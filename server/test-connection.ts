import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

async function testConnection() {
  console.log('Testing Supabase connection...\n');
  console.log('Database URL:', process.env.DATABASE_URL?.replace(/:[^:]*@/, ':****@')); // Hide password
  console.log('Supabase URL:', process.env.SUPABASE_URL);
  console.log('Supabase Anon Key:', process.env.SUPABASE_ANON_KEY ? '✓ Present' : '✗ Missing');
  console.log('\nAttempting to connect...\n');

  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully!\n');
    
    // Try a simple query
    const result = await prisma.$queryRaw`SELECT version()`;
    console.log('Database version:', result);
    
    await prisma.$disconnect();
    console.log('\n✅ Connection test passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error);
    console.error('\n📋 Troubleshooting steps:');
    console.error('1. Check if your Supabase project is active (not paused)');
    console.error('2. Verify your DATABASE_URL in .env file');
    console.error('3. Ensure password special characters are URL-encoded');
    console.error('4. Check if you are behind a firewall blocking port 5432\n');
    await prisma.$disconnect();
    process.exit(1);
  }
}

testConnection();
