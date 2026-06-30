# Quick Setup Instructions

## What's Already Done

1. Installed Supabase SDK and Prisma
2. Created Prisma schema with User and Query models
3. Created database configuration
4. Created database service functions
5. Integrated database into the main server

## What You Need to Do

### Step 1: Get Supabase Credentials

1. Go to [supabase.com](https://supabase.com) and create a project
2. Get your credentials from the dashboard:
   - **Settings → API**: Copy `Project URL` and `anon public key`
   - **Settings → Database**: Copy the connection string (URI format)

### Step 2: Update .env File

Replace the placeholders in `.env` with your actual credentials:

```env
# Your existing keys are already set 
TAVILY_API_KEY = tvly-dev-4SSx8x...
NVIDIA_API_KEY = nvapi-yYFDKcWJD8TEK...
OPENROUTER_API_KEY = sk-or-v1-e8b8cafd...

# Add these from your Supabase dashboard:
SUPABASE_URL = https://xxxxxxxxx.supabase.co
SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DATABASE_URL = postgresql://postgres:YOUR_PASSWORD@db.xxxxxxxxx.supabase.co:5432/postgres
```

### Step 3: Generate Prisma Client

Run this command:

```bash
bun run db:generate
```

This creates the `./generated` folder with your database types.

### Step 4: Push Schema to Database

Run this command to create the tables in your Supabase database:

```bash
bun run db:push
```

This creates the `users` and `queries` tables automatically.

### Step 5: Start the Server

```bash
bun run dev
```

You should see:
```
Database connected successfully
Purplexity server running on http://localhost:3000
```

## 📝 Testing in Postman

### Without Database (works now)
```json
POST http://localhost:3000/purplexity_ask

{
  "query": "What is Rust?"
}
```

### With Database (after setup)
```json
POST http://localhost:3000/purplexity_ask

{
  "query": "What is Rust?",
  "userId": "123e4567-e89b-12d3-a456-426614174000"
}
```

The query will be saved to the database if you provide a valid `userId`.

## 🛠️ Useful Commands

```bash
# Start development server
bun run dev

# Generate Prisma client
bun run db:generate

# Push schema to database
bun run db:push

# Open database GUI
bun run db:studio

# Create migration
bun run db:migrate
```

## 📚 Database Schema

### Users Table
- `id` - UUID (auto-generated)
- `email` - Unique email address
- `provider` - Github or Google
- `name` - User's display name

### Queries Table
- `id` - UUID (auto-generated)
- `userId` - Links to User
- `query` - The user's question
- `answer` - The AI-generated answer
- `followUps` - Array of follow-up questions
- `sources` - JSON array of web sources
- `createdAt` - Timestamp

## 🔍 View Your Data

After running queries, open Prisma Studio to see your data:

```bash
bun run db:studio
```

This opens a web UI at `http://localhost:5555` where you can:
- View all users and queries
- Edit data directly
- Test relationships

## ⚠️ Important Notes

1. The `generated` folder will appear after running `bun run db:generate`
2. Don't commit the `.env` file to git (it's already in `.gitignore`)
3. Database connection errors mean your `DATABASE_URL` is incorrect
4. The server works WITHOUT database - it just won't save queries

## 🐛 Troubleshooting

**Error: Cannot find module '../generated/client'**
→ Run `bun run db:generate`

**Error: Database connection failed**
→ Check your `DATABASE_URL` in `.env`

**Error: Invalid userId**
→ Either don't send `userId` or create a user first in Prisma Studio

## Need More Help?

Check `SUPABASE_SETUP.md` for detailed Supabase setup instructions.
