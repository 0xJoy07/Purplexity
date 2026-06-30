# How to Get Your Correct Supabase Connection String

Your current connection is failing. Follow these steps to get the correct connection string:

## Step 1: Go to Your Supabase Dashboard

1. Open [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project: `gwundhyeqapyyoxpsztc`

## Step 2: Check if Your Project is Active

- If you see "Project is paused", click **Restore Project**
- Free-tier projects auto-pause after 7 days of inactivity
- Wait for it to become active (takes ~2 minutes)

## Step 3: Get the Correct Database Connection String

1. In your project dashboard, click **Settings** (gear icon in sidebar)
2. Click **Database** in the left menu
3. Scroll down to **Connection string** section
4. You'll see several tabs - click **URI**
5. Copy the connection string that looks like:
   ```
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```
   OR
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

## Step 4: Replace Password Placeholder

The connection string will have `[YOUR-PASSWORD]` - replace it with: `Purplexity@197320`

**IMPORTANT**: If your password contains special characters like `@`, `#`, `:`, `/`, etc., you must URL-encode them:
- `@` becomes `%40`
- `#` becomes `%23`
- `:` becomes `%3A`
- `/` becomes `%2F`

For your password `Purplexity@197320`, it should be: `Purplexity%40197320`

## Step 5: Update Your .env File

Replace the DATABASE_URL in your `.env` file with the corrected string.

Example:
```env
DATABASE_URL=postgresql://postgres:Purplexity%40197320@db.gwundhyeqapyyoxpsztc.supabase.co:5432/postgres
```

## Step 6: Test Connection

Run:
```bash
bunx prisma db push
```

---

## Troubleshooting

### Error: Can't reach database server
- Your project might be paused (free tier auto-pauses after 7 days)
- Go to dashboard and click "Restore project"

### Error: Password authentication failed
- Double-check your database password
- Make sure you're using the correct project reference ID

### Error: Connection timeout
- Check if you're behind a corporate firewall
- Try using the connection pooler (port 6543) instead of direct connection (port 5432)

### Still Having Issues?

1. Go to Supabase Dashboard > Settings > Database
2. Take a screenshot of the "Connection string" section (hide the password)
3. Verify your project reference ID matches: `gwundhyeqapyyoxpsztc`
4. Check that the password you set when creating the project is: `Purplexity@197320`
