# Token System Documentation

## Overview

The Purplexity token system tracks and limits daily usage for each user. Tokens are calculated based on the content processed in each request (query + web results + AI response).

## Token Calculation Rules

```
1 token ≈ 4 English characters
100 tokens ≈ 75 words
```

### Calculation Method

The system uses a dual-method approach for accuracy:
1. **Character-based**: `tokens = Math.ceil(text.length / 4)`
2. **Word-based**: `tokens = Math.ceil((wordCount * 100) / 75)`
3. **Final**: Average of both methods

### Example Calculations

| Text | Characters | Words | Tokens |
|------|------------|-------|--------|
| "Hello world" | 11 | 2 | ~3 |
| "What is Rust?" | 13 | 3 | ~4 |
| 300-char paragraph | 300 | ~75 | ~75-100 |
| Full conversation | 2000 | ~500 | ~500-650 |

## Default Limits

- **Free tier**: 10,000 tokens/day
- **Pro tier** (future): 50,000 tokens/day
- **Enterprise** (future): Unlimited

## Database Schema

### Users Table Addition
```prisma
dailyTokenLimit Int @default(10000)
```

### Token Usage Table
```prisma
model TokenUsage {
  id           String   @id @default(uuid())
  userId       String
  date         DateTime @db.Date
  tokensUsed   Int
  requestCount Int
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  @@unique([userId, date])
}
```

## API Integration

### Protected Endpoints

All query endpoints now require `userId` and check token limits:

1. **POST /purplexity_ask**
2. **POST /conversations/:id/messages**

### Middleware Flow

```
Request → checkTokenLimit middleware → Verify tokens available → Process request
                                     ↓ (if limit exceeded)
                              Return 429 error
```

### Response Format

#### Legacy Endpoint
```xml
<ANSWER>Your answer here</ANSWER>
<FOLLOW UP>Question 1; Question 2</FOLLOW UP>
<TOKENS>9500 tokens remaining today</TOKENS>
```

#### Modern Endpoint
```json
{
  "userMessage": {...},
  "assistantMessage": {...},
  "sources": [...],
  "followUps": [...],
  "tokenUsage": {
    "tokensUsed": 250,
    "tokensRemaining": 9750,
    "dailyLimit": 10000,
    "requestCount": 5
  }
}
```

## New API Endpoints

### Get Today's Token Usage
```
GET /tokens/:userId
```

**Response:**
```json
{
  "userId": "uuid",
  "date": "2025-01-01T00:00:00.000Z",
  "tokensUsed": 2500,
  "tokensRemaining": 7500,
  "dailyLimit": 10000,
  "requestCount": 8,
  "canMakeRequest": true
}
```

### Get Token Usage History
```
GET /tokens/:userId/history?days=7
```

**Response:**
```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "date": "2025-01-01T00:00:00.000Z",
    "tokensUsed": 2500,
    "requestCount": 8,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T23:59:59.000Z"
  },
  ...
]
```

## Error Responses

### 429 - Token Limit Exceeded
```json
{
  "error": "Daily token limit exceeded",
  "message": "You have used all your tokens for today. Please try again tomorrow.",
  "tokenUsage": {
    "tokensUsed": 10000,
    "tokensRemaining": 0,
    "dailyLimit": 10000,
    "requestCount": 35,
    "resetTime": "2025-01-02T00:00:00.000Z"
  }
}
```

### 400 - Missing userId
```json
{
  "error": "userId is required for token tracking"
}
```

## Token Tracking Flow

### Request Processing

1. **Pre-request**: Check if user has tokens available
2. **Process**: Execute web search + LLM generation
3. **Calculate**: Count tokens in query + results + answer
4. **Track**: Update daily usage in database
5. **Respond**: Include token info in response

### Example Token Breakdown

For query: "What is Rust programming language?"

```
Query tokens:        8  (31 chars)
Web results tokens:  400 (1600 chars from 10 results)
AI answer tokens:    150 (600 chars)
------------------------
Total tokens:        558
```

## Reset Schedule

Tokens reset daily at **00:00:00 UTC**.

Users can check remaining time until reset via the `resetTime` field in error responses.

## Admin Operations

### Update User Token Limit

```typescript
import { updateUserTokenLimit } from './services/token.service';

// Give user premium tier
await updateUserTokenLimit(userId, 50000);
```

### Query Token Statistics

```sql
-- Today's total usage
SELECT SUM(tokens_used) as total_tokens, COUNT(*) as total_users
FROM token_usage
WHERE date = CURRENT_DATE;

-- Top consumers
SELECT user_id, tokens_used, request_count
FROM token_usage
WHERE date = CURRENT_DATE
ORDER BY tokens_used DESC
LIMIT 10;

-- Weekly trend
SELECT date, SUM(tokens_used) as daily_total
FROM token_usage
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY date
ORDER BY date;
```

## Best Practices

### For Users
1. Check token balance before large queries
2. Use follow-up questions (they're already generated)
3. Monitor usage via `/tokens/:userId` endpoint
4. Plan complex research sessions accordingly

### For Developers
1. Always pass `userId` in requests
2. Handle 429 errors gracefully
3. Display token info in UI
4. Cache responses when possible
5. Implement retry logic with backoff

## Testing

### Postman Examples

**1. Check Token Balance**
```
GET http://localhost:3000/tokens/{{userId}}
```

**2. Make a Query (with token tracking)**
```
POST http://localhost:3000/purplexity_ask
Body: {
  "query": "What is TypeScript?",
  "userId": "{{userId}}"
}
```

**3. View Token History**
```
GET http://localhost:3000/tokens/{{userId}}/history?days=7
```

## Migration Guide

### Update Existing Database

After updating `schema.prisma`, run:

```bash
bun run db:generate
bun run db:push
```

This will:
1. Add `dailyTokenLimit` column to users (default: 10000)
2. Create `token_usage` table
3. Generate updated Prisma client

### Existing Users

All existing users automatically get:
- `dailyTokenLimit`: 10,000 tokens
- First request creates their token_usage record

## Future Enhancements

- [ ] Token purchase system
- [ ] Subscription tiers (free/pro/enterprise)
- [ ] Token rollover (unused tokens to next day)
- [ ] Token gifting/sharing
- [ ] Real-time token usage dashboard
- [ ] Alerts when 80% of limit reached
- [ ] Model-specific token costs (GPT-4 costs more)
- [ ] Bulk operations with token reservations

## Support

For token-related issues:
- Check current balance: `GET /tokens/:userId`
- View usage history: `GET /tokens/:userId/history`
- Contact admin for limit increases
