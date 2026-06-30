"use client";

import {
  ArrowUp, BookOpen, Check, ChevronLeft, Command, ExternalLink,
  FileText, Globe2, LoaderCircle, Menu, MessageSquare, Paperclip,
  Plus, Search, Sparkles, Trash2, X,
} from "lucide-react";
import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";

type Source = { title: string; url: string };
type Message = { id: string; role: "user" | "assistant" | "system"; content: string; sources?: Source[]; followUps?: string[] };
type Conversation = { id: string; title: string; updatedAt: string; messages?: Message[]; _count?: { messages: number } };
type CommandItem = { icon: typeof Search; label: string; description: string; prefix: string };

const commands: CommandItem[] = [
  { icon: Search, label: "Research", description: "Search the web in depth", prefix: "/research" },
  { icon: BookOpen, label: "Explain", description: "Break down a complex topic", prefix: "/explain" },
  { icon: Globe2, label: "Compare", description: "Compare ideas with sources", prefix: "/compare" },
  { icon: FileText, label: "Summarize", description: "Create a concise overview", prefix: "/summarize" },
];

const starters = [
  "What changed in AI this week?",
  "Explain quantum computing simply",
  "Compare React and Svelte in 2026",
  "Research the future of clean energy",
];

const API = "/api/backend";

async function api<T>(path: string, init?: RequestInit): Promise<{ data: T; userId?: string }> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const userId = response.headers.get("x-user-id") ?? undefined;
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message ?? payload?.error ?? "Request failed");
  return { data: payload as T, userId };
}

export default function Home() {
  const [value, setValue] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteMounted, setPaletteMounted] = useState(false);
  const [paletteClosing, setPaletteClosing] = useState(false);
  const [activeCommand, setActiveCommand] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const rememberUser = useCallback((id?: string | null) => {
    if (!id) return;
    localStorage.setItem("purplexity-user-id", id);
    setUserId(id);
  }, []);

  const loadConversations = useCallback(async (id: string) => {
    try {
      const { data } = await api<Conversation[]>(`/conversations/user/${id}`);
      setConversations(data);
    } catch { /* First visit may not have history yet. */ }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("purplexity-user-id");
    if (saved) { setUserId(saved); void loadConversations(saved); }
  }, [loadConversations]);

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "56px";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  const openPalette = () => { setPaletteClosing(false); setPaletteMounted(true); };
  const closePalette = () => {
    if (!paletteMounted) return;
    setPaletteClosing(true);
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--dropdown-close-dur");
    window.setTimeout(() => { setPaletteMounted(false); setPaletteClosing(false); }, parseFloat(raw) || 150);
  };

  useEffect(() => {
    if (value.startsWith("/") && !value.includes(" ")) {
      const index = commands.findIndex((item) => item.prefix.startsWith(value.toLowerCase()));
      setActiveCommand(index < 0 ? 0 : index);
      openPalette();
    } else if (paletteMounted && !paletteClosing) closePalette();
    // palette state is intentionally controlled by input text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const selectCommand = (command: CommandItem) => {
    setValue(`${command.prefix} `);
    closePalette();
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const newChat = () => {
    setConversationId(null); setMessages([]); setValue(""); setError(null); setSidebarOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const openConversation = async (id: string) => {
    setLoading(true); setError(null);
    try {
      const { data } = await api<Conversation>(`/conversations/${id}`);
      setConversationId(id); setMessages(data.messages ?? []); setSidebarOpen(false);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load conversation"); }
    finally { setLoading(false); }
  };

  const removeConversation = async (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    try {
      await api(`/conversations/${id}`, { method: "DELETE" });
      setConversations((items) => items.filter((item) => item.id !== id));
      if (conversationId === id) newChat();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not delete conversation"); }
  };

  const send = async (text = value) => {
    const query = text.trim();
    if (!query || loading) return;
    setLoading(true); setError(null); closePalette();
    setMessages((items) => [...items, { id: `optimistic-${Date.now()}`, role: "user", content: query }]);
    setValue(""); setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = "56px";

    try {
      let currentConversation = conversationId;
      let currentUser = userId;
      if (!currentConversation) {
        const created = await api<Conversation>("/conversations", {
          method: "POST",
          body: JSON.stringify({ userId: currentUser ?? undefined }),
        });
        currentConversation = created.data.id;
        currentUser = created.userId ?? (created.data as Conversation & { userId?: string }).userId ?? currentUser;
        setConversationId(currentConversation);
        rememberUser(currentUser);
      }

      const response = await api<{ userMessage: Message; assistantMessage: Message; sources: Source[]; followUps: string[] }>(
        `/conversations/${currentConversation}/messages`,
        { method: "POST", body: JSON.stringify({ message: query, userId: currentUser ?? undefined }) },
      );
      rememberUser(response.userId ?? currentUser);
      setMessages((items) => [
        ...items.filter((item) => !item.id.startsWith("optimistic-")),
        response.data.userMessage,
        { ...response.data.assistantMessage, sources: response.data.sources, followUps: response.data.followUps },
      ]);
      if (currentUser) await loadConversations(currentUser);
    } catch (err) {
      setMessages((items) => items.filter((item) => !item.id.startsWith("optimistic-")));
      setValue(query);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally { setLoading(false); }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (paletteMounted) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setActiveCommand((current) => event.key === "ArrowDown" ? (current + 1) % commands.length : (current - 1 + commands.length) % commands.length);
      } else if (event.key === "Tab" || event.key === "Enter") {
        event.preventDefault(); selectCommand(commands[activeCommand]);
      } else if (event.key === "Escape") { event.preventDefault(); closePalette(); }
    } else if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); }
  };

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open conversations"><Menu size={20} /></button>
      {sidebarOpen && <button className="scrim" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar" />}

      <aside className={`sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="brand"><span className="brand-mark"><Sparkles size={17} /></span><span>purplexity</span><button className="sidebar-close" onClick={() => setSidebarOpen(false)}><ChevronLeft size={18} /></button></div>
        <button className="new-chat" onClick={newChat}><Plus size={16} /> New thread</button>
        <div className="history-label">Recent</div>
        <nav className="history">
          {conversations.length === 0 && <p className="history-empty">Your research threads will appear here.</p>}
          {conversations.map((item) => (
            <button key={item.id} className={`history-item ${item.id === conversationId ? "active" : ""}`} onClick={() => void openConversation(item.id)}>
              <MessageSquare size={14} /><span>{item.title}</span><Trash2 className="history-delete" size={13} onClick={(event) => void removeConversation(event, item.id)} />
            </button>
          ))}
        </nav>
        <div className="sidebar-footer"><span className="status-dot" /> Sources connected</div>
      </aside>

      <section className={`workspace ${messages.length ? "has-messages" : ""}`}>
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="eyebrow"><span className="live-dot" /> AI-powered web research</div>
            <div className="t-stagger is-shown">
              <h1 className="t-stagger-line t-stagger-line--1">What do you want to <em>understand?</em></h1>
              <p className="t-stagger-line t-stagger-line--2">Ask anything. Purplexity searches the web, reads the sources, and turns them into a clear answer.</p>
            </div>
            <Composer value={value} setValue={setValue} loading={loading} send={send} onKeyDown={onKeyDown} resize={resizeTextarea} textareaRef={textareaRef} attachments={attachments} setAttachments={setAttachments} fileRef={fileRef} openPalette={openPalette} paletteMounted={paletteMounted} paletteClosing={paletteClosing} activeCommand={activeCommand} selectCommand={selectCommand} />
            <div className="starters">{starters.map((starter, index) => <button key={starter} onClick={() => void send(starter)}><span>0{index + 1}</span>{starter}<ArrowUp size={14} /></button>)}</div>
          </div>
        ) : (
          <div className="conversation-view">
            <header className="conversation-header"><button onClick={newChat}><Plus size={15} /> New thread</button><span><span className="status-dot" /> Live web sources</span></header>
            <div className="message-list">
              {messages.map((message) => <ChatMessage key={message.id} message={message} onFollowUp={(text) => void send(text)} />)}
              {loading && <div className="assistant-row loading-row"><span className="assistant-icon"><Sparkles size={16} /></span><span className="t-shimmer" data-text="Searching, reading, and writing…">Searching, reading, and writing…</span></div>}
            </div>
            <div className="sticky-composer"><Composer compact value={value} setValue={setValue} loading={loading} send={send} onKeyDown={onKeyDown} resize={resizeTextarea} textareaRef={textareaRef} attachments={attachments} setAttachments={setAttachments} fileRef={fileRef} openPalette={openPalette} paletteMounted={paletteMounted} paletteClosing={paletteClosing} activeCommand={activeCommand} selectCommand={selectCommand} /></div>
          </div>
        )}
        {error && <div className="error-toast"><X size={15} /><span>{error}</span><button onClick={() => setError(null)}>Dismiss</button></div>}
      </section>
    </main>
  );
}

type ComposerProps = {
  compact?: boolean; value: string; setValue: (value: string) => void; loading: boolean;
  send: (text?: string) => Promise<void>; onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  resize: () => void; textareaRef: React.RefObject<HTMLTextAreaElement>; attachments: string[];
  setAttachments: React.Dispatch<React.SetStateAction<string[]>>; fileRef: React.RefObject<HTMLInputElement>;
  openPalette: () => void; paletteMounted: boolean; paletteClosing: boolean; activeCommand: number;
  selectCommand: (command: CommandItem) => void;
};

function Composer(props: ComposerProps) {
  const submit = (event: FormEvent) => { event.preventDefault(); void props.send(); };
  return <form className={`composer ${props.compact ? "compact" : ""}`} onSubmit={submit}>
    {props.paletteMounted && <div className={`command-menu t-dropdown is-open ${props.paletteClosing ? "is-closing" : ""}`} data-origin="bottom-left">
      <div className="command-title"><Command size={13} /> Commands</div>
      {commands.map((item, index) => <button type="button" key={item.prefix} className={index === props.activeCommand ? "selected" : ""} onMouseDown={(event) => event.preventDefault()} onClick={() => props.selectCommand(item)}><span className="command-icon"><item.icon size={16} /></span><span><b>{item.label}</b><small>{item.description}</small></span><code>{item.prefix}</code></button>)}
    </div>}
    {props.attachments.length > 0 && <div className="attachments">{props.attachments.map((name, index) => <span key={`${name}-${index}`}><FileText size={13} />{name}<button type="button" onClick={() => props.setAttachments((items) => items.filter((_, i) => i !== index))}><X size={12} /></button></span>)}</div>}
    <textarea ref={props.textareaRef} value={props.value} rows={1} placeholder="Ask a question about anything…" aria-label="Your question" onChange={(event) => { props.setValue(event.target.value); props.resize(); }} onKeyDown={props.onKeyDown} />
    <div className="composer-actions">
      <div><input ref={props.fileRef} type="file" hidden multiple onChange={(event) => props.setAttachments(Array.from(event.target.files ?? []).map((file) => file.name))} /><button type="button" className="icon-button" onClick={() => props.fileRef.current?.click()} aria-label="Attach files"><Paperclip size={17} /></button><button type="button" className="icon-button" onClick={props.openPalette} aria-label="Open commands"><Command size={17} /></button></div>
      <button className="send-button" type="submit" disabled={!props.value.trim() || props.loading} aria-label="Send question">{props.loading ? <LoaderCircle className="spin" size={18} /> : <ArrowUp size={18} />}</button>
    </div>
  </form>;
}

function ChatMessage({ message, onFollowUp }: { message: Message; onFollowUp: (text: string) => void }) {
  if (message.role === "user") return <div className="user-row"><div className="user-message">{message.content}</div></div>;
  return <article className="assistant-row"><span className="assistant-icon"><Sparkles size={16} /></span><div className="assistant-content"><div className="answer">{message.content}</div>{message.sources && message.sources.length > 0 && <div className="sources"><div className="section-label"><Globe2 size={13} /> Sources</div><div className="source-grid">{message.sources.slice(0, 4).map((source, index) => <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer"><span>{index + 1}</span><div><b>{source.title}</b><small>{new URL(source.url).hostname.replace("www.", "")}</small></div><ExternalLink size={13} /></a>)}</div></div>}{message.followUps && message.followUps.length > 0 && <div className="follow-ups"><div className="section-label"><Check size={13} /> Keep exploring</div>{message.followUps.map((text) => <button key={text} onClick={() => onFollowUp(text)}>{text}<ArrowUp size={13} /></button>)}</div>}</div></article>;
}
