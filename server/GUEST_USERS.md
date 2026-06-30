# Guest & Test Users Documentation

## Overview

The system supports temporary user accounts for testing and guest access:

- **Guest Users**: Temporary accounts that expire after 24 hours (default)
- **Test Users**: Development accounts with higher token limits

## User Types

### Guest Users
- Email format: `guest_[timestamp]_[random]@guest.purplexity.local`
- Default token limit: **1,000 tokens/day**
- Auto-expire: **24 hours** (configurable)
- Use case: Anonymous users, demos, trials

### Test Users
- Email format: `test_[timestamp]_[random]@test.purplexity.local`
- Default token limit: **50,000 tokens/day**
- No expiration (manual cleanup)
- Use case: Development, testing, QA

## API Endpoints

### Create Guest User
```
POST /users/guest
```

**Request Body** (optional):
```json
{
  "dailyTokenLimit": 1000,
  "expiresInHours": 24
}
```

**Response:**
```json
{
  "userId": "uuid-here",
  "guestId": "guest_xyz123_abc456",
  "email": "guest_xyz123_abc456@guest.purplexity.local",
  "name": "Guest User xyz123",
  "dailyTokenLimit": 1000,
  "expiresAt": "2025-01-02T12:00:00.000Z",
  "isGuest": true
}
```

### Create Test User
```
POST /users/test
```

**Request Body** (optional):
```json
{
  "dailyTokenLimit": 50000
}
```

**Response:**
```json
{
  "userId": "uuid-here",
  "testId": "test_abc123_def456",
  "email": "test_abc123_def456@test.purplexity.local",
  "name": "Test User abc123",
  "dailyTokenLimit": 50000,
  "isTest": true
}
```

### Get All Guest Users
```
GET /users/guests
```

**Response:**
```json
[
  {
    "id": "uuid",
    "email": "guest_xyz@guest.purplexity.local",
    "name": "Guest User xyz",
    "dailyTokenLimit": 1000,
    "createdAt": "2025-01-01T12:00:00.000Z",
    "_count": {
      "conversations": 2,
      "queries": 5
    }
  }
]
```

### Get All Test Users
```
GET /users/tests
```

**Response:** Same format as guest users

### Delete Temporary User
```
DELETE /users/temp/:userId
```

**Response:**
```json
{
  "success": true,
  "message": "Temporary user deleted successfully"
}
```

### Cleanup Expired Guests
```
POST /users/cleanup
```

**Response:**
```json
{
  "deletedCount": 5,
  "message": "Cleaned up 5 expired guest users"
}
```

## Quick Setup Script

### Generate Multiple Test Users

```bash
bun run create:test-users
```

This creates:
- **3 test users** with varying token limits (50K, 10K, 1K)
- **2 guest users** with different expiration times (24h, 12h)

**Output:**
```
🚀 Creating test and guest users...

📝 Creating test users...
✅ Test User 1 (High Limit):
   User ID: 123e4567-e89b-12d3-a456-426614174000
   Email: test_lz8x9c_3f7d2a@test.purplexity.local
   Daily Limit: 50000 tokens

✅ Test User 2 (Normal Limit):
   User ID: 223e4567-e89b-12d3-a456-426614174001
   Email: test_lz8x9d_4g8e3b@test.purplexity.local
   Daily Limit: 10000 tokens

✅ Test User 3 (Low Limit):
   User ID: 323e4567-e89b-12d3-a456-426614174002
   Email: test_lz8x9e_5h9f4c@test.purplexity.local
   Daily Limit: 1000 tokens

👤 Creating guest users...
✅ Guest User 1:
   User ID: 423e4567-e89b-12d3-a456-426614174003
   Email: guest_lz8x9f_6i0g5d@guest.purplexity.local
   Daily Limit: 1000 tokens
   Expires: 2025-01-02T12:00:00.000Z

✅ Guest User 2:
   User ID: 523e4567-e89b-12d3-a456-426614174004
   Email: guest_lz8x9g_7j1h6e@guest.purplexity.local
   Daily Limit: 500 tokens
   Expires: 2025-01-02T00:00:00.000Z

✨ All users created successfully!
```

## Usage Examples

### Postman Testing

**1. Create a guest user:**
```
POST http://localhost:3000/users/guest
```

**2. Use guest userId in queries:**
```
POST http://localhost:3000/purplexity_ask
Body: {
  "query": "What is TypeScript?",
  "userId": "guest-user-id-from-step-1"
}
```

**3. Check token usage:**
```
GET http://localhost:3000/tokens/guest-user-id
```

### Testing Different Token Limits

```javascript
// Create user with custom limit
POST /users/test
{
  "dailyTokenLimit": 100  // Very low for testing limits
}

// Make requests until limit reached
POST /purplexity_ask (repeat until 429 error)

// Verify limit enforcement
GET /tokens/:userId  // Should show 0 remaining
```

## Automated Cleanup

### Manual Cleanup
```bash
curl -X POST http://localhost:3000/users/cleanup
```

### Automated Cleanup (Cron Job)

Add to your server startup or use a cron job:

```typescript
// Run cleanup every hour
setInterval(async () => {
  const result = await cleanupExpiredGuests();
  console.log(result.message);
}, 60 * 60 * 1000);
```

Or in Unix cron:
```bash
# Cleanup expired guests every day at 2 AM
0 2 * * * curl -X POST http://localhost:3000/users/cleanup
```

## Security Considerations

### Guest User Limits

1. **Token Limits**: Lower than regular users (1K vs 10K)
2. **Expiration**: Auto-delete after 24 hours
3. **No OAuth**: Cannot be linked to real accounts
4. **Rate Limiting**: Consider IP-based limits

### Test User Management

1. **Development Only**: Delete before production
2. **Monitoring**: Track test user activity
3. **Cleanup**: Remove unused test accounts regularly

## Frontend Integration

### Guest User Flow

```typescript
// 1. Create guest on first visit
async function getOrCreateGuest() {
  let guestId = localStorage.getItem('guestUserId');
  
  if (!guestId) {
    const response = await fetch('/users/guest', { method: 'POST' });
    const guest = await response.json();
    localStorage.setItem('guestUserId', guest.userId);
    localStorage.setItem('guestExpires', guest.expiresAt);
    guestId = guest.userId;
  }
  
  return guestId;
}

// 2. Use guest ID in requests
async function askQuestion(query) {
  const userId = await getOrCreateGuest();
  
  const response = await fetch('/purplexity_ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, userId })
  });
  
  return response.text();
}

// 3. Check if guest expired
function isGuestExpired() {
  const expires = localStorage.getItem('guestExpires');
  return expires && new Date(expires) < new Date();
}
```

## Database Queries

### Find all temporary users
```sql
SELECT * FROM users
WHERE email LIKE '%@guest.purplexity.local'
   OR email LIKE '%@test.purplexity.local';
```

### Guest user statistics
```sql
SELECT 
  COUNT(*) as total_guests,
  SUM(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 ELSE 0 END) as active_guests,
  AVG(daily_token_limit) as avg_token_limit
FROM users
WHERE email LIKE '%@guest.purplexity.local';
```

### Token usage by guest users
```sql
SELECT 
  u.email,
  tu.tokens_used,
  tu.request_count,
  u.daily_token_limit
FROM token_usage tu
JOIN users u ON tu.user_id = u.id
WHERE u.email LIKE '%@guest.purplexity.local'
  AND tu.date = CURRENT_DATE
ORDER BY tu.tokens_used DESC;
```

## Monitoring

### Metrics to Track

1. **Guest User Count**: Active vs expired
2. **Token Usage**: Average per guest
3. **Conversion Rate**: Guest → registered user
4. **Abuse Detection**: Unusual patterns

### Example Monitoring Query

```typescript
import { prisma } from './config/db.config';

async function getGuestMetrics() {
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);

  const [totalGuests, activeGuests, tokenUsage] = await Promise.all([
    prisma.user.count({
      where: { email: { contains: '@guest.purplexity.local' } }
    }),
    prisma.user.count({
      where: {
        email: { contains: '@guest.purplexity.local' },
        createdAt: { gte: oneDayAgo }
      }
    }),
    prisma.tokenUsage.aggregate({
      where: {
        user: { email: { contains: '@guest.purplexity.local' } },
        date: { gte: oneDayAgo }
      },
      _sum: { tokensUsed: true },
      _avg: { tokensUsed: true }
    })
  ]);

  return {
    totalGuests,
    activeGuests,
    totalTokensUsed: tokenUsage._sum.tokensUsed || 0,
    avgTokensPerGuest: tokenUsage._avg.tokensUsed || 0
  };
}
```

## Best Practices

### For Development
- Use test users with high limits
- Create new test users for each test scenario
- Clean up after testing

### For Production
- Enable guest users for trials
- Set conservative token limits
- Monitor for abuse
- Implement IP rate limiting
- Auto-cleanup expired guests

### For Users
- Prompt guest users to register before expiration
- Show token usage in UI
- Warn before token limit reached
- Smooth transition from guest to registered
