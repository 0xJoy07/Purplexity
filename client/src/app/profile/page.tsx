"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { updateProfile, updatePassword, resendVerificationEmail } from "@/lib/api";
import { User, Camera, Shield, Mail, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function ProfilePage() {
  const { user, token, refreshUser, isLoading: authLoading } = useAuth();
  
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
        <h2 className="mb-2 text-xl font-semibold">Sign in to view your profile</h2>
        <p className="mb-6 text-sm text-text-muted">You need to be signed in to manage your account settings.</p>
        <Link href="/signin" className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90">
          Sign In
        </Link>
      </div>
    );
  }

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    
    setIsSavingProfile(true);
    setProfileMessage(null);
    try {
      await updateProfile({ name, email }, token);
      await refreshUser();
      setProfileMessage({ type: "success", text: "Profile updated successfully!" });
    } catch (err: any) {
      setProfileMessage({ type: "error", text: err.message || "Failed to update profile." });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    setIsSavingProfile(true);
    setProfileMessage(null);
    try {
      const formData = new FormData();
      formData.append("profileImage", file);
      
      await updateProfile(formData, token);
      await refreshUser();
      setProfileMessage({ type: "success", text: "Profile picture updated!" });
    } catch (err: any) {
      setProfileMessage({ type: "error", text: err.message || "Failed to upload image." });
    } finally {
      setIsSavingProfile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "New passwords do not match." });
      return;
    }

    setIsSavingPassword(true);
    setPasswordMessage(null);
    try {
      await updatePassword({ currentPassword, newPassword }, token);
      setPasswordMessage({ type: "success", text: "Password updated successfully!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordMessage({ type: "error", text: err.message || "Failed to update password." });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleResendVerification = async () => {
    if (!token) return;
    
    setIsResending(true);
    setResendMessage(null);
    try {
      const res = await resendVerificationEmail(token);
      setResendMessage({ type: "success", text: res.message || "Verification email sent!" });
    } catch (err: any) {
      setResendMessage({ type: "error", text: err.message || "Failed to send verification email." });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-background md:pl-[300px]">
      <header className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
        <h1 className="text-lg font-semibold text-foreground">Profile Settings</h1>
        <ThemeToggle />
      </header>

      <main className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="mx-auto max-w-2xl space-y-8">
          
          {/* Email Verification Banner */}
          {!user.emailVerified && user.provider === "Credentials" && (
            <div className="flex flex-col gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-600 sm:flex-row sm:items-center sm:justify-between dark:text-amber-400">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="text-sm font-medium">Your email address is not verified.</p>
              </div>
              <button 
                onClick={handleResendVerification} 
                disabled={isResending}
                className="whitespace-nowrap rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50 dark:bg-amber-600 dark:hover:bg-amber-700"
              >
                {isResending ? "Sending..." : "Resend Email"}
              </button>
            </div>
          )}
          {resendMessage && (
             <p className={cn("text-sm", resendMessage.type === "error" ? "text-red-500" : "text-green-500")}>
               {resendMessage.text}
             </p>
          )}

          {/* Profile Details Section */}
          <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-semibold text-foreground">
              <User className="h-5 w-5 text-accent" />
              Personal Details
            </h2>
            
            <div className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
              <div className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-border-subtle bg-surface-hover">
                {user.profileImage ? (
                  <img src={user.profileImage} alt={user.name} className="h-full w-full object-cover" />
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
                <h3 className="text-xl font-medium text-foreground">{user.name}</h3>
                <p className="mt-1 text-sm text-text-subtle">{user.email}</p>
                <div className="mt-3 flex items-center justify-center gap-1.5 rounded-full bg-surface-active px-3 py-1 text-xs font-medium text-text-muted sm:justify-start w-fit">
                  {user.provider === "Credentials" ? <Mail className="h-3.5 w-3.5" /> : null}
                  Signed in via {user.provider}
                </div>
              </div>
            </div>

            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="name" className="text-sm font-medium text-foreground">Full Name</label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-sm font-medium text-foreground">Email Address</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>
              
              {profileMessage && (
                <div className={cn("flex items-center gap-2 text-sm", profileMessage.type === "error" ? "text-red-500" : "text-green-500")}>
                  {profileMessage.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  {profileMessage.text}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSavingProfile || (name === user.name && email === user.email)}
                  className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingProfile ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </section>

          {/* Password Section */}
          {user.provider === "Credentials" && (
            <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
              <h2 className="mb-6 flex items-center gap-2 text-lg font-semibold text-foreground">
                <Shield className="h-5 w-5 text-accent" />
                Change Password
              </h2>
              
              <form onSubmit={handlePasswordUpdate} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="currentPassword" className="text-sm font-medium text-foreground">Current Password</label>
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
                    <label htmlFor="newPassword" className="text-sm font-medium text-foreground">New Password</label>
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
                    <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">Confirm New Password</label>
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
                  <div className={cn("flex items-center gap-2 text-sm", passwordMessage.type === "error" ? "text-red-500" : "text-green-500")}>
                    {passwordMessage.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    {passwordMessage.text}
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSavingPassword || !currentPassword || !newPassword || !confirmPassword}
                    className="rounded-xl border border-border-focus bg-surface-active px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingPassword ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </form>
            </section>
          )}

        </div>
      </main>
    </div>
  );
}
