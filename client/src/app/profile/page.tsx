"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useAuth, type TokenUsageState } from "@/lib/auth";
import {
  updateProfile,
  updatePassword,
  resendVerificationEmail,
  deleteAccount,
  clearSearchHistory,
  getActiveSessions,
  signOutAllDevices,
  getTokenHistory,
  getTokenUsage,
} from "@/lib/api";
import {
  User,
  Camera,
  Shield,
  Mail,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  Settings,
  Palette,
  AlertTriangle,
  Trash2,
  Lock,
  ExternalLink,
  Monitor,
  LogOut,
  Clock,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "next-themes";
import { useSearchParams, useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = "profile" | "usage" | "preferences" | "security" | "danger";

interface Tab {
  id: TabId;
  label: string;
  icon: LucideIcon;
}

const tabs: Tab[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "usage", label: "Usage & Limits", icon: BarChart3 },
  { id: "preferences", label: "Preferences", icon: Palette },
  { id: "security", label: "Security", icon: Shield },
  { id: "danger", label: "Danger Zone", icon: AlertTriangle },
];

// ── Reusable SettingsCard ─────────────────────────────────────────────────────

function SettingsCard({
  title,
  icon: Icon,
  children,
  danger,
  className,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  danger?: boolean;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border bg-surface p-6 shadow-sm transition-colors",
        danger
          ? "border-red-300 dark:border-red-800/50"
          : "border-border",
        className
      )}
    >
      <h2 className="mb-6 flex items-center gap-2.5 text-lg font-semibold text-foreground">
        <Icon
          className={cn(
            "h-5 w-5",
            danger ? "text-red-500" : "text-accent"
          )}
        />
        {title}
      </h2>
      {children}
    </section>
  );
}

// ── Profile Section ───────────────────────────────────────────────────────────

function ProfileSection() {
  const { user, token, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [email] = useState(user?.email || "");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [isResending, setIsResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user || !token) return null;

  const isOAuth = user.provider !== "Credentials";
  const isDirty = name !== user.name;

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      await updateProfile({ name, email }, token);
      await refreshUser();
      setMessage({ type: "success", text: "Profile updated successfully!" });
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.message || "Failed to update profile.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("profileImage", file);
      await updateProfile(formData, token);
      await refreshUser();
      setMessage({ type: "success", text: "Profile picture updated!" });
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.message || "Failed to upload image.",
      });
    } finally {
      setIsSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setResendMsg(null);
    try {
      const res = await resendVerificationEmail(token);
      setResendMsg({
        type: "success",
        text: res.message || "Verification email sent!",
      });
    } catch (err: any) {
      setResendMsg({
        type: "error",
        text: err.message || "Failed to send verification email.",
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Email Verification Banner */}
      {!user.emailVerified && user.provider === "Credentials" && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-600 sm:flex-row sm:items-center sm:justify-between dark:text-amber-400">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">
              Your email address is not verified.
            </p>
          </div>
          <button
            onClick={handleResend}
            disabled={isResending}
            className="whitespace-nowrap rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50 dark:bg-amber-600 dark:hover:bg-amber-700"
          >
            {isResending ? "Sending..." : "Resend Email"}
          </button>
        </div>
      )}
      {resendMsg && (
        <p
          className={cn(
            "text-sm",
            resendMsg.type === "error" ? "text-red-500" : "text-green-500"
          )}
        >
          {resendMsg.text}
        </p>
      )}

      <SettingsCard title="Personal Details" icon={User}>
        {/* Avatar + info */}
        <div className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
          <div className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-border-subtle bg-surface-hover">
            {user.profileImage ? (
              <img
                src={user.profileImage}
                alt={user.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <User className="h-10 w-10 text-text-subtle" />
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
              title="Change profile picture"
            >
              <Camera className="h-6 w-6 text-white" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/png, image/jpeg, image/webp"
              onChange={handleImageUpload}
            />
          </div>
          <div className="flex flex-col text-center sm:text-left">
            <h3 className="text-xl font-medium text-foreground">
              {user.name}
            </h3>
            <p className="mt-1 text-sm text-text-subtle">{user.email}</p>
            <div className="mt-3 flex w-fit items-center justify-center gap-1.5 rounded-full bg-surface-active px-3 py-1 text-xs font-medium text-text-muted sm:justify-start">
              {user.provider === "Credentials" ? (
                <Mail className="h-3.5 w-3.5" />
              ) : null}
              Signed in via {user.provider}
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="name"
                className="text-sm font-medium text-foreground"
              >
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-sm font-medium text-foreground"
              >
                Email Address
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  readOnly={isOAuth}
                  className={cn(
                    "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
                    isOAuth && "cursor-not-allowed bg-surface-hover pr-10 text-text-muted"
                  )}
                />
                {isOAuth && (
                  <div className="group absolute right-3 top-1/2 -translate-y-1/2">
                    <Lock className="h-4 w-4 text-text-subtle" />
                    <div className="pointer-events-none absolute bottom-full right-0 mb-2 hidden w-48 rounded-lg bg-foreground px-3 py-2 text-xs text-background shadow-lg group-hover:block">
                      Managed by {user.provider} sign-in
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {message && (
            <div
              className={cn(
                "flex items-center gap-2 text-sm",
                message.type === "error" ? "text-red-500" : "text-green-500"
              )}
            >
              {message.type === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {message.text}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving || !isDirty}
              className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </SettingsCard>
    </div>
  );
}

// ── Usage & Limits Section ────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return n.toString();
}

function UsageSection() {
  const { user, token, tokenUsage, refreshTokenUsage } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !token) return;
    const fetchHistory = async () => {
      try {
        const data = await getTokenHistory(user.id, token, 7);
        // Transform for recharts
        const chartData = data.map((d: any) => ({
          date: new Date(d.date).toLocaleDateString("en-IN", {
            weekday: "short",
          }),
          tokens: d.tokensUsed,
          requests: d.requestCount,
        }));
        setHistory(chartData.reverse());
      } catch (err) {
        console.error("Failed to fetch history:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
    refreshTokenUsage();
  }, [user, token]);

  if (!tokenUsage) {
    return (
      <SettingsCard title="Usage & Limits" icon={BarChart3}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-text-subtle" />
        </div>
      </SettingsCard>
    );
  }

  const pct = Math.min(
    100,
    (tokenUsage.tokensUsedToday / tokenUsage.dailyLimit) * 100
  );
  const level =
    pct >= 100 ? "exceeded" : pct > 85 ? "high" : pct > 60 ? "medium" : "low";

  const barColor =
    level === "low"
      ? "#0F766E"
      : level === "medium"
        ? "#D97706"
        : "#DC2626";

  return (
    <div className="space-y-6">
      <SettingsCard title="Today's Usage" icon={Zap}>
        <div className="space-y-4">
          {/* Main progress */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                {formatTokens(tokenUsage.tokensUsedToday)} /{" "}
                {formatTokens(tokenUsage.dailyLimit)} tokens used today
              </span>
              <span
                className={cn(
                  "text-xs font-semibold",
                  level === "low"
                    ? "text-accent"
                    : level === "medium"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-red-500"
                )}
              >
                {Math.round(pct)}%
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${pct}%`,
                  backgroundColor: barColor,
                }}
              />
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-text-subtle">
              <Clock className="h-3 w-3" />
              Resets at 12:00 AM IST
            </div>
          </div>

          {/* Context window */}
          <div className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Context Window
                </p>
                <p className="mt-0.5 text-xs text-text-subtle">
                  Max tokens per search request
                </p>
              </div>
              <span className="rounded-lg bg-accent-soft px-3 py-1.5 text-sm font-semibold text-accent">
                {formatTokens(tokenUsage.contextWindowLimit)}
              </span>
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* 7-day chart */}
      <SettingsCard title="7-Day History" icon={BarChart3}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-text-subtle" />
          </div>
        ) : history.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-subtle">
            No usage data yet. Start searching to see your history.
          </p>
        ) : (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={history}
                margin={{ top: 4, right: 0, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--border)"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--text-subtle)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--text-subtle)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => formatTokens(v)}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                    boxShadow: "0 4px 12px rgba(0,0,0,.08)",
                  }}
                  formatter={(value: number) => [
                    `${value.toLocaleString()} tokens`,
                    "Usage",
                  ]}
                />
                <Bar
                  dataKey="tokens"
                  fill="#0F766E"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SettingsCard>
    </div>
  );
}

// ── Preferences Section ───────────────────────────────────────────────────────

function PreferencesSection() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [responseLength, setResponseLength] = useState("balanced");

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const themeOptions = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "System" },
  ];

  const lengthOptions = [
    {
      value: "concise",
      label: "Concise",
      desc: "Short, direct answers",
    },
    {
      value: "balanced",
      label: "Balanced",
      desc: "Moderate detail",
    },
    {
      value: "detailed",
      label: "Detailed",
      desc: "Comprehensive responses",
    },
  ];

  return (
    <div className="space-y-6">
      <SettingsCard title="Appearance" icon={Palette}>
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Theme</p>
          <p className="mb-3 text-xs text-text-subtle">
            Choose how Purplexity looks for you
          </p>
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={cn(
                  "rounded-xl border px-4 py-3 text-sm font-medium transition-all",
                  theme === opt.value
                    ? "border-accent bg-accent-soft text-accent shadow-sm"
                    : "border-border bg-background text-text-muted hover:border-border-focus hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Response Style" icon={Settings}>
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            Response Length
          </p>
          <p className="mb-3 text-xs text-text-subtle">
            Controls how detailed AI responses are
          </p>
          <div className="space-y-2">
            {lengthOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setResponseLength(opt.value)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all",
                  responseLength === opt.value
                    ? "border-accent bg-accent-soft"
                    : "border-border bg-background hover:border-border-focus"
                )}
              >
                <div>
                  <p
                    className={cn(
                      "text-sm font-medium",
                      responseLength === opt.value
                        ? "text-accent"
                        : "text-foreground"
                    )}
                  >
                    {opt.label}
                  </p>
                  <p className="text-xs text-text-subtle">{opt.desc}</p>
                </div>
                {responseLength === opt.value && (
                  <CheckCircle2 className="h-5 w-5 text-accent" />
                )}
              </button>
            ))}
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}

// ── Security Section ──────────────────────────────────────────────────────────

function SecuritySection() {
  const { user, token, logout } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  // Password state (credentials only)
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!token) return;
    getActiveSessions(token)
      .then((data) => setSessions(data.activeSessions || []))
      .catch(() => { })
      .finally(() => setLoadingSessions(false));
  }, [token]);

  if (!user || !token) return null;

  const isOAuth = user.provider !== "Credentials";

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMessage({
        type: "error",
        text: "New passwords do not match.",
      });
      return;
    }
    setIsSavingPassword(true);
    setPasswordMessage(null);
    try {
      await updatePassword({ currentPassword, newPassword }, token);
      setPasswordMessage({
        type: "success",
        text: "Password updated successfully!",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordMessage({
        type: "error",
        text: err.message || "Failed to update password.",
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleSignOutAll = async () => {
    setSigningOut(true);
    try {
      await signOutAllDevices(token);
      await logout();
      router.push("/signin");
    } catch {
      setSigningOut(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Auth provider info */}
      <SettingsCard title="Authentication" icon={Shield}>
        <div className="rounded-xl border border-border bg-background p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft">
                <Shield className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Signed in via {user.provider}
                </p>
                <p className="text-xs text-text-subtle">{user.email}</p>
              </div>
            </div>
            {isOAuth && (
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                Revoke Access
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </SettingsCard>

      {/* Password change (Credentials only) */}
      {!isOAuth && (
        <SettingsCard title="Change Password" icon={Lock}>
          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="currentPassword"
                className="text-sm font-medium text-foreground"
              >
                Current Password
              </label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="newPassword"
                  className="text-sm font-medium text-foreground"
                >
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="confirmPassword"
                  className="text-sm font-medium text-foreground"
                >
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  required
                  minLength={8}
                />
              </div>
            </div>

            {passwordMessage && (
              <div
                className={cn(
                  "flex items-center gap-2 text-sm",
                  passwordMessage.type === "error"
                    ? "text-red-500"
                    : "text-green-500"
                )}
              >
                {passwordMessage.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                {passwordMessage.text}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={
                  isSavingPassword ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword
                }
                className="rounded-xl border border-border-focus bg-surface-active px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingPassword ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </SettingsCard>
      )}

      {/* Active Sessions */}
      <SettingsCard title="Active Sessions" icon={Monitor}>
        {loadingSessions ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-text-subtle" />
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between rounded-xl border border-border bg-background p-4"
              >
                <div className="flex items-center gap-3">
                  <Monitor className="h-5 w-5 text-text-subtle" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {session.isCurrent ? "This device" : "Other device"}
                    </p>
                    <p className="max-w-xs truncate text-xs text-text-subtle">
                      {session.device?.slice(0, 60)}
                    </p>
                  </div>
                </div>
                {session.isCurrent && (
                  <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[10px] font-semibold text-accent">
                    Current
                  </span>
                )}
              </div>
            ))}

            <button
              onClick={handleSignOutAll}
              disabled={signingOut}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              {signingOut
                ? "Signing out..."
                : "Sign out of all devices"}
            </button>
          </div>
        )}
      </SettingsCard>
    </div>
  );
}

// ── Danger Zone Section ───────────────────────────────────────────────────────

function DangerSection() {
  const { user, token, logout } = useAuth();
  const router = useRouter();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [isClearing, setIsClearing] = useState(false);
  const [clearResult, setClearResult] = useState<string | null>(null);

  if (!user || !token) return null;

  const handleDeleteAccount = async () => {
    setDeleteError("");
    setIsDeleting(true);
    try {
      await deleteAccount(deleteEmail, token);
      await logout();
      router.push("/signin");
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete account.");
      setIsDeleting(false);
    }
  };

  const handleClearHistory = async () => {
    setIsClearing(true);
    setClearResult(null);
    try {
      const result = await clearSearchHistory(token);
      setClearResult(
        `Cleared ${result.deleted.conversations} conversations and ${result.deleted.queries} queries.`
      );
    } catch (err: any) {
      setClearResult(err.message || "Failed to clear history.");
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Clear History */}
      <SettingsCard title="Clear Search History" icon={Trash2} danger>
        <p className="mb-4 text-sm text-text-muted">
          This will permanently delete all your conversations and search
          queries. This action cannot be undone.
        </p>
        {clearResult && (
          <p className="mb-3 text-sm text-text-muted">{clearResult}</p>
        )}
        <button
          onClick={handleClearHistory}
          disabled={isClearing}
          className="rounded-xl border border-red-300 bg-red-50 px-5 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
        >
          {isClearing ? "Clearing..." : "Clear All History"}
        </button>
      </SettingsCard>

      {/* Delete Account */}
      <SettingsCard title="Delete Account" icon={AlertTriangle} danger>
        <p className="mb-4 text-sm text-text-muted">
          Once you delete your account, there is no going back. All your data,
          conversations, and files will be permanently removed.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
        >
          Delete My Account
        </button>
      </SettingsCard>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                Delete Account
              </h3>
            </div>

            <p className="mb-4 text-sm text-text-muted">
              This action is <strong>permanent and irreversible</strong>.
              Type your email address below to confirm:
            </p>

            <p className="mb-2 text-xs font-medium text-text-subtle">
              {user.email}
            </p>

            <input
              type="email"
              value={deleteEmail}
              onChange={(e) => setDeleteEmail(e.target.value)}
              placeholder="Type your email to confirm"
              className="mb-4 w-full rounded-xl border border-red-300 bg-background px-4 py-2.5 text-sm text-foreground transition-colors focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-red-800/50"
            />

            {deleteError && (
              <p className="mb-3 text-sm text-red-500">{deleteError}</p>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteEmail("");
                  setDeleteError("");
                }}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={
                  isDeleting ||
                  deleteEmail.toLowerCase() !== user.email.toLowerCase()
                }
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting
                  ? "Deleting..."
                  : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Settings Page (inner, uses useSearchParams) ──────────────────────────

function SettingsPageInner() {
  const { user, isLoading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const activeTab = (searchParams.get("tab") as TabId) || "profile";

  const setActiveTab = useCallback(
    (tab: TabId) => {
      router.replace(`/profile?tab=${tab}`, { scroll: false });
    },
    [router]
  );

  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground">
        <div className="mb-4 rounded-full bg-surface-hover p-4 text-text-subtle">
          <User className="h-12 w-12" />
        </div>
        <h2 className="mb-2 text-xl font-semibold">
          Sign in to view your profile
        </h2>
        <p className="mb-6 text-sm text-text-muted">
          You need to be signed in to manage your account settings.
        </p>
        <Link
          href="/signin"
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90"
        >
          Sign In
        </Link>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case "profile":
        return <ProfileSection />;
      case "usage":
        return <UsageSection />;
      case "preferences":
        return <PreferencesSection />;
      case "security":
        return <SecuritySection />;
      case "danger":
        return <DangerSection />;
      default:
        return <ProfileSection />;
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-surface-hover"
          >
            <img
              src="/logo.png"
              alt="Logo"
              className="h-5 w-auto object-contain"
            />
          </Link>
          <h1 className="text-lg font-semibold text-foreground">Settings</h1>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar nav */}
        <nav className="hidden w-56 shrink-0 border-r border-border bg-background p-4 md:block">
          <ul className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <li key={tab.id}>
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                      isActive
                        ? "bg-accent-soft text-accent shadow-sm"
                        : "text-text-muted hover:bg-surface-hover hover:text-foreground",
                      tab.id === "danger" &&
                      !isActive &&
                      "text-red-500/70 hover:text-red-500"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        isActive
                          ? "text-accent"
                          : tab.id === "danger"
                            ? "text-red-500/70"
                            : "text-text-subtle"
                      )}
                    />
                    {tab.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Mobile tab bar */}
        <div className="flex w-full shrink-0 gap-1 overflow-x-auto border-b border-border bg-background px-4 py-2 md:hidden">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                  isActive
                    ? "bg-accent-soft text-accent"
                    : "text-text-muted hover:bg-surface-hover",
                  tab.id === "danger" &&
                  !isActive &&
                  "text-red-500/70"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10">
          <div className="mx-auto max-w-2xl">{renderContent()}</div>
        </main>
      </div>
    </div>
  );
}

// ── Export with Suspense wrapper ───────────────────────────────────────────────

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      }
    >
      <SettingsPageInner />
    </Suspense>
  );
}
