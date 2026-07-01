"use client";

import * as React from "react";
import { Pacifico } from 'next/font/google';
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUp,
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  CircleUserRound,
  Code2,
  Cpu,
  ExternalLink,
  Globe2,
  LoaderCircle,
  Paperclip,
  Search,
  Sparkles,
  X,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createConversation,
  getConversation,
  getOrCreateGuestUser,
  Message,
  sendMessage,
} from "@/lib/api";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ResponseStream } from "./ui/response-stream";

const pacifico = Pacifico({ subsets: ['latin'], weight: '400' });
function useAutoResizeTextarea(minHeight: number, maxHeight = 200) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const adjustHeight = useCallback((reset = false) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = `${minHeight}px`;
    if (!reset) textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight)}px`;
  }, [maxHeight, minHeight]);

  useEffect(() => {
    adjustHeight(true);
    const resize = () => adjustHeight();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

interface AnimatedAIChatProps {
  activeConversationId: string | null;
  onConversationCreated: (conversationId: string) => void;
  onNewChat: () => void;
  sidebarOpen: boolean;
}

const suggestions = [
  { icon: Globe2, eyebrow: "Explore", label: "What will shape technology this year?", query: "What emerging technologies will have the biggest impact this year?" },
  { icon: Code2, eyebrow: "Learn", label: "Explain the JavaScript event loop", query: "How does the JavaScript event loop work?" },
  { icon: Brain, eyebrow: "Understand", label: "How neural networks actually learn", query: "How does a neural network learn?" },
  { icon: Cpu, eyebrow: "Compare", label: "REST and GraphQL, side by side", query: "Explain the difference between REST and GraphQL APIs" },
];

export function AnimatedAIChat({ activeConversationId, onConversationCreated, sidebarOpen }: AnimatedAIChatProps) {
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [newMessageId, setNewMessageId] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea(54);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setConversationId(activeConversationId); }, [activeConversationId]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      setNewMessageId(null);
      return;
    }
    const loadConversation = async () => {
      try {
        const guest = await getOrCreateGuestUser();
        if (!guest) return;
        const conversation = await getConversation(activeConversationId, guest.token);
        setMessages(conversation.messages || []);
        setNewMessageId(null);
      } catch (error) {
        console.error("Failed to load conversation:", error);
        setMessages([]);
      }
    };
    loadConversation();
  }, [activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const submitQuery = async (query?: string) => {
    const messageText = (query ?? value).trim();
    if (!messageText || isTyping) return;
    setValue("");
    adjustHeight(true);
    setIsTyping(true);

    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: messageText,
      createdAt: new Date().toISOString(),
    };

    try {
      const guest = await getOrCreateGuestUser();
      if (!guest) throw new Error("Could not initialize guest");
      let currentId = conversationId;
      if (!currentId) {
        const conversation = await createConversation(guest.userId, guest.token);
        currentId = conversation.id;
        setConversationId(currentId);
        onConversationCreated(currentId);
      }
      setMessages((current) => [...current, optimistic]);
      const response = await sendMessage(currentId, messageText, guest.userId, guest.token);
      setNewMessageId(response.assistantMessage.id);
      setMessages((current) => [
        ...current.filter((message) => message.id !== optimistic.id),
        response.userMessage,
        response.assistantMessage,
      ]);
    } catch (error) {
      console.error(error);
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
    } finally {
      setIsTyping(false);
    }
  };

  const handleDownload = async (message: Message, format: "pdf" | "docx" | "md") => {
    try {
      if (format === "md") {
        const { saveAs } = await import("file-saver");
        const blob = new Blob([message.content], { type: "text/markdown;charset=utf-8" });
        saveAs(blob, `purplexity-response-${message.id}.md`);
      } else if (format === "pdf") {
        const html2pdf = (await import("html2pdf.js")).default;
        const element = document.getElementById(`message-content-${message.id}`);
        if (element) {
          const opt = {
            margin: 10,
            filename: `purplexity-response-${message.id}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
          };
          html2pdf().set(opt).from(element).save();
        }
      } else if (format === "docx") {
        const { asBlob } = await import("html-docx-js-typescript");
        const { saveAs } = await import("file-saver");
        const element = document.getElementById(`message-content-${message.id}`);
        if (element) {
          const htmlString = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${element.innerHTML}</body></html>`;
          const blob = await asBlob(htmlString);
          saveAs(blob as Blob, `purplexity-response-${message.id}.docx`);
        }
      }
    } catch (err) {
      console.error("Export failed", err);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitQuery();
    }
  };

  const attachFile = () => setAttachments((current) => [...current, `research-${Math.floor(Math.random() * 1000)}.pdf`]);
  const hasMessages = messages.length > 0;

  const composer = (compact = false) => (
    <motion.div
      className={cn(
        "relative overflow-hidden rounded-[18px] border bg-white transition-all duration-200",
        inputFocused ? "border-[#9ebfbc] shadow-[0_0_0_3px_rgba(22,139,134,0.08),0_12px_32px_rgba(36,39,33,0.08)]" : "border-[#d7d7d1] shadow-[0_8px_30px_rgba(31,34,28,0.07)]",
      )}
      initial={{ opacity: 0, y: compact ? 12 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => { setValue(event.target.value); adjustHeight(); }}
        onKeyDown={handleKeyDown}
        onFocus={() => setInputFocused(true)}
        onBlur={() => setInputFocused(false)}
        placeholder={compact ? "Ask a follow-up…" : "Ask anything…"}
        aria-label={compact ? "Ask a follow-up" : "Ask anything"}
        className={cn("block w-full resize-none border-0 bg-transparent px-5 pt-4 text-[15px] leading-6 text-[#252621] outline-none placeholder:text-[#9b9c96]", compact ? "min-h-[54px] pb-2" : "min-h-[72px] pb-3")}
        style={{ overflow: "hidden" }}
      />

      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div className="flex flex-wrap gap-2 px-4 pb-2" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            {attachments.map((file, index) => (
              <span key={`${file}-${index}`} className="flex items-center gap-2 rounded-lg bg-[#f1f3ef] px-2.5 py-1.5 text-xs text-[#62635d]">
                <BookOpen className="h-3.5 w-3.5 text-[#168b86]" />{file}
                <button type="button" onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-[#969790] hover:text-[#33342f]"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between px-3 pb-3">
        <div className="flex items-center gap-1">
          <button type="button" className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-[#5d5e58] transition-colors hover:bg-[#f2f2ee]">
            <Search className="h-3.5 w-3.5 text-[#168b86]" />Auto<ChevronDown className="h-3 w-3" />
          </button>
          <button type="button" onClick={attachFile} aria-label="Attach a file" className="rounded-lg p-2 text-[#777871] transition-colors hover:bg-[#f2f2ee] hover:text-[#33342f]"><Paperclip className="h-4 w-4" /></button>
        </div>
        <button type="button" onClick={() => submitQuery()} disabled={isTyping || !value.trim()} aria-label="Submit question" className={cn("flex h-9 w-9 items-center justify-center rounded-full transition-all", value.trim() ? "bg-[#168b86] text-white hover:bg-[#117a75]" : "bg-[#ecece7] text-[#adaea7]")}>
          {isTyping ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
        </button>
      </div>
    </motion.div>
  );

  return (
    <section className={cn("relative flex h-screen min-w-0 flex-1 flex-col bg-[#fcfcf9] text-[#20211d] transition-[margin] duration-200", sidebarOpen ? "lg:ml-[248px]" : "ml-0")}>
      <header className="absolute inset-x-0 top-0 z-20 flex h-16 items-center justify-end border-b border-transparent px-4 sm:px-6">
        <button type="button" className="flex h-9 items-center gap-2 rounded-lg bg-[#20211d] px-3.5 text-xs font-medium text-white transition-colors hover:bg-[#353630]">
          <CircleUserRound className="h-4 w-4" />Sign in
        </button>
      </header>

      <AnimatePresence mode="wait">
        {!hasMessages && !isTyping ? (
          <motion.main key="welcome" className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-5 pb-10 pt-24" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -12 }}>
            <div className="my-auto w-full max-w-[720px] py-10">
              <motion.div className="mb-9 text-center" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
                <div className="mx-auto mb-5 flex items-center justify-center">
                  <span className="purplexity-mark scale-110 pacifico.className" aria-hidden="true"><span> Welcome to, Purplexity</span></span>
                </div>
                <h1 className="text-[32px] font-medium tracking-[-0.045em] text-[#20211d] sm:text-[38px]">Where knowledge begins</h1>
                <p className="mt-3 text-sm text-[#777871]">Ask a question. Get a clear answer with sources.</p>
              </motion.div>

              {composer()}

              <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {suggestions.map(({ icon: Icon, eyebrow, label, query }, index) => (
                  <motion.button key={label} type="button" onClick={() => submitQuery(query)} className="group flex min-h-[74px] items-start gap-3 rounded-xl border border-transparent px-3.5 py-3 text-left transition-colors hover:border-[#e1e1dc] hover:bg-white" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 + index * 0.05 }}>
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e7f1ef] text-[#168b86]"><Icon className="h-4 w-4" /></span>
                    <span className="min-w-0"><span className="block text-[11px] font-medium uppercase tracking-[0.08em] text-[#9a9b94]">{eyebrow}</span><span className="mt-1 block text-[13px] leading-5 text-[#565750] group-hover:text-[#252621]">{label}</span></span>
                  </motion.button>
                ))}
              </div>
            </div>
            <p className="text-center text-[11px] text-[#a0a19a]">Purplexity may make mistakes. Check important sources.</p>
          </motion.main>
        ) : (
          <motion.main key="thread" className="flex min-h-0 flex-1 flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex-1 overflow-y-auto px-5 pb-8 pt-20 sm:px-8">
              <div className="mx-auto w-full max-w-[760px]">
                {messages.map((message) => message.role === "user" ? (
                  <motion.div key={message.id} className="border-b border-[#e5e5df] pb-6 pt-6 first:pt-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-[#999a93]">Question</p>
                    <h1 className="text-[25px] font-medium leading-[1.3] tracking-[-0.035em] text-[#20211d] sm:text-[30px]">{message.content}</h1>
                  </motion.div>
                ) : (
                  <motion.article key={message.id} className="py-7" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="mb-5 flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#168b86] text-white"><Sparkles className="h-3.5 w-3.5" /></span>
                      <span className="text-sm font-semibold text-[#292a25]">Answer</span>
                      <span className="ml-auto flex items-center gap-1 text-[11px] text-[#999a93]"><Check className="h-3.5 w-3.5 text-[#168b86]" />Searched the web</span>
                    </div>

                    {message.sources && message.sources.length > 0 && (
                      <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto pb-1">
                        {message.sources.map((source, index) => (
                          <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer" className="flex min-w-[180px] max-w-[220px] items-start gap-2.5 rounded-xl border border-[#e1e1dc] bg-[#f8f8f5] p-3 transition-colors hover:bg-[#f2f4f1]">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white text-[10px] font-semibold text-[#168b86] shadow-sm">{index + 1}</span>
                            <span className="min-w-0 text-xs leading-4 text-[#5f605a]"><span className="line-clamp-2">{source.title}</span><ExternalLink className="mt-1 h-3 w-3 text-[#a0a19a]" /></span>
                          </a>
                        ))}
                      </div>
                    )}

                    <div className="max-w-[720px]" id={`message-content-${message.id}`}>
                      {message.id === newMessageId ? <ResponseStream textStream={message.content} mode="fade" fadeDuration={600} onComplete={() => setNewMessageId(null)} /> : <MarkdownRenderer content={message.content} />}
                    </div>

                    {message.id !== newMessageId && (
                      <div className="mt-4 flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-[#999a93] uppercase tracking-wider">Export</span>
                        <button type="button" onClick={() => handleDownload(message, 'pdf')} className="flex items-center gap-1 rounded border border-[#e1e1dc] bg-[#f8f8f5] px-2 py-1 text-xs text-[#5f605a] hover:bg-[#f2f4f1] transition-colors"><Download className="h-3 w-3" /> PDF</button>
                        <button type="button" onClick={() => handleDownload(message, 'docx')} className="flex items-center gap-1 rounded border border-[#e1e1dc] bg-[#f8f8f5] px-2 py-1 text-xs text-[#5f605a] hover:bg-[#f2f4f1] transition-colors"><Download className="h-3 w-3" /> DOCX</button>
                        <button type="button" onClick={() => handleDownload(message, 'md')} className="flex items-center gap-1 rounded border border-[#e1e1dc] bg-[#f8f8f5] px-2 py-1 text-xs text-[#5f605a] hover:bg-[#f2f4f1] transition-colors"><Download className="h-3 w-3" /> MD</button>
                      </div>
                    )}

                    {message.id !== newMessageId && message.followUps && message.followUps.length > 0 && (
                      <div className="mt-7 border-t border-[#e7e7e1] pt-5">
                        <p className="mb-3 text-xs font-semibold text-[#4a4b45]">Related</p>
                        <div className="space-y-1.5">
                          {message.followUps.map((followUp, index) => (
                            <button key={`${followUp}-${index}`} type="button" onClick={() => { setValue(followUp); adjustHeight(); }} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-[#55564f] transition-colors hover:bg-[#f1f2ee] hover:text-[#168b86]">
                              {followUp}<ArrowUp className="h-3.5 w-3.5 rotate-45" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.article>
                ))}

                {isTyping && (
                  <motion.div className="flex items-center gap-3 py-7 text-sm text-[#74756e]" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e4f1ef] text-[#168b86]"><Search className="h-3.5 w-3.5 animate-pulse" /></span>
                    <span>Searching and reading sources</span><SearchingDots />
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="border-t border-[#e9e9e4] bg-[#fcfcf9]/95 px-4 pb-4 pt-3 backdrop-blur sm:px-8">
              <div className="mx-auto w-full max-w-[760px]">{composer(true)}</div>
            </div>
          </motion.main>
        )}
      </AnimatePresence>
    </section>
  );
}

function SearchingDots() {
  return (
    <span className="flex items-center gap-1">
      {[0, 1, 2].map((dot) => (
        <motion.span key={dot} className="h-1 w-1 rounded-full bg-[#168b86]" animate={{ opacity: [0.25, 1, 0.25] }} transition={{ duration: 1.1, repeat: Infinity, delay: dot * 0.15 }} />
      ))}
    </span>
  );
}
