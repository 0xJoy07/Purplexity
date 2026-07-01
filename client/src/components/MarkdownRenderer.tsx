"use client";

import React from "react";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  const rendered = parseMarkdown(content);
  return (
    <div
      className={`markdown-response ${className}`}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}

function parseMarkdown(text: string): string {
  if (!text) return "";

  let html = text;

  // Normalize line endings
  html = html.replace(/\r\n/g, "\n");

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const escaped = escapeHtml(code.trimEnd());
    return `<pre><code class="language-${lang || "text"}">${escaped}</code></pre>`;
  });

  // Headings
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Horizontal rule
  html = html.replace(/^---$/gm, "<hr />");

  // Bold + Italic (***text***)
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");

  // Bold (**text**)
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic (*text*)
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");

  // Inline code (`code`)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Links [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");
  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>\n<blockquote>/g, "<br />");

  // Unordered lists
  html = processLists(html);

  // Paragraphs - wrap remaining lines
  html = wrapParagraphs(html);

  return html;
}

function processLists(html: string): string {
  const lines = html.split("\n");
  const result: string[] = [];
  let inUl = false;
  let inOl = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ulMatch = line.match(/^[\s]*[-*+] (.+)$/);
    const olMatch = line.match(/^[\s]*(\d+)\. (.+)$/);

    if (ulMatch) {
      if (!inUl) {
        if (inOl) { result.push("</ol>"); inOl = false; }
        result.push("<ul>");
        inUl = true;
      }
      result.push(`<li>${ulMatch[1]}</li>`);
    } else if (olMatch) {
      if (!inOl) {
        if (inUl) { result.push("</ul>"); inUl = false; }
        result.push("<ol>");
        inOl = true;
      }
      result.push(`<li>${olMatch[2]}</li>`);
    } else {
      if (inUl) { result.push("</ul>"); inUl = false; }
      if (inOl) { result.push("</ol>"); inOl = false; }
      result.push(line);
    }
  }

  if (inUl) result.push("</ul>");
  if (inOl) result.push("</ol>");

  return result.join("\n");
}

function wrapParagraphs(html: string): string {
  const blocks = html.split(/\n\n+/);
  return blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      // Don't wrap block elements
      if (
        trimmed.startsWith("<h") ||
        trimmed.startsWith("<pre") ||
        trimmed.startsWith("<ul") ||
        trimmed.startsWith("<ol") ||
        trimmed.startsWith("<blockquote") ||
        trimmed.startsWith("<hr") ||
        trimmed.startsWith("<p")
      ) {
        return trimmed;
      }
      // Replace single newlines within paragraph with <br />
      const inner = trimmed.replace(/\n/g, "<br />");
      return `<p>${inner}</p>`;
    })
    .join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
