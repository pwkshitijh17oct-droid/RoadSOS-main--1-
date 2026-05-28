"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

interface HeatmapPoint {
  lat: number;
  lng: number;
  weight: number;
  severity: string;
  status: string;
  escalated: boolean;
  hospital: string | null;
  userName: string;
  createdAt: string;
}

interface HeatmapStats {
  total: number;
  critical: number;
  escalated: number;
  resolved: number;
  active: number;
}

export default function HeatmapPage() {
  const [points, setPoints] = useState<HeatmapPoint[]>([]);
  const [stats, setStats] = useState<HeatmapStats>({ total: 0, critical: 0, escalated: 0, resolved: 0, active: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const heatLayerRef = useRef<L.Layer | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/sos/alerts/heatmap");
      if (res.ok) {
        const data = await res.json();
        setPoints(data.points || []);
        setStats(data.stats || { total: 0, critical: 0, escalated: 0, resolved: 0, active: 0 });
      }
    } catch (err) {
      console.error("Failed to fetch heatmap data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initMap = async () => {
      // Double-check ref inside async to prevent React strict mode double-init
      if (mapRef.current) return;

      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");

      // Check again after await
      if (mapRef.current || !mapContainerRef.current) return;

      leafletRef.current = L;

      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        center: [22.5, 78.9],
        zoom: 5,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      mapRef.current = map;
      markersRef.current = L.layerGroup().addTo(map);
      setMapReady(true);
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update heatmap when points or filter changes
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !mapReady || points.length === 0) return;

    // Filter points
    const filtered = filter === "all"
      ? points
      : filter === "critical"
        ? points.filter((p) => p.severity === "critical")
        : filter === "escalated"
          ? points.filter((p) => p.escalated)
          : filter === "active"
            ? points.filter((p) => p.status === "active")
            : points;

    // Remove old heat layer
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
    }

    // Add heatmap using circle markers (no external dependency needed)
    if (markersRef.current) {
      markersRef.current.clearLayers();
    }

    // Create heat-like circles
    filtered.forEach((point) => {
      const severityColors: Record<string, string> = {
        critical: "#ef4444",
        high: "#f97316",
        medium: "#eab308",
        low: "#22c55e",
      };
      const color = severityColors[point.severity] || "#eab308";
      const radius = point.weight * 30 + 10;

      // Glow circle (larger, transparent)
      L.circleMarker([point.lat, point.lng], {
        radius: radius + 15,
        fillColor: color,
        fillOpacity: 0.12,
        stroke: false,
      }).addTo(markersRef.current!);

      // Mid circle
      L.circleMarker([point.lat, point.lng], {
        radius: radius,
        fillColor: color,
        fillOpacity: 0.25,
        stroke: false,
      }).addTo(markersRef.current!);

      // Core circle
      const marker = L.circleMarker([point.lat, point.lng], {
        radius: 6,
        fillColor: color,
        fillOpacity: 0.9,
        weight: 2,
        color: "rgba(255,255,255,0.3)",
      }).addTo(markersRef.current!);

      // Popup
      const time = new Date(point.createdAt).toLocaleString();
      marker.bindPopup(
        `<div style="font-family:Inter,sans-serif;font-size:12px;color:#e5e5e5;min-width:180px;">
          <div style="font-weight:700;font-size:14px;margin-bottom:6px;font-family:Outfit,sans-serif;">${point.userName}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
            <span style="background:${color}22;color:${color};padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;text-transform:uppercase;">${point.severity}</span>
            ${point.escalated ? '<span style="background:#ef444422;color:#ef4444;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;">ESCALATED</span>' : ""}
            <span style="background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.6);padding:2px 8px;border-radius:20px;font-size:10px;">${point.status}</span>
          </div>
          ${point.hospital ? `<div style="color:rgba(255,255,255,0.5);font-size:11px;">🏥 ${point.hospital}</div>` : ""}
          <div style="color:rgba(255,255,255,0.35);font-size:10px;margin-top:4px;">${time}</div>
        </div>`,
        {
          className: "dark-popup",
        }
      );
    });

    // Fit bounds if we have points
    if (filtered.length > 0) {
      const bounds = L.latLngBounds(filtered.map((p) => [p.lat, p.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    }
  }, [points, filter, mapReady]);

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 1) return `${Math.floor(diff / 60000)}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="h-screen w-full flex flex-col bg-[#06060c] overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 pt-5 pb-4 border-b border-white/[0.06] z-20 relative">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="glass-card w-10 h-10 flex items-center justify-center hover:bg-white/10 transition-all hover:border-white/20"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/60">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 via-red-500 to-rose-600 flex items-center justify-center shadow-2xl shadow-red-500/25">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-orange-400 to-rose-400 bg-clip-text text-transparent" style={{ fontFamily: "Outfit" }}>
                  Incident Heatmap
                </h1>
                <p className="text-[11px] text-white/40 mt-0.5">
                  Accident hotspot analysis · {stats.total} incidents
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="glass-card px-3.5 py-2 text-xs text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer flex items-center gap-2 hover:border-white/20"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="shrink-0 px-6 py-3 border-b border-white/[0.04] z-10 relative">
        <div className="max-w-7xl mx-auto flex items-center gap-3 overflow-x-auto no-scrollbar">
          {[
            { label: "All Incidents", value: stats.total, key: "all", color: "white", active: "bg-white/10 text-white border-white/20" },
            { label: "Critical", value: stats.critical, key: "critical", color: "red", active: "bg-red-500/15 text-red-400 border-red-500/25" },
            { label: "Escalated", value: stats.escalated, key: "escalated", color: "orange", active: "bg-orange-500/15 text-orange-400 border-orange-500/25" },
            { label: "Active Now", value: stats.active, key: "active", color: "amber", active: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setFilter(s.key)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all duration-300 cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                filter === s.key
                  ? s.active + " shadow-lg"
                  : "bg-white/[0.02] border-white/[0.06] text-white/30 hover:text-white/60 hover:bg-white/[0.04]"
              }`}
              style={{ fontFamily: "Outfit" }}
            >
              {s.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${filter === s.key ? "bg-white/10" : "bg-white/[0.04]"}`}>
                {s.value}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {loading && points.length === 0 && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#06060c]">
            <div className="text-center">
              <div className="inline-block w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-white/40 text-sm">Loading incident data...</p>
            </div>
          </div>
        )}
        <div ref={mapContainerRef} className="absolute inset-0 z-0" />

        {/* Legend */}
        <div className="absolute bottom-6 left-6 z-20 glass-card px-4 py-3">
          <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2 font-semibold" style={{ fontFamily: "Outfit" }}>Severity</p>
          <div className="space-y-1.5">
            {[
              { label: "Critical", color: "#ef4444" },
              { label: "High", color: "#f97316" },
              { label: "Medium", color: "#eab308" },
              { label: "Low", color: "#22c55e" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2 text-[11px] text-white/50">
                <span className="w-3 h-3 rounded-full" style={{ background: s.color, boxShadow: `0 0 8px ${s.color}40` }} />
                {s.label}
              </div>
            ))}
          </div>
        </div>

        {/* Recent incidents sidebar */}
        {points.length > 0 && (
          <div className="absolute top-4 right-4 z-20 w-72 max-h-[calc(100%-2rem)] overflow-auto no-scrollbar">
            <div className="glass-card p-4">
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-3 font-semibold" style={{ fontFamily: "Outfit" }}>
                Recent Incidents
              </p>
              <div className="space-y-2.5">
                {(filter === "all" ? points : points.filter((p) =>
                  filter === "critical" ? p.severity === "critical" :
                  filter === "escalated" ? p.escalated :
                  filter === "active" ? p.status === "active" : true
                )).slice(0, 8).map((point, i) => {
                  const severityColors: Record<string, string> = {
                    critical: "text-red-400 bg-red-500/10",
                    high: "text-orange-400 bg-orange-500/10",
                    medium: "text-amber-400 bg-amber-500/10",
                    low: "text-emerald-400 bg-emerald-500/10",
                  };
                  const cls = severityColors[point.severity] || "text-white/40 bg-white/5";
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.03] transition-colors cursor-pointer"
                      onClick={() => {
                        mapRef.current?.flyTo([point.lat, point.lng], 15, { duration: 1.5 });
                      }}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${cls}`}>
                        {point.severity.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-white/80 font-medium truncate">{point.userName}</p>
                        <p className="text-[10px] text-white/30 flex items-center gap-1.5">
                          <span>{timeAgo(point.createdAt)}</span>
                          {point.escalated && <span className="text-red-400">⚡</span>}
                          <span className={`${point.status === "active" ? "text-red-400" : point.status === "responding" ? "text-amber-400" : "text-emerald-400"}`}>
                            {point.status}
                          </span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
