import { prisma } from "../config/db.config";

// Token calculation: 1 token ≈ 4 English characters, 100 tokens ≈ 75 words
export function calculateTokens(text: string): number {
  // Remove extra whitespace
  const cleanText = text.trim().replace(/\s+/g, " ");
  
  // Calculate based on characters (1 token = 4 chars)
  const charBasedTokens = Math.ceil(cleanText.length / 4);
  
  // Calculate based on words (100 tokens = 75 words)
  const wordCount = cleanText.split(" ").length;
  const wordBasedTokens = Math.ceil((wordCount * 100) / 75);
  
  // Use the average of both methods for better accuracy
  return Math.ceil((charBasedTokens + wordBasedTokens) / 2);
}

export interface TokenUsageInfo {
  userId: string;
  date: Date;
  tokensUsed: number;
  tokensRemaining: number;
  dailyLimit: number;
  requestCount: number;
  canMakeRequest: boolean;
}

// Get or create today's token usage for a user
export async function getTodayTokenUsage(userId: string): Promise<TokenUsageInfo> {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of day

  // Get user to check daily limit
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dailyTokenLimit: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Get or create token usage record for today
  const tokenUsage = await prisma.tokenUsage.upsert({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
    update: {},
    create: {
      userId,
      date: today,
      tokensUsed: 0,
      requestCount: 0,
    },
  });

  const tokensRemaining = Math.max(0, user.dailyTokenLimit - tokenUsage.tokensUsed);
  const canMakeRequest = tokensRemaining > 0;

  return {
    userId,
    date: today,
    tokensUsed: tokenUsage.tokensUsed,
    tokensRemaining,
    dailyLimit: user.dailyTokenLimit,
    requestCount: tokenUsage.requestCount,
    canMakeRequest,
  };
}

// Track token usage for a request
export async function trackTokenUsage(
  userId: string,
  tokensUsed: number
): Promise<TokenUsageInfo> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Update token usage
  const tokenUsage = await prisma.tokenUsage.upsert({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
    update: {
      tokensUsed: {
        increment: tokensUsed,
      },
      requestCount: {
        increment: 1,
      },
    },
    create: {
      userId,
      date: today,
      tokensUsed,
      requestCount: 1,
    },
  });

  // Get user's daily limit
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dailyTokenLimit: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const tokensRemaining = Math.max(0, user.dailyTokenLimit - tokenUsage.tokensUsed);

  return {
    userId,
    date: today,
    tokensUsed: tokenUsage.tokensUsed,
    tokensRemaining,
    dailyLimit: user.dailyTokenLimit,
    requestCount: tokenUsage.requestCount,
    canMakeRequest: tokensRemaining > 0,
  };
}

// Calculate tokens for a complete request (query + web results + answer)
export function calculateRequestTokens(query: string, webResults: string, answer: string): number {
  const queryTokens = calculateTokens(query);
  const webTokens = calculateTokens(webResults);
  const answerTokens = calculateTokens(answer);
  
  return queryTokens + webTokens + answerTokens;
}

// Get user's token usage history
export async function getUserTokenHistory(userId: string, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  return await prisma.tokenUsage.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
      },
    },
    orderBy: {
      date: "desc",
    },
  });
}

// Update user's daily token limit (for admin/subscription changes)
export async function updateUserTokenLimit(userId: string, newLimit: number) {
  return await prisma.user.update({
    where: { id: userId },
    data: { dailyTokenLimit: newLimit },
  });
}
