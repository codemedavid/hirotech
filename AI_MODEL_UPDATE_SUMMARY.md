# AI Model Configuration Update Summary

## What Changed

### 1. Made Models Configurable
- **File**: `src/lib/ai/google-ai-service.ts`
- **Change**: Models are now configurable via environment variables
- **Backward Compatible**: Defaults to current models if env vars not set

### 2. Added Configuration Support
- `AI_PRIMARY_MODEL` - Sets the primary model for all analysis
- `AI_FALLBACK_MODELS` - Comma-separated list of fallback models

### 3. Created Documentation
- `AI_MODEL_ANALYSIS.md` - Complete analysis of current AI setup
- `AI_MODEL_CONFIGURATION.md` - Guide for configuring models
- `AI_MODEL_UPDATE_SUMMARY.md` - This file

## Current System Analysis

### Architecture
- **Provider**: OpenRouter API (via OpenAI SDK)
- **Service**: `src/lib/ai/google-ai-service.ts`
- **Key Management**: Rotates up to 17 API keys
- **Error Handling**: Automatic retries, fallbacks, key rotation

### Current Models (Default)
- **Primary**: `google/gemini-2.0-flash-exp:free`
- **Fallbacks**: 
  - `openai/gpt-oss-20b:free`
  - `mistralai/mistral-small-3.1-24b-instruct:free`
  - `deepseek/deepseek-chat-v3.1:free`

### Current Issue
- **Error**: "401 User not found" from OpenRouter
- **Cause**: Invalid or expired API key
- **Solution**: Verify OpenRouter API keys start with `sk-or-v1-`

## How to Change Models

### Quick Start

1. **Edit `.env.local`**:
```env
# Use GPT-4 for better quality (paid)
AI_PRIMARY_MODEL=openai/gpt-4o
AI_FALLBACK_MODELS=openai/gpt-4-turbo,openai/gpt-3.5-turbo
```

2. **Restart Next.js server**:
```bash
# Stop current server (Ctrl+C)
npm run dev
```

3. **Check logs** for confirmation:
```
[OpenRouter] Model Configuration:
  Primary: openai/gpt-4o
  Fallbacks: openai/gpt-4-turbo, openai/gpt-3.5-turbo
```

### Popular Model Options

#### Free Tier (Current)
```env
AI_PRIMARY_MODEL=google/gemini-2.0-flash-exp:free
AI_FALLBACK_MODELS=deepseek/deepseek-chat-v3.1:free,mistralai/mistral-small-3.1-24b-instruct:free
```

#### Best Quality (Paid)
```env
AI_PRIMARY_MODEL=openai/gpt-4o
AI_FALLBACK_MODELS=anthropic/claude-3.5-sonnet,openai/gpt-4-turbo
```

#### Cost-Effective (Paid)
```env
AI_PRIMARY_MODEL=openai/gpt-3.5-turbo
AI_FALLBACK_MODELS=anthropic/claude-3-haiku,google/gemini-flash-1.5
```

## Algorithm Flow

### Conversation Analysis
1. Get API key from rotation manager
2. Create OpenRouter client
3. Format conversation messages
4. Build analysis prompt
5. Try models: PRIMARY → FALLBACK_1 → FALLBACK_2 → FALLBACK_3
6. Handle errors (rate limits, auth failures)
7. Return summary or null

### Stage Recommendation Analysis
1. Same as above, but with complex prompt
2. Includes pipeline stage descriptions
3. Returns structured JSON with:
   - summary
   - recommendedStage
   - leadScore (0-100)
   - leadStatus
   - confidence (0-100)
   - reasoning

## Error Handling

### Rate Limits (429)
- Retry same key up to 3 times (6-second delays)
- Mark key as rate-limited
- Rotate to next key
- Try all fallback models

### Authentication (401)
- Mark key as invalid
- Rotate to next key immediately
- Log detailed error

### Other Errors
- Record failure for tracking
- Return null gracefully

## Testing

After changing models:

1. **Restart server** (required)
2. **Check startup logs** for model config
3. **Test analysis** with a conversation
4. **Monitor logs** for model usage
5. **Check for errors** in console

## Next Steps

1. **Fix 401 Error**: Verify OpenRouter API keys
2. **Choose Model**: Based on quality vs cost needs
3. **Update Config**: Add env vars to `.env.local`
4. **Test**: Restart and verify model selection
5. **Monitor**: Watch logs for model performance

## Files Modified

- ✅ `src/lib/ai/google-ai-service.ts` - Made models configurable
- ✅ `AI_MODEL_ANALYSIS.md` - Complete system analysis
- ✅ `AI_MODEL_CONFIGURATION.md` - Configuration guide
- ✅ `AI_MODEL_UPDATE_SUMMARY.md` - This summary

## Support

For more information:
- See `AI_MODEL_CONFIGURATION.md` for detailed model options
- See `AI_MODEL_ANALYSIS.md` for system architecture
- Check OpenRouter docs: https://openrouter.ai/docs

