import { prisma } from "../config/db.config";
import { randomBytes } from "crypto";

// Generate a unique guest identifier
function generateGuestId(): string {
  const prefix = "guest";
  const randomPart = randomBytes(8).toString("hex");
  const timestamp = Date.now().toString(36);
  return `${prefix}_${timestamp}_${randomPart}`;
}

// Generate a test user identifier
function generateTestUserId(): string {
  const prefix = "test";
  const randomPart = randomBytes(6).toString("hex");
  const timestamp = Date.now().toString(36);
  return `${prefix}_${timestamp}_${randomPart}`;
}

export interface GuestUserOptions {
  dailyTokenLimit?: number;
  expiresInHours?: number;
}

// Create a guest user (temporary, expires after set time)
export async function createGuestUser(options: GuestUserOptions = {}) {
  const guestId = generateGuestId();
  const email = `${guestId}@guest.purplexity.local`;
  const dailyTokenLimit = options.dailyTokenLimit || 1000; // Lower limit for guests
  
  const user = await prisma.user.create({
    data: {
      email,
      provider: "Google", // Placeholder provider
      name: `Guest User ${guestId.split("_")[1]}`,
      profileImage: null,
      dailyTokenLimit,
    },
  });

  // Calculate expiration time
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + (options.expiresInHours || 24));

  return {
    userId: user.id,
    guestId,
    email: user.email,
    name: user.name,
    dailyTokenLimit,
    expiresAt,
    isGuest: true,
  };
}

// Create a test user (for development/testing)
export async function createTestUser(options: GuestUserOptions = {}) {
  const testId = generateTestUserId();
  const email = `${testId}@test.purplexity.local`;
  const dailyTokenLimit = options.dailyTokenLimit || 50000; // Higher limit for testing
  
  const user = await prisma.user.create({
    data: {
      email,
      provider: "Google",
      name: `Test User ${testId.split("_")[1]}`,
      profileImage: null,
      dailyTokenLimit,
    },
  });

  return {
    userId: user.id,
    testId,
    email: user.email,
    name: user.name,
    dailyTokenLimit,
    isTest: true,
  };
}

// Check if a user is a guest or test user
export function isGuestUser(email: string): boolean {
  return email.includes("@guest.purplexity.local");
}

export function isTestUser(email: string): boolean {
  return email.includes("@test.purplexity.local");
}

export function isTempUser(email: string): boolean {
  return isGuestUser(email) || isTestUser(email);
}

// Cleanup expired guest users (older than 24 hours)
export async function cleanupExpiredGuests() {
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);

  const result = await prisma.user.deleteMany({
    where: {
      email: {
        contains: "@guest.purplexity.local",
      },
      createdAt: {
        lt: oneDayAgo,
      },
    },
  });

  return {
    deletedCount: result.count,
    message: `Cleaned up ${result.count} expired guest users`,
  };
}

// Get all guest users
export async function getAllGuestUsers() {
  return await prisma.user.findMany({
    where: {
      email: {
        contains: "@guest.purplexity.local",
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      dailyTokenLimit: true,
      createdAt: true,
      _count: {
        select: {
          conversations: true,
          queries: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

// Get all test users
export async function getAllTestUsers() {
  return await prisma.user.findMany({
    where: {
      email: {
        contains: "@test.purplexity.local",
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      dailyTokenLimit: true,
      createdAt: true,
      _count: {
        select: {
          conversations: true,
          queries: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

// Delete a specific guest or test user
export async function deleteTempUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (!isTempUser(user.email)) {
    throw new Error("Cannot delete non-temporary user via this endpoint");
  }

  await prisma.user.delete({
    where: { id: userId },
  });

  return {
    success: true,
    message: "Temporary user deleted successfully",
  };
}
