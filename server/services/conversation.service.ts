import { prisma } from "../config/db.config";
import type { MessageRole } from "@prisma/client";

export interface CreateConversationData {
  userId: string;
  title?: string;
}

export interface CreateMessageData {
  conversationId: string;
  role: MessageRole;
  content: string;
  sources?: any[];
  followUps?: string[];
}

// Conversation operations
export async function createConversation(data: CreateConversationData) {
  return await prisma.conversation.create({
    data: {
      userId: data.userId,
      title: data.title || "New Conversation",
    },
  });
}

export async function getConversationById(conversationId: string) {
  return await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          profileImage: true,
        },
      },
    },
  });
}

export async function getUserConversations(userId: string, limit = 50) {
  return await prisma.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      messages: {
        take: 1,
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: { messages: true },
      },
    },
  });
}

export async function updateConversationTitle(
  conversationId: string,
  title: string
) {
  return await prisma.conversation.update({
    where: { id: conversationId },
    data: { title },
  });
}

export async function deleteConversation(conversationId: string) {
  return await prisma.conversation.delete({
    where: { id: conversationId },
  });
}

// Message operations
export async function createMessage(data: CreateMessageData) {
  return await prisma.message.create({
    data: {
      conversationId: data.conversationId,
      role: data.role,
      content: data.content,
      sources: data.sources || [],
      followUps: data.followUps || [],
    },
  });
}

export async function getConversationMessages(
  conversationId: string,
  limit = 100
) {
  return await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function deleteMessage(messageId: string) {
  return await prisma.message.delete({
    where: { id: messageId },
  });
}

// Combined operations for chat flow
export async function addMessageToConversation(
  conversationId: string,
  userMessage: string,
  assistantMessage: string,
  sources?: any[],
  followUps?: string[]
) {
  // Create user message
  const userMsg = await createMessage({
    conversationId,
    role: "user",
    content: userMessage,
  });

  // Create assistant message
  const assistantMsg = await createMessage({
    conversationId,
    role: "assistant",
    content: assistantMessage,
    sources,
    followUps,
  });

  // Update conversation timestamp
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  return { userMsg, assistantMsg };
}

// Auto-generate conversation title from first message
export async function generateConversationTitle(
  conversationId: string,
  firstUserMessage: string
) {
  // Take first 50 characters or until first newline
  const title =
    firstUserMessage.split("\n")[0].substring(0, 50) +
    (firstUserMessage.length > 50 ? "..." : "");

  return await updateConversationTitle(conversationId, title);
}
