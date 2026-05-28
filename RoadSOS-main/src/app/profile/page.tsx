"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getUserProfile, saveUserProfile, type UserProfile } from "@/lib/profiles";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const VEHICLE_TYPES = ["Sedan", "SUV", "Hatchback", "Motorcycle", "Truck", "Van", "Auto", "Other"];
const GENDERS = ["Male", "Female", "Other", "Prefer not to say"];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] text-white/30 uppercase tracking-[0.15em] font-semibold mb-2.5" style={{ fontFamily: "Outfit" }}>{children}</label>;
}

function InputField({ label, icon, value, onChange, placeholder, type = "text", accent = "blue" }: {
  label: string; icon: React.ReactNode; value: string; onChange: (v: string) => void; placeholder: string; type?: string; accent?: string;
}) {
  const focusColors: Record<string, string> = { blue: "focus:border-blue-500/40 focus:shadow-[0_0_20px_rgba(59,130,246,0.08)]", amber: "focus:border-amber-500/40 focus:shadow-[0_0_20px_rgba(245,158,11,0.08)]", red: "focus:border-red-500/40 focus:shadow-[0_0_20px_rgba(239,68,68,0.08)]" };
  const iconColors: Record<string, string> = { blue: "text-blue-400/30 group-focus-within:text-blue-400/60", amber: "text-amber-400/30 group-focus-within:text-amber-400/60", red: "text-red-400/30 group-focus-within:text-red-400/60" };

  return (
    <div className="space-y-3">
      <label className="block text-[11px] text-white/30 uppercase tracking-[0.15em] font-semibold mb-1 pl-2" style={{ fontFamily: "Outfit", lineHeight: "1.6" }}>{label}</label>
      <div className="relative group">
        <span className={`absolute top-1/2 -translate-y-1/2 transition-colors duration-300 ${iconColors[accent] || iconColors.blue}`} style={{ left: "20px" }}>
          {icon}
        </span>
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className={`w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl px-5 py-4 text-sm text-white/90 placeholder-white/15 outline-none transition-all duration-300 hover:bg-white/[0.05] hover:border-white/20 ${focusColors[accent] || focusColors.blue}`}
          style={{ fontFamily: "Inter, system-ui, sans-serif", paddingLeft: "55px", lineHeight: "1.6" }}
        />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState("personal");
  const [newContact, setNewContact] = useState({ name: "", phone: "", relation: "" });
  const [addingContact, setAddingContact] = useState(false);
  const [newMedical, setNewMedical] = useState("");
  const [newAllergy, setNewAllergy] = useState("");

  useEffect(() => { setProfile(getUserProfile()); }, []);
  if (!profile) return null;

  const update = (field: keyof UserProfile, value: unknown) => {
    setProfile((p) => p ? { ...p, [field]: value } : p);
    setSaved(false);
  };

  const handleSave = () => {
    if (!profile) return;
    saveUserProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const addEmergencyContact = () => {
    if (!newContact.name || !newContact.phone) return;
    update("emergencyContacts", [...profile.emergencyContacts, { ...newContact }]);
    setNewContact({ name: "", phone: "", relation: "" });
    setAddingContact(false);
  };

  const addMedical = () => { if (!newMedical.trim()) return; update("medicalConditions", [...profile.medicalConditions, newMedical.trim()]); setNewMedical(""); };
  const addAllergy = () => { if (!newAllergy.trim()) return; update("allergies", [...profile.allergies, newAllergy.trim()]); setNewAllergy(""); };

  const sections = [
    { id: "personal", label: "Personal", icon: "👤" },
    { id: "vehicle", label: "Vehicle", icon: "🚗" },
    { id: "medical", label: "Medical", icon: "🏥" },
    { id: "emergency", label: "Contacts", icon: "📱" },
  ];

  return (
    <div className="min-h-screen w-full overflow-auto">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-600/[0.05] via-cyan-600/[0.02] to-transparent" />
        <div className="absolute top-[25%] right-[10%] w-[400px] h-[400px] bg-blue-600/[0.03] rounded-full blur-[160px]" />
        <div className="absolute bottom-[15%] left-[5%] w-[300px] h-[300px] bg-purple-600/[0.03] rounded-full blur-[140px]" />
      </div>

      <div className="relative z-10 w-full flex justify-center">
      <div className="w-full max-w-xl px-6 pt-10 pb-32">
        {/* Header */}
        <div className="text-center mb-10 animate-fade-in-up">
          <Link href="/user" className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors mb-6">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            Back to Map
          </Link>
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500 flex items-center justify-center text-3xl mx-auto mb-5 shadow-2xl shadow-blue-500/20">
            {profile.name ? profile.name.charAt(0).toUpperCase() : "U"}
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-1" style={{ fontFamily: "Outfit" }}>
            My Profile
          </h1>
          <p className="text-sm text-white/30">{profile.name || "Set up your profile"}</p>
        </div>

        {/* Section tabs */}
        <div className="flex justify-center gap-2 mb-10 animate-fade-in-up" style={{ animationDelay: "100ms", animationFillMode: "both" }}>
          {sections.map((s) => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={`px-5 py-3 rounded-2xl text-xs font-semibold border transition-all duration-300 cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                activeSection === s.id
                  ? "bg-blue-500/15 text-blue-400 border-blue-500/25 shadow-lg shadow-blue-500/10"
                  : "bg-white/[0.02] border-white/[0.06] text-white/30 hover:text-white/60 hover:bg-white/[0.04]"
              }`} style={{ fontFamily: "Outfit" }}
            >
              <span className="text-sm">{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        {/* ─── PERSONAL ─── */}
        {activeSection === "personal" && (
          <div className="animate-fade-in-up space-y-6">
            <div className="glass-card p-7 space-y-7">
              <h3 className="text-base font-bold text-white/80 flex items-center gap-2.5" style={{ fontFamily: "Outfit" }}>
                <span className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-sm">👤</span>
                Personal Information
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <InputField label="Full Name" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>} value={profile.name} onChange={(v) => update("name", v)} placeholder="Enter your full name" />
                <InputField label="Phone Number" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>} value={profile.phone} onChange={(v) => update("phone", v)} placeholder="+91 XXXXX XXXXX" type="tel" />
                <InputField label="Age" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg>} value={profile.age} onChange={(v) => update("age", v)} placeholder="e.g. 28" />
                <div>
                  <SectionLabel>Gender</SectionLabel>
                  <div className="grid grid-cols-2 gap-2.5">
                    {GENDERS.map((g) => (
                      <button key={g} onClick={() => update("gender", g)}
                        className={`py-3 rounded-2xl text-xs font-semibold border transition-all cursor-pointer ${
                          profile.gender === g ? "bg-blue-500/15 text-blue-400 border-blue-500/25" : "bg-white/[0.02] border-white/[0.06] text-white/30 hover:bg-white/[0.04]"
                        }`} style={{ fontFamily: "Outfit" }}>{g}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <SectionLabel>Blood Group</SectionLabel>
                <div className="grid grid-cols-4 gap-2.5">
                  {BLOOD_GROUPS.map((bg) => (
                    <button key={bg} onClick={() => update("bloodGroup", bg)}
                      className={`py-3.5 rounded-2xl text-sm font-bold border transition-all cursor-pointer ${
                        profile.bloodGroup === bg ? "bg-red-500/15 text-red-400 border-red-500/25 shadow-lg shadow-red-500/10" : "bg-white/[0.02] border-white/[0.06] text-white/30 hover:bg-white/[0.04]"
                      }`} style={{ fontFamily: "Outfit" }}>{bg}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── VEHICLE ─── */}
        {activeSection === "vehicle" && (
          <div className="animate-fade-in-up space-y-6">
            <div className="glass-card p-7 space-y-7">
              <h3 className="text-base font-bold text-white/80 flex items-center gap-2.5" style={{ fontFamily: "Outfit" }}>
                <span className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-sm">🚗</span>
                Vehicle Information
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <InputField label="Vehicle Number" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 17h4V5H2v12h3M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>} value={profile.vehicleNumber} onChange={(v) => update("vehicleNumber", v)} placeholder="e.g. DL 01 AB 1234" accent="amber" />
                <InputField label="Vehicle Model" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="22" height="13" rx="2"/><path d="M7 21h10"/></svg>} value={profile.vehicleModel} onChange={(v) => update("vehicleModel", v)} placeholder="e.g. Maruti Swift, Honda City" accent="amber" />
                <InputField label="Vehicle Color" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/></svg>} value={profile.vehicleColor} onChange={(v) => update("vehicleColor", v)} placeholder="e.g. White, Silver" accent="amber" />
                <InputField label="Driving License" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/></svg>} value={profile.drivingLicense} onChange={(v) => update("drivingLicense", v)} placeholder="DL number" accent="amber" />
                <InputField label="Insurance ID" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>} value={profile.insuranceId} onChange={(v) => update("insuranceId", v)} placeholder="Insurance policy number" accent="amber" />
              </div>

              <div className="pt-2">
                <SectionLabel>Vehicle Type</SectionLabel>
                <div className="grid grid-cols-4 gap-2.5">
                  {VEHICLE_TYPES.map((vt) => (
                    <button key={vt} onClick={() => update("vehicleType", vt)}
                      className={`py-3 rounded-2xl text-xs font-semibold border transition-all cursor-pointer ${
                        profile.vehicleType === vt ? "bg-amber-500/15 text-amber-400 border-amber-500/25 shadow-lg shadow-amber-500/10" : "bg-white/[0.02] border-white/[0.06] text-white/30 hover:bg-white/[0.04]"
                      }`} style={{ fontFamily: "Outfit" }}>{vt}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── MEDICAL ─── */}
        {activeSection === "medical" && (
          <div className="animate-fade-in-up space-y-6">
            {/* Medical Conditions */}
            <div className="glass-card p-7 space-y-5">
              <h3 className="text-base font-bold text-white/80 flex items-center gap-2.5" style={{ fontFamily: "Outfit" }}>
                <span className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-sm">💊</span>
                Medical Conditions
              </h3>
              <div className="flex flex-wrap gap-2.5 min-h-[40px]">
                {profile.medicalConditions.map((mc, i) => (
                  <span key={i} className="flex items-center gap-2 text-xs bg-red-500/10 text-red-400 border border-red-500/15 px-4 py-2 rounded-full">
                    {mc}
                    <button onClick={() => update("medicalConditions", profile.medicalConditions.filter((_, j) => j !== i))} className="text-red-400/40 hover:text-red-400 transition-colors cursor-pointer text-sm">×</button>
                  </span>
                ))}
                {profile.medicalConditions.length === 0 && <span className="text-xs text-white/15 italic">No conditions added yet</span>}
              </div>
              <div className="flex gap-3">
                <input type="text" value={newMedical} onChange={(e) => setNewMedical(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMedical()}
                  className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-2xl px-4 py-3 text-xs text-white/90 placeholder-white/15 outline-none focus:border-red-500/30 transition-colors"
                  placeholder="e.g. Diabetes, Asthma, Heart condition..." />
                <button onClick={addMedical} className="px-5 py-3 bg-red-500/10 text-red-400 text-xs font-semibold rounded-2xl border border-red-500/15 hover:bg-red-500/20 transition-all cursor-pointer" style={{ fontFamily: "Outfit" }}>+ Add</button>
              </div>
            </div>

            {/* Allergies */}
            <div className="glass-card p-7 space-y-5">
              <h3 className="text-base font-bold text-white/80 flex items-center gap-2.5" style={{ fontFamily: "Outfit" }}>
                <span className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-sm">⚠️</span>
                Allergies
              </h3>
              <div className="flex flex-wrap gap-2.5 min-h-[40px]">
                {profile.allergies.map((al, i) => (
                  <span key={i} className="flex items-center gap-2 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/15 px-4 py-2 rounded-full">
                    {al}
                    <button onClick={() => update("allergies", profile.allergies.filter((_, j) => j !== i))} className="text-amber-400/40 hover:text-amber-400 transition-colors cursor-pointer text-sm">×</button>
                  </span>
                ))}
                {profile.allergies.length === 0 && <span className="text-xs text-white/15 italic">No allergies added yet</span>}
              </div>
              <div className="flex gap-3">
                <input type="text" value={newAllergy} onChange={(e) => setNewAllergy(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addAllergy()}
                  className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-2xl px-4 py-3 text-xs text-white/90 placeholder-white/15 outline-none focus:border-amber-500/30 transition-colors"
                  placeholder="e.g. Penicillin, Peanuts..." />
                <button onClick={addAllergy} className="px-5 py-3 bg-amber-500/10 text-amber-400 text-xs font-semibold rounded-2xl border border-amber-500/15 hover:bg-amber-500/20 transition-all cursor-pointer" style={{ fontFamily: "Outfit" }}>+ Add</button>
              </div>
            </div>
          </div>
        )}

        {/* ─── EMERGENCY CONTACTS ─── */}
        {activeSection === "emergency" && (
          <div className="animate-fade-in-up space-y-6">
            <div className="glass-card p-7 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white/80 flex items-center gap-2.5" style={{ fontFamily: "Outfit" }}>
                  <span className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-sm">📱</span>
                  Emergency Contacts
                </h3>
                <button onClick={() => setAddingContact(!addingContact)}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer flex items-center gap-1.5 bg-blue-500/10 px-3.5 py-2 rounded-xl border border-blue-500/15" style={{ fontFamily: "Outfit" }}>
                  {addingContact ? "Cancel" : "+ Add"}
                </button>
              </div>

              <div className="space-y-3">
                {profile.emergencyContacts.map((ec, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.06] rounded-2xl px-5 py-4 group hover:bg-white/[0.04] transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center text-sm font-bold text-emerald-400" style={{ fontFamily: "Outfit" }}>
                        {ec.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white/80" style={{ fontFamily: "Outfit" }}>{ec.name}</p>
                        <p className="text-[11px] text-white/30 mt-0.5">{ec.relation} · {ec.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <a href={`tel:${ec.phone}`} className="text-[11px] text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full hover:bg-emerald-500/20 transition-colors border border-emerald-500/15">Call</a>
                      <button onClick={() => update("emergencyContacts", profile.emergencyContacts.filter((_, j) => j !== i))}
                        className="text-white/15 hover:text-red-400 transition-colors cursor-pointer opacity-0 group-hover:opacity-100">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
                {profile.emergencyContacts.length === 0 && !addingContact && (
                  <div className="text-center py-12 text-white/15">
                    <p className="text-3xl mb-3">📱</p>
                    <p className="text-xs">No emergency contacts yet</p>
                  </div>
                )}
              </div>

              {addingContact && (
                <div className="bg-blue-500/[0.04] border border-blue-500/15 rounded-2xl p-6 space-y-4 animate-fade-in">
                  <p className="text-xs font-semibold text-blue-400" style={{ fontFamily: "Outfit" }}>New Emergency Contact</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input type="text" value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                      className="bg-white/[0.03] border border-white/[0.08] rounded-2xl px-4 py-3 text-xs text-white/90 placeholder-white/15 outline-none focus:border-blue-500/30 transition-colors" placeholder="Name" />
                    <input type="tel" value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                      className="bg-white/[0.03] border border-white/[0.08] rounded-2xl px-4 py-3 text-xs text-white/90 placeholder-white/15 outline-none focus:border-blue-500/30 transition-colors" placeholder="Phone" />
                    <input type="text" value={newContact.relation} onChange={(e) => setNewContact({ ...newContact, relation: e.target.value })}
                      className="bg-white/[0.03] border border-white/[0.08] rounded-2xl px-4 py-3 text-xs text-white/90 placeholder-white/15 outline-none focus:border-blue-500/30 transition-colors" placeholder="Relation" />
                  </div>
                  <div className="pt-12 mt-12 border-t border-white/5">
                    <button onClick={addEmergencyContact} disabled={!newContact.name || !newContact.phone}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-600 text-white font-bold text-sm tracking-wide shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer" style={{ fontFamily: "Outfit" }}>
                      Add Contact
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Sticky save */}
      <div className="fixed bottom-0 left-0 right-0 z-20">
        <div className="max-w-xl mx-auto px-6 pb-8 pt-4 bg-gradient-to-t from-[#06060c] via-[#06060c]/95 to-transparent">
          <button onClick={handleSave}
            className={`w-full py-4 text-sm font-bold rounded-2xl shadow-2xl transition-all cursor-pointer active:scale-[0.98] ${
              saved ? "bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-600/20 text-white" : "bg-gradient-to-r from-blue-600 to-cyan-600 shadow-blue-600/20 text-white hover:opacity-90"
            }`} style={{ fontFamily: "Outfit" }}>
            {saved ? "✅ Profile Saved!" : "💾 Save Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
