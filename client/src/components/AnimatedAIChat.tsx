"use client";

import { useEffect, useRef, useCallback, useTransition } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  getOrCreateGuestUser,
  createConversation,
  sendMessage,
  getConversation,
  Message,
} from "@/lib/api";
import {
  MonitorIcon,
  ArrowUpIcon,
  Paperclip,
  SendIcon,
  XIcon,
  LoaderIcon,
  Sparkles,
  Command,
  CircleUserRound,
  Zap,
  Search,
  Code,
  Brain,
  Cpu,
} from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import * as React from "react";
import { TypewriterText } from "./TypewriterText";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface UseAutoResizeTextareaProps {
  minHeight: number;
  maxHeight?: number;
}

function useAutoResizeTextarea({
  minHeight,
  maxHeight,
}: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }

      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(
        minHeight,
        Math.min(
          textarea.scrollHeight,
          maxHeight ?? Number.POSITIVE_INFINITY
        )
      );

      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = `${minHeight}px`;
    }
  }, [minHeight]);

  useEffect(() => {
    const handleResize = () => adjustHeight();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  containerClassName?: string;
  showRing?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, containerClassName, showRing = true, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);

    return (
      <div className={cn("relative", containerClassName)}>
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
            "transition-all duration-200 ease-in-out",
            "placeholder:text-muted-foreground",
            "disabled:cursor-not-allowed disabled:opacity-50",
            showRing
              ? "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
              : "",
            className
          )}
          ref={ref}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />

        {showRing && isFocused && (
          <motion.span
            className="absolute inset-0 rounded-md pointer-events-none ring-2 ring-offset-0 ring-violet-500/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

// ===== Recommended Questions =====
interface RecommendedQuestion {
  icon: React.ReactNode;
  label: string;
  query: string;
}

const recommendedQuestions: RecommendedQuestion[] = [
  {
    icon: <Code className="w-4 h-4" />,
    label: "JavaScript Event Loop",
    query: "How does the JavaScript event loop work?",
  },
  {
    icon: <Cpu className="w-4 h-4" />,
    label: "REST vs GraphQL",
    query: "Explain the difference between REST and GraphQL APIs",
  },
  {
    icon: <Brain className="w-4 h-4" />,
    label: "Neural Networks",
    query: "How does a neural network learn?",
  },
  {
    icon: <Search className="w-4 h-4" />,
    label: "Design Patterns",
    query: "What are design patterns in software engineering?",
  },
];

// ===== Main Chat Component =====

interface AnimatedAIChatProps {
  activeConversationId: string | null;
  onConversationCreated: (conversationId: string) => void;
  onNewChat: () => void;
  sidebarOpen: boolean;
}

export function AnimatedAIChat({
  activeConversationId,
  onConversationCreated,
  onNewChat,
  sidebarOpen,
}: AnimatedAIChatProps) {
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [newMessageId, setNewMessageId] = useState<string | null>(null); // track which message gets typewriter
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 56,
    maxHeight: 200,
  });
  const [inputFocused, setInputFocused] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Sync conversationId with prop
  useEffect(() => {
    setConversationId(activeConversationId);
  }, [activeConversationId]);

  // Load conversation messages when switching conversations
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
        const conv = await getConversation(
          activeConversationId,
          guest.token
        );
        setMessages(conv.messages || []);
        setNewMessageId(null); // Don't typewrite loaded messages
      } catch (err) {
        console.error("Failed to load conversation:", err);
        setMessages([]);
      }
    };

    loadConversation();
  }, [activeConversationId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  // Mouse position for glow effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const hasMessages = messages.length > 0;

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        handleSendMessage();
      }
    }
  };

  const handleSendMessage = async () => {
    if (!value.trim() || isTyping) return;

    const messageText = value.trim();
    setValue("");
    adjustHeight(true);
    setIsTyping(true);

    try {
      const guest = await getOrCreateGuestUser();
      if (!guest) throw new Error("Could not initialize guest");

      let currentConvId = conversationId;
      if (!currentConvId) {
        const conv = await createConversation(guest.userId, guest.token);
        currentConvId = conv.id;
        setConversationId(currentConvId);
        onConversationCreated(currentConvId);
      }

      // Optimistic user message
      const optimisticUserMsg: Message = {
        id: "temp-" + Date.now(),
        role: "user",
        content: messageText,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUserMsg]);

      const response = await sendMessage(
        currentConvId,
        messageText,
        guest.userId,
        guest.token
      );

      // Track the new assistant message for typewriter effect
      setNewMessageId(response.assistantMessage.id);

      setMessages((prev) => {
        const filtered = prev.filter(
          (m) => m.id !== optimisticUserMsg.id
        );
        return [
          ...filtered,
          response.userMessage,
          response.assistantMessage,
        ];
      });
    } catch (error) {
      console.error(error);
      // Remove optimistic message on error
      setMessages((prev) =>
        prev.filter((m) => !m.id.startsWith("temp-"))
      );
    } finally {
      setIsTyping(false);
    }
  };

  const handleRecommendedQuestion = (query: string) => {
    setValue(query);
    // Auto-send after a brief visual delay
    setTimeout(() => {
      setValue(query);
      adjustHeight();
      // Trigger send
      const syntheticSend = async () => {
        const messageText = query;
        setValue("");
        adjustHeight(true);
        setIsTyping(true);

        try {
          const guest = await getOrCreateGuestUser();
          if (!guest) throw new Error("Could not initialize guest");

          let currentConvId = conversationId;
          if (!currentConvId) {
            const conv = await createConversation(
              guest.userId,
              guest.token
            );
            currentConvId = conv.id;
            setConversationId(currentConvId);
            onConversationCreated(currentConvId);
          }

          const optimisticUserMsg: Message = {
            id: "temp-" + Date.now(),
            role: "user",
            content: messageText,
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, optimisticUserMsg]);

          const response = await sendMessage(
            currentConvId,
            messageText,
            guest.userId,
            guest.token
          );

          setNewMessageId(response.assistantMessage.id);

          setMessages((prev) => {
            const filtered = prev.filter(
              (m) => m.id !== optimisticUserMsg.id
            );
            return [
              ...filtered,
              response.userMessage,
              response.assistantMessage,
            ];
          });
        } catch (error) {
          console.error(error);
          setMessages((prev) =>
            prev.filter((m) => !m.id.startsWith("temp-"))
          );
        } finally {
          setIsTyping(false);
        }
      };
      syntheticSend();
    }, 100);
  };

  const handleAttachFile = () => {
    const mockFileName = `file-${Math.floor(Math.random() * 1000)}.pdf`;
    setAttachments((prev) => [...prev, mockFileName]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div
      className={cn(
        "flex-1 flex flex-col h-screen bg-[#0A0A0B] text-white relative overflow-hidden transition-all duration-300",
        sidebarOpen ? "lg:ml-[280px]" : "ml-0"
      )}
    >
      {/* Background effects */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full mix-blend-normal filter blur-[128px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full mix-blend-normal filter blur-[128px] animate-pulse delay-700" />
        <div className="absolute top-1/4 right-1/3 w-64 h-64 bg-fuchsia-500/10 rounded-full mix-blend-normal filter blur-[96px] animate-pulse delay-1000" />
      </div>

      {/* Sign In Button (top-right) */}
      <div className="absolute top-4 right-5 z-30">
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] backdrop-blur-sm text-white/70 hover:text-white text-sm font-medium transition-all"
          onClick={() => {
            // Placeholder — sign-in page will be built later
          }}
        >
          <CircleUserRound className="w-4 h-4" />
          <span>Sign In</span>
        </motion.button>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col w-full max-w-3xl mx-auto px-4 relative z-10">
        {/* Center content (shown when no messages) */}
        <AnimatePresence mode="wait">
          {!hasMessages && !isTyping && (
            <motion.div
              key="welcome"
              className="flex-1 flex flex-col items-center justify-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30, transition: { duration: 0.3 } }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              {/* Logo mark */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="mb-6"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-violet-500/25">
                  <Zap className="w-7 h-7 text-white" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="text-center space-y-3 mb-8"
              >
                <h1 className="text-3xl font-semibold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white/90 to-white/50">
                  What do you want to know?
                </h1>
                <motion.div
                  className="h-px bg-gradient-to-r from-transparent via-white/15 to-transparent max-w-xs mx-auto"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "100%", opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                />
                <p className="text-sm text-white/35">
                  Search the web, powered by AI
                </p>
              </motion.div>

              {/* Search Input (centered) */}
              <div className="w-full max-w-2xl">
                <motion.div
                  className="relative backdrop-blur-2xl bg-white/[0.03] rounded-2xl border border-white/[0.07] shadow-2xl"
                  initial={{ scale: 0.98 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <div className="p-3">
                    <Textarea
                      ref={textareaRef}
                      value={value}
                      onChange={(e) => {
                        setValue(e.target.value);
                        adjustHeight();
                      }}
                      onKeyDown={handleKeyDown}
                      onFocus={() => setInputFocused(true)}
                      onBlur={() => setInputFocused(false)}
                      placeholder="Ask anything..."
                      containerClassName="w-full"
                      className={cn(
                        "w-full px-4 py-3",
                        "resize-none",
                        "bg-transparent",
                        "border-none",
                        "text-white/90 text-sm",
                        "focus:outline-none",
                        "placeholder:text-white/20",
                        "min-h-[56px]"
                      )}
                      style={{ overflow: "hidden" }}
                      showRing={false}
                    />
                  </div>

                  {/* Attachments */}
                  <AnimatePresence>
                    {attachments.length > 0 && (
                      <motion.div
                        className="px-4 pb-3 flex gap-2 flex-wrap"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        {attachments.map((file, index) => (
                          <motion.div
                            key={index}
                            className="flex items-center gap-2 text-xs bg-white/[0.03] py-1.5 px-3 rounded-lg text-white/70"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                          >
                            <span>{file}</span>
                            <button
                              onClick={() => removeAttachment(index)}
                              className="text-white/40 hover:text-white transition-colors"
                            >
                              <XIcon className="w-3 h-3" />
                            </button>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="px-3 pb-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <motion.button
                        type="button"
                        onClick={handleAttachFile}
                        whileTap={{ scale: 0.94 }}
                        className="p-2 text-white/30 hover:text-white/70 rounded-lg transition-colors"
                      >
                        <Paperclip className="w-4 h-4" />
                      </motion.button>
                    </div>

                    <motion.button
                      type="button"
                      onClick={handleSendMessage}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      disabled={isTyping || !value.trim()}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                        "flex items-center gap-2",
                        value.trim()
                          ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20"
                          : "bg-white/[0.05] text-white/30"
                      )}
                    >
                      {isTyping ? (
                        <LoaderIcon className="w-4 h-4 animate-[spin_2s_linear_infinite]" />
                      ) : (
                        <ArrowUpIcon className="w-4 h-4" />
                      )}
                    </motion.button>
                  </div>
                </motion.div>

                {/* Recommended Questions */}
                <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                  {recommendedQuestions.map((q, index) => (
                    <motion.button
                      key={index}
                      onClick={() => handleRecommendedQuestion(q.query)}
                      className="flex items-center gap-2 px-3.5 py-2 bg-white/[0.03] hover:bg-white/[0.07] rounded-xl text-xs text-white/50 hover:text-white/80 transition-all border border-white/[0.05] hover:border-white/[0.1]"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + index * 0.1 }}
                      whileHover={{ y: -1 }}
                    >
                      <span className="text-violet-400/70">{q.icon}</span>
                      <span>{q.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages area + bottom input (shown when messages exist or typing) */}
        {(hasMessages || isTyping) && (
          <motion.div
            className="flex-1 flex flex-col min-h-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            {/* Messages scroll area */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto py-6 pt-14 space-y-6"
            >
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  className={cn(
                    "flex flex-col gap-2 w-full",
                    msg.role === "user" ? "items-end" : "items-start"
                  )}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Role label */}
                  <div
                    className={cn(
                      "flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider mb-1",
                      msg.role === "user"
                        ? "text-white/30 pr-1"
                        : "text-violet-400/60 pl-1"
                    )}
                  >
                    {msg.role === "user" ? (
                      <>
                        <CircleUserRound className="w-3.5 h-3.5" />
                        You
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" />
                        Purplexity
                      </>
                    )}
                  </div>

                  {/* Message content */}
                  <div
                    className={cn(
                      "rounded-2xl max-w-[90%]",
                      msg.role === "user"
                        ? "bg-white/[0.08] text-white px-4 py-3 text-sm"
                        : "bg-transparent text-white/90 pr-4"
                    )}
                  >
                    {msg.role === "assistant" ? (
                      msg.id === newMessageId ? (
                        <TypewriterText
                          content={msg.content}
                          speed={12}
                          onComplete={() => setNewMessageId(null)}
                        />
                      ) : (
                        <MarkdownRenderer content={msg.content} />
                      )
                    ) : (
                      msg.content
                    )}
                  </div>

                  {/* Sources */}
                  {msg.role === "assistant" &&
                    msg.sources &&
                    msg.sources.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2 pl-1">
                        {msg.sources.map((s, i) => (
                          <a
                            key={i}
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs flex items-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] px-2.5 py-1.5 rounded-lg transition-colors text-white/50 hover:text-white/70 border border-white/[0.04]"
                          >
                            <MonitorIcon className="w-3 h-3" />
                            <span className="truncate max-w-[150px]">
                              {s.title}
                            </span>
                          </a>
                        ))}
                      </div>
                    )}

                  {/* Follow-ups */}
                  {msg.role === "assistant" &&
                    msg.followUps &&
                    msg.followUps.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2 pl-1">
                        {msg.followUps.map((f, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setValue(f);
                              adjustHeight();
                            }}
                            className="text-xs flex items-center gap-1.5 bg-violet-500/8 hover:bg-violet-500/15 text-violet-300/80 border border-violet-500/15 px-3 py-1.5 rounded-full transition-colors text-left"
                          >
                            <Sparkles className="w-3 h-3 shrink-0" />
                            {f}
                          </button>
                        ))}
                      </div>
                    )}
                </motion.div>
              ))}

              {/* Typing indicator */}
              {isTyping && (
                <motion.div
                  className="flex items-start gap-3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-violet-400/60 pl-1 mb-2">
                    <Zap className="w-3.5 h-3.5" />
                    Purplexity
                  </div>
                </motion.div>
              )}
              {isTyping && (
                <motion.div
                  className="flex items-center gap-3 pl-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
                    <div className="flex items-center gap-1">
                      <SearchingDots />
                    </div>
                    <span className="text-sm text-white/40">
                      Searching the web...
                    </span>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Bottom input bar */}
            <div className="pb-4 pt-2">
              <motion.div
                className="relative backdrop-blur-2xl bg-white/[0.03] rounded-2xl border border-white/[0.07] shadow-2xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="p-3">
                  <Textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => {
                      setValue(e.target.value);
                      adjustHeight();
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    placeholder="Ask a follow-up..."
                    containerClassName="w-full"
                    className={cn(
                      "w-full px-4 py-2.5",
                      "resize-none",
                      "bg-transparent",
                      "border-none",
                      "text-white/90 text-sm",
                      "focus:outline-none",
                      "placeholder:text-white/20",
                      "min-h-[44px]"
                    )}
                    style={{ overflow: "hidden" }}
                    showRing={false}
                  />
                </div>

                <div className="px-3 pb-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <motion.button
                      type="button"
                      onClick={handleAttachFile}
                      whileTap={{ scale: 0.94 }}
                      className="p-2 text-white/30 hover:text-white/70 rounded-lg transition-colors"
                    >
                      <Paperclip className="w-4 h-4" />
                    </motion.button>
                  </div>

                  <motion.button
                    type="button"
                    onClick={handleSendMessage}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    disabled={isTyping || !value.trim()}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                      "flex items-center gap-2",
                      value.trim()
                        ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20"
                        : "bg-white/[0.05] text-white/30"
                    )}
                  >
                    {isTyping ? (
                      <LoaderIcon className="w-4 h-4 animate-[spin_2s_linear_infinite]" />
                    ) : (
                      <ArrowUpIcon className="w-4 h-4" />
                    )}
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input focus glow */}
      {inputFocused && (
        <motion.div
          className="fixed w-[50rem] h-[50rem] rounded-full pointer-events-none z-0 opacity-[0.015] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 blur-[96px]"
          animate={{
            x: mousePosition.x - 400,
            y: mousePosition.y - 400,
          }}
          transition={{
            type: "spring",
            damping: 25,
            stiffness: 150,
            mass: 0.5,
          }}
        />
      )}
    </div>
  );
}

// ===== Searching Dots Animation =====
function SearchingDots() {
  return (
    <div className="flex items-center">
      {[1, 2, 3].map((dot) => (
        <motion.div
          key={dot}
          className="w-1.5 h-1.5 bg-violet-400/80 rounded-full mx-0.5"
          initial={{ opacity: 0.3 }}
          animate={{
            opacity: [0.3, 0.9, 0.3],
            scale: [0.85, 1.1, 0.85],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: dot * 0.15,
            ease: "easeInOut",
          }}
          style={{
            boxShadow: "0 0 4px rgba(139, 92, 246, 0.3)",
          }}
        />
      ))}
    </div>
  );
}
