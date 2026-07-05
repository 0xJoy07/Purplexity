"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Clock, AlertTriangle } from "lucide-react";
import { useAuth, type TokenUsageState } from "@/lib/auth";

function formatTokenCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return n.toString();
}

function getTimeUntilReset(resetTime: string): string {
  const now = new Date();
  const reset = new Date(resetTime);
  const diff = reset.getTime() - now.getTime();
  if (diff <= 0) return "resetting...";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getUsageLevel(used: number, limit: number): "low" | "medium" | "high" | "exceeded" {
  if (used >= limit) return "exceeded";
  const pct = used / limit;
  if (pct > 0.85) return "high";
  if (pct > 0.6) return "medium";
  return "low";
}

const levelColors = {
  low: {
    bar: "bg-[#19a49f]",
    text: "text-[#19a49f]",
    bg: "bg-[#e7f1ef] dark:bg-[#102422]",
    icon: "text-[#19a49f]",
  },
  medium: {
    bar: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    icon: "text-amber-500",
  },
  high: {
    bar: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/30",
    icon: "text-red-500",
  },
  exceeded: {
    bar: "bg-red-600",
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/30",
    icon: "text-red-600",
  },
};

interface TokenUsageIndicatorProps {
  compact?: boolean;
  className?: string;
}

export function TokenUsageIndicator({ compact = false, className = "" }: TokenUsageIndicatorProps) {
  const { tokenUsage } = useAuth();
  const [countdown, setCountdown] = useState("");

  // Live countdown timer when quota is exceeded
  useEffect(() => {
    if (!tokenUsage || tokenUsage.canMakeRequest) return;

    const update = () => setCountdown(getTimeUntilReset(tokenUsage.resetTime));
    update();
    const interval = setInterval(update, 30_000); // update every 30s
    return () => clearInterval(interval);
  }, [tokenUsage]);

  if (!tokenUsage) return null;

  const { tokensUsedToday, dailyLimit, canMakeRequest, resetTime } = tokenUsage;
  const level = getUsageLevel(tokensUsedToday, dailyLimit);
  const colors = levelColors[level];
  const pct = Math.min(100, (tokensUsedToday / dailyLimit) * 100);

  // ── Exceeded state ──────────────────────────────────────────────────────────
  if (!canMakeRequest) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800/40 ${colors.bg} px-3 py-2 ${className}`}
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-red-600 dark:text-red-400">
            Daily limit reached
          </p>
          <p className="text-[10px] text-red-500/80 dark:text-red-400/60">
            Resets in {countdown || getTimeUntilReset(resetTime)} · 12:00 AM IST
          </p>
        </div>
      </motion.div>
    );
  }

  // ── Compact mode (thread view) ──────────────────────────────────────────────
  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`flex items-center gap-2 ${className}`}
      >
        <Zap className={`h-3 w-3 ${colors.icon}`} />
        <div className="flex items-center gap-1.5">
          <div className="h-1 w-16 overflow-hidden rounded-full bg-border">
            <motion.div
              className={`h-full rounded-full ${colors.bar}`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
          <span className={`text-[10px] font-medium ${colors.text}`}>
            {formatTokenCount(tokensUsedToday)} / {formatTokenCount(dailyLimit)}
          </span>
        </div>
      </motion.div>
    );
  }

  // ── Full mode (welcome view) ────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className={`flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2 ${className}`}
    >
      <Zap className={`h-3.5 w-3.5 shrink-0 ${colors.icon}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-medium text-text-muted">
            {formatTokenCount(tokensUsedToday)} / {formatTokenCount(dailyLimit)} tokens today
          </span>
          {level !== "low" && (
            <span className={`text-[10px] font-medium ${colors.text}`}>
              {level === "high" ? "Almost full" : "Getting low"}
            </span>
          )}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
          <motion.div
            className={`h-full rounded-full ${colors.bar}`}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>
    </motion.div>
  );
}

/** Toast shown when context was trimmed for a request. */
export function ContextTrimmedToast({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <p className="text-[11px] text-amber-700 dark:text-amber-300">
            Older context was trimmed to fit the request limit.
          </p>
          <button
            onClick={onDismiss}
            className="ml-auto text-[10px] font-medium text-amber-600 dark:text-amber-400 hover:underline"
          >
            Dismiss
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Toast shown when daily quota is exhausted. */
export function QuotaExceededToast({ visible, resetTime }: { visible: boolean; resetTime: string }) {
  const [countdown, setCountdown] = useState(getTimeUntilReset(resetTime));

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => setCountdown(getTimeUntilReset(resetTime)), 30_000);
    return () => clearInterval(interval);
  }, [visible, resetTime]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-950/30 px-3 py-2"
        >
          <Clock className="h-3.5 w-3.5 shrink-0 text-red-500" />
          <p className="text-[11px] text-red-700 dark:text-red-300">
            Daily token limit reached. Resets in <strong>{countdown}</strong> (12:00 AM IST).
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
