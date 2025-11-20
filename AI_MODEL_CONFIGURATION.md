# AI Model Configuration Guide

## Overview

The conversation analysis system now supports configurable AI models via environment variables. You can easily switch between different models without modifying code.

## Current Configuration

### Default Models (if not configured)
- **Primary**: `google/gemini-2.0-flash-exp:free`
- **Fallbacks**: 
  - `openai/gpt-oss-20b:free`
  - `mistralai/mistral-small-3.1-24b-instruct:free`
  - `deepseek/deepseek-chat-v3.1:free`

## Environment Variables

Add these to your `.env.local` file to configure models:

```env
# Primary model for conversation analysis
AI_PRIMARY_MODEL=google/gemini-2.0-flash-exp:free

# Fallback models (comma-separated, tried in order)
AI_FALLBACK_MODELS=openai/gpt-oss-20b:free,mistralai/mistral-small-3.1-24b-instruct:free,deepseek/deepseek-chat-v3.1:free
```

## Available Models on OpenRouter

### Free Tier Models

#### Google Models
- `google/gemini-2.0-flash-exp:free` - Latest Gemini Flash (experimental)
- `google/gemini-flash-1.5-8b:free` - Gemini Flash 8B
- `google/gemini-pro-1.5:free` - Gemini Pro 1.5

#### OpenAI Models
- `openai/gpt-oss-20b:free` - OpenAI OSS 20B
- `openai/gpt-3.5-turbo:free` - GPT-3.5 Turbo (if available)

#### Mistral Models
- `mistralai/mistral-small-3.1-24b-instruct:free` - Mistral Small 3.1
- `mistralai/mistral-tiny:free` - Mistral Tiny

#### DeepSeek Models
- `deepseek/deepseek-chat-v3.1:free` - DeepSeek Chat v3.1
- `deepseek/deepseek-chat:free` - DeepSeek Chat

#### Other Free Models
- `meta-llama/llama-3.2-3b-instruct:free` - Llama 3.2 3B
- `qwen/qwen-2.5-7b-instruct:free` - Qwen 2.5 7B

### Paid Tier Models (Require OpenRouter credits)

#### High-Performance Models
- `openai/gpt-4o` - GPT-4 Omni (best quality)
- `openai/gpt-4-turbo` - GPT-4 Turbo
- `openai/gpt-4` - GPT-4
- `anthropic/claude-3.5-sonnet` - Claude 3.5 Sonnet
- `anthropic/claude-3-opus` - Claude 3 Opus
- `google/gemini-pro-1.5` - Gemini Pro 1.5 (paid)
- `meta-llama/llama-3.1-405b-instruct` - Llama 3.1 405B

#### Cost-Effective Options
- `openai/gpt-3.5-turbo` - GPT-3.5 Turbo (cheap, fast)
- `anthropic/claude-3-haiku` - Claude 3 Haiku (cheap, fast)
- `google/gemini-flash-1.5` - Gemini Flash 1.5 (cheap, fast)

## Example Configurations

### 1. Use GPT-4 for Better Quality (Paid)
```env
AI_PRIMARY_MODEL=openai/gpt-4o
AI_FALLBACK_MODELS=openai/gpt-4-turbo,openai/gpt-3.5-turbo
```

### 2. Use Claude for Analysis (Paid)
```env
AI_PRIMARY_MODEL=anthropic/claude-3.5-sonnet
AI_FALLBACK_MODELS=anthropic/claude-3-haiku,openai/gpt-3.5-turbo
```

### 3. Use Free Models Only
```env
AI_PRIMARY_MODEL=google/gemini-pro-1.5:free
AI_FALLBACK_MODELS=deepseek/deepseek-chat-v3.1:free,mistralai/mistral-small-3.1-24b-instruct:free
```

### 4. Use Llama for Open Source
```env
AI_PRIMARY_MODEL=meta-llama/llama-3.2-3b-instruct:free
AI_FALLBACK_MODELS=deepseek/deepseek-chat-v3.1:free,openai/gpt-oss-20b:free
```

### 5. Cost-Effective Paid Setup
```env
AI_PRIMARY_MODEL=openai/gpt-3.5-turbo
AI_FALLBACK_MODELS=anthropic/claude-3-haiku,google/gemini-flash-1.5
```

## Model Selection Guide

### For Conversation Analysis
- **Best Quality**: `openai/gpt-4o` or `anthropic/claude-3.5-sonnet`
- **Good Balance**: `openai/gpt-4-turbo` or `google/gemini-pro-1.5`
- **Cost-Effective**: `openai/gpt-3.5-turbo` or `anthropic/claude-3-haiku`
- **Free Option**: `google/gemini-2.0-flash-exp:free` (current default)

### For Stage Recommendation (Complex Analysis)
- **Recommended**: `openai/gpt-4o` or `anthropic/claude-3.5-sonnet` (better JSON parsing)
- **Alternative**: `openai/gpt-4-turbo` or `google/gemini-pro-1.5`
- **Free**: `google/gemini-2.0-flash-exp:free` (works but may have parsing issues)

## How It Works

1. **Primary Model**: Always tried first for every request
2. **Fallback Chain**: If primary fails (rate limit, error), tries fallbacks in order
3. **Automatic Retry**: On rate limits, retries same model up to 3 times
4. **Key Rotation**: If all models fail, rotates to next API key and retries

## Testing Your Configuration

After updating `.env.local`:

1. **Restart your Next.js dev server** (required for env var changes)
2. Check server logs for model configuration:
   ```
   [OpenRouter] Model Configuration:
     Primary: your-primary-model
     Fallbacks: fallback1, fallback2, fallback3
   ```
3. Test with a conversation analysis request
4. Monitor logs for which models are being used

## Troubleshooting

### Model Not Found Error
- Verify the model name is correct (check OpenRouter model list)
- Ensure model is available for your API key tier (free vs paid)

### Rate Limit Issues
- Free tier models have strict rate limits (~15 req/min)
- Consider using paid tier models for production
- Add more API keys for rotation

### Authentication Error (401)
- Verify your OpenRouter API keys are valid
- Keys must start with `sk-or-v1-`
- Check keys in OpenRouter dashboard

### Poor Quality Results
- Try a more powerful model (GPT-4, Claude 3.5)
- Adjust temperature/prompt if needed (requires code changes)
- Check model documentation for best practices

## Finding Available Models

Visit OpenRouter's model list:
- Website: https://openrouter.ai/models
- API: `GET https://openrouter.ai/api/v1/models`

## Cost Considerations

### Free Tier
- Limited rate limits (~15 req/min per key)
- May have quality limitations
- Good for development/testing

### Paid Tier
- Higher rate limits
- Better quality models
- Pay per token usage
- Recommended for production

Check OpenRouter pricing: https://openrouter.ai/docs/pricing

