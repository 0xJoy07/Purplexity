import { prisma } from "../config/db.config";
import type { AuthProvider } from "../generated/client";

export interface CreateUserData {
  email: string;
  provider: AuthProvider;
  name: string;
  profileImage?: string;
}

export interface SaveQueryData {
  userId: string;
  query: string;
  answer: string;
  followUps: string[];
  sources: any[];
}

// User operations
export async function findOrCreateUser(data: CreateUserData) {
  return await prisma.user.upsert({
    where: { email: data.email },
    update: {
      name: data.name,
      profileImage: data.profileImage,
    },
    create: {
      email: data.email,
      provider: data.provider,
      name: data.name,
      profileImage: data.profileImage,
    },
  });
}

export async function getUserById(userId: string) {
  return await prisma.user.findUnique({
    where: { id: userId },
    include: {
      conversations: {
        orderBy: { updatedAt: "desc" },
        take: 10,
        include: {
          _count: {
            select: { messages: true },
          },
        },
      },
      queries: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });
}

export async function updateUserProfile(
  userId: string,
  data: { name?: string; profileImage?: string }
) {
  return await prisma.user.update({
    where: { id: userId },
    data,
  });
}

export async function deleteUser(userId: string) {
  return await prisma.user.delete({
    where: { id: userId },
  });
}

// Query operations (legacy standalone queries)
export async function saveQuery(data: SaveQueryData) {
  return await prisma.query.create({
    data: {
      userId: data.userId,
      query: data.query,
      answer: data.answer,
      followUps: data.followUps,
      sources: data.sources,
    },
  });
}

export async function getQueryById(queryId: string) {
  return await prisma.query.findUnique({
    where: { id: queryId },
    include: {
      user: true,
    },
  });
}

export async function getUserQueries(userId: string, limit = 20) {
  return await prisma.query.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function deleteQuery(queryId: string) {
  return await prisma.query.delete({
    where: { id: queryId },
  });
}

// Statistics
export async function getUserStats(userId: string) {
  const [conversationCount, messageCount, queryCount] = await Promise.all([
    prisma.conversation.count({ where: { userId } }),
    prisma.message.count({
      where: { conversation: { userId } },
    }),
    prisma.query.count({ where: { userId } }),
  ]);

  return {
    conversationCount,
    messageCount,
    queryCount,
    totalInteractions: messageCount + queryCount,
  };
}
