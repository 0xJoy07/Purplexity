# Supabase Setup Guide for Purplexity

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Fill in:
   - **Project Name**: `purplexity` (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose closest to you
4. Click "Create new project"
5. Wait for the project to be created (~2 minutes)

## Step 2: Get Your Credentials

### Get Supabase URL and Anon Key

1. In your Supabase project dashboard, click **Settings** (gear icon)
2. Go to **API** section
3. Copy the following:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")

### Get Database Connection String

1. Still in **Settings**, go to **Database** section
2. Scroll to **Connection string** section
3. Select **URI** tab
4. Copy the connection string
5. Replace `[YOUR-PASSWORD]` with your database password from Step 1

## Step 3: Update .env File

Open your `.env` file and replace the placeholders:

```env
# Supabase Configuration
SUPABASE_URL = https://your-project-id.supabase.co
SUPABASE_ANON_KEY = your-anon-key-here

# Database Connection String
DATABASE_URL = postgresql://postgres:your-password@db.your-project-ref.supabase.co:5432/postgres
```

## Step 4: Generate Prisma Client & Migrate Database

Run these commands in your terminal:

```bash
# Generate Prisma Client
bunx prisma generate

# Push schema to database (creates tables)
bunx prisma db push

# Optional: Open Prisma Studio to view your database
bunx prisma studio
```

## Step 5: Verify Connection

Start your server:

```bash
bun run index.ts
```

You should see:
```
Database connected successfully
Purplexity server running on http://localhost:3000
```

## Database Schema

Your Purplexity database has 2 tables:

### `users` Table
- `id` (UUID, Primary Key)
- `email` (String, Unique)
- `provider` (Enum: Github or Google)
- `name` (String)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

### `queries` Table
- `id` (UUID, Primary Key)
- `userId` (UUID, Foreign Key → users.id)
- `query` (Text)
- `answer` (Text)
- `followUps` (String Array)
- `sources` (JSON)
- `createdAt` (DateTime)

## Testing with Postman

### Save a Query (with userId)

```json
POST http://localhost:3000/purplexity_ask
Content-Type: application/json

{
  "query": "What is Rust programming language?",
  "userId": "user-uuid-here"
}
```

If you don't have a userId yet, you can create a user directly in Prisma Studio or via SQL in Supabase.

## Troubleshooting

### Connection Issues

If you see database connection errors:

1. Check your `DATABASE_URL` is correct
2. Make sure your IP is allowed (Supabase > Settings > Database > Connection pooling)
3. Verify your database password is correct

### Prisma Generate Errors

If `bunx prisma generate` fails:

```bash
# Clean and regenerate
rm -rf generated
bunx prisma generate
```

### Migration Issues

If `bunx prisma db push` fails:

```bash
# Reset database (⚠️ this deletes all data!)
bunx prisma db push --force-reset
```

## Next Steps

- Set up authentication endpoints (login, register)
- Add user query history endpoints
- Implement rate limiting per user
- Add API key authentication

## Useful Commands

```bash
# View database in browser
bunx prisma studio

# Format schema file
bunx prisma format

# Check if schema and database are in sync
bunx prisma db pull

# Create a migration
bunx prisma migrate dev --name init
```
