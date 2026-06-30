#!/usr/bin/env bun
/**
 * Script to create test and guest users for development
 * Run: bun run scripts/create-test-users.ts
 */

import "dotenv/config";
import { createGuestUser, createTestUser } from "../services/guest.service";
import { prisma } from "../config/db.config";

async function main() {
  console.log("Creating test and guest users...\n");

  try {
    // Create 3 test users with different token limits
    console.log("Creating test users...");
    
    const testUser1 = await createTestUser({ dailyTokenLimit: 50000 });
    console.log(`Test User 1 (High Limit):`);
    console.log(`   User ID: ${testUser1.userId}`);
    console.log(`   Email: ${testUser1.email}`);
    console.log(`   Daily Limit: ${testUser1.dailyTokenLimit} tokens\n`);

    const testUser2 = await createTestUser({ dailyTokenLimit: 10000 });
    console.log(`Test User 2 (Normal Limit):`);
    console.log(`   User ID: ${testUser2.userId}`);
    console.log(`   Email: ${testUser2.email}`);
    console.log(`   Daily Limit: ${testUser2.dailyTokenLimit} tokens\n`);

    const testUser3 = await createTestUser({ dailyTokenLimit: 1000 });
    console.log(`Test User 3 (Low Limit):`);
    console.log(`   User ID: ${testUser3.userId}`);
    console.log(`   Email: ${testUser3.email}`);
    console.log(`   Daily Limit: ${testUser3.dailyTokenLimit} tokens\n`);

    // Create 2 guest users
    console.log("Creating guest users...");
    
    const guest1 = await createGuestUser({ dailyTokenLimit: 1000, expiresInHours: 24 });
    console.log(`Guest User 1:`);
    console.log(`   User ID: ${guest1.userId}`);
    console.log(`   Email: ${guest1.email}`);
    console.log(`   Daily Limit: ${guest1.dailyTokenLimit} tokens`);
    console.log(`   Expires: ${guest1.expiresAt}\n`);

    const guest2 = await createGuestUser({ dailyTokenLimit: 500, expiresInHours: 12 });
    console.log(`Guest User 2:`);
    console.log(`   User ID: ${guest2.userId}`);
    console.log(`   Email: ${guest2.email}`);
    console.log(`   Daily Limit: ${guest2.dailyTokenLimit} tokens`);
    console.log(`   Expires: ${guest2.expiresAt}\n`);

    // Save user IDs to a file for easy access
    const userIds = {
      testUsers: [
        { id: testUser1.userId, limit: testUser1.dailyTokenLimit, email: testUser1.email },
        { id: testUser2.userId, limit: testUser2.dailyTokenLimit, email: testUser2.email },
        { id: testUser3.userId, limit: testUser3.dailyTokenLimit, email: testUser3.email },
      ],
      guestUsers: [
        { id: guest1.userId, limit: guest1.dailyTokenLimit, email: guest1.email, expires: guest1.expiresAt },
        { id: guest2.userId, limit: guest2.dailyTokenLimit, email: guest2.email, expires: guest2.expiresAt },
      ],
    };

    console.log("📄 User IDs Summary:");
    console.log(JSON.stringify(userIds, null, 2));
    console.log("\n✨ All users created successfully!");
    console.log("\n💡 Usage:");
    console.log("   Copy any userId above and use it in your Postman requests");
    console.log("   Example: POST /purplexity_ask with { 'query': '...', 'userId': 'uuid-here' }");

  } catch (error) {
    console.error("❌ Error creating users:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
