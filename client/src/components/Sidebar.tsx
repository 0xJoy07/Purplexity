"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Compass, History, Home, Library, PanelLeftClose, PanelLeftOpen, Plus, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationSummary } from "@/lib/api";
import { deleteConversation as apiDeleteConversation, getOrCreateGuestUser, getUserConversations } from "@/lib/api";
import { ThemeToggle } from "./ThemeToggle";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewChat: () => void;
  refreshTrigger: number;
}

export function Sidebar({ isOpen, onToggle, activeConversationId, onSelectConversation, onNewChat, refreshTrigger }: SidebarProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      const guest = await getOrCreateGuestUser();
      if (!guest) return;
      const items = await getUserConversations(guest.userId, guest.token);
      setConversations(items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations, refreshTrigger]);

  const handleDelete = async (event: React.MouseEvent, conversationId: string) => {
    event.stopPropagation();
    if (deletingId) return; // Prevent double clicks or concurrent deletes
    try {
      setDeletingId(conversationId);
      const guest = await getOrCreateGuestUser();
      if (!guest) return;
      await apiDeleteConversation(conversationId, guest.token);
      setConversations((current) => current.filter((conversation) => conversation.id !== conversationId));
      if (activeConversationId === conversationId) onNewChat();
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const navItems = [
    { label: "Home", icon: Home, active: true },
    { label: "Discover", icon: Compass, active: false },
    { label: "Library", icon: Library, active: false },
  ];

  return (
    <>
      {!isOpen && (
        <button type="button" onClick={onToggle} aria-label="Open sidebar" className="fixed left-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-text-muted shadow-sm transition-colors hover:bg-surface-hover hover:text-foreground">
          <PanelLeftOpen className="h-[18px] w-[18px]" />
        </button>
      )}

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.aside className="fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-sidebar-border bg-sidebar transition-colors" initial={{ x: -248 }} animate={{ x: 0 }} exit={{ x: -248 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
            <div className="flex h-16 items-center justify-between px-3">
              <button type="button" onClick={onNewChat} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-foreground">
                <img src="/logo.png" alt="Purplexity Logo" className="h-[22px] w-auto" />
                <span className="text-[17px] font-semibold tracking-[-0.03em]">purplexity</span>
              </button>
              <button type="button" onClick={onToggle} aria-label="Close sidebar" className="rounded-lg p-2 text-text-subtle transition-colors hover:bg-surface-hover hover:text-foreground">
                <PanelLeftClose className="h-[18px] w-[18px]" />
              </button>
            </div>

            <div className="px-3 pb-3">
              <button type="button" onClick={onNewChat} className="flex h-10 w-full items-center gap-3 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-colors hover:border-border-focus">
                <Plus className="h-4 w-4 text-accent" />
                New thread
                <span className="ml-auto text-[11px] font-normal text-text-subtle">Ctrl I</span>
              </button>
            </div>

            <nav className="space-y-0.5 px-3">
              {navItems.map(({ label, icon: Icon, active }) => (
                <button key={label} type="button" className={cn("flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors", active ? "bg-surface-hover font-medium text-foreground" : "text-text-muted hover:bg-surface-hover hover:text-foreground")}>
                  <Icon className="h-[17px] w-[17px]" />{label}
                </button>
              ))}
            </nav>

            <div className="mx-4 my-4 h-px bg-border" />

            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className="flex items-center gap-2 px-5 pb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-text-subtle"><History className="h-3.5 w-3.5" />Recent</div>
              
              {isLoading ? (
                <div className="px-5 py-5 text-xs text-text-subtle">Loading threads…</div>
              ) : conversations.length === 0 ? (
                <div className="px-5 py-5 text-xs leading-5 text-text-subtle">Your research threads will appear here.</div>
              ) : (
                <div className="space-y-0.5 px-2">
                  {conversations.map((conversation) => (
                    <button key={conversation.id} type="button" onClick={() => onSelectConversation(conversation.id)} className={cn("sidebar-item group flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition-colors", activeConversationId === conversation.id ? "bg-surface-active font-medium text-accent" : "text-text-muted hover:bg-surface-hover hover:text-foreground")}>
                      <span className="truncate">{conversation.title || "New Conversation"}</span>
                      <span role="button" tabIndex={0} onClick={(event) => handleDelete(event, conversation.id)} className={cn("sidebar-delete shrink-0 rounded p-1 text-text-subtle hover:bg-surface-hover hover:text-red-500", deletingId === conversation.id && "opacity-40")}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="m-3 flex items-center justify-between rounded-xl border border-border-subtle bg-surface p-3">
              <div>
                <p className="text-xs font-medium text-foreground">Guest workspace</p>
                <p className="mt-1 text-[11px] leading-4 text-text-subtle">Sign in to sync your research.</p>
              </div>
              <ThemeToggle />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && <motion.button type="button" aria-label="Close sidebar overlay" className="fixed inset-0 z-30 bg-black/20 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onToggle} />}
      </AnimatePresence>
    </>
  );
}
