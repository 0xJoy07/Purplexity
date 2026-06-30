# Purplexity API Documentation

Base URL: `http://localhost:3000`

## 📋 Table of Contents

1. [User Endpoints](#user-endpoints)
2. [Conversation Endpoints](#conversation-endpoints)
3. [Message Endpoints](#message-endpoints)
4. [Legacy Query Endpoint](#legacy-query-endpoint)
5. [Health Check Endpoints](#health-check-endpoints)

---

## 🧑 User Endpoints

### Create or Find User
**POST** `/users`

Creates a new user or returns existing user if email already exists.

**Request Body:**
```json
{
  "email": "user@example.com",
  "provider": "Google",
  "name": "John Doe",
  "profileImage": "https://example.com/avatar.jpg"
}
```

**Response:**
```json
{
  "id": "uuid-here",
  "email": "user@example.com",
  "provider": "Google",
  "name": "John Doe",
  "profileImage": "https://example.com/avatar.jpg",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Get User Profile
**GET** `/users/:userId`

Get user profile with statistics.

**Response:**
```json
{
  "id": "uuid-here",
  "email": "user@example.com",
  "provider": "Google",
  "name": "John Doe",
  "profileImage": "https://example.com/avatar.jpg",
  "conversations": [...],
  "queries": [...],
  "stats": {
    "conversationCount": 10,
    "messageCount": 45,
    "queryCount": 5,
    "totalInteractions": 50
  }
}
```

---

## 💬 Conversation Endpoints

### Create Conversation
**POST** `/conversations`

Create a new conversation for a user.

**Request Body:**
```json
{
  "userId": "user-uuid-here",
  "title": "My Research Topic"
}
```

**Response:**
```json
{
  "id": "conversation-uuid",
  "userId": "user-uuid-here",
  "title": "My Research Topic",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Get User Conversations
**GET** `/conversations/user/:userId`

Get all conversations for a specific user (most recent first).

**Response:**
```json
[
  {
    "id": "conversation-uuid-1",
    "userId": "user-uuid",
    "title": "What is Rust?",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T01:30:00.000Z",
    "messages": [
      {
        "id": "message-uuid",
        "role": "assistant",
        "content": "Rust is a systems programming language...",
        "createdAt": "2024-01-01T00:15:00.000Z"
      }
    ],
    "_count": {
      "messages": 12
    }
  }
]
```

### Get Conversation Detail
**GET** `/conversations/:conversationId`

Get a specific conversation with all messages.

**Response:**
```json
{
  "id": "conversation-uuid",
  "userId": "user-uuid",
  "title": "What is Rust?",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T01:30:00.000Z",
  "user": {
    "id": "user-uuid",
    "name": "John Doe",
    "email": "user@example.com",
    "profileImage": "https://example.com/avatar.jpg"
  },
  "messages": [
    {
      "id": "message-uuid-1",
      "conversationId": "conversation-uuid",
      "role": "user",
      "content": "What is Rust?",
      "sources": null,
      "followUps": [],
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "message-uuid-2",
      "conversationId": "conversation-uuid",
      "role": "assistant",
      "content": "Rust is a systems programming language...",
      "sources": [
        {
          "title": "Rust Programming Language",
          "url": "https://www.rust-lang.org"
        }
      ],
      "followUps": [
        "What are Rust's main features?",
        "How do I get started with Rust?"
      ],
      "createdAt": "2024-01-01T00:00:15.000Z"
    }
  ]
}
```

### Update Conversation Title
**PATCH** `/conversations/:conversationId`

Update the title of a conversation.

**Request Body:**
```json
{
  "title": "New Title Here"
}
```

**Response:**
```json
{
  "id": "conversation-uuid",
  "userId": "user-uuid",
  "title": "New Title Here",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T02:00:00.000Z"
}
```

### Delete Conversation
**DELETE** `/conversations/:conversationId`

Delete a conversation and all its messages.

**Response:**
```json
{
  "message": "Conversation deleted successfully"
}
```

---

## 📨 Message Endpoints

### Send Message in Conversation
**POST** `/conversations/:conversationId/messages`

Send a message in a conversation and get AI response.

**Request Body:**
```json
{
  "message": "How do I learn Rust?"
}
```

**Response:**
```json
{
  "userMessage": {
    "id": "message-uuid-1",
    "conversationId": "conversation-uuid",
    "role": "user",
    "content": "How do I learn Rust?",
    "sources": null,
    "followUps": [],
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "assistantMessage": {
    "id": "message-uuid-2",
    "conversationId": "conversation-uuid",
    "role": "assistant",
    "content": "Here's how to learn Rust...",
    "sources": [
      {
        "title": "The Rust Book",
        "url": "https://doc.rust-lang.org/book/"
      },
      {
        "title": "Rust by Example",
        "url": "https://doc.rust-lang.org/rust-by-example/"
      }
    ],
    "followUps": [
      "What projects should I build to learn Rust?",
      "How long does it take to learn Rust?",
      "Is Rust hard to learn?"
    ],
    "createdAt": "2024-01-01T00:00:15.000Z"
  },
  "sources": [...],
  "followUps": [...]
}
```

**Note:** 
- The first message in a conversation automatically generates a title from the message content.
- Each message triggers web search and AI response generation.

---

## 🔍 Legacy Query Endpoint

### Single Query (Standalone)
**POST** `/purplexity_ask`

Legacy endpoint for standalone queries (not part of a conversation).

**Request Body:**
```json
{
  "query": "What is TypeScript?",
  "userId": "user-uuid-here"
}
```

**Response:**
```
<ANSWER>TypeScript is a strongly typed programming language that builds on JavaScript...</ANSWER><FOLLOW UP>What are TypeScript's main features?; How does TypeScript differ from JavaScript?; When should I use TypeScript?</FOLLOW UP>
```

**Note:** 
- `userId` is optional. If provided, query will be saved to database.
- Response format is XML-style text (legacy format).

---

## 🏥 Health Check Endpoints

### Server Health
**GET** `/health`

Check if server is running.

**Response:**
```json
{
  "status": "ok",
  "message": "Purplexity server is running"
}
```

### Database Health
**GET** `/health/db`

Check database connection status.

**Response:**
```json
{
  "status": "ok",
  "database": "connected"
}
```

---

## 🔐 Auth Provider Enum

Valid values for `provider` field:
- `"Github"`
- `"Google"`

## 📝 Message Role Enum

Valid values for message `role`:
- `"user"` - Message from the user
- `"assistant"` - Response from AI
- `"system"` - System messages (not currently used in API)

---

## 🌊 Typical Flow

### 1. User Authentication
```
POST /users
{
  "email": "user@example.com",
  "provider": "Google",
  "name": "John Doe"
}
→ Returns user with userId
```

### 2. Create Conversation
```
POST /conversations
{
  "userId": "user-uuid-from-step-1"
}
→ Returns conversation with conversationId
```

### 3. Send Messages
```
POST /conversations/{conversationId}/messages
{
  "message": "What is Rust?"
}
→ Returns user message + AI response with sources
```

### 4. View Conversation History
```
GET /conversations/{conversationId}
→ Returns full conversation with all messages
```

### 5. List All Conversations
```
GET /conversations/user/{userId}
→ Returns all user conversations
```

---

## ⚠️ Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message here",
  "message": "Detailed error information"
}
```

Common HTTP status codes:
- `400` - Bad Request (missing required fields)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error (unexpected error)

---

## 🚀 Testing with Postman

1. Import this collection or create requests manually
2. Start with creating a user
3. Create a conversation for that user
4. Send messages in the conversation
5. View conversation history

### Example Postman Collection

```json
{
  "info": {
    "name": "Purplexity API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Create User",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/users",
        "body": {
          "mode": "raw",
          "raw": "{\"email\":\"test@example.com\",\"provider\":\"Google\",\"name\":\"Test User\"}"
        }
      }
    },
    {
      "name": "Create Conversation",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/conversations",
        "body": {
          "mode": "raw",
          "raw": "{\"userId\":\"{{userId}}\"}"
        }
      }
    },
    {
      "name": "Send Message",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/conversations/{{conversationId}}/messages",
        "body": {
          "mode": "raw",
          "raw": "{\"message\":\"What is Rust?\"}"
        }
      }
    }
  ]
}
```

Set variables:
- `baseUrl`: `http://localhost:3000`
- `userId`: (from create user response)
- `conversationId`: (from create conversation response)
