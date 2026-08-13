"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginRole, setLoginRole] = useState<"admin" | "member">("admin");

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [hasAdmin, setHasAdmin] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetch("/api/auth/register")
      .then((r) => r.json())
      .then((data) => {
        if (data.hasAdmin) {
          setHasAdmin(true);
          setRole("member");
        }
      })
      .catch(() => { });
  }, [mode]);

  function selectLoginRole(targetRole: "admin" | "member") {
    setLoginRole(targetRole);
    setError("");
    setEmail("");
    setPassword("");
  }

  function redirectUserByRole(userRole: string) {
    if (userRole === "admin" || userRole === "manager") {
      router.push("/dashboard");
    } else {
      router.push("/projects");
    }
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (mode === "register" && !name) {
      setError("Please enter your full name.");
      return;
    }

    if (!email || !password) {
      setError("Please fill in both email and password.");
      return;
    }

    setLoading(true);

    try {
      // Ensure initial tables are verified
      await fetch("/api/auth/seed", { method: "POST" }).catch(() => { });

      if (mode === "login") {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Login failed");

        redirectUserByRole(data.user?.role || "member");
      } else {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password, role }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Registration failed");

        redirectUserByRole(data.user?.role || "member");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-4 text-white">
      <div className="mx-auto w-full max-w-md">
        {/* Brand Header */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center rounded-2xl bg-amber-500/10 p-3 ring-1 ring-amber-500/30">
            <svg
              className="h-9 w-9 text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 0V8m0 3h4m-4 0H9"
              />
            </svg>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Hujurat Construction
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Construction Cost Control &amp; Project Management System
          </p>
        </div>

        {/* Auth Card */}
        <div className="rounded-3xl border border-slate-700/60 bg-slate-800/80 p-8 shadow-2xl backdrop-blur-xl">
          {/* Mode Switcher Tabs */}
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-slate-900/90 p-1.5 ring-1 ring-slate-800">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={`rounded-xl py-2.5 text-xs font-bold transition-all ${mode === "login"
                  ? "bg-amber-500 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-white"
                }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError("");
              }}
              className={`rounded-xl py-2.5 text-xs font-bold transition-all ${mode === "register"
                  ? "bg-amber-500 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-white"
                }`}
            >
              Register Account
            </button>
          </div>

          <h2 className="text-xl font-bold text-white">
            {mode === "login" ? "Welcome Back" : "Create an Account"}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {mode === "login"
              ? "Enter your account credentials to sign in."
              : "Register as Admin (one-time) or Project Team Member."}
          </p>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-medium text-rose-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900/90 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Email Address
              </label>
              <input
                type="email"
                required
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900/90 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                placeholder={loginRole === "admin" ? "admin@company.com" : "member@company.com"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-xs text-slate-400 hover:text-amber-400"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900/90 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {mode === "register" && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Register As
                </label>

                {hasAdmin && (
                  <div className="mb-2 rounded-lg bg-amber-500/10 p-2 text-center text-[11px] font-medium text-amber-400 ring-1 ring-amber-500/20">
                    ⚡ Admin already registered. New accounts register as Project Team.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={hasAdmin}
                    onClick={() => !hasAdmin && setRole("admin")}
                    className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition ${role === "admin"
                        ? "border-amber-500 bg-amber-500/10 text-amber-400"
                        : "border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-600"
                      } ${hasAdmin ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    <span className="text-sm font-bold">⚡ Register as Admin</span>
                    <span className="mt-0.5 text-[10px] opacity-80">
                      {hasAdmin ? "Setup Completed" : "1-Time Setup"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole("member")}
                    className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition ${role === "member"
                        ? "border-amber-500 bg-amber-500/10 text-amber-400"
                        : "border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-600"
                      }`}
                  >
                    <span className="text-sm font-bold">🏗️ Register as Member</span>
                    <span className="mt-0.5 text-[10px] opacity-80">Project Team</span>
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-3.5 font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:from-amber-400 hover:to-amber-500 active:scale-[0.99] disabled:opacity-50"
            >
              {loading
                ? mode === "login"
                  ? "Signing in…"
                  : "Registering…"
                : mode === "login"
                  ? `Sign In as ${loginRole === "admin" ? "Admin" : "Team Member"} →`
                  : `Register as ${role === "admin" ? "Admin" : "Team Member"} →`}
            </button>
          </form>

          {/* Role-based Sign-In Options at Bottom */}
          {mode === "login" && (
            <div className="mt-7 border-t border-slate-700/60 pt-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
                Sign In As:
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => selectLoginRole("admin")}
                  className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition ${loginRole === "admin"
                      ? "border-amber-500 bg-amber-500/10 text-amber-400"
                      : "border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-600"
                    }`}
                >
                  <span className="text-sm font-bold">⚡ Sign In as Admin</span>
                  <span className="mt-0.5 text-[10px] opacity-80">Full Dashboard</span>
                </button>

                <button
                  type="button"
                  onClick={() => selectLoginRole("member")}
                  className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition ${loginRole === "member"
                      ? "border-amber-500 bg-amber-500/10 text-amber-400"
                      : "border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-600"
                    }`}
                >
                  <span className="text-sm font-bold">🏗️ Sign In as Member</span>
                  <span className="mt-0.5 text-[10px] opacity-80">Project Team</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
