"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export function AuthForm({ mode }: { mode: "login" | "signup" | "forgot" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const supabase = createClient();
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/app");
        router.refresh();
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: window.location.origin + "/auth/callback?next=/onboarding",
          },
        });
        if (error) throw error;
        if (data.session) {
          router.replace("/onboarding");
          router.refresh();
        } else
          setMessage(
            "Check your email to verify your account. Your workspace setup will be waiting.",
          );
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/auth/callback?next=/reset-password",
        });
        if (error) throw error;
        setMessage("If an account exists for this email, a reset link is on its way.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }
  const title =
    mode === "login"
      ? "Welcome back"
      : mode === "signup"
        ? "Create your account"
        : "Reset your password";
  return (
    <section className="w-full max-w-md rounded-3xl border border-[#e7ede8] bg-white p-8 shadow-2xl shadow-[#183d2b]/10">
      <p className="text-xs font-semibold tracking-widest text-[#176b4b]">SOCIALOS ACCOUNT</p>
      <h1 className="mt-3 text-3xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-[#738078]">Your social operations start here.</p>
      <form onSubmit={submit} className="mt-8 space-y-5">
        {mode === "signup" && (
          <label className="block text-sm font-medium">
            Full name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="mt-2 w-full rounded-xl border border-[#dfe7e0] px-4 py-3 outline-none focus:border-[#176b4b]"
            />
          </label>
        )}
        <label className="block text-sm font-medium">
          Email address
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="mt-2 w-full rounded-xl border border-[#dfe7e0] px-4 py-3 outline-none focus:border-[#176b4b]"
          />
        </label>
        {mode !== "forgot" && (
          <label className="block text-sm font-medium">
            Password
            <input
              required
              minLength={8}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="mt-2 w-full rounded-xl border border-[#dfe7e0] px-4 py-3 outline-none focus:border-[#176b4b]"
            />
          </label>
        )}
        {mode === "login" && (
          <div className="text-right text-xs">
            <Link href="/forgot-password" className="font-semibold text-[#176b4b]">
              Forgot password?
            </Link>
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="rounded-xl bg-[#edf5ef] p-3 text-sm text-[#176b4b]">
            {message}
          </p>
        )}
        <button
          disabled={busy}
          className="w-full rounded-xl bg-[#176b4b] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy
            ? "Please wait…"
            : mode === "login"
              ? "Sign in"
              : mode === "signup"
                ? "Create account"
                : "Send reset link"}
        </button>
      </form>
      <p className="mt-7 text-center text-sm text-[#738078]">
        {mode === "login"
          ? "New to SocialOS?"
          : mode === "signup"
            ? "Already have an account?"
            : "Remembered your password?"}{" "}
        <Link
          href={mode === "login" ? "/signup" : "/login"}
          className="font-semibold text-[#176b4b]"
        >
          {mode === "login" ? "Create an account" : "Sign in"}
        </Link>
      </p>
    </section>
  );
}
