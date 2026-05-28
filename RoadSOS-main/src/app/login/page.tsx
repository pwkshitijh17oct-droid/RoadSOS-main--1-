"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.email || !form.password) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      // Store user info in localStorage for the app
      localStorage.setItem("roadsos_auth", JSON.stringify(data.user));
      localStorage.setItem("roadsos_token", data.token);

      // Sync full profile from DB into the app's profile store
      if (data.user.role === "user") {
        localStorage.setItem("roadsos_user_profile", JSON.stringify({
          name: data.user.name,
          phone: data.user.phone,
          bloodGroup: data.user.bloodGroup || "",
          vehicleNumber: data.user.vehicleNumber || "",
          vehicleType: data.user.vehicleType || "",
          age: data.user.age || "",
          gender: data.user.gender || "",
          emergencyContacts: data.user.emergencyContacts || [],
        }));
      }

      // Redirect based on role
      if (data.user.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/user");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const emailIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>;
  const lockIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-12 overflow-auto">
      {/* Background glow effects - softer for soothing look */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[15%] left-[10%] w-[500px] h-[500px] bg-cyan-600/[0.04] rounded-full blur-[140px] animate-glow-pulse" />
        <div className="absolute bottom-[15%] right-[10%] w-[500px] h-[500px] bg-purple-600/[0.04] rounded-full blur-[140px] animate-glow-pulse delay-500" />
        <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-red-600/[0.02] rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
        {/* Logo */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <Link href="/" className="flex items-center gap-4 group">
            <div
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 via-red-600 to-red-800 flex items-center justify-center text-white font-black text-base shadow-xl shadow-red-500/30 animate-gradient-shift group-hover:scale-105 transition-transform"
              style={{ fontFamily: "Outfit" }}
            >
              SOS
            </div>
            <div>
              <h1
                className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent"
                style={{ fontFamily: "Outfit" }}
              >
                RoadSOS
              </h1>
              <p className="text-[10px] text-white/30 tracking-widest uppercase mt-0.5">
                Emergency Road Assistance
              </p>
            </div>
          </Link>
        </div>

        {/* Card */}
        <div className="profile-card p-8 sm:p-10" style={{ "--card-glow": "rgba(34, 211, 238, 0.08)", "--card-border-hover": "rgba(34, 211, 238, 0.25)", "--card-shadow": "rgba(34, 211, 238, 0.10)" } as React.CSSProperties}>
          <div className="relative z-10">
            <div className="text-center mb-10">
              <h2
                className="text-2xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent mb-2"
                style={{ fontFamily: "Outfit" }}
              >
                Welcome Back
              </h2>
              <p className="text-sm text-white/40 tracking-wide">Sign in to your account</p>
            </div>

            {error && (
              <div className="mb-8 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-3.5 text-sm text-red-400 animate-scale-in">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
                <span className="font-medium">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email */}
              <div className="space-y-3">
                <label className="block text-[11px] font-bold uppercase tracking-[0.2em] text-white/40 pl-2" style={{ fontFamily: "Outfit", lineHeight: "1.6" }}>
                  Email Address
                </label>
                <div className="relative group">
                  <span className="absolute top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cyan-400/60 transition-colors duration-300" style={{ left: "20px" }}>
                    {emailIcon}
                  </span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-5 py-4 text-sm text-white/90 outline-none transition-all duration-300 hover:bg-white/[0.05] hover:border-white/20 focus:border-cyan-500/40 focus:bg-white/[0.06] focus:shadow-[0_0_25px_rgba(34,211,238,0.06)]"
                    style={{ paddingLeft: "55px", lineHeight: "1.6" }}
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-3">
                <label className="block text-[11px] font-bold uppercase tracking-[0.2em] text-white/40 pl-2" style={{ fontFamily: "Outfit", lineHeight: "1.6" }}>
                  Password
                </label>
                <div className="relative group">
                  <span className="absolute top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cyan-400/60 transition-colors duration-300" style={{ left: "20px" }}>
                    {lockIcon}
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-5 py-4 pr-12 text-sm text-white/90 outline-none transition-all duration-300 hover:bg-white/[0.05] hover:border-white/20 focus:border-cyan-500/40 focus:bg-white/[0.06] focus:shadow-[0_0_25px_rgba(34,211,238,0.06)]"
                    style={{ paddingLeft: "55px", lineHeight: "1.6" }}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-all cursor-pointer p-1"
                    style={{ right: "20px" }}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-12 py-4 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 text-white font-bold text-sm tracking-widest uppercase shadow-xl shadow-blue-500/10 hover:shadow-blue-500/25 transition-all duration-300 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                style={{ fontFamily: "Outfit" }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-3">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Authenticating...
                  </span>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-6 my-10">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <span className="text-[10px] text-white/20 font-bold uppercase tracking-[0.3em]">or</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>

            {/* Sign up link */}
            <p className="text-center text-sm text-white/30">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="text-cyan-400/80 hover:text-cyan-300 font-bold transition-all ml-1 underline underline-offset-4 decoration-cyan-400/20 hover:decoration-cyan-300"
              >
                Create Account
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-white/15 text-[10px] tracking-widest mt-8 font-medium">
          ROADSOS SECURE ACCESS v1.0
        </p>
      </div>
    </div>
  );
}

