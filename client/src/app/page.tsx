"use client";

import { useState, useCallback, useEffect } from "react";
import { AnimatedAIChat } from "@/components/AnimatedAIChat";
import { Sidebar } from "@/components/Sidebar";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (window.innerWidth >= 1024) setSidebarOpen(true);
  }, []);

  const handleNewChat = useCallback(() => {
    setActiveConversationId(null);
  }, []);

  const handleConversationCreated = useCallback((conversationId: string) => {
    setActiveConversationId(conversationId);
    // Trigger sidebar refresh to show the new conversation
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const handleSelectConversation = useCallback((conversationId: string) => {
    setActiveConversationId(conversationId);
    // Close sidebar on mobile after selection
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, []);

  return (
    <main className="flex h-screen overflow-hidden bg-[#fcfcf9]">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((prev) => !prev)}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        refreshTrigger={refreshTrigger}
      />
      <AnimatedAIChat
        activeConversationId={activeConversationId}
        onConversationCreated={handleConversationCreated}
        onNewChat={handleNewChat}
        sidebarOpen={sidebarOpen}
      />
    </main>
  );
}
