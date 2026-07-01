const API_BASE = "http://localhost:5000";

export interface Source {
  title: string;
  url: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources?: Source[];
  followUps?: string[];
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface ConversationSummary {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
}

// ===== Auth Helpers =====

export async function getOrCreateGuestUser() {
  if (typeof window === "undefined") return null;
  
  const existingToken = localStorage.getItem("guestToken");
  const existingUserId = localStorage.getItem("guestUserId");

  if (existingToken && existingUserId) {
    return { token: existingToken, userId: existingUserId };
  }

  const res = await fetch(`${API_BASE}/users/guest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dailyTokenLimit: 50000, expiresInHours: 24 }),
  });

  if (!res.ok) {
    throw new Error("Failed to create guest user");
  }

  const data = await res.json();
  localStorage.setItem("guestToken", data.token);
  localStorage.setItem("guestUserId", data.userId);

  return { token: data.token, userId: data.userId };
}

// ===== Conversation CRUD =====

export async function createConversation(userId: string, token: string) {
  const res = await fetch(`${API_BASE}/conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ userId }),
  });

  if (!res.ok) {
    throw new Error("Failed to create conversation");
  }

  return res.json() as Promise<Conversation>;
}

export async function getUserConversations(userId: string, token: string) {
  const res = await fetch(`${API_BASE}/conversations/user/${userId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch conversations");
  }

  return res.json() as Promise<ConversationSummary[]>;
}

export async function getConversation(conversationId: string, token: string) {
  const res = await fetch(`${API_BASE}/conversations/${conversationId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch conversation");
  }

  return res.json() as Promise<Conversation>;
}

export async function deleteConversation(conversationId: string, token: string) {
  const res = await fetch(`${API_BASE}/conversations/${conversationId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to delete conversation");
  }

  return res.json();
}

// ===== Messaging =====

export async function sendMessage(conversationId: string, message: string, userId: string, token: string) {
  const res = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message, userId }),
  });

  if (!res.ok) {
    let errMsg = "Failed to send message";
    try {
      const data = await res.json();
      if (data.message) errMsg = data.message;
      else if (data.error) errMsg = data.error;
    } catch (e) {}
    throw new Error(errMsg);
  }

  return res.json() as Promise<{
    userMessage: Message;
    assistantMessage: Message;
    sources: Source[];
    followUps: string[];
    tokenUsage: any;
  }>;
}
