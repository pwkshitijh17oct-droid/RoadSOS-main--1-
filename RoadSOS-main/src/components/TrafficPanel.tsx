"use client";

import { useState, useEffect, useCallback } from "react";

interface TrafficData {
  trafficConditions: {
    overall: "free" | "moderate" | "heavy" | "severe";
    factor: number;
    description: string;
  };
  routes: {
    serviceId: string;
    serviceName: string;
    serviceType: string;
    distance: number;
    duration: number;
    durationInTraffic: number;
    trafficLevel: string;
    geometry: string;
  }[];
}

interface ServiceForETA {
  _id: string;
  name: string;
  type: string;
  location: { coordinates: [number, number] };
}

interface TrafficPanelProps {
  userLat: number | null;
  userLng: number | null;
  services: ServiceForETA[];
  isVisible: boolean;
  onClose: () => void;
}

const levelConfig = {
  free: { color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30", icon: "🟢", barColor: "bg-emerald-500" },
  moderate: { color: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/30", icon: "🟡", barColor: "bg-amber-500" },
  heavy: { color: "text-orange-400", bg: "bg-orange-500/15", border: "border-orange-500/30", icon: "🟠", barColor: "bg-orange-500" },
  severe: { color: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/30", icon: "🔴", barColor: "bg-red-500" },
};

const typeIcons: Record<string, string> = {
  hospital: "🏥", police: "👮", ambulance: "🚑", towing: "🚗", repair: "🔧", showroom: "🏪",
};

export default function TrafficPanel({ userLat, userLng, services, isVisible, onClose }: TrafficPanelProps) {
  const [trafficData, setTrafficData] = useState<TrafficData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const fetchTraffic = useCallback(async () => {
    if (!userLat || !userLng || services.length === 0) return;

    setLoading(true);
    try {
      const top5 = services.slice(0, 5);
      const params = new URLSearchParams({
        lat: userLat.toString(),
        lng: userLng.toString(),
        serviceLats: top5.map((s) => s.location.coordinates[1]).join(","),
        serviceLngs: top5.map((s) => s.location.coordinates[0]).join(","),
        serviceNames: top5.map((s) => s.name).join(","),
        serviceTypes: top5.map((s) => s.type).join(","),
        serviceIds: top5.map((s) => s._id).join(","),
      });

      const res = await fetch(`/api/traffic/eta?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTrafficData(data);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error("Traffic fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [userLat, userLng, services]);

  // Fetch on mount and every 60s
  useEffect(() => {
    if (isVisible) {
      fetchTraffic();
      const interval = setInterval(fetchTraffic, 60000);
      return () => clearInterval(interval);
    }
  }, [isVisible, fetchTraffic]);

  if (!isVisible) return null;

  const traffic = trafficData?.trafficConditions;
  const config = traffic ? levelConfig[traffic.overall] : levelConfig.free;

  return (
    <div className="absolute bottom-24 left-4 z-[1000] w-80 max-h-[60vh] flex flex-col glass-card shadow-2xl shadow-black/40 overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-sm">🚦</div>
          <div>
            <h3 className="text-sm font-bold" style={{ fontFamily: "Outfit" }}>Live Traffic</h3>
            {lastUpdated && <p className="text-[10px] text-white/30">Updated {lastUpdated}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={fetchTraffic} disabled={loading} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer text-white/50 hover:text-white">
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6" /><path d="M23 20v-6h-6" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" /></svg>
          </button>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer text-white/50 hover:text-white">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Traffic Status */}
      {traffic && (
        <div className={`mx-3 mt-3 p-2.5 rounded-xl ${config.bg} border ${config.border}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{config.icon}</span>
            <span className={`text-sm font-bold ${config.color}`}>
              {traffic.overall.charAt(0).toUpperCase() + traffic.overall.slice(1)} Traffic
            </span>
            <span className="text-[10px] text-white/30 ml-auto">{traffic.factor}x</span>
          </div>
          <p className="text-[11px] text-white/50 leading-relaxed">{traffic.description}</p>
          {/* Traffic bar visualization */}
          <div className="flex gap-0.5 mt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= Math.ceil(traffic.factor * 2.5) ? config.barColor : "bg-white/10"} transition-all`} />
            ))}
          </div>
        </div>
      )}

      {/* Routes */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && !trafficData && (
          <div className="text-center py-8">
            <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs text-white/40">Calculating routes...</p>
          </div>
        )}

        {trafficData?.routes.map((route, i) => {
          const rl = levelConfig[route.trafficLevel as keyof typeof levelConfig] || levelConfig.free;
          const delay = route.durationInTraffic - route.duration;
          return (
            <div key={route.serviceId} className="glass-card p-2.5 hover:bg-white/[0.06] transition-colors">
              <div className="flex items-start gap-2 mb-1.5">
                <span className="text-lg shrink-0">{typeIcons[route.serviceType] || "📍"}</span>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold truncate">{route.serviceName}</h4>
                  <p className="text-[10px] text-white/40">{route.distance} km · {route.serviceType}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold" style={{ fontFamily: "Outfit" }}>
                    {Math.round(route.durationInTraffic)} <span className="text-[10px] font-normal text-white/40">min</span>
                  </div>
                  {delay > 1 && (
                    <div className="text-[10px] text-red-400">+{Math.round(delay)} min</div>
                  )}
                </div>
              </div>
              {/* Mini traffic bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full ${rl.barColor} rounded-full transition-all`} style={{ width: `${Math.min(100, (route.duration / route.durationInTraffic) * 100)}%` }} />
                </div>
                <span className="text-[10px]">{rl.icon}</span>
              </div>
            </div>
          );
        })}

        {trafficData && trafficData.routes.length === 0 && (
          <p className="text-center text-xs text-white/30 py-6">No routes available</p>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-white/10 text-center shrink-0">
        <p className="text-[9px] text-white/20">Routes via OSRM · Traffic estimates based on time patterns</p>
      </div>
    </div>
  );
}
