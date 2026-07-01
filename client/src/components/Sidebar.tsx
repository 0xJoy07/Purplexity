"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Compass, History, Home, Library, PanelLeftClose, PanelLeftOpen, Plus, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationSummary } from "@/lib/api";
import { deleteConversation as apiDeleteConversation, getOrCreateGuestUser, getUserConversations } from "@/lib/api";

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
        <button type="button" onClick={onToggle} aria-label="Open sidebar" className="fixed left-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-xl border border-[#deded9] bg-[#fcfcf9] text-[#6f706b] shadow-sm transition-colors hover:bg-[#f1f1ed] hover:text-[#171714]">
          <PanelLeftOpen className="h-[18px] w-[18px]" />
        </button>
      )}

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.aside className="fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-[#e5e5df] bg-[#f7f7f4]" initial={{ x: -248 }} animate={{ x: 0 }} exit={{ x: -248 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
            <div className="flex h-16 items-center justify-between px-3">
              <button type="button" onClick={onNewChat} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[#191a17]">
                <span className="purplexity-mark" aria-hidden="true"><span>P</span></span>
                <span className="text-[17px] font-semibold tracking-[-0.03em]">purplexity</span>
              </button>
              <button type="button" onClick={onToggle} aria-label="Close sidebar" className="rounded-lg p-2 text-[#8a8b85] transition-colors hover:bg-[#eaeae5] hover:text-[#22231f]">
                <PanelLeftClose className="h-[18px] w-[18px]" />
              </button>
            </div>

            <div className="px-3 pb-3">
              <button type="button" onClick={onNewChat} className="flex h-10 w-full items-center gap-3 rounded-lg border border-[#ddddd7] bg-white px-3 text-sm font-medium text-[#33342f] shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-colors hover:border-[#c9c9c2]">
                <Plus className="h-4 w-4 text-[#168b86]" />
                New thread
                <span className="ml-auto text-[11px] font-normal text-[#a1a29c]">Ctrl I</span>
              </button>
            </div>

            <nav className="space-y-0.5 px-3">
              {navItems.map(({ label, icon: Icon, active }) => (
                <button key={label} type="button" className={cn("flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors", active ? "bg-[#e9e9e4] font-medium text-[#20211d]" : "text-[#6d6e68] hover:bg-[#ededE8] hover:text-[#252621]")}>
                  <Icon className="h-[17px] w-[17px]" />{label}
                </button>
              ))}
            </nav>

            <div className="mx-4 my-4 h-px bg-[#e1e1dc]" />

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center gap-2 px-5 pb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[#989991]"><History className="h-3.5 w-3.5" />Recent</div>
              <div className="no-scrollbar flex-1 overflow-y-auto px-2">
                {isLoading ? (
                  <div className="px-3 py-5 text-xs text-[#9b9c95]">Loading threads…</div>
                ) : conversations.length === 0 ? (
                  <div className="px-3 py-5 text-xs leading-5 text-[#9b9c95]">Your research threads will appear here.</div>
                ) : conversations.map((conversation) => (
                  <button key={conversation.id} type="button" onClick={() => onSelectConversation(conversation.id)} className={cn("sidebar-item group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors", activeConversationId === conversation.id ? "bg-[#e4efed] font-medium text-[#176f6b]" : "text-[#64655f] hover:bg-[#ecece7] hover:text-[#292a25]")}>
                    <Search className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span className="min-w-0 flex-1 truncate">{conversation.title || "New thread"}</span>
                    <span role="button" tabIndex={0} onClick={(event) => handleDelete(event, conversation.id)} className={cn("sidebar-delete rounded p-1 text-[#999a94] hover:bg-[#deded8] hover:text-[#b34a46]", deletingId === conversation.id && "opacity-40")}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="m-3 rounded-xl border border-[#e1e1db] bg-[#fbfbf8] p-3">
              <p className="text-xs font-medium text-[#383934]">Guest workspace</p>
              <p className="mt-1 text-[11px] leading-4 text-[#92938c]">Sign in to sync your research.</p>
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
