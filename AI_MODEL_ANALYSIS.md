# AI Model & Algorithm Analysis

## Current Implementation Overview

### Architecture
- **Service Provider**: OpenRouter API (via OpenAI SDK)
- **Primary Service File**: `src/lib/ai/google-ai-service.ts`
- **Secondary Service File**: `src/lib/ai/openai-service.ts` (fallback, uses direct OpenAI API)

### Current AI Models

#### Primary Model
- **Model**: `google/gemini-2.0-flash-exp:free`
- **Provider**: Google (via OpenRouter)
- **Tier**: Free
- **Used For**: All conversation analysis tasks

#### Fallback Models (in order)
1. `openai/gpt-oss-20b:free` - OpenAI OSS model (free tier)
2. `mistralai/mistral-small-3.1-24b-instruct:free` - Mistral AI (free tier)
3. `deepseek/deepseek-chat-v3.1:free` - DeepSeek (free tier)

### Current Algorithm Flow

#### 1. Conversation Analysis (`analyzeConversation`)
```
1. Get API key from rotation manager
2. Create OpenRouter client
3. Format conversation messages
4. Build analysis prompt (3-5 sentence summary)
5. Try models in order: PRIMARY → FALLBACK_1 → FALLBACK_2 → FALLBACK_3
6. Handle rate limits (429) with retries
7. Handle auth errors (401) with key rotation
8. Return summary or null
```

#### 2. Stage Recommendation Analysis (`analyzeConversationWithStageRecommendation`)
```
1. Get API key from rotation manager
2. Create OpenRouter client
3. Format conversation + pipeline stages
4. Build complex prompt with:
   - Stage descriptions
   - Lead scoring guidelines
   - Status determination rules
5. Try models in order (same as above)
6. Parse JSON response
7. Return structured analysis:
   - summary
   - recommendedStage
   - leadScore (0-100)
   - leadStatus
   - confidence (0-100)
   - reasoning
```

### API Key Management

- **Rotation System**: Up to 17 API keys (`GOOGLE_AI_API_KEY` through `GOOGLE_AI_API_KEY_17`)
- **Key Manager**: `src/lib/ai/api-key-manager.ts`
- **Features**:
  - Automatic rotation on rate limits
  - Invalid key detection and marking
  - Success/failure tracking
  - Rate limit tracking

### Error Handling

#### Rate Limit (429)
- Retry same key up to 3 times with 6-second delays
- Mark key as rate-limited after max attempts
- Rotate to next key automatically
- Try all fallback models before giving up

#### Authentication Error (401)
- Mark key as invalid immediately
- Rotate to next key
- Log detailed error information

#### Other Errors
- Record failure for tracking
- Return null gracefully

### Current Issues

1. **401 "User not found" Error**
   - Indicates invalid or expired OpenRouter API key
   - Keys must start with `sk-or-v1-`
   - Solution: Verify keys in OpenRouter dashboard

2. **Hardcoded Models**
   - Models are hardcoded in the service file
   - Cannot be changed without code modification
   - Solution: Make configurable via environment variables

3. **Free Tier Limitations**
   - All models use free tier (rate limits apply)
   - May hit quota limits frequently
   - Solution: Support paid tier models via config

### Usage Points

The `analyzeConversation` function is called from:
1. `src/lib/facebook/sync-contacts.ts` - During contact sync
2. `src/lib/facebook/pipeline-analyzer.ts` - Pipeline analysis jobs
3. `src/lib/facebook/analyze-selected-contacts.ts` - Bulk analysis
4. `src/lib/ai/analyze-existing-contacts.ts` - Retroactive analysis

### Performance Characteristics

- **Retry Logic**: Up to 2 retries with key rotation
- **Rate Limit Delay**: 6 seconds between retries
- **Model Fallback**: Automatic fallback chain
- **Concurrency**: Limited by rate limits (free tier ~15 req/min)

### Recommendations

1. **Make Models Configurable**
   - Add environment variables for primary and fallback models
   - Allow per-function model selection
   - Support both free and paid tier models

2. **Improve Error Messages**
   - More specific error messages for 401 errors
   - Better guidance on key format requirements

3. **Add Model Performance Tracking**
   - Track which models work best
   - Log model selection decisions
   - Monitor success rates per model

4. **Support Multiple Providers**
   - Keep OpenRouter as primary
   - Add direct OpenAI API as fallback
   - Support Anthropic Claude via OpenRouter

