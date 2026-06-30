const API_BASE = "http://localhost:3000";

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

export async function getOrCreateGuestUser() {
  if (typeof window === "undefined") return null;
  
  const existingToken = localStorage.getItem("guestToken");
  const existingUserId = localStorage.getItem("guestUserId");

  if (existingToken && existingUserId) {
    // Optionally check if token is expired, but for now we trust it
    return { token: existingToken, userId: existingUserId };
  }

  // Create new guest
  const res = await fetch(`${API_BASE}/users/guest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dailyTokenLimit: 1000, expiresInHours: 24 }),
  });

  if (!res.ok) {
    throw new Error("Failed to create guest user");
  }

  const data = await res.json();
  localStorage.setItem("guestToken", data.token);
  localStorage.setItem("guestUserId", data.userId);

  return { token: data.token, userId: data.userId };
}

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
    throw new Error("Failed to send message");
  }

  return res.json() as Promise<{
    userMessage: Message;
    assistantMessage: Message;
    sources: Source[];
    followUps: string[];
    tokenUsage: any;
  }>;
}
