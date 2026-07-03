"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, History, Home, Library, LogIn, LogOut, PanelLeftClose, PanelLeftOpen, Plus, Trash2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationSummary } from "@/lib/api";
import { deleteConversation as apiDeleteConversation, getOrCreateGuestUser, getUserConversations } from "@/lib/api";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { gsap } from "gsap";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewChat: () => void;
  refreshTrigger: number;
}

export function Sidebar({ isOpen, onToggle, activeConversationId, onSelectConversation, onNewChat, refreshTrigger }: SidebarProps) {
  const pathname = usePathname();
  const { user, token, logout, isLoading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      if (user && token) {
        const res = await fetch(`http://localhost:5000/conversations/user/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const items = await res.json();
        setConversations(Array.isArray(items) ? items.sort((a: ConversationSummary, b: ConversationSummary) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) : []);
      } else {
        const guest = await getOrCreateGuestUser();
        if (!guest) return;
        const items = await getUserConversations(guest.userId, guest.token);
        setConversations(items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, token]);

  useEffect(() => { fetchConversations(); }, [fetchConversations, refreshTrigger]);

  const handleDelete = async (event: React.MouseEvent, conversationId: string) => {
    event.stopPropagation();
    if (deletingId) return;
    try {
      setDeletingId(conversationId);
      if (user && token) {
        await fetch(`http://localhost:5000/conversations/${conversationId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        const guest = await getOrCreateGuestUser();
        if (!guest) return;
        await apiDeleteConversation(conversationId, guest.token);
      }
      setConversations((current) => current.filter((c) => c.id !== conversationId));
      if (activeConversationId === conversationId) onNewChat();
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleLogout = async () => {
    gsap.to('.sidebar-user-row', { opacity: 0, y: 8, duration: 0.2 });
    await logout();
  };

  const navItems = [
    { label: "Home", icon: Home, href: "/" },
    { label: "Documents", icon: FileText, href: "/documents" },
    { label: "Profile", icon: Library, href: "/profile" },
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
          <motion.aside className="fixed inset-y-0 left-0 z-40 flex w-[300px] flex-col border-r border-sidebar-border bg-sidebar transition-colors" initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
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
              {navItems.map(({ label, icon: Icon, href }) => {
                const isActive = pathname === href;
                return (
                  <Link key={label} href={href} className={cn("flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors", isActive ? "bg-surface-hover font-medium text-foreground" : "text-text-muted hover:bg-surface-hover hover:text-foreground")}>
                    <Icon className="h-[17px] w-[17px]" />{label}
                  </Link>
                );
              })}
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

            {/* User footer */}
            <div className="m-3">
              {!authLoading && user ? (
                <div className="sidebar-user-row flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface p-3">
                  {user.profileImage ? (
                    <img src={user.profileImage} alt={user.name} className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft">
                      <User className="h-4 w-4 text-accent" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">{user.name}</p>
                    <p className="truncate text-[10px] text-text-subtle">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <ThemeToggle />
                    <button onClick={handleLogout} title="Sign out" className="rounded-lg p-1.5 text-text-subtle transition-colors hover:bg-surface-hover hover:text-foreground">
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface p-3">
                  <div>
                    <p className="text-xs font-medium text-foreground">Guest workspace</p>
                    <p className="mt-1 text-[11px] leading-4 text-text-subtle">Sign in to secure research</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <ThemeToggle />
                    <Link href="/signin" className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-accent transition-colors hover:bg-accent-soft">
                      <LogIn className="h-3.5 w-3.5" />
                      Sign in
                    </Link>
                  </div>
                </div>
              )}
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
