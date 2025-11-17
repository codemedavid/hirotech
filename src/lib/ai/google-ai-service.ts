import OpenAI from 'openai';
import apiKeyManager from './api-key-manager';

// Store current key for tracking purposes
let currentKey: string | null = null;

const RATE_LIMIT_RETRY_DELAY_MS = 6000; // 6 seconds between retries
const MAX_ATTEMPTS_PER_KEY = 3;

const PRIMARY_MODEL = 'google/gemini-2.0-flash-exp:free';
const FALLBACK_MODELS = [
  'openai/gpt-oss-20b:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'deepseek/deepseek-chat-v3.1:free',
];

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to create OpenAI client configured for OpenRouter
function createOpenRouterClient(apiKey: string): OpenAI {
  const siteUrl = process.env.OPENROUTER_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://hiro.app';
  const siteName = process.env.OPENROUTER_SITE_NAME || 'Hiro';
  
  console.log(`[OpenRouter] Creating client with baseURL: https://openrouter.ai/api/v1`);
  console.log(`[OpenRouter] Headers - HTTP-Referer: ${siteUrl}, X-Title: ${siteName}`);
  console.log(`[OpenRouter] API Key length: ${apiKey.length}, starts with: ${apiKey.substring(0, 8)}...`);
  
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: apiKey,
    defaultHeaders: {
      'HTTP-Referer': siteUrl,
      'X-Title': siteName,
    },
  });
}

export async function analyzeConversation(
  messages: Array<{
    from: string;
    text: string;
    timestamp?: Date;
  }>,
  retries = 2
): Promise<string | null> {
  const apiKey = await apiKeyManager.getNextKey();
  if (!apiKey) {
    console.error('[OpenRouter] No API key available');
    return null;
  }

  return analyzeConversationWithKey(apiKey, messages, retries, 0);
}

async function analyzeConversationWithKey(
  apiKey: string,
  messages: Array<{
    from: string;
    text: string;
    timestamp?: Date;
  }>,
  retries: number,
  keyAttempts: number
): Promise<string | null> {
  currentKey = apiKey;

  try {
    const openai = createOpenRouterClient(apiKey);

    // Format conversation for AI
    const conversationText = messages
      .map(msg => `${msg.from}: ${msg.text}`)
      .join('\n');

    const prompt = `Analyze this conversation and provide a concise 3-5 sentence summary covering:
- The main topic or purpose of the conversation
- Key points discussed
- Customer intent or needs
- Any action items or requests

Conversation:
${conversationText}

Summary:`;

    const modelsToTry = [PRIMARY_MODEL, ...FALLBACK_MODELS];
    let lastRateLimitError: Error | null = null;
    let completion;

    for (const model of modelsToTry) {
      try {
        console.log(
          `[OpenRouter] Sending request - Model: ${model}, Messages: ${messages.length}`
        );

        completion = await openai.chat.completions.create({
          model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        console.log(
          `[OpenRouter] Received response - Model: ${model}, Choices: ${
            completion.choices?.length || 0
          }, Usage: ${JSON.stringify(completion.usage || {})}`
        );
        lastRateLimitError = null;
        break;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (
          errorMessage?.includes('429') ||
          errorMessage?.includes('quota') ||
          errorMessage?.includes('rate limit')
        ) {
          console.warn(
            `[OpenRouter] Model ${model} hit rate limit, trying next fallback model...`
          );
          lastRateLimitError =
            error instanceof Error ? error : new Error(String(error));
          continue;
        }

        // Non rate-limit error – rethrow and let outer handler manage it
        throw error;
      }
    }

    if (!completion) {
      if (lastRateLimitError) {
        throw lastRateLimitError;
      }
      throw new Error('[OpenRouter] All models failed without a usable response');
    }

    console.log(`[OpenRouter] Received response - Choices: ${completion.choices?.length || 0}, Usage: ${JSON.stringify(completion.usage || {})}`);

    const summary = completion.choices[0]?.message?.content;
    if (!summary) {
      console.error('[OpenRouter] No response content received. Full response:', JSON.stringify(completion, null, 2));
      return null;
    }
    
    console.log(`[OpenRouter] ✅ Generated summary (${summary.length} chars)`);
    
    // Record success
    if (currentKey) {
      await apiKeyManager.recordSuccess(currentKey);
    }
    
    return summary.trim();
  } catch (error: unknown) {
    // Enhanced error logging
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
    } : { raw: String(error) };
    
    console.error('[OpenRouter] ❌ Analysis failed:', errorMessage);
    console.error('[OpenRouter] Error details:', JSON.stringify(errorDetails, null, 2));
    
    // Check if it's a rate limit error (429)
    if (errorMessage?.includes('429') || errorMessage?.includes('quota') || errorMessage?.includes('rate limit')) {
      const attemptNumber = keyAttempts + 1;
      if (attemptNumber < MAX_ATTEMPTS_PER_KEY) {
        console.warn(
          `[OpenRouter] Rate limit hit for current key, retrying same key (attempt ${attemptNumber + 1}/${MAX_ATTEMPTS_PER_KEY}) after ${RATE_LIMIT_RETRY_DELAY_MS}ms...`
        );
        await sleep(RATE_LIMIT_RETRY_DELAY_MS);
        return analyzeConversationWithKey(apiKey, messages, retries, keyAttempts + 1);
      }

      console.warn(
        '[OpenRouter] Rate limit persists after multiple attempts, marking key as rate-limited and rotating...'
      );
      
      // Mark key as rate-limited
      if (currentKey) {
        await apiKeyManager.markRateLimited(currentKey);
      }
      
      // Try with next API key if we have retries left
      if (retries > 0) {
        await sleep(RATE_LIMIT_RETRY_DELAY_MS);
        return analyzeConversation(messages, retries - 1);
      }
      
      console.error('[OpenRouter] All API keys rate limited');
      return null;
    }
    
    // Record failure for non-rate-limit errors
    if (currentKey) {
      await apiKeyManager.recordFailure(currentKey);
    }
    
    // Check for 401 authentication errors
    if (errorMessage?.includes('401') || errorMessage?.includes('No auth') || errorMessage?.includes('Unauthorized')) {
      console.error('[OpenRouter] 🔐 Authentication failed - Check API key format and validity');
      console.error('[OpenRouter] API key should start with "sk-or-v1-" for OpenRouter');
      return null;
    }
    
    return null;
  }
}

export async function getAvailableKeyCount(): Promise<number> {
  return await apiKeyManager.getKeyCount();
}

// Generate follow-up message for AI automation
export interface AIFollowUpResult {
  message: string;
  reasoning: string;
}

export async function generateFollowUpMessage(
  contactName: string,
  conversationHistory: Array<{ from: string; text: string; timestamp?: Date }>,
  customPrompt?: string | null,
  languageStyle?: string | null,
  retries = 2
): Promise<AIFollowUpResult | null> {
  const apiKey = await apiKeyManager.getNextKey();
  if (!apiKey) {
    console.error('[OpenRouter] No API key available');
    return null;
  }

  return generateFollowUpWithKey(
    apiKey,
    contactName,
    conversationHistory,
    customPrompt,
    languageStyle,
    retries,
    0
  );
}

async function generateFollowUpWithKey(
  apiKey: string,
  contactName: string,
  conversationHistory: Array<{ from: string; text: string; timestamp?: Date }>,
  customPrompt: string | null | undefined,
  languageStyle: string | null | undefined,
  retries: number,
  keyAttempts: number
): Promise<AIFollowUpResult | null> {
  currentKey = apiKey;

  try {
    const openai = createOpenRouterClient(apiKey);

    // Format conversation history
    const historyText = conversationHistory
      .map(msg => `${msg.from}: ${msg.text}`)
      .join('\n');

    // Build prompt based on custom instructions and language style
    const styleInstruction = languageStyle 
      ? `\n\nLanguage Style: ${languageStyle}`
      : '\n\nUse a friendly, professional tone that feels natural and conversational.';

    const customInstruction = customPrompt
      ? `\n\nCustom Instructions: ${customPrompt}`
      : '';

    const prompt = `You are a helpful business assistant generating a follow-up message for a customer named ${contactName}.

Previous Conversation:
${historyText}
${styleInstruction}${customInstruction}

Generate a natural, engaging follow-up message that:
1. References the previous conversation context
2. Provides value or continues the conversation naturally
3. Encourages further engagement
4. Feels personalized and human (not robotic)
5. Is concise (2-4 sentences)

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "message": "the follow-up message text here",
  "reasoning": "brief explanation of why this message was chosen"
}`;

    const completion = await openai.chat.completions.create({
      model: 'google/gemini-2.0-flash-exp:free',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      console.error('[OpenRouter] No response content received');
      return null;
    }
    
    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[OpenRouter] No JSON found in response');
      return null;
    }
    
    const followUp = JSON.parse(jsonMatch[0]) as AIFollowUpResult;
    console.log(
      `[OpenRouter] Generated follow-up message for ${contactName}: "${followUp.message}"`
    );
    
    // Record success
    if (currentKey) {
      await apiKeyManager.recordSuccess(currentKey);
    }
    
    return followUp;
  } catch (error: unknown) {
    // Check if it's a rate limit error (429)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage?.includes('429') ||
      errorMessage?.includes('quota') ||
      errorMessage?.includes('rate limit')
    ) {
      const attemptNumber = keyAttempts + 1;
      if (attemptNumber < MAX_ATTEMPTS_PER_KEY) {
        console.warn(
          `[OpenRouter] Rate limit hit for current key (follow-up), retrying same key (attempt ${
            attemptNumber + 1
          }/${MAX_ATTEMPTS_PER_KEY}) after ${RATE_LIMIT_RETRY_DELAY_MS}ms...`
        );
        await sleep(RATE_LIMIT_RETRY_DELAY_MS);
        return generateFollowUpWithKey(
          apiKey,
          contactName,
          conversationHistory,
          customPrompt,
          languageStyle,
          retries,
          keyAttempts + 1
        );
      }

      console.warn(
        '[OpenRouter] Rate limit persists for follow-up after multiple attempts, marking key and rotating...'
      );
      
      // Mark key as rate-limited
      if (currentKey) {
        await apiKeyManager.markRateLimited(currentKey);
      }
      
      // Try with next API key if we have retries left
      if (retries > 0) {
        await sleep(RATE_LIMIT_RETRY_DELAY_MS);
        return generateFollowUpMessage(
          contactName,
          conversationHistory,
          customPrompt,
          languageStyle,
          retries - 1
        );
      }
      
      console.error('[OpenRouter] All API keys rate limited');
      return null;
    }
    
    // Record failure
    if (currentKey) {
      await apiKeyManager.recordFailure(currentKey);
    }
    
    console.error('[OpenRouter] Follow-up generation failed:', errorMessage);
    return null;
  }
}

// Structured analysis for pipeline stage recommendation
export interface AIContactAnalysis {
  summary: string;              // Existing 3-5 sentence summary
  recommendedStage: string;     // Stage name recommendation
  leadScore: number;            // 0-100
  leadStatus: string;           // NEW, CONTACTED, QUALIFIED, etc.
  confidence: number;           // 0-100 confidence score
  reasoning: string;            // Why this stage was chosen
}

export async function analyzeConversationWithStageRecommendation(
  messages: Array<{ from: string; text: string; timestamp?: Date }>,
  pipelineStages: Array<{ 
    name: string; 
    type: string; 
    description?: string | null;
    leadScoreMin?: number;
    leadScoreMax?: number;
  }>,
  retries = 2
): Promise<AIContactAnalysis | null> {
  const apiKey = await apiKeyManager.getNextKey();
  if (!apiKey) {
    console.error('[OpenRouter] No API key available');
    return null;
  }

  return analyzeConversationWithStageAndKey(
    apiKey,
    messages,
    pipelineStages,
    retries,
    0
  );
}

async function analyzeConversationWithStageAndKey(
  apiKey: string,
  messages: Array<{ from: string; text: string; timestamp?: Date }>,
  pipelineStages: Array<{ 
    name: string; 
    type: string; 
    description?: string | null;
    leadScoreMin?: number;
    leadScoreMax?: number;
  }>,
  retries: number,
  keyAttempts: number
): Promise<AIContactAnalysis | null> {
  currentKey = apiKey;

  try {
    const openai = createOpenRouterClient(apiKey);

    const conversationText = messages
      .map(msg => `${msg.from}: ${msg.text}`)
      .join('\n');

    // Enhanced stage descriptions with lead score ranges
    const stageDescriptions = pipelineStages
      .map((s, i) => {
        let desc = `${i + 1}. ${s.name} (${s.type})`;
        
        // Add score range if available
        if (s.leadScoreMin !== undefined && s.leadScoreMax !== undefined) {
          desc += ` [Score: ${s.leadScoreMin}-${s.leadScoreMax}]`;
        }
        
        // Add description if available
        if (s.description) {
          desc += `: ${s.description}`;
        }
        
        return desc;
      })
      .join('\n');

    const prompt = `Analyze this customer conversation and intelligently assign them to the most appropriate sales/support stage.

Available Pipeline Stages:
${stageDescriptions}

Conversation:
${conversationText}

Analyze the conversation and determine:
1. Which stage best fits this contact's current position in the customer journey
2. Their engagement level and intent (lead score 0-100)
   - Use the stage score ranges as guides for appropriate scoring
   - Score should reflect: conversation maturity, customer intent, engagement level, and commitment signals
3. Their status (NEW, CONTACTED, QUALIFIED, PROPOSAL_SENT, NEGOTIATING, WON, LOST, UNRESPONSIVE)
   - If the conversation indicates a CLOSED deal → status: WON
   - If the conversation indicates LOST opportunity → status: LOST
4. Your confidence in this assessment (0-100)

Scoring Guidelines:
- 0-30: Cold leads, initial contact, minimal engagement, just browsing
- 31-60: Warm leads, asking questions, showing interest, early qualification
- 61-80: Hot leads, high engagement, discussing specifics, budget/timeline mentioned
- 81-100: Ready to close, strong commitment signals, final negotiations, deal imminent

Consider:
- Conversation maturity (new inquiry vs ongoing discussion)
- Customer intent (browsing vs ready to buy)
- Engagement level (responsive vs unresponsive)
- Specific requests or commitments made (pricing, timeline, contracts)
- Timeline and urgency indicators
- Buying signals (budget discussed, decision maker involved, timeline set)

IMPORTANT:
- If customer has AGREED TO BUY, CLOSED THE DEAL, or SIGNED: leadStatus MUST be "WON" (score 85-100)
- If customer has REJECTED, DECLINED, or SAID NO: leadStatus MUST be "LOST" (score 0-20)
- Match your lead score to the appropriate stage's score range when possible

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "summary": "3-5 sentence summary of conversation",
  "recommendedStage": "exact stage name from list above",
  "leadScore": 0-100,
  "leadStatus": "NEW|CONTACTED|QUALIFIED|PROPOSAL_SENT|NEGOTIATING|WON|LOST|UNRESPONSIVE",
  "confidence": 0-100,
  "reasoning": "brief explanation of stage choice and score"
}`;

    const modelsToTry = [PRIMARY_MODEL, ...FALLBACK_MODELS];
    let lastRateLimitError: Error | null = null;
    let completion;

    for (const model of modelsToTry) {
      try {
        console.log(
          `[OpenRouter] Sending stage recommendation request - Model: ${model}, Stages: ${pipelineStages.length}`
        );
    
        completion = await openai.chat.completions.create({
          model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        console.log(
          `[OpenRouter] Received response - Model: ${model}, Choices: ${
            completion.choices?.length || 0
          }, Usage: ${JSON.stringify(completion.usage || {})}`
        );
        lastRateLimitError = null;
        break;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (
          errorMessage?.includes('429') ||
          errorMessage?.includes('quota') ||
          errorMessage?.includes('rate limit')
        ) {
          console.warn(
            `[OpenRouter] Model ${model} hit rate limit (stage recommendation), trying next fallback model...`
          );
          lastRateLimitError =
            error instanceof Error ? error : new Error(String(error));
          continue;
        }

        // Non rate-limit error – rethrow and let outer handler manage it
        throw error;
      }
    }

    if (!completion) {
      if (lastRateLimitError) {
        throw lastRateLimitError;
      }
      throw new Error(
        '[OpenRouter] All models failed for stage recommendation without a usable response'
      );
    }

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      console.error('[OpenRouter] No response content received. Full response:', JSON.stringify(completion, null, 2));
      return null;
    }
    
    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[OpenRouter] No JSON found in response. Raw text:', text.substring(0, 200));
      return null;
    }
    
    const analysis = JSON.parse(jsonMatch[0]) as AIContactAnalysis;
    console.log(`[OpenRouter] ✅ Stage recommendation: ${analysis.recommendedStage} (confidence: ${analysis.confidence}%, score: ${analysis.leadScore})`);
    
    // Record success
    if (currentKey) {
      await apiKeyManager.recordSuccess(currentKey);
    }
    
    return analysis;
  } catch (error: unknown) {
    // Enhanced error logging
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
    } : { raw: String(error) };
    
    console.error('[OpenRouter] ❌ Stage recommendation failed:', errorMessage);
    console.error('[OpenRouter] Error details:', JSON.stringify(errorDetails, null, 2));
    
    // Check if it's a rate limit error (429)
    if (errorMessage?.includes('429') || errorMessage?.includes('quota') || errorMessage?.includes('rate limit')) {
      const attemptNumber = keyAttempts + 1;
      if (attemptNumber < MAX_ATTEMPTS_PER_KEY) {
        console.warn(
          `[OpenRouter] Rate limit hit for current key (stage recommendation), retrying same key (attempt ${attemptNumber + 1}/${MAX_ATTEMPTS_PER_KEY}) after ${RATE_LIMIT_RETRY_DELAY_MS}ms...`
        );
        await sleep(RATE_LIMIT_RETRY_DELAY_MS);
        return analyzeConversationWithStageAndKey(
          apiKey,
          messages,
          pipelineStages,
          retries,
          keyAttempts + 1
        );
      }

      console.warn(
        '[OpenRouter] Rate limit persists for stage recommendation after multiple attempts, marking key and rotating...'
      );
      
      // Mark key as rate-limited
      if (currentKey) {
        await apiKeyManager.markRateLimited(currentKey);
      }
      
      // Try with next API key if we have retries left
      if (retries > 0) {
        await sleep(RATE_LIMIT_RETRY_DELAY_MS);
        return analyzeConversationWithStageRecommendation(messages, pipelineStages, retries - 1);
      }
      
      console.error('[OpenRouter] All API keys rate limited');
      return null;
    }
    
    // Record failure for non-rate-limit errors
    if (currentKey) {
      await apiKeyManager.recordFailure(currentKey);
    }
    
    // Check for 401 authentication errors
    if (errorMessage?.includes('401') || errorMessage?.includes('No auth') || errorMessage?.includes('Unauthorized')) {
      console.error('[OpenRouter] 🔐 Authentication failed - Check API key format and validity');
      console.error('[OpenRouter] API key should start with "sk-or-v1-" for OpenRouter');
      return null;
    }
    
    return null;
  }
}

// Generate personalized campaign message
export interface PersonalizedMessageContext {
  contactName: string;
  conversationHistory: Array<{ from: string; message: string; timestamp: string }>;
  templateMessage: string;
  customInstructions?: string;
}

export class GoogleAIService {
  private currentKey: string | null = null;

  async generatePersonalizedMessage(
    context: PersonalizedMessageContext,
    retries = 2
  ): Promise<string> {
    const apiKey = await apiKeyManager.getNextKey();
    if (!apiKey) {
      console.error('[OpenRouter] No API key available');
      // Fallback to template
      return context.templateMessage
        .replace(/\{firstName\}/g, context.contactName)
        .replace(/\{name\}/g, context.contactName);
    }

    this.currentKey = apiKey;

    try {
      const openai = createOpenRouterClient(apiKey);

      const historyText = context.conversationHistory.length > 0
        ? context.conversationHistory
            .map((msg) => `${msg.from}: ${msg.message}`)
            .join('\n')
        : 'No previous conversation';

      const customInstructions = context.customInstructions
        ? `\n\nCustom Instructions: ${context.customInstructions}`
        : '';

      const prompt = `Generate a personalized follow-up message for ${context.contactName}.

Template Message: ${context.templateMessage}

Previous Conversation History:
${historyText}${customInstructions}

Create a natural, personalized version of the template message that:
1. References specific points from the conversation history (if available)
2. Feels personal and tailored to ${context.contactName}
3. Maintains the intent and key information from the template
4. Uses a conversational, friendly tone
5. Is concise and engaging (2-4 sentences)

Respond with ONLY the personalized message text (no JSON, no markdown, no explanation).`;

      const completion = await openai.chat.completions.create({
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const personalizedMessage = completion.choices[0]?.message?.content?.trim();
      if (!personalizedMessage) {
        console.error('[OpenRouter] No response content received');
        // Fallback to template
        return context.templateMessage
          .replace(/\{firstName\}/g, context.contactName)
          .replace(/\{name\}/g, context.contactName);
      }

      console.log(`[OpenRouter] Generated personalized message for ${context.contactName}`);
      
      // Record success
      if (this.currentKey) {
        await apiKeyManager.recordSuccess(this.currentKey);
      }
      
      return personalizedMessage;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage?.includes('429') || errorMessage?.includes('quota') || errorMessage?.includes('rate limit')) {
        console.warn(
          `[OpenRouter] Rate limit hit for current key (personalization), marking key and rotating after ${RATE_LIMIT_RETRY_DELAY_MS}ms...`
        );

        // Mark key as rate-limited
        if (this.currentKey) {
          await apiKeyManager.markRateLimited(this.currentKey);
        }

        if (retries > 0) {
          await sleep(RATE_LIMIT_RETRY_DELAY_MS);
          return this.generatePersonalizedMessage(context, retries - 1);
        }

        console.error('[OpenRouter] All API keys rate limited');
      } else {
        // Record failure
        if (this.currentKey) {
          await apiKeyManager.recordFailure(this.currentKey);
        }
        console.error('[OpenRouter] Personalization failed:', errorMessage);
      }

      // Fallback to template
      return context.templateMessage
        .replace(/\{firstName\}/g, context.contactName)
        .replace(/\{name\}/g, context.contactName);
    }
  }
}
