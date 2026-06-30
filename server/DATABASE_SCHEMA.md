# Purplexity Database Schema

## 📊 Entity Relationship Diagram

```
┌──────────────────────────┐
│         Users            │
├──────────────────────────┤
│ id (UUID) PK             │
│ email (String) UNIQUE    │
│ provider (AuthProvider)  │
│ name (String)            │
│ profileImage (String?)   │
│ createdAt (DateTime)     │
│ updatedAt (DateTime)     │
└──────────┬───────────────┘
           │
           │ 1:N
           ├─────────────────────────┐
           │                         │
           │                         │
┌──────────▼───────────────┐  ┌─────▼──────────────────┐
│    Conversations         │  │      Queries           │
├──────────────────────────┤  ├────────────────────────┤
│ id (UUID) PK             │  │ id (UUID) PK           │
│ userId (UUID) FK         │  │ userId (UUID) FK       │
│ title (String)           │  │ query (Text)           │
│ createdAt (DateTime)     │  │ answer (Text)          │
│ updatedAt (DateTime)     │  │ followUps (String[])   │
└──────────┬───────────────┘  │ sources (JSON)         │
           │                  │ createdAt (DateTime)   │
           │ 1:N              └────────────────────────┘
           │
┌──────────▼───────────────┐
│       Messages           │
├──────────────────────────┤
│ id (UUID) PK             │
│ conversationId (UUID) FK │
│ role (MessageRole)       │
│ content (Text)           │
│ sources (JSON?)          │
│ followUps (String[])     │
│ createdAt (DateTime)     │
└──────────────────────────┘
```

---

## 📋 Table Definitions

### `users` Table

Stores user account information.

| Column         | Type          | Constraints      | Description                           |
|----------------|---------------|------------------|---------------------------------------|
| id             | UUID          | PRIMARY KEY      | Unique user identifier                |
| email          | String        | UNIQUE, NOT NULL | User email address                    |
| provider       | AuthProvider  | NOT NULL         | OAuth provider (Github/Google)        |
| name           | String        | NOT NULL         | User display name                     |
| profileImage   | String        | NULLABLE         | URL to user profile image             |
| createdAt      | DateTime      | DEFAULT now()    | Account creation timestamp            |
| updatedAt      | DateTime      | AUTO UPDATE      | Last profile update timestamp         |

**Relationships:**
- Has many `conversations`
- Has many `queries`

---

### `conversations` Table

Stores chat conversation sessions.

| Column      | Type     | Constraints      | Description                           |
|-------------|----------|------------------|---------------------------------------|
| id          | UUID     | PRIMARY KEY      | Unique conversation identifier        |
| userId      | UUID     | FOREIGN KEY      | References users(id), CASCADE DELETE  |
| title       | String   | DEFAULT "New..."  | Conversation title/topic              |
| createdAt   | DateTime | DEFAULT now()    | Conversation creation timestamp       |
| updatedAt   | DateTime | AUTO UPDATE      | Last message timestamp                |

**Indexes:**
- `userId` (for fast user lookups)
- `createdAt` (for chronological ordering)

**Relationships:**
- Belongs to one `user`
- Has many `messages`

---

### `messages` Table

Stores individual messages within conversations.

| Column           | Type        | Constraints      | Description                           |
|------------------|-------------|------------------|---------------------------------------|
| id               | UUID        | PRIMARY KEY      | Unique message identifier             |
| conversationId   | UUID        | FOREIGN KEY      | References conversations(id), CASCADE |
| role             | MessageRole | NOT NULL         | Message sender role                   |
| content          | Text        | NOT NULL         | Message text content                  |
| sources          | JSON        | NULLABLE         | Web sources used (assistant only)     |
| followUps        | String[]    | DEFAULT []       | Follow-up questions (assistant only)  |
| createdAt        | DateTime    | DEFAULT now()    | Message creation timestamp            |

**Indexes:**
- `conversationId` (for fast conversation lookups)
- `createdAt` (for chronological ordering)

**Relationships:**
- Belongs to one `conversation`

---

### `queries` Table

Stores standalone queries (legacy format, not part of conversations).

| Column      | Type      | Constraints      | Description                           |
|-------------|-----------|------------------|---------------------------------------|
| id          | UUID      | PRIMARY KEY      | Unique query identifier               |
| userId      | UUID      | FOREIGN KEY      | References users(id), CASCADE DELETE  |
| query       | Text      | NOT NULL         | User question                         |
| answer      | Text      | NOT NULL         | AI-generated answer                   |
| followUps   | String[]  | NOT NULL         | Follow-up questions                   |
| sources     | JSON      | DEFAULT []       | Web sources used                      |
| createdAt   | DateTime  | DEFAULT now()    | Query timestamp                       |

**Indexes:**
- `userId` (for fast user lookups)
- `createdAt` (for chronological ordering)

**Relationships:**
- Belongs to one `user`

---

## 🏷️ Enums

### `AuthProvider`

Valid authentication providers.

```prisma
enum AuthProvider {
  Github
  Google
}
```

### `MessageRole`

Valid message roles in conversations.

```prisma
enum MessageRole {
  user       // Message from the user
  assistant  // Response from AI
  system     // System messages (reserved)
}
```

---

## 🔄 Cascade Delete Behavior

When a user is deleted:
- ✅ All their conversations are deleted
- ✅ All messages in those conversations are deleted
- ✅ All their standalone queries are deleted

When a conversation is deleted:
- ✅ All messages in that conversation are deleted

---

## 📐 Design Decisions

### Why Two Storage Models?

1. **Conversations + Messages** (Primary)
   - For multi-turn chat sessions
   - Preserves conversation context
   - Allows editing titles
   - Better UX for chat interface

2. **Queries** (Legacy/Standalone)
   - For single-shot questions
   - Backward compatibility
   - Simpler for one-off searches
   - Can be migrated to conversations later

### Why Separate `followUps` and `sources`?

- **followUps**: Array of strings (simple, frequently accessed)
- **sources**: JSON (flexible structure, includes title + URL + metadata)

### Why JSON for `sources`?

- Flexible schema (can add metadata without migration)
- Web sources have varying structures
- Not frequently queried directly
- Easy to serialize/deserialize

---

## 🚀 Example Data Flow

### Creating a Conversation

```typescript
// 1. User logs in
const user = await findOrCreateUser({
  email: "john@example.com",
  provider: "Google",
  name: "John Doe"
});

// 2. Create conversation
const conversation = await createConversation({
  userId: user.id
});

// 3. User sends first message
const { userMsg, assistantMsg } = await addMessageToConversation(
  conversation.id,
  "What is Rust?",
  "Rust is a systems programming language...",
  [{ title: "Rust Lang", url: "https://rust-lang.org" }],
  ["How do I install Rust?", "What is Rust used for?"]
);

// 4. Auto-generate title from first message
await generateConversationTitle(conversation.id, "What is Rust?");
```

---

## 🔍 Common Queries

### Get User's Recent Conversations
```typescript
const conversations = await prisma.conversation.findMany({
  where: { userId },
  orderBy: { updatedAt: 'desc' },
  take: 20,
  include: {
    messages: {
      take: 1,
      orderBy: { createdAt: 'desc' }
    }
  }
});
```

### Get Full Conversation
```typescript
const conversation = await prisma.conversation.findUnique({
  where: { id: conversationId },
  include: {
    messages: {
      orderBy: { createdAt: 'asc' }
    },
    user: true
  }
});
```

### Count User's Total Messages
```typescript
const count = await prisma.message.count({
  where: {
    conversation: {
      userId
    }
  }
});
```

---

## 📊 Database Size Estimates

Assuming average values:

**Per User:**
- 10 conversations
- 20 messages per conversation (10 exchanges)
- 5 standalone queries

**Storage per user:**
- User: ~200 bytes
- Conversations: 10 × 150 bytes = 1.5 KB
- Messages: 200 × 1 KB = 200 KB
- Queries: 5 × 2 KB = 10 KB

**Total per user: ~212 KB**

**For 10,000 users: ~2.1 GB**

---

## 🔒 Security Considerations

1. **Row-Level Security (RLS)**
   - Enable RLS in Supabase
   - Users can only access their own data
   
2. **Indexes**
   - All foreign keys are indexed
   - Timestamp columns indexed for sorting

3. **Cascade Deletes**
   - Prevent orphaned records
   - Maintain referential integrity

4. **UUID Primary Keys**
   - Non-sequential IDs
   - Harder to enumerate

---

## 🛠️ Migrations

After modifying `schema.prisma`, run:

```bash
# Generate Prisma Client
bun run db:generate

# Push changes to database
bun run db:push

# Or create a migration (recommended for production)
bun run db:migrate
```

---

## 📈 Future Enhancements

Potential schema additions:

1. **Reactions/Ratings**
   ```prisma
   model MessageRating {
     id        String   @id @default(uuid())
     messageId String
     rating    Int      // 1-5 stars
     createdAt DateTime @default(now())
   }
   ```

2. **Shared Conversations**
   ```prisma
   model ConversationShare {
     id             String   @id @default(uuid())
     conversationId String
     shareToken     String   @unique
     expiresAt      DateTime?
   }
   ```

3. **Usage Tracking**
   ```prisma
   model UsageLog {
     id        String   @id @default(uuid())
     userId    String
     action    String   // "query", "message", etc.
     createdAt DateTime @default(now())
   }
   ```
