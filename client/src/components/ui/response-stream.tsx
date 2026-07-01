"use client"

import { cn } from "@/lib/utils"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { MarkdownRenderer, parseMarkdown } from "@/components/MarkdownRenderer"

export type Mode = "typewriter" | "fade"

export type UseTextStreamOptions = {
  textStream: string | AsyncIterable<string>
  speed?: number
  mode?: Mode
  onComplete?: () => void
  fadeDuration?: number
  segmentDelay?: number
  characterChunkSize?: number
  onError?: (error: unknown) => void
}

export type UseTextStreamResult = {
  displayedText: string
  isComplete: boolean
  segments: { text: string; index: number }[]
  getFadeDuration: () => number
  getSegmentDelay: () => number
  reset: () => void
  startStreaming: () => void
  pause: () => void
  resume: () => void
}

export function useTextStream({
  textStream,
  speed = 20,
  mode = "typewriter",
  onComplete,
  fadeDuration,
  segmentDelay,
  characterChunkSize,
  onError,
}: UseTextStreamOptions): UseTextStreamResult {
  const [displayedText, setDisplayedText] = useState("")
  const [isComplete, setIsComplete] = useState(false)
  const [segments, setSegments] = useState<{ text: string; index: number }[]>(
    []
  )

  const speedRef = useRef(speed)
  const modeRef = useRef(mode)
  const currentIndexRef = useRef(0)
  const animationRef = useRef<number | null>(null)
  const fadeDurationRef = useRef(fadeDuration)
  const segmentDelayRef = useRef(segmentDelay)
  const characterChunkSizeRef = useRef(characterChunkSize)
  const streamRef = useRef<AbortController | null>(null)
  const completedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    speedRef.current = speed
    modeRef.current = mode
    fadeDurationRef.current = fadeDuration
    segmentDelayRef.current = segmentDelay
    characterChunkSizeRef.current = characterChunkSize
  }, [speed, mode, fadeDuration, segmentDelay, characterChunkSize])

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const getChunkSize = useCallback(() => {
    if (typeof characterChunkSizeRef.current === "number") {
      return Math.max(1, characterChunkSizeRef.current)
    }

    const normalizedSpeed = Math.min(100, Math.max(1, speedRef.current))

    if (modeRef.current === "typewriter") {
      if (normalizedSpeed < 25) return 1
      return Math.max(1, Math.round((normalizedSpeed - 25) / 10))
    } else if (modeRef.current === "fade") {
      return 1
    }

    return 1
  }, [])

  const getProcessingDelay = useCallback(() => {
    if (typeof segmentDelayRef.current === "number") {
      return Math.max(0, segmentDelayRef.current)
    }

    const normalizedSpeed = Math.min(100, Math.max(1, speedRef.current))
    return Math.max(1, Math.round(100 / Math.sqrt(normalizedSpeed)))
  }, [])

  const getFadeDuration = useCallback(() => {
    if (typeof fadeDurationRef.current === "number")
      return Math.max(10, fadeDurationRef.current)

    const normalizedSpeed = Math.min(100, Math.max(1, speedRef.current))
    return Math.round(1000 / Math.sqrt(normalizedSpeed))
  }, [])

  const getSegmentDelay = useCallback(() => {
    if (typeof segmentDelayRef.current === "number")
      return Math.max(0, segmentDelayRef.current)

    const normalizedSpeed = Math.min(100, Math.max(1, speedRef.current))
    return Math.max(1, Math.round(100 / Math.sqrt(normalizedSpeed)))
  }, [])

  const updateSegments = useCallback((text: string) => {
    if (modeRef.current === "fade") {
      // Not using segments array for fade anymore, handled by parsed HTML
    }
  }, [])

  const markComplete = useCallback(() => {
    if (!completedRef.current) {
      completedRef.current = true
      setIsComplete(true)
      onCompleteRef.current?.()
    }
  }, [])

  const reset = useCallback(() => {
    currentIndexRef.current = 0
    setDisplayedText("")
    setSegments([])
    setIsComplete(false)
    completedRef.current = false

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
  }, [])

  const processStringTypewriter = useCallback(
    (text: string) => {
      let lastFrameTime = 0

      const streamContent = (timestamp: number) => {
        const delay = getProcessingDelay()
        if (delay > 0 && timestamp - lastFrameTime < delay) {
          animationRef.current = requestAnimationFrame(streamContent)
          return
        }
        lastFrameTime = timestamp

        if (currentIndexRef.current >= text.length) {
          markComplete()
          return
        }

        const chunkSize = getChunkSize()
        let endIndex = Math.min(
          currentIndexRef.current + chunkSize,
          text.length
        )
        
        // Fast-forward through markdown symbols to avoid rendering them piece-by-piece
        const currentSlice = text.slice(currentIndexRef.current, endIndex);
        if (currentSlice.includes("*") || currentSlice.includes("#") || currentSlice.includes("`") || currentSlice.includes("[")) {
            endIndex = Math.min(endIndex + 3, text.length);
        }

        const newDisplayedText = text.slice(0, endIndex)

        setDisplayedText(newDisplayedText)
        if (modeRef.current === "fade") {
          updateSegments(newDisplayedText)
        }

        currentIndexRef.current = endIndex

        if (endIndex < text.length) {
          animationRef.current = requestAnimationFrame(streamContent)
        } else {
          markComplete()
        }
      }

      animationRef.current = requestAnimationFrame(streamContent)
    },
    [getProcessingDelay, getChunkSize, updateSegments, markComplete]
  )

  const processAsyncIterable = useCallback(
    async (stream: AsyncIterable<string>) => {
      const controller = new AbortController()
      streamRef.current = controller

      let displayed = ""

      try {
        for await (const chunk of stream) {
          if (controller.signal.aborted) return

          displayed += chunk
          setDisplayedText(displayed)
          updateSegments(displayed)
        }

        markComplete()
      } catch (error) {
        console.error("Error processing text stream:", error)
        markComplete()
        onError?.(error)
      }
    },
    [updateSegments, markComplete, onError]
  )

  const startStreaming = useCallback(() => {
    reset()

    if (typeof textStream === "string") {
      processStringTypewriter(textStream)
    } else if (textStream) {
      processAsyncIterable(textStream)
    }
  }, [textStream, reset, processStringTypewriter, processAsyncIterable])

  const pause = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
  }, [])

  const resume = useCallback(() => {
    if (typeof textStream === "string" && !isComplete) {
      processStringTypewriter(textStream)
    }
  }, [textStream, isComplete, processStringTypewriter])

  useEffect(() => {
    startStreaming()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (streamRef.current) {
        streamRef.current.abort()
      }
    }
  }, [textStream, startStreaming])

  return {
    displayedText,
    isComplete,
    segments,
    getFadeDuration,
    getSegmentDelay,
    reset,
    startStreaming,
    pause,
    resume,
  }
}

export type ResponseStreamProps = {
  textStream: string | AsyncIterable<string>
  mode?: Mode
  speed?: number // 1-100, where 1 is slowest and 100 is fastest
  className?: string
  onComplete?: () => void
  as?: keyof React.JSX.IntrinsicElements // Element type to render
  fadeDuration?: number // Custom fade duration in ms (overrides speed)
  segmentDelay?: number // Custom delay between segments in ms (overrides speed)
  characterChunkSize?: number // Custom characters per frame for typewriter mode (overrides speed)
}

function FadeFormattedText({ 
  text, 
  speed = 50, 
  fadeDuration = 600, 
  segmentDelayOverride,
  onComplete,
  className,
  as: Container = "div"
}: { 
  text: string; 
  speed?: number; 
  fadeDuration?: number; 
  segmentDelayOverride?: number;
  onComplete?: () => void;
  className?: string;
  as?: any;
}) {
  const [fadedHtml, setFadedHtml] = useState("");
  
  useEffect(() => {
    const rawHtml = parseMarkdown(text);
    if (typeof document === 'undefined') {
      setFadedHtml(rawHtml);
      return;
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');
    let idx = 0;
    
    // faster speed = smaller delay. If segmentDelayOverride is provided, use it.
    const segmentDelay = segmentDelayOverride ?? Math.max(1, Math.round(100 / Math.sqrt(speed)));
    
    function walk(node: Node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const textContent = node.textContent || '';
        if (!textContent.trim() && !textContent.includes('\n')) return; // skip empty text nodes
        
        const words = textContent.split(/(\s+)/);
        const fragment = document.createDocumentFragment();
        
        words.forEach(word => {
          if (!word) return;
          const isWhitespace = /^\s+$/.test(word);
          const span = document.createElement('span');
          span.className = 'fade-segment' + (isWhitespace ? ' fade-segment-space' : '');
          span.style.animationDelay = `${idx * segmentDelay}ms`;
          span.textContent = word;
          fragment.appendChild(span);
          if (!isWhitespace) idx++;
        });
        
        node.parentNode?.replaceChild(fragment, node);
      } else {
        // Must convert to array because we might replace children which messes up iteration
        Array.from(node.childNodes).forEach(child => walk(child));
      }
    }
    
    Array.from(doc.body.childNodes).forEach(child => walk(child));
    setFadedHtml(doc.body.innerHTML);
    
    const totalDuration = idx * segmentDelay + fadeDuration;
    const timer = setTimeout(() => {
      onComplete?.();
    }, totalDuration);
    
    return () => clearTimeout(timer);
  }, [text, speed, fadeDuration, segmentDelayOverride, onComplete]);
  
  const fadeStyle = `
    .fade-segment {
      opacity: 0;
      animation: fadeIn ${fadeDuration}ms forwards;
    }
    .fade-segment-space {
      animation: none;
      opacity: 1;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `;
  
  return (
    <Container className={className}>
      <style>{fadeStyle}</style>
      <div className="markdown-response" dangerouslySetInnerHTML={{ __html: fadedHtml }} />
    </Container>
  );
}

export function ResponseStream({
  textStream,
  mode = "fade",
  speed = 50,
  className = "",
  onComplete,
  as = "div",
  fadeDuration,
  segmentDelay,
  characterChunkSize,
}: ResponseStreamProps) {
  if (mode === "fade" && typeof textStream === "string") {
    return <FadeFormattedText 
      text={textStream} 
      speed={speed} 
      fadeDuration={fadeDuration} 
      segmentDelayOverride={segmentDelay}
      onComplete={onComplete}
      className={className}
      as={as}
    />;
  }

  const animationEndRef = useRef<(() => void) | null>(null)

  const {
    displayedText,
    isComplete,
    segments,
    getFadeDuration,
    getSegmentDelay,
  } = useTextStream({
    textStream,
    speed,
    mode,
    onComplete,
    fadeDuration,
    segmentDelay,
    characterChunkSize,
  })

  useEffect(() => {
    animationEndRef.current = onComplete ?? null
  }, [onComplete])

  const handleLastSegmentAnimationEnd = useCallback(() => {
    if (animationEndRef.current && isComplete) {
      animationEndRef.current()
    }
  }, [isComplete])

  // fadeStyle is the style for the fade animation
  const fadeStyle = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    .fade-segment {
      display: inline-block;
      opacity: 0;
      animation: fadeIn ${getFadeDuration()}ms ease-out forwards;
    }

    .fade-segment-space {
      white-space: pre;
    }
  `

  const renderContent = () => {
    switch (mode) {
      case "typewriter":
        return <MarkdownRenderer content={displayedText} />

      case "fade":
        return (
          <>
            <style>{fadeStyle}</style>
            <div className="relative">
              {segments.map((segment, idx) => {
                const isWhitespace = /^\s+$/.test(segment.text)
                const isLastSegment = idx === segments.length - 1

                return (
                  <span
                    key={`${segment.text}-${idx}`}
                    className={cn(
                      "fade-segment",
                      isWhitespace && "fade-segment-space"
                    )}
                    style={{
                      animationDelay: `${idx * getSegmentDelay()}ms`,
                    }}
                    onAnimationEnd={
                      isLastSegment ? handleLastSegmentAnimationEnd : undefined
                    }
                  >
                    {segment.text}
                  </span>
                )
              })}
            </div>
          </>
        )

      default:
        return <MarkdownRenderer content={displayedText} />
    }
  }

  const Container = as as keyof React.JSX.IntrinsicElements

  return <Container className={className}>{renderContent()}</Container>
}
