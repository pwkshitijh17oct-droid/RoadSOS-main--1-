"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const vehicleTypes = ["Sedan", "SUV", "Hatchback", "Motorcycle", "Truck", "Bus", "Auto", "Other"];

// --- Stable icons (declared once, never re-created) ---
const emailIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 7L2 7" /></svg>;
const userIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
const phoneIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>;
const lockIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
const carIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 17h4V5H2v12h3M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1" /><circle cx="7.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></svg>;

// --- InputField defined OUTSIDE the page component for stability ---
function InputField({ label, icon, value, onChange, type = "text", placeholder, required = false, autoComplete }: {
  label: string; icon: React.ReactNode; value: string; onChange: (v: string) => void; type?: string; placeholder: string; required?: boolean; autoComplete?: string;
}) {
  return (
    <div className="space-y-3">
      <label className="block text-[11px] font-bold uppercase tracking-[0.2em] text-white/40 pl-2" style={{ fontFamily: "Outfit", lineHeight: "1.6" }}>
        {label} {required && <span className="text-red-400/50">*</span>}
      </label>
      <div className="relative group">
        <span className="absolute top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cyan-400/60 transition-colors duration-300" style={{ left: "20px" }}>{icon}</span>
        <input
          type={type} value={value}
          onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-5 py-4 text-sm text-white/90 outline-none transition-all duration-300 hover:bg-white/[0.05] hover:border-white/20 focus:border-cyan-500/40 focus:bg-white/[0.06] focus:shadow-[0_0_25px_rgba(34,211,238,0.06)]"
          style={{ paddingLeft: "55px", lineHeight: "1.6" }}
          autoComplete={autoComplete}
        />
      </div>
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    name: "", email: "", phone: "", password: "", confirmPassword: "",
    role: "user" as "user" | "admin",
    bloodGroup: "", vehicleNumber: "", vehicleType: "", age: "", gender: "",
    ecName: "", ecPhone: "", ecRelation: "",
  });

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const nextStep = () => {
    if (step === 1) {
      if (!form.role) { setError("Please select a role"); return; }
    }
    if (step === 2) {
      if (!form.name || !form.email || !form.phone || !form.password) {
        setError("Please fill all required fields"); return;
      }
      if (form.password.length < 6) { setError("Password must be at least 6 characters"); return; }
      if (form.password !== form.confirmPassword) { setError("Passwords do not match"); return; }
    }
    setError("");
    setStep((s) => s + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const emergencyContacts = form.ecName && form.ecPhone
      ? [{ name: form.ecName, phone: form.ecPhone, relation: form.ecRelation || "Other" }]
      : [];

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name, email: form.email, phone: form.phone,
          password: form.password, role: form.role,
          bloodGroup: form.bloodGroup, vehicleNumber: form.vehicleNumber,
          vehicleType: form.vehicleType, age: form.age, gender: form.gender,
          emergencyContacts,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error || "Registration failed"); return; }

      localStorage.setItem("roadsos_auth", JSON.stringify(data.user));
      localStorage.setItem("roadsos_token", data.token);

      if (data.user.role === "user") {
        localStorage.setItem("roadsos_user_profile", JSON.stringify({
          name: form.name, phone: form.phone, bloodGroup: form.bloodGroup,
          vehicleNumber: form.vehicleNumber, vehicleType: form.vehicleType,
          emergencyContacts,
        }));
      }

      router.push(data.user.role === "admin" ? "/admin" : "/user");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-12 overflow-auto">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[15%] right-[10%] w-[500px] h-[500px] bg-purple-600/[0.06] rounded-full blur-[140px] animate-glow-pulse" />
        <div className="absolute bottom-[15%] left-[10%] w-[500px] h-[500px] bg-cyan-600/[0.06] rounded-full blur-[140px] animate-glow-pulse delay-500" />
      </div>

      <div className="relative z-10 w-full max-w-lg animate-fade-in-up">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 via-red-600 to-red-800 flex items-center justify-center text-white font-black text-base shadow-xl shadow-red-500/30 animate-gradient-shift group-hover:scale-105 transition-transform" style={{ fontFamily: "Outfit" }}>SOS</div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent" style={{ fontFamily: "Outfit" }}>RoadSOS</h1>
              <p className="text-[10px] text-white/40 -mt-0.5 tracking-wide">Emergency Road Assistance</p>
            </div>
          </Link>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${step >= s ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25" : "bg-white/[0.06] text-white/30 border border-white/10"}`} style={{ fontFamily: "Outfit" }}>{s}</div>
              {s < 3 && <div className={`w-10 h-0.5 rounded-full transition-all duration-500 ${step > s ? "bg-gradient-to-r from-cyan-500 to-blue-600" : "bg-white/10"}`} />}
            </div>
          ))}
        </div>
        <p className="text-center text-[11px] text-white/30 mb-6">
          {step === 1 ? "Choose your role" : step === 2 ? "Account details" : "Additional info"}
        </p>

        {/* Card */}
        <div className="profile-card p-8" style={{ "--card-glow": "rgba(168, 85, 247, 0.08)", "--card-border-hover": "rgba(168, 85, 247, 0.25)", "--card-shadow": "rgba(168, 85, 247, 0.10)" } as React.CSSProperties}>
          <div className="relative z-10">
            <div className="text-center mb-7">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent mb-1" style={{ fontFamily: "Outfit" }}>Create Account</h2>
              <p className="text-sm text-white/40">Join the emergency network</p>
            </div>

            {error && (
              <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-400 animate-scale-in">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Step 1: Role */}
              {step === 1 && (
                <div className="space-y-4 animate-fade-in-up">
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-white/45 mb-3" style={{ fontFamily: "Outfit" }}>Select Your Role</label>
                  <div className="grid grid-cols-2 gap-4">
                    {/* User role */}
                    <button type="button" onClick={() => update("role", "user")}
                      className={`p-5 rounded-2xl border text-left transition-all duration-300 cursor-pointer ${form.role === "user" ? "border-blue-500/40 bg-blue-500/10 shadow-lg shadow-blue-500/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15"}`}>
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center mb-3 shadow-lg shadow-blue-500/20">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                      </div>
                      <h3 className="text-sm font-bold mb-0.5" style={{ fontFamily: "Outfit" }}>User</h3>
                      <p className="text-[10px] text-white/35 leading-relaxed">Report emergencies, get help nearby, SOS alerts</p>
                      {form.role === "user" && <div className="mt-3 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg></div>}
                    </button>
                    {/* Admin role */}
                    <button type="button" onClick={() => update("role", "admin")}
                      className={`p-5 rounded-2xl border text-left transition-all duration-300 cursor-pointer ${form.role === "admin" ? "border-purple-500/40 bg-purple-500/10 shadow-lg shadow-purple-500/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15"}`}>
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mb-3 shadow-lg shadow-purple-500/20">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                      </div>
                      <h3 className="text-sm font-bold mb-1" style={{ fontFamily: "Outfit" }}>Admin</h3>
                      <p className="text-[10px] text-white/30 leading-relaxed tracking-wide">Monitor SOS alerts, coordinate emergency response</p>
                      {form.role === "admin" && <div className="mt-4 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center shadow-lg shadow-purple-500/30"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg></div>}
                    </button>
                  </div>
                  <button type="button" onClick={nextStep} className="w-full mt-4 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 text-white font-bold text-sm tracking-wide shadow-xl shadow-blue-500/20 hover:shadow-blue-500/35 transition-all hover:brightness-110 active:scale-[0.98] cursor-pointer" style={{ fontFamily: "Outfit" }}>Continue</button>
                </div>
              )}

              {/* Step 2: Core details */}
              {step === 2 && (
                <div className="space-y-4 animate-fade-in-up">
                  <InputField label="Full Name" icon={userIcon} value={form.name} onChange={(v) => update("name", v)} placeholder="John Doe" required autoComplete="name" />
                  <InputField label="Email Address" icon={emailIcon} value={form.email} onChange={(v) => update("email", v)} type="email" placeholder="you@example.com" required autoComplete="email" />
                  <InputField label="Phone Number" icon={phoneIcon} value={form.phone} onChange={(v) => update("phone", v)} type="tel" placeholder="+91 98765 43210" required autoComplete="tel" />
                  <div className="space-y-3">
                    <label className="block text-[11px] font-bold uppercase tracking-[0.2em] text-white/40 pl-2" style={{ fontFamily: "Outfit", lineHeight: "1.6" }}>Password <span className="text-red-400/50">*</span></label>
                    <div className="relative group">
                      <span className="absolute top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cyan-400/60 transition-colors duration-300" style={{ left: "20px" }}>{lockIcon}</span>
                      <input type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="Min. 6 characters"
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-5 py-4 pr-12 text-sm text-white/90 outline-none transition-all duration-300 hover:bg-white/[0.05] hover:border-white/20 focus:border-cyan-500/40 focus:bg-white/[0.06] focus:shadow-[0_0_25px_rgba(34,211,238,0.06)]"
                        style={{ paddingLeft: "55px", lineHeight: "1.6" }}
                        autoComplete="new-password" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-all cursor-pointer p-1" style={{ right: "20px" }}>
                        {showPassword ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                          : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>}
                      </button>
                    </div>
                  </div>
                  <InputField label="Confirm Password" icon={lockIcon} value={form.confirmPassword} onChange={(v) => update("confirmPassword", v)} type="password" placeholder="Re-enter password" required autoComplete="new-password" />
                  <div className="flex gap-3 pt-12">
                    <button type="button" onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-white/60 text-sm font-semibold hover:bg-white/10 transition-all cursor-pointer" style={{ fontFamily: "Outfit" }}>Back</button>
                    <button type="button" onClick={nextStep} className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 text-white font-bold text-sm shadow-xl shadow-blue-500/20 hover:brightness-110 active:scale-[0.98] cursor-pointer" style={{ fontFamily: "Outfit" }}>Continue</button>
                  </div>
                </div>
              )}

              {/* Step 3: Additional info */}
              {step === 3 && (
                <div className="space-y-8 animate-fade-in-up">
                  {form.role === "user" && (
                    <>
                      {/* Section 1: Personal & Medical */}
                      <div className="space-y-5">
                        <div className="flex items-center gap-3 mb-1">
                          <div className="w-1.5 h-4 bg-cyan-500 rounded-full" />
                          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60" style={{ fontFamily: "Outfit" }}>Identity & Health</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-5">
                          <div className="space-y-2.5">
                            <label className="block text-[11px] font-bold uppercase tracking-[0.2em] text-white/40 pl-2" style={{ fontFamily: "Outfit" }}>Blood Group</label>
                            <select value={form.bloodGroup} onChange={(e) => update("bloodGroup", e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-5 py-3.5 text-sm text-white/90 outline-none transition-all duration-300 hover:bg-white/[0.05] hover:border-white/20 focus:border-cyan-500/40 appearance-none cursor-pointer">
                              <option value="" className="bg-[#0a0e1a]">Select</option>
                              {bloodGroups.map((bg) => <option key={bg} value={bg} className="bg-[#0a0e1a]">{bg}</option>)}
                            </select>
                          </div>
                          <div className="space-y-2.5">
                            <label className="block text-[11px] font-bold uppercase tracking-[0.2em] text-white/40 pl-2" style={{ fontFamily: "Outfit" }}>Gender</label>
                            <select value={form.gender} onChange={(e) => update("gender", e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-5 py-3.5 text-sm text-white/90 outline-none transition-all duration-300 hover:bg-white/[0.05] hover:border-white/20 focus:border-cyan-500/40 appearance-none cursor-pointer">
                              <option value="" className="bg-[#0a0e1a]">Select</option>
                              <option value="Male" className="bg-[#0a0e1a]">Male</option>
                              <option value="Female" className="bg-[#0a0e1a]">Female</option>
                              <option value="Other" className="bg-[#0a0e1a]">Other</option>
                            </select>
                          </div>
                        </div>
                        <InputField label="Age" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" /></svg>} value={form.age} onChange={(v) => update("age", v)} placeholder="e.g. 25" />
                      </div>

                      {/* Section 2: Vehicle Details */}
                      <div className="space-y-5 pt-2">
                        <div className="flex items-center gap-3 mb-1">
                          <div className="w-1.5 h-4 bg-amber-500 rounded-full" />
                          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60" style={{ fontFamily: "Outfit" }}>Vehicle Information</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-5">
                          <div className="space-y-2.5">
                            <label className="block text-[11px] font-bold uppercase tracking-[0.2em] text-white/40 pl-2" style={{ fontFamily: "Outfit" }}>Vehicle Type</label>
                            <select value={form.vehicleType} onChange={(e) => update("vehicleType", e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-5 py-3.5 text-sm text-white/90 outline-none transition-all duration-300 hover:bg-white/[0.05] hover:border-white/20 focus:border-cyan-500/40 appearance-none cursor-pointer">
                              <option value="" className="bg-[#0a0e1a]">Select</option>
                              {vehicleTypes.map((v) => <option key={v} value={v} className="bg-[#0a0e1a]">{v}</option>)}
                            </select>
                          </div>
                          <InputField label="Vehicle Number" icon={carIcon} value={form.vehicleNumber} onChange={(v) => update("vehicleNumber", v)} placeholder="DL 01 AB 1234" />
                        </div>
                      </div>

                      {/* Section 3: Emergency Contact */}
                      <div className="space-y-5 pt-2">
                        <div className="flex items-center gap-3 mb-1">
                          <div className="w-1.5 h-4 bg-purple-500 rounded-full" />
                          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60" style={{ fontFamily: "Outfit" }}>Emergency Contact</h3>
                        </div>
                        <div className="space-y-5">
                          <InputField label="Contact Name" icon={userIcon} value={form.ecName} onChange={(v) => update("ecName", v)} placeholder="Priya Sharma" />
                          <div className="grid grid-cols-2 gap-5">
                            <InputField label="Contact Phone" icon={phoneIcon} value={form.ecPhone} onChange={(v) => update("ecPhone", v)} type="tel" placeholder="+91 87654 32100" />
                            <InputField label="Relation" icon={userIcon} value={form.ecRelation} onChange={(v) => update("ecRelation", v)} placeholder="Spouse" />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {form.role === "admin" && (
                    <div className="text-center py-6">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/15 to-pink-500/15 border border-purple-500/20 flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">🛡️</span>
                      </div>
                      <p className="text-sm text-white/60 mb-2 font-medium">Admin Account</p>
                      <p className="text-xs text-white/30 max-w-xs mx-auto leading-relaxed">
                        You&apos;ll have access to the command center to monitor SOS alerts, coordinate responses, and manage the emergency network.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-12">
                    <button type="button" onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-white/60 text-sm font-semibold hover:bg-white/10 transition-all cursor-pointer" style={{ fontFamily: "Outfit" }}>Back</button>
                    <button type="submit" disabled={loading} className="flex-[2] py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 text-white font-bold text-sm shadow-xl shadow-blue-500/20 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 cursor-pointer" style={{ fontFamily: "Outfit" }}>
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          Creating...
                        </span>
                      ) : "Create Account"}
                    </button>
                  </div>
                </div>
              )}
            </form>

            <div className="flex items-center gap-4 my-10">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <span className="text-[10px] text-white/25 uppercase tracking-widest">or</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>

            <div className="text-center pb-2">
              <p className="text-sm text-white/40">
                Already have an account?{" "}
                <Link href="/login" className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors">Sign In</Link>
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-white/15 text-[11px] mt-6">RoadSOS v0.1 · Emergency Response Platform</p>
      </div>
    </div>
  );
}
