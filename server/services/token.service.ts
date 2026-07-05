import { prisma } from "../config/db.config";

// ── Constants ─────────────────────────────────────────────────────────────────
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

// ── Token Calculation ─────────────────────────────────────────────────────────

/**
 * Estimate token count for a string.
 * Uses a dual-method average (character-based + word-based) to approximate
 * the BPE tokenisation used by LLMs.
 *
 * 1 token ≈ 4 English characters, 100 tokens ≈ 75 words.
 */
export function calculateTokens(text: string): number {
  const cleanText = text.trim().replace(/\s+/g, " ");
  if (cleanText.length === 0) return 0;

  const charBasedTokens = Math.ceil(cleanText.length / 4);
  const wordCount = cleanText.split(" ").length;
  const wordBasedTokens = Math.ceil((wordCount * 100) / 75);

  return Math.ceil((charBasedTokens + wordBasedTokens) / 2);
}

// ── IST Helpers ───────────────────────────────────────────────────────────────

/** Return the start-of-today in IST as a UTC Date. */
function getTodayMidnightIST(): Date {
  const now = new Date();
  // Current IST time
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  // Midnight IST today (in UTC representation)
  const istMidnight = new Date(
    Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate())
  );
  // Convert back to real UTC by subtracting IST offset
  return new Date(istMidnight.getTime() - IST_OFFSET_MS);
}

/** Return next 12:00 AM IST as an ISO string (for client display). */
export function getNextResetTimeIST(): string {
  const todayMidnight = getTodayMidnightIST();
  const nextMidnight = new Date(todayMidnight.getTime() + 24 * 60 * 60 * 1000);
  return nextMidnight.toISOString();
}

// ── Daily Reset Logic ─────────────────────────────────────────────────────────

/**
 * Check whether the user's daily counter needs resetting.
 * If `lastResetAt` is before today's midnight IST, atomically reset
 * `tokensUsedToday` to 0 and update `lastResetAt`.
 */
export async function checkAndResetDaily(userId: string) {
  const todayMidnight = getTodayMidnightIST();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastResetAt: true },
  });

  if (!user) throw new Error("User not found");

  // If the last reset was before today's midnight IST → reset
  if (user.lastResetAt < todayMidnight) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        tokensUsedToday: 0,
        lastResetAt: todayMidnight,
      },
    });
  }
}

// ── Public Interfaces ─────────────────────────────────────────────────────────

export interface TokenUsageInfo {
  userId: string;
  date: Date;
  tokensUsedToday: number;
  tokensRemaining: number;
  dailyLimit: number;
  contextWindowLimit: number;
  requestCount: number;
  canMakeRequest: boolean;
  resetTime: string;
}

// ── Core Functions ────────────────────────────────────────────────────────────

/**
 * Get the user's token usage for today, performing a daily reset if needed.
 */
export async function getTodayTokenUsage(userId: string): Promise<TokenUsageInfo> {
  // Ensure daily reset has happened
  await checkAndResetDaily(userId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      dailyTokenLimit: true,
      tokensUsedToday: true,
      contextWindowLimit: true,
    },
  });

  if (!user) throw new Error("User not found");

  // Upsert daily analytics row (kept for historical tracking)
  const tokenUsage = await prisma.tokenUsage.upsert({
    where: { userId_date: { userId, date: today } },
    update: {},
    create: { userId, date: today, tokensUsed: 0, requestCount: 0 },
  });

  const tokensRemaining = Math.max(0, user.dailyTokenLimit - user.tokensUsedToday);

  return {
    userId,
    date: today,
    tokensUsedToday: user.tokensUsedToday,
    tokensRemaining,
    dailyLimit: user.dailyTokenLimit,
    contextWindowLimit: user.contextWindowLimit,
    requestCount: tokenUsage.requestCount,
    canMakeRequest: tokensRemaining > 0,
    resetTime: getNextResetTimeIST(),
  };
}

/**
 * Record token usage after a successful request.
 * Increments both the daily counter (`tokensUsedToday`) and the lifetime
 * accumulator (`tokensUsed`) for analytics.
 */
export async function trackTokenUsage(
  userId: string,
  tokensUsed: number
): Promise<TokenUsageInfo> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [tokenUsage, user] = await prisma.$transaction([
    prisma.tokenUsage.upsert({
      where: { userId_date: { userId, date: today } },
      update: {
        tokensUsed: { increment: tokensUsed },
        requestCount: { increment: 1 },
      },
      create: {
        userId,
        date: today,
        tokensUsed,
        requestCount: 1,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        tokensUsedToday: { increment: tokensUsed },
        tokensUsed: { increment: tokensUsed }, // lifetime analytics
      },
      select: {
        dailyTokenLimit: true,
        tokensUsedToday: true,
        contextWindowLimit: true,
      },
    }),
  ]);

  const tokensRemaining = Math.max(0, user.dailyTokenLimit - user.tokensUsedToday);

  return {
    userId,
    date: today,
    tokensUsedToday: user.tokensUsedToday,
    tokensRemaining,
    dailyLimit: user.dailyTokenLimit,
    contextWindowLimit: user.contextWindowLimit,
    requestCount: tokenUsage.requestCount,
    canMakeRequest: tokensRemaining > 0,
    resetTime: getNextResetTimeIST(),
  };
}

// ── Context Window Estimation & Trimming ──────────────────────────────────────

/** Calculate tokens for a complete request (query + web results + answer). */
export function calculateRequestTokens(query: string, webResults: string, answer: string): number {
  return calculateTokens(query) + calculateTokens(webResults) + calculateTokens(answer);
}

/**
 * Pre-flight estimate: how many tokens will this context consume?
 */
export function estimateContextTokens(
  query: string,
  webResults: string,
  conversationHistory?: string,
  fileContext?: string
): number {
  let total = calculateTokens(query) + calculateTokens(webResults);
  if (conversationHistory) total += calculateTokens(conversationHistory);
  if (fileContext) total += calculateTokens(fileContext);
  return total;
}

export interface TrimmedContext {
  webResults: string;
  conversationHistory: string | undefined;
  fileContext: string | undefined;
  contextTrimmed: boolean;
  trimDetails?: string;
}

/**
 * Trim context to fit within the context window limit.
 * Priority order for trimming:
 *   1. Drop oldest conversation turns
 *   2. Drop least-relevant (last) web results
 *   3. Truncate file content
 */
export function trimContextToFit(
  query: string,
  webResults: string,
  conversationHistory: string | undefined,
  fileContext: string | undefined,
  limit: number
): TrimmedContext {
  let trimmed = false;
  let trimDetails: string[] = [];

  let currentWebResults = webResults;
  let currentHistory = conversationHistory;
  let currentFileContext = fileContext;

  const estimate = () =>
    estimateContextTokens(query, currentWebResults, currentHistory, currentFileContext);

  // Already fits?
  if (estimate() <= limit) {
    return {
      webResults: currentWebResults,
      conversationHistory: currentHistory,
      fileContext: currentFileContext,
      contextTrimmed: false,
    };
  }

  // Step 1: Drop oldest conversation turns
  if (currentHistory) {
    const turns = currentHistory.split("\n\n");
    while (turns.length > 0 && estimate() > limit) {
      turns.shift(); // drop the oldest turn
      currentHistory = turns.length > 0 ? turns.join("\n\n") : undefined;
      trimmed = true;
    }
    if (trimmed) trimDetails.push("older conversation history");
  }

  if (estimate() <= limit) {
    return {
      webResults: currentWebResults,
      conversationHistory: currentHistory,
      fileContext: currentFileContext,
      contextTrimmed: trimmed,
      trimDetails: trimmed ? trimDetails.join(", ") : undefined,
    };
  }

  // Step 2: Drop least-relevant (last) web results
  try {
    let parsedResults = JSON.parse(currentWebResults);
    if (Array.isArray(parsedResults) && parsedResults.length > 1) {
      while (parsedResults.length > 1 && estimate() > limit) {
        parsedResults.pop();
        currentWebResults = JSON.stringify(parsedResults);
        trimmed = true;
      }
      if (!trimDetails.includes("web results")) trimDetails.push("some web results");
    }
  } catch {
    // webResults is not JSON, truncate raw string
    while (calculateTokens(currentWebResults) > limit * 0.3 && currentWebResults.length > 500) {
      currentWebResults = currentWebResults.slice(0, Math.floor(currentWebResults.length * 0.7));
      trimmed = true;
    }
    if (!trimDetails.includes("web results")) trimDetails.push("web results text");
  }

  if (estimate() <= limit) {
    return {
      webResults: currentWebResults,
      conversationHistory: currentHistory,
      fileContext: currentFileContext,
      contextTrimmed: trimmed,
      trimDetails: trimmed ? trimDetails.join(", ") : undefined,
    };
  }

  // Step 3: Truncate file content
  if (currentFileContext) {
    const overageTokens = estimate() - limit;
    const charsToRemove = overageTokens * 4; // rough reverse: 1 token ≈ 4 chars
    if (charsToRemove >= currentFileContext.length) {
      currentFileContext = undefined;
    } else {
      currentFileContext = currentFileContext.slice(0, currentFileContext.length - charsToRemove) +
        "\n[…file content truncated to fit context window…]";
    }
    trimmed = true;
    trimDetails.push("file content");
  }

  return {
    webResults: currentWebResults,
    conversationHistory: currentHistory,
    fileContext: currentFileContext,
    contextTrimmed: trimmed,
    trimDetails: trimmed ? trimDetails.join(", ") : undefined,
  };
}

// ── History / Admin ───────────────────────────────────────────────────────────

/** Get user's token usage history (daily analytics rows). */
export async function getUserTokenHistory(userId: string, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  return await prisma.tokenUsage.findMany({
    where: { userId, date: { gte: startDate } },
    orderBy: { date: "desc" },
  });
}

/** Update user's daily token limit (admin / subscription changes). */
export async function updateUserTokenLimit(userId: string, newLimit: number) {
  return await prisma.user.update({
    where: { id: userId },
    data: { tokenLimit: newLimit, dailyTokenLimit: newLimit },
  });
}
