"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Download,
  FileText,
  FileImage,
  FileSpreadsheet,
  File as FileIcon,
  Trash2,
  Search,
  Loader2,
  LogIn,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { getUserDocuments, deleteUserDocument, getFileDownloadUrl, type UserDocument } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import Link from "next/link";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType === "application/pdf") return FileText;
  if (mimeType.includes("spreadsheet") || mimeType.includes("csv") || mimeType.includes("excel")) return FileSpreadsheet;
  return FileIcon;
}

function getFileTypeLabel(mimeType: string): string {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.startsWith("image/png")) return "PNG";
  if (mimeType.startsWith("image/jpeg")) return "JPEG";
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "Spreadsheet";
  if (mimeType.includes("csv")) return "CSV";
  if (mimeType.includes("word") || mimeType.includes("document")) return "Document";
  if (mimeType.startsWith("text/")) return "Text";
  return "File";
}

function getAccentForType(mimeType: string): string {
  if (mimeType === "application/pdf") return "text-red-500 bg-red-500/10";
  if (mimeType.startsWith("image/")) return "text-blue-500 bg-blue-500/10";
  if (mimeType.includes("spreadsheet") || mimeType.includes("csv") || mimeType.includes("excel")) return "text-green-500 bg-green-500/10";
  if (mimeType.includes("word") || mimeType.includes("document")) return "text-indigo-500 bg-indigo-500/10";
  return "text-accent bg-accent-soft";
}

export default function DocumentsPage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (window.innerWidth >= 1024) setSidebarOpen(true);
  }, []);

  const fetchDocuments = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const docs = await getUserDocuments(token);
      setDocuments(docs);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading) fetchDocuments();
  }, [fetchDocuments, authLoading]);

  const handleDelete = async (fileId: string) => {
    if (deletingId || !token) return;
    try {
      setDeletingId(fileId);
      await deleteUserDocument(fileId, token);
      setDocuments((prev) => prev.filter((d) => d.id !== fileId));
    } catch (error) {
      console.error("Failed to delete document:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (doc: UserDocument) => {
    if (!token) return;
    try {
      const res = await fetch(getFileDownloadUrl(doc.id), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download:", error);
    }
  };

  const filteredDocuments = documents.filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((prev) => !prev)}
        activeConversationId={null}
        onSelectConversation={() => {}}
        onNewChat={() => {}}
        refreshTrigger={0}
      />
      <div className={cn("flex-1 flex flex-col overflow-hidden transition-all duration-300", sidebarOpen ? "lg:pl-[300px]" : "")}>
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-border px-6 py-5">
          {!sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-text-muted shadow-sm transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <PanelLeftOpen className="h-[18px] w-[18px]" />
            </button>
          )}
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Documents</h1>
            <p className="mt-0.5 text-sm text-text-muted">
              {!authLoading && user
                ? `${documents.length} file${documents.length !== 1 ? "s" : ""} uploaded`
                : "Sign in to view your documents"
              }
            </p>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {authLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2 className="h-8 w-8 text-accent animate-spin" />
              <p className="text-sm text-text-muted">Loading...</p>
            </div>
          ) : !user ? (
            /* Not signed in */
            <div className="flex flex-col items-center justify-center h-full gap-5">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-accent-soft">
                <FileText className="h-10 w-10 text-accent" />
              </div>
              <div className="text-center">
                <h2 className="text-lg font-semibold text-foreground">Sign in to view documents</h2>
                <p className="mt-1 max-w-sm text-sm text-text-muted">
                  Your uploaded and downloaded documents will appear here once you&apos;re signed in.
                </p>
              </div>
              <Link
                href="/signin"
                className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-hover"
              >
                <LogIn className="h-4 w-4" />
                Sign in
              </Link>
            </div>
          ) : (
            <>
              {/* Search bar */}
              {documents.length > 0 && (
                <div className="mb-6">
                  <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
                    <input
                      type="text"
                      placeholder="Search documents..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-4 text-sm text-foreground placeholder:text-text-subtle outline-none transition-colors focus:border-border-focus focus:ring-1 focus:ring-border-focus"
                    />
                  </div>
                </div>
              )}

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="h-8 w-8 text-accent animate-spin" />
                  <p className="text-sm text-text-muted">Loading documents...</p>
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-hover">
                    <FileText className="h-8 w-8 text-text-subtle" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-base font-medium text-foreground">
                      {searchQuery ? "No documents found" : "No documents yet"}
                    </h3>
                    <p className="mt-1 text-sm text-text-muted">
                      {searchQuery
                        ? "Try a different search term."
                        : "Documents you upload in conversations will appear here."}
                    </p>
                  </div>
                </div>
              ) : (
                /* Document grid */
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  <AnimatePresence mode="popLayout">
                    {filteredDocuments.map((doc, index) => {
                      const IconComp = getFileIcon(doc.mimeType);
                      const typeLabel = getFileTypeLabel(doc.mimeType);
                      const accentClasses = getAccentForType(doc.mimeType);

                      return (
                        <motion.div
                          key={doc.id}
                          layout
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.2, delay: index * 0.03 }}
                          className="group relative flex flex-col rounded-xl border border-border bg-surface p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all hover:border-border-focus hover:shadow-md"
                        >
                          {/* File icon & type badge */}
                          <div className="mb-3 flex items-start justify-between">
                            <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", accentClasses)}>
                              <IconComp className="h-5 w-5" />
                            </div>
                            <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", accentClasses)}>
                              {typeLabel}
                            </span>
                          </div>

                          {/* File name */}
                          <h3 className="mb-1 truncate text-sm font-medium text-foreground" title={doc.name}>
                            {doc.name}
                          </h3>

                          {/* Meta */}
                          <p className="text-[11px] text-text-subtle">
                            {formatFileSize(doc.size)} · {formatDate(doc.createdAt)}
                          </p>

                          {/* Actions */}
                          <div className="mt-3 flex items-center gap-1.5 pt-3 border-t border-border/50">
                            <button
                              onClick={() => handleDownload(doc)}
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-surface-hover px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-btn-secondary-hover"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </button>
                            <button
                              onClick={() => handleDelete(doc.id)}
                              disabled={deletingId === doc.id}
                              className={cn(
                                "flex items-center justify-center rounded-lg p-1.5 text-text-subtle transition-colors hover:bg-red-500/10 hover:text-red-500",
                                deletingId === doc.id && "opacity-40 pointer-events-none"
                              )}
                              title="Delete document"
                            >
                              {deletingId === doc.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
