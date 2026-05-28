"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { ADMIN_PROFILE } from "@/lib/profiles";

interface SOSAlertData {
  _id: string;
  user: {
    name: string;
    phone: string;
    bloodGroup: string;
    emergencyContacts: { name: string; phone: string; relation: string }[];
    medicalConditions: string[];
    allergies: string[];
    vehicleNumber?: string;
    vehicleType?: string;
  };
  location: {
    type: string;
    coordinates: [number, number];
  };
  severity: string;
  status: "active" | "responding" | "resolved";
  description: string;
  canSelfReach?: boolean | null;
  escalatedToCritical?: boolean;
  nearestHospital?: {
    name: string;
    distance: number;
    eta: number;
    lat: number;
    lng: number;
  };
  survey?: {
    injuryLevel: string;
    bloodGroup: string;
    numberOfPatients: number;
    canDrive: boolean;
    needAmbulance: boolean;
    description: string;
  };
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  liveLocation?: {
    lat: number;
    lng: number;
    updatedAt: string;
    speed?: number;
    heading?: number;
  };
  locationHistory?: {
    lat: number;
    lng: number;
    timestamp: string;
  }[];
}

const statusConfig = {
  active: {
    color: "text-red-400",
    bg: "bg-red-500/15",
    border: "border-red-500/30",
    ring: "ring-red-500/20",
    label: "ACTIVE",
    dot: "bg-red-500",
    cardClass: "active",
    accent: "from-red-500 to-rose-500",
    muted: "text-red-400/60",
  },
  responding: {
    color: "text-amber-400",
    bg: "bg-amber-500/15",
    border: "border-amber-500/30",
    ring: "ring-amber-500/20",
    label: "RESPONDING",
    dot: "bg-amber-500",
    cardClass: "responding",
    accent: "from-amber-500 to-orange-500",
    muted: "text-amber-400/60",
  },
  resolved: {
    color: "text-emerald-400",
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/30",
    ring: "ring-emerald-500/20",
    label: "RESOLVED",
    dot: "bg-emerald-500",
    cardClass: "resolved",
    accent: "from-emerald-500 to-teal-500",
    muted: "text-emerald-400/60",
  },
};

function timeAgo(dateStr: string, now: number): string {
  if (!now) return "--";
  const seconds = Math.floor(
    (now - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AdminPage() {
  const [alerts, setAlerts] = useState<SOSAlertData[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [newAlertFlash, setNewAlertFlash] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const prevCountRef = useRef(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "sse" | "polling">("connecting");
  const [currentTime, setCurrentTime] = useState(0);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/sos/alerts");
      if (res.ok) {
        const data = await res.json();
        const newAlerts: SOSAlertData[] = data.alerts || [];

        if (
          prevCountRef.current > 0 &&
          newAlerts.length > prevCountRef.current
        ) {
          setNewAlertFlash(true);
          setTimeout(() => setNewAlertFlash(false), 3000);
        }
        prevCountRef.current = newAlerts.length;
        setAlerts(newAlerts);
      }
    } catch (err) {
      console.error("Failed to fetch alerts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // SSE real-time connection + fallback polling
  useEffect(() => {
    const initialFetch = setTimeout(fetchAlerts, 0);

    let eventSource: EventSource | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;

    try {
      eventSource = new EventSource("/api/sse/alerts");

      eventSource.onopen = () => {
        setConnectionStatus("sse");
        // With SSE active, use slow polling as backup (every 30s)
        fallbackInterval = setInterval(fetchAlerts, 30000);
      };

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.type === "connected" || payload.type === "heartbeat") return;

          // Any real event → re-fetch alerts immediately
          if (["new_alert", "alert_updated", "alert_escalated", "alert_resolved", "survey_submitted"].includes(payload.type)) {
            fetchAlerts();

            // Flash for new alerts and escalations
            if (payload.type === "new_alert" || payload.type === "alert_escalated") {
              setNewAlertFlash(true);
              setTimeout(() => setNewAlertFlash(false), 3000);
            }
          }
        } catch {
          // Ignore parse errors (heartbeat comments etc)
        }
      };

      eventSource.onerror = () => {
        setConnectionStatus("polling");
        eventSource?.close();
        // Fall back to fast polling
        if (fallbackInterval) clearInterval(fallbackInterval);
        fallbackInterval = setInterval(fetchAlerts, 5000);
      };
    } catch {
      // SSE not supported, use polling
      setTimeout(() => setConnectionStatus("polling"), 0);
      fallbackInterval = setInterval(fetchAlerts, 5000);
    }

    return () => {
      clearTimeout(initialFetch);
      eventSource?.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [fetchAlerts]);

  useEffect(() => {
    const updateClock = () => setCurrentTime(Date.now());
    const initialClock = setTimeout(updateClock, 0);
    const clockInterval = setInterval(updateClock, 30000);

    return () => {
      clearTimeout(initialClock);
      clearInterval(clockInterval);
    };
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/sos/alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) fetchAlerts();
    } catch (err) {
      console.error("Failed to update:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const activeCount = alerts.filter((a) => a.status === "active").length;
  const respondingCount = alerts.filter(
    (a) => a.status === "responding"
  ).length;
  const resolvedCount = alerts.filter((a) => a.status === "resolved").length;
  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const escalatedCount = alerts.filter((a) => a.escalatedToCritical).length;
  const gpsLiveCount = alerts.filter(
    (a) => a.liveLocation && a.status !== "resolved"
  ).length;
  const latestAlert = alerts[0];
  const query = searchQuery.trim().toLowerCase();
  const filteredAlerts = alerts.filter((alert) => {
    const matchesStatus =
      statusFilter === "all" || alert.status === statusFilter;
    if (!matchesStatus) return false;
    if (!query) return true;

    const searchable = [
      alert.user.name,
      alert.user.phone,
      alert.user.vehicleNumber,
      alert.user.vehicleType,
      alert.severity,
      alert.status,
      alert.nearestHospital?.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchable.includes(query);
  });

  const filterOptions = [
    { id: "all", label: "All", count: alerts.length, activeClass: "bg-white/10 text-white border-white/20 shadow-lg shadow-white/5" },
    { id: "active", label: "Active", count: activeCount, activeClass: "bg-red-500/15 text-red-400 border-red-500/25 shadow-lg shadow-red-500/10" },
    { id: "responding", label: "Responding", count: respondingCount, activeClass: "bg-amber-500/15 text-amber-400 border-amber-500/25 shadow-lg shadow-amber-500/10" },
    { id: "resolved", label: "Resolved", count: resolvedCount, activeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25 shadow-lg shadow-emerald-500/10" },
  ];

  const statCards = [
    { label: "Total", value: alerts.length, helper: "alerts logged", statColor: "rgba(255,255,255,0.26)", textClass: "bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent" },
    { label: "Active", value: activeCount, helper: "needs triage", statColor: "rgba(255,48,79,0.64)", textClass: "text-red-400", pulse: activeCount > 0 },
    { label: "Responding", value: respondingCount, helper: "teams moving", statColor: "rgba(245,158,11,0.64)", textClass: "text-amber-400" },
    { label: "Critical", value: criticalCount, helper: "highest risk", statColor: "rgba(244,63,94,0.64)", textClass: "text-rose-400", pulse: criticalCount > 0 },
    { label: "GPS Live", value: gpsLiveCount, helper: "tracking now", statColor: "rgba(34,197,94,0.64)", textClass: "text-emerald-400", pulse: gpsLiveCount > 0 },
  ];

  return (
    <div className="min-h-screen w-full overflow-auto">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-x-0 top-0 h-[420px] bg-[linear-gradient(180deg,rgba(168,85,247,0.12),rgba(34,211,238,0.045),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(34,211,238,0.04),transparent_34%,rgba(255,48,79,0.05)_74%,transparent)]" />
        {newAlertFlash && (
          <div className="absolute inset-0 bg-red-500/[0.06] animate-pulse" />
        )}
      </div>

      <div className="relative z-10 w-full flex justify-center">
      <div className="w-full max-w-6xl px-5 sm:px-6 pt-8 pb-20">
        {/* Header */}
        <div className="relative mb-8 overflow-hidden rounded-[28px] border border-white/12 bg-white/[0.055] px-5 py-5 shadow-2xl shadow-black/30 backdrop-blur-2xl animate-fade-in-up sm:px-6 sm:py-6">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
          <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-fuchsia-500/[0.08] to-transparent" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="glass-card w-10 h-10 flex items-center justify-center hover:bg-white/10 transition-all hover:border-white/20"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 via-purple-500 to-rose-500 flex items-center justify-center shadow-2xl shadow-purple-500/25 ring-1 ring-white/20">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300/70" style={{ fontFamily: "Outfit" }}>
                  Admin Command Center
                </p>
                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-cyan-100 to-fuchsia-200 bg-clip-text text-transparent" style={{ fontFamily: "Outfit" }}>
                  {ADMIN_PROFILE.name}
                </h1>
                <p className="text-xs text-white/40 mt-0.5">
                  {ADMIN_PROFILE.role} ·{" "}
                  {connectionStatus === "sse" ? (
                    <span className="text-emerald-400/70">● Real-time</span>
                  ) : connectionStatus === "polling" ? (
                    <span className="text-amber-400/70">● Polling</span>
                  ) : (
                    <span className="text-white/30">● Connecting...</span>
                  )}
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center sm:w-[270px]">
            <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.06] px-3 py-2">
              <p className="text-lg font-bold text-red-400" style={{ fontFamily: "Outfit" }}>{activeCount}</p>
              <p className="text-[9px] uppercase tracking-[0.16em] text-red-300/45">Active</p>
            </div>
            <div className="rounded-2xl border border-rose-500/15 bg-rose-500/[0.05] px-3 py-2">
              <p className="text-lg font-bold text-rose-400" style={{ fontFamily: "Outfit" }}>{escalatedCount}</p>
              <p className="text-[9px] uppercase tracking-[0.16em] text-rose-300/45">Escalated</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.05] px-3 py-2">
              <p className="text-lg font-bold text-emerald-400" style={{ fontFamily: "Outfit" }}>{resolvedCount}</p>
              <p className="text-[9px] uppercase tracking-[0.16em] text-emerald-300/45">Resolved</p>
            </div>
          </div>
          <button
            onClick={fetchAlerts}
            className="glass-card px-3.5 py-2 text-xs text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer flex items-center gap-2 hover:border-white/20"
          >
            <svg
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M1 4v6h6" />
              <path d="M23 20v-6h-6" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
            </svg>
            Refresh
          </button>
          <Link
            href="/admin/heatmap"
            className="glass-card px-3.5 py-2 text-xs text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2 hover:border-white/20"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-400/70">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
            Heatmap
          </Link>
          </div>
        </div>

        {/* New alert notification */}
        {newAlertFlash && (
          <div className="mb-4 glass-card p-3.5 border-red-500/30 bg-red-500/10 flex items-center gap-2.5 animate-scale-in">
            <span className="text-lg animate-pulse">🚨</span>
            <span className="text-sm font-semibold text-red-400">
              New SOS Alert Received!
            </span>
            <span className="text-xs text-red-400/50 ml-auto">Just now</span>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6 animate-fade-in-up delay-100 sm:grid-cols-3 lg:grid-cols-5" style={{ animationFillMode: "both" }}>
          {statCards.map((s) => (
            <div key={s.label} className="stat-card min-h-[116px] px-5 py-6" style={{ "--stat-color": s.statColor } as React.CSSProperties}>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45" style={{ fontFamily: "Outfit" }}>{s.label}</p>
              <div className="flex items-baseline gap-2">
                <p className={`text-3xl font-bold ${s.textClass}`} style={{ fontFamily: "Outfit" }}>{s.value}</p>
                {s.pulse && <span className="w-2 h-2 rounded-full bg-red-500 animate-dot-pulse" />}
              </div>
              <p className="mt-2.5 text-[10px] text-white/35">{s.helper}</p>
            </div>
          ))}
        </div>

        {/* Search + Filter */}
        <div className="mb-8 flex flex-col gap-4 animate-fade-in-up delay-200 lg:flex-row lg:items-center" style={{ animationFillMode: "both" }}>
          <div className="glass-card flex min-h-12 flex-1 items-center gap-5 px-6 py-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-cyan-300/60">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone, vehicle, severity..."
              className="min-w-0 flex-1 bg-transparent text-sm text-white/80 placeholder-white/20 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="rounded-lg px-2 py-1 text-xs text-white/35 transition-colors hover:bg-white/10 hover:text-white/70 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {filterOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setStatusFilter(option.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-2xl border px-4 py-3 text-xs font-semibold transition-all duration-300 cursor-pointer ${
                  statusFilter === option.id
                    ? option.activeClass
                    : "bg-white/[0.025] border-white/[0.08] text-white/35 hover:text-white/70 hover:bg-white/[0.055]"
                }`}
                style={{ fontFamily: "Outfit" }}
              >
                {option.label}
                <span className="rounded-lg bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-white/55">
                  {option.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {latestAlert && (
          <div className="mb-5 flex flex-wrap items-center gap-2 text-[11px] text-white/35">
            <span className="rounded-full border border-cyan-400/15 bg-cyan-400/[0.055] px-3 py-1 text-cyan-300/70">
              Latest: {latestAlert.user.name} | {timeAgo(latestAlert.createdAt, currentTime)}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1">
              Showing {filteredAlerts.length} of {alerts.length}
            </span>
          </div>
        )}

        <div className="mb-5 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Alerts List */}
        <div className="space-y-4">
          {loading && alerts.length === 0 && (
            <div className="text-center py-20 animate-fade-in">
              <div className="inline-block w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm text-white/40">Connecting to database...</p>
            </div>
          )}

          {!loading && alerts.length === 0 && (
            <div className="text-center py-20 animate-fade-in-up">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🛡️</span>
              </div>
              <p className="text-white/50 text-sm mb-1 font-medium">No SOS alerts</p>
              <p className="text-white/20 text-xs max-w-xs mx-auto">
                Alerts will appear here in real-time when a user triggers SOS
              </p>
            </div>
          )}

          {!loading && alerts.length > 0 && filteredAlerts.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] px-6 py-14 text-center animate-fade-in-up">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.07]">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-300/70">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-white/60">No matching alerts</p>
              <p className="mt-1 text-xs text-white/25">Try a different search or status filter</p>
            </div>
          )}

          {filteredAlerts.map((alert, index) => {
            const cfg = statusConfig[alert.status];
            const isExpanded = expandedId === alert._id;
            const lat = alert.location.coordinates[1];
            const lng = alert.location.coordinates[0];
            const responseAge = timeAgo(alert.createdAt, currentTime);

            return (
              <div
                key={alert._id}
                className={`alert-card ${cfg.cardClass} animate-fade-in-up relative`}
                style={{ animationDelay: `${index * 60}ms`, animationFillMode: "both" }}
              >
                <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${cfg.accent}`} />
                {/* Alert header */}
                <div
                  className="px-5 py-5 sm:px-6 cursor-pointer hover:bg-white/[0.035] transition-colors"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : alert._id)
                  }
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-4">
                    <div className="flex min-w-0 items-center gap-4">
                      <div
                        className={`w-13 h-13 shrink-0 rounded-2xl ${cfg.bg} border ${cfg.border} ${cfg.ring} ring-4 flex items-center justify-center text-xl transition-all`}
                      >
                        {alert.status === "active"
                          ? "🚨"
                          : alert.status === "responding"
                            ? "📡"
                            : "✅"}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold leading-tight" style={{ fontFamily: "Outfit" }}>
                          {alert.user.name}
                        </h3>
                        <p className="text-xs text-white/40 flex flex-wrap items-center gap-2 mt-1.5">
                          <span>{alert.user.phone}</span>
                          <span className="text-white/15">·</span>
                          <span>{responseAge}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 self-start">
                      <span
                        className={`text-[11px] px-3 py-1.5 rounded-full font-bold ${cfg.bg} ${cfg.color} ${cfg.border} border flex items-center gap-1.5`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${alert.status === "active" ? "animate-dot-pulse" : ""}`}
                        />
                        {cfg.label}
                      </span>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={`text-white/20 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </div>
                  </div>

                  {/* Quick info row */}
                  <div className="mt-5 grid gap-2 text-xs text-white/42 sm:ml-[4.25rem] sm:grid-cols-2 lg:grid-cols-4">
                    <span className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2">
                      <span className="text-red-400/60">🩸</span>{" "}
                      {alert.survey?.bloodGroup || alert.user.bloodGroup || "N/A"}
                    </span>
                    <span className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2">
                      <span className="text-amber-400/60">🚗</span>{" "}
                      {alert.user.vehicleNumber || "N/A"}
                    </span>
                    <span className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2 font-mono text-[11px]">
                      <span className="text-blue-400/60">📍</span>{" "}
                      {lat.toFixed(4)}, {lng.toFixed(4)}
                    </span>
                    <span className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2">
                      <span className="text-red-400/60">⚠️</span>{" "}
                      {alert.severity}
                    </span>
                    {alert.escalatedToCritical && (
                      <span className="flex items-center gap-1 text-red-400 font-bold animate-pulse">
                        🚨 ESCALATED
                      </span>
                    )}
                    {alert.canSelfReach === true && (
                      <span className="flex items-center gap-1 text-emerald-400">
                        ✅ Can self-reach
                      </span>
                    )}
                    {alert.survey && (
                      <span className="flex items-center gap-1 text-cyan-400">
                        📋 Survey filled
                      </span>
                    )}
                    {alert.liveLocation && alert.status !== "resolved" && (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-dot-pulse" />
                        GPS Live
                      </span>
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-white/[0.06] p-6 space-y-6 bg-white/[0.015] animate-fade-in">
                    {/* Location */}
                    <div>
                      <h4 className="text-[10px] text-blue-400/60 uppercase tracking-wider mb-2 font-semibold">
                        📍 Location
                      </h4>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-white/60 font-mono bg-white/[0.04] px-2 py-1 rounded">
                          {lat.toFixed(6)}, {lng.toFixed(6)}
                        </span>
                        <a
                          href={`https://www.google.com/maps?q=${lat},${lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                        >
                          Open in Google Maps
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <path d="M7 17L17 7M7 7h10v10" />
                          </svg>
                        </a>
                      </div>
                    </div>

                    {/* Live GPS Tracking */}
                    {alert.liveLocation && alert.status !== "resolved" && (
                      <div className="glass-card p-5 border-emerald-500/20 bg-emerald-500/[0.04]">
                        <div className="flex items-center justify-between mb-3.5">
                          <h4 className="text-[11px] text-emerald-400/80 uppercase tracking-[0.15em] font-semibold flex items-center gap-2" style={{ fontFamily: "Outfit" }}>
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-dot-pulse" />
                            📡 Live GPS Tracking
                          </h4>
                          <span className="text-[10px] text-emerald-400/50">
                            {(() => {
                              const secs = Math.floor(((currentTime || new Date(alert.liveLocation.updatedAt).getTime()) - new Date(alert.liveLocation.updatedAt).getTime()) / 1000);
                              return secs < 10 ? "Just now" : secs < 60 ? `${secs}s ago` : `${Math.floor(secs / 60)}m ago`;
                            })()}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-xs text-white/60">
                          <p className="flex items-center gap-2">
                            <span className="text-white/30 w-16 shrink-0">Position</span>
                            <span className="text-emerald-400 font-mono text-[11px]">
                              {alert.liveLocation.lat.toFixed(6)}, {alert.liveLocation.lng.toFixed(6)}
                            </span>
                          </p>
                          <p className="flex items-center gap-2">
                            <span className="text-white/30 w-16 shrink-0">Speed</span>
                            <span className="text-white/80">
                              {alert.liveLocation.speed != null ? `${(alert.liveLocation.speed * 3.6).toFixed(1)} km/h` : "—"}
                            </span>
                          </p>
                          <p className="flex items-center gap-2">
                            <span className="text-white/30 w-16 shrink-0">Heading</span>
                            <span className="text-white/80">
                              {alert.liveLocation.heading != null ? `${alert.liveLocation.heading.toFixed(0)}°` : "—"}
                            </span>
                          </p>
                          <p className="flex items-center gap-2">
                            <span className="text-white/30 w-16 shrink-0">Trail</span>
                            <span className="text-white/80">
                              {alert.locationHistory?.length || 0} points
                            </span>
                          </p>
                        </div>
                        <div className="mt-3.5 flex gap-2">
                          <a
                            href={`https://www.google.com/maps?q=${alert.liveLocation.lat},${alert.liveLocation.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-emerald-400 bg-emerald-500/10 px-3.5 py-1.5 rounded-xl border border-emerald-500/15 hover:bg-emerald-500/20 transition-colors"
                          >
                            📍 Track Live ↗
                          </a>
                        </div>
                      </div>
                    )}
                    {alert.liveLocation && alert.status === "resolved" && (
                      <div className="glass-card p-5">
                        <h4 className="text-[11px] text-white/40 uppercase tracking-[0.15em] mb-3 font-semibold" style={{ fontFamily: "Outfit" }}>
                          📡 GPS Tracking (Ended)
                        </h4>
                        <p className="text-xs text-white/40">
                          Last known: {alert.liveLocation.lat.toFixed(6)}, {alert.liveLocation.lng.toFixed(6)} · {alert.locationHistory?.length || 0} trail points recorded
                        </p>
                      </div>
                    )}
                    {/* User + Emergency contacts */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="glass-card p-5">
                        <h4 className="text-[11px] text-cyan-400/60 uppercase tracking-[0.15em] mb-3.5 font-semibold" style={{ fontFamily: "Outfit" }}>
                          👤 User Details
                        </h4>
                        <div className="space-y-2.5 text-xs text-white/60">
                          <p className="flex items-center gap-2">
                            <span className="text-white/30 w-16 shrink-0">Name</span>
                            <span className="text-white/80 font-medium">{alert.user.name}</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <span className="text-white/30 w-16 shrink-0">Phone</span>
                            <span className="text-white/80">{alert.user.phone}</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <span className="text-white/30 w-16 shrink-0">Blood</span>
                            <span className="text-red-400 font-bold">{alert.user.bloodGroup || "N/A"}</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <span className="text-white/30 w-16 shrink-0">Vehicle</span>
                            <span className="text-white/80">
                              {alert.user.vehicleType || "N/A"} · {alert.user.vehicleNumber || "N/A"}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="glass-card p-5">
                        <h4 className="text-[11px] text-amber-400/60 uppercase tracking-[0.15em] mb-3.5 font-semibold" style={{ fontFamily: "Outfit" }}>
                          📱 Emergency Contacts
                        </h4>
                        <div className="space-y-3 text-xs text-white/60">
                          {alert.user.emergencyContacts.length > 0 ? (
                            alert.user.emergencyContacts.map((ec, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between"
                              >
                                <div>
                                  <p className="font-medium text-white/70">
                                    {ec.name}
                                  </p>
                                  <p className="text-[10px] text-white/30">
                                    {ec.relation}
                                  </p>
                                </div>
                                <a
                                  href={`tel:${ec.phone}`}
                                  className="text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-500/10 px-2 py-0.5 rounded-full"
                                >
                                  {ec.phone}
                                </a>
                              </div>
                            ))
                          ) : (
                            <p className="text-white/30 italic">
                              No contacts listed
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Escalation banner */}
                    {alert.escalatedToCritical && (
                      <div className="glass-card p-5 border-red-500/30 bg-red-500/[0.06] animate-border-glow">
                        <div className="flex items-center gap-2.5 mb-2">
                          <span className="text-xl animate-pulse">🚨</span>
                          <h4 className="text-sm text-red-400 font-bold uppercase" style={{ fontFamily: "Outfit" }}>Critical Escalation</h4>
                        </div>
                        <p className="text-xs text-white/50 leading-relaxed ml-8">User did not confirm they could reach hospital within 10 seconds. Situation auto-escalated to CRITICAL.</p>
                      </div>
                    )}

                    {/* Nearest Hospital */}
                    {alert.nearestHospital && (
                      <div className="glass-card p-5">
                        <h4 className="text-[11px] text-red-400/60 uppercase tracking-[0.15em] mb-3 font-semibold" style={{ fontFamily: "Outfit" }}>🏥 Nearest Hospital</h4>
                        <div className="flex items-center justify-between">
                          <div className="space-y-1.5 text-xs text-white/60">
                            <p className="font-semibold text-white/80 text-sm" style={{ fontFamily: "Outfit" }}>{alert.nearestHospital.name}</p>
                            <p>{alert.nearestHospital.distance} km away · ~{alert.nearestHospital.eta} min ETA</p>
                          </div>
                          <a href={`https://www.google.com/maps?q=${alert.nearestHospital.lat},${alert.nearestHospital.lng}`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-400 bg-blue-500/10 px-3.5 py-1.5 rounded-xl border border-blue-500/15 hover:bg-blue-500/20 transition-colors">View ↗</a>
                        </div>
                      </div>
                    )}

                    {/* Survey Data */}
                    {alert.survey && (
                      <div className="glass-card p-5">
                        <h4 className="text-[11px] text-cyan-400/60 uppercase tracking-[0.15em] mb-3.5 font-semibold" style={{ fontFamily: "Outfit" }}>📋 Injury Assessment</h4>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs text-white/60">
                          <p className="flex items-center gap-2">
                            <span className="text-white/30 w-20 shrink-0">Injury</span>
                            <span className={`font-bold ${alert.survey.injuryLevel === 'severe' ? 'text-red-400' : alert.survey.injuryLevel === 'moderate' ? 'text-amber-400' : alert.survey.injuryLevel === 'minor' ? 'text-blue-400' : 'text-emerald-400'}`}>{alert.survey.injuryLevel}</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <span className="text-white/30 w-20 shrink-0">Blood</span>
                            <span className="text-red-400 font-bold">{alert.survey.bloodGroup}</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <span className="text-white/30 w-20 shrink-0">Patients</span>
                            <span className="text-white/80 font-bold">{alert.survey.numberOfPatients}</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <span className="text-white/30 w-20 shrink-0">Can Drive</span>
                            <span className={alert.survey.canDrive ? 'text-emerald-400' : 'text-red-400'}>{alert.survey.canDrive ? 'Yes' : 'No'}</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <span className="text-white/30 w-20 shrink-0">Ambulance</span>
                            <span className={alert.survey.needAmbulance ? 'text-red-400 font-bold' : 'text-emerald-400'}>{alert.survey.needAmbulance ? 'YES NEEDED' : 'No'}</span>
                          </p>
                          {alert.survey.description && (
                            <p className="col-span-2 flex items-start gap-2 mt-1">
                              <span className="text-white/30 w-20 shrink-0">Notes</span>
                              <span className="text-white/60 italic">{alert.survey.description}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Timeline */}
                    <div className="glass-card p-5">
                      <h4 className="text-[11px] text-purple-400/60 uppercase tracking-[0.15em] mb-3 font-semibold" style={{ fontFamily: "Outfit" }}>
                        🕐 Timeline
                      </h4>
                      <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs text-white/50">
                        <p>
                          <span className="text-white/30">Created:</span>{" "}
                          {new Date(alert.createdAt).toLocaleString()}
                        </p>
                        {alert.resolvedAt && (
                          <p>
                            <span className="text-emerald-400/50">Resolved:</span>{" "}
                            <span className="text-emerald-400/70">
                              {new Date(alert.resolvedAt).toLocaleString()}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-3 pt-2">
                      {alert.status === "active" && (
                        <button
                          onClick={() =>
                            updateStatus(alert._id, "responding")
                          }
                          disabled={updatingId === alert._id}
                          className="flex-1 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white text-xs font-bold rounded-xl hover:opacity-90 transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-amber-600/20"
                        >
                          {updatingId === alert._id
                            ? "Updating..."
                            : "📡 Mark Responding"}
                        </button>
                      )}
                      {(alert.status === "active" ||
                        alert.status === "responding") && (
                        <button
                          onClick={() =>
                            updateStatus(alert._id, "resolved")
                          }
                          disabled={updatingId === alert._id}
                          className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold rounded-xl hover:opacity-90 transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-emerald-600/20"
                        >
                          {updatingId === alert._id
                            ? "Updating..."
                            : "✅ Mark Resolved"}
                        </button>
                      )}
                      <a
                        href={`tel:${alert.user.phone}`}
                        className="px-5 py-2.5 bg-white/[0.04] text-white/70 text-xs font-bold rounded-xl hover:bg-white/[0.08] transition-all border border-white/[0.08] text-center hover:border-white/15"
                      >
                        📞 Call
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  );
}
