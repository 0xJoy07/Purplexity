"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  MessageSquarePlus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  MessagesSquare,
  Clock,
} from "lucide-react";
import type { ConversationSummary } from "@/lib/api";
import {
  getUserConversations,
  deleteConversation as apiDeleteConversation,
  getOrCreateGuestUser,
} from "@/lib/api";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewChat: () => void;
  refreshTrigger: number; // increment this to force refresh
}

export function Sidebar({
  isOpen,
  onToggle,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  refreshTrigger,
}: SidebarProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      const guest = await getOrCreateGuestUser();
      if (!guest) return;
      const convs = await getUserConversations(guest.userId, guest.token);
      // Sort by most recent first
      const sorted = convs.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      setConversations(sorted);
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations, refreshTrigger]);

  const handleDelete = async (
    e: React.MouseEvent,
    conversationId: string
  ) => {
    e.stopPropagation();
    try {
      setDeletingId(conversationId);
      const guest = await getOrCreateGuestUser();
      if (!guest) return;
      await apiDeleteConversation(conversationId, guest.token);
      setConversations((prev) =>
        prev.filter((c) => c.id !== conversationId)
      );
      // If we're deleting the active conversation, start a new chat
      if (activeConversationId === conversationId) {
        onNewChat();
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const formatTimestamp = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Group conversations by time period
  const groupConversations = (convs: ConversationSummary[]) => {
    const today: ConversationSummary[] = [];
    const yesterday: ConversationSummary[] = [];
    const thisWeek: ConversationSummary[] = [];
    const older: ConversationSummary[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);
    const weekStart = new Date(todayStart.getTime() - 7 * 86400000);

    convs.forEach((c) => {
      const date = new Date(c.updatedAt);
      if (date >= todayStart) today.push(c);
      else if (date >= yesterdayStart) yesterday.push(c);
      else if (date >= weekStart) thisWeek.push(c);
      else older.push(c);
    });

    return { today, yesterday, thisWeek, older };
  };

  const groups = groupConversations(conversations);

  const renderGroup = (label: string, items: ConversationSummary[]) => {
    if (items.length === 0) return null;
    return (
      <div key={label} className="mb-4">
        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/25">
          {label}
        </div>
        {items.map((conv) => (
          <motion.button
            key={conv.id}
            onClick={() => onSelectConversation(conv.id)}
            className={cn(
              "sidebar-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all group",
              activeConversationId === conv.id
                ? "bg-violet-500/15 text-white border border-violet-500/20"
                : "text-white/60 hover:text-white/90 hover:bg-white/[0.04]"
            )}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ x: 2 }}
            transition={{ duration: 0.15 }}
          >
            <MessagesSquare
              className={cn(
                "w-4 h-4 shrink-0",
                activeConversationId === conv.id
                  ? "text-violet-400"
                  : "text-white/30"
              )}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate font-medium">
                {conv.title || "New Conversation"}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <Clock className="w-2.5 h-2.5 text-white/20" />
                <span className="text-[10px] text-white/25">
                  {formatTimestamp(conv.updatedAt)}
                </span>
              </div>
            </div>
            <button
              onClick={(e) => handleDelete(e, conv.id)}
              disabled={deletingId === conv.id}
              className={cn(
                "sidebar-delete p-1.5 rounded-md text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all",
                deletingId === conv.id && "opacity-50"
              )}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </motion.button>
        ))}
      </div>
    );
  };

  return (
    <>
      {/* Toggle button (always visible) */}
      <motion.button
        onClick={onToggle}
        className={cn(
          "fixed top-4 z-50 p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-white/60 hover:text-white transition-all backdrop-blur-sm",
          isOpen ? "left-[268px]" : "left-4"
        )}
        animate={{ left: isOpen ? 268 : 16 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        whileTap={{ scale: 0.92 }}
      >
        {isOpen ? (
          <ChevronLeft className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </motion.button>

      {/* Sidebar panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            className="fixed left-0 top-0 bottom-0 z-40 w-[280px] bg-[#0d0d0f]/95 backdrop-blur-xl border-r border-white/[0.06] flex flex-col"
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {/* Logo */}
            <div className="p-5 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                  <span className="text-white font-bold text-sm">P</span>
                </div>
                <h1 className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-violet-300 to-indigo-300">
                  Purplexity
                </h1>
              </div>
            </div>

            {/* New Chat Button */}
            <div className="px-3 pb-3">
              <motion.button
                onClick={onNewChat}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-600/20 to-indigo-600/20 hover:from-violet-600/30 hover:to-indigo-600/30 border border-violet-500/20 text-white/90 text-sm font-medium transition-all"
              >
                <MessageSquarePlus className="w-4 h-4 text-violet-400" />
                <span>New Chat</span>
              </motion.button>
            </div>

            {/* Divider */}
            <div className="mx-3 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto p-2 pt-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-2 text-white/30 text-xs">
                    <div className="w-3 h-3 border-2 border-white/20 border-t-violet-400 rounded-full animate-spin" />
                    Loading...
                  </div>
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <MessagesSquare className="w-8 h-8 text-white/10 mb-3" />
                  <p className="text-xs text-white/25">No conversations yet</p>
                  <p className="text-[10px] text-white/15 mt-1">
                    Start a new chat to begin
                  </p>
                </div>
              ) : (
                <>
                  {renderGroup("Today", groups.today)}
                  {renderGroup("Yesterday", groups.yesterday)}
                  {renderGroup("This Week", groups.thisWeek)}
                  {renderGroup("Older", groups.older)}
                </>
              )}
            </div>

            {/* Bottom section */}
            <div className="p-3 border-t border-white/[0.04]">
              <div className="flex items-center gap-2 px-2 py-2 text-[11px] text-white/20">
                <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
                <span>Guest Session</span>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onToggle}
          />
        )}
      </AnimatePresence>
    </>
  );
}
