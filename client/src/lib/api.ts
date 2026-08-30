const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

// ===== Token Usage =====

export interface TokenUsageResponse {
  userId: string;
  tokensUsedToday: number;
  tokensRemaining: number;
  dailyLimit: number;
  contextWindowLimit: number;
  requestCount: number;
  canMakeRequest: boolean;
  resetTime: string;
}

export async function getTokenUsage(userId: string, token: string): Promise<TokenUsageResponse> {
  const res = await fetch(`${API_BASE}/tokens/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch token usage");
  return res.json();
}

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

export interface UserDocument {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
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

export async function sendMessage(
  conversationId: string,
  message: string,
  userId: string,
  token: string,
  files?: File[]
) {
  let body: BodyInit;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  if (files && files.length > 0) {
    // Multipart form data when files are attached
    const formData = new FormData();
    formData.append("message", message);
    formData.append("userId", userId);
    files.forEach((file) => {
      console.log(`[sendMessage] Appending file: ${file.name} (${file.type}, ${file.size} bytes)`);
      formData.append("files", file);
    });
    body = formData;
    console.log(`[sendMessage] Sending FormData with ${files.length} file(s)`);
    // Don't set Content-Type — browser sets it with boundary automatically
  } else {
    // Plain JSON when no files
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({ message, userId });
    console.log("[sendMessage] Sending JSON (no files)");
  }

  console.log(`[sendMessage] POST /conversations/${conversationId}/messages`);
  const res = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
    method: "POST",
    headers,
    body,
  });



  if (!res.ok) {
    if (res.status === 429) {
      let errorData: any = {};
      try { errorData = await res.json(); } catch {}
      const err = new Error(errorData.message || "Daily token limit reached") as any;
      err.status = 429;
      err.tokenUsage = errorData.tokenUsage;
      throw err;
    }
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
    attachments?: { name: string; type: string; url: string }[];
    contextTrimmed?: boolean;
    tokenUsage: {
      tokensUsedToday: number;
      tokensRemaining: number;
      dailyLimit: number;
      contextWindowLimit: number;
      requestCount: number;
      resetTime: string;
    };
  }>;
}

// ===== Documents =====

export async function getUserDocuments(token: string): Promise<UserDocument[]> {
  const res = await fetch(`${API_BASE}/api/files`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch documents");
  }

  return res.json();
}

export async function deleteUserDocument(fileId: string, token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/files/${fileId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to delete document");
  }
}

export function getFileDownloadUrl(fileId: string): string {
  return `${API_BASE}/api/files/${fileId}`;
}

// ===== Profile / Auth Endpoints =====

export async function updateProfile(data: FormData | { name: string; email: string }, token: string) {
  let body: BodyInit;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  if (data instanceof FormData) {
    body = data;
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(data);
  }

  const res = await fetch(`${API_BASE}/auth/profile`, {
    method: "PUT",
    headers,
    body,
  });

  if (!res.ok) {
    let errMsg = "Failed to update profile";
    try {
      const errData = await res.json();
      if (errData.error) errMsg = errData.error;
    } catch (e) {}
    throw new Error(errMsg);
  }

  return res.json();
}

export async function updatePassword(data: any, token: string) {
  const res = await fetch(`${API_BASE}/auth/password`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    let errMsg = "Failed to update password";
    try {
      const errData = await res.json();
      if (errData.error) errMsg = errData.error;
    } catch (e) {}
    throw new Error(errMsg);
  }

  return res.json();
}

export async function resendVerificationEmail(token: string) {
  const res = await fetch(`${API_BASE}/auth/resend-verification`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    let errMsg = "Failed to resend verification email";
    try {
      const errData = await res.json();
      if (errData.error) errMsg = errData.error;
    } catch (e) {}
    throw new Error(errMsg);
  }

  return res.json();
}

// ===== Settings Page APIs =====

export async function deleteAccount(confirmEmail: string, token: string) {
  const res = await fetch(`${API_BASE}/auth/account`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ confirmEmail }),
  });

  if (!res.ok) {
    let errMsg = "Failed to delete account";
    try {
      const errData = await res.json();
      if (errData.error) errMsg = errData.error;
    } catch (e) {}
    throw new Error(errMsg);
  }

  return res.json();
}

export async function clearSearchHistory(token: string) {
  const res = await fetch(`${API_BASE}/auth/search-history`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    let errMsg = "Failed to clear search history";
    try {
      const errData = await res.json();
      if (errData.error) errMsg = errData.error;
    } catch (e) {}
    throw new Error(errMsg);
  }

  return res.json();
}

export async function getActiveSessions(token: string) {
  const res = await fetch(`${API_BASE}/auth/sessions`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error("Failed to fetch sessions");
  return res.json();
}

export async function signOutAllDevices(token: string) {
  const res = await fetch(`${API_BASE}/auth/sessions/sign-out-all`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error("Failed to sign out of all devices");
  return res.json();
}

export async function getTokenHistory(userId: string, token: string, days = 7) {
  const res = await fetch(`${API_BASE}/tokens/${userId}/history?days=${days}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error("Failed to fetch token history");
  return res.json();
}
