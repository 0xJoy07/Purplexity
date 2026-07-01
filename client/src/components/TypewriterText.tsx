"use client";

import { useState, useEffect, useRef } from "react";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface TypewriterTextProps {
  content: string;
  speed?: number;
  onComplete?: () => void;
  className?: string;
}

export function TypewriterText({
  content,
  speed = 12,
  onComplete,
  className = "",
}: TypewriterTextProps) {
  const [displayedLength, setDisplayedLength] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const contentRef = useRef(content);

  // If content changes (e.g. loading a past conversation), show it immediately
  useEffect(() => {
    if (content !== contentRef.current) {
      contentRef.current = content;
      setDisplayedLength(content.length);
      setIsComplete(true);
      return;
    }
  }, [content]);

  useEffect(() => {
    if (isComplete) return;

    // Speed up through whitespace, slow down on punctuation
    const getDelay = (char: string) => {
      if (char === "\n") return speed * 3;
      if (".!?".includes(char)) return speed * 4;
      if (",;:".includes(char)) return speed * 2;
      if (char === " ") return speed * 0.5;
      return speed;
    };

    const tick = () => {
      setDisplayedLength((prev) => {
        if (prev >= content.length) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setIsComplete(true);
          onComplete?.();
          return prev;
        }

        const nextChar = content[prev];
        const delay = getDelay(nextChar);

        // Reschedule with variable delay
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(tick, delay);

        // Skip ahead through markdown syntax characters to avoid showing raw syntax
        let skip = 1;
        // If we encounter ** or *, skip through them quickly
        if (content[prev] === "*" || content[prev] === "#" || content[prev] === "`") {
          skip = 1;
        }

        return prev + skip;
      });
    };

    intervalRef.current = setInterval(tick, speed);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [content, speed, onComplete, isComplete]);

  const displayedText = content.slice(0, displayedLength);

  return (
    <div className={`relative ${className}`}>
      <MarkdownRenderer content={displayedText} />
    </div>
  );
}
