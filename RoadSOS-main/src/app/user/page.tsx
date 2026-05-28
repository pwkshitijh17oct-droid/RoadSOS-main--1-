"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import SOSButton from "@/components/SOSButton";
import TrafficPanel from "@/components/TrafficPanel";
import { getUserProfile, type UserProfile } from "@/lib/profiles";
import { prefetchEmergencyRoute, isCacheFresh, hasUserMoved } from "@/lib/offlineCache";
import type { ServiceType, ServiceData, RouteData } from "@/components/Map";
import { Motion } from "@capacitor/motion";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, byte;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

const categories: {
  id: ServiceType | "all";
  label: string;
  icon: string;
  color: string;
}[] = [
  { id: "all", label: "All", icon: "🗺️", color: "from-slate-500 to-slate-700" },
  { id: "hospital", label: "Hospitals", icon: "🏥", color: "from-red-500 to-red-700" },
  { id: "police", label: "Police", icon: "👮", color: "from-blue-500 to-blue-700" },
  { id: "ambulance", label: "Ambulance", icon: "🚑", color: "from-emerald-500 to-emerald-700" },
  { id: "towing", label: "Towing", icon: "🚗", color: "from-amber-500 to-amber-700" },
  { id: "repair", label: "Repair", icon: "🔧", color: "from-violet-500 to-violet-700" },
];

const typeColors: Record<string, string> = {
  hospital: "bg-red-500/20 text-red-400 border-red-500/30",
  police: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  ambulance: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  towing: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  repair: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  showroom: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

export default function UserPage() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeFilter, setActiveFilter] = useState<ServiceType | "all">("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [trafficOpen, setTrafficOpen] = useState(false);
  const [services, setServices] = useState<ServiceData[]>([]);
  const [dbNotice, setDbNotice] = useState<string | null>(null);
  const [offlineCached, setOfflineCached] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Route state
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [routeLoading, setRouteLoading] = useState<string | null>(null);
  const [acceleration, setAcceleration] = useState(0);
  const [crashDetected, setCrashDetected] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [lastCrashTime, setLastCrashTime] = useState(0);
  const [sosTriggered, setSosTriggered] = useState(false);

  useEffect(() => {
    setUserProfile(getUserProfile());
  }, []);

  useEffect(() => {

    const watchId = navigator.geolocation.watchPosition(

      (pos) => {

        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        setUserLocation({ lat, lng });

        const speedKmph = (pos.coords.speed || 0) * 3.6;

        setCurrentSpeed(speedKmph);

        console.log("[GPS] Speed:", speedKmph);

      },

      (err) => {
        console.error("[GPS] Error:", err);
      },

      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000,
      }

    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };

  }, []);

  useEffect(() => {

    let accelListener: any;

    const startMotionDetection = async () => {

      accelListener = await Motion.addListener("accel", (event) => {

        const x = event.acceleration.x || 0;
        const y = event.acceleration.y || 0;
        const z = event.acceleration.z || 0;

        const totalAcceleration = Math.sqrt(
          x * x + y * y + z * z
        );

        setAcceleration(totalAcceleration);

        console.log(
          "[Motion]",
          "Acceleration:",
          totalAcceleration.toFixed(2),
          "Speed:",
          currentSpeed.toFixed(2)
        );

        // Crash threshold
        const now = Date.now();

        if (
          totalAcceleration > 15 &&
          currentSpeed > 20 &&
          !sosTriggered &&
          !crashDetected &&
          now - lastCrashTime > 30000
        ) {
          setLastCrashTime(now);

          console.log(
            "[Crash Detection] Possible high-speed collision detected"
          );

          setCrashDetected(true);

          setCountdown(10);
        }
      });
    };

    startMotionDetection();

    return () => {
      accelListener?.remove();
    };

  }, [currentSpeed, sosTriggered, lastCrashTime, crashDetected]);

  useEffect(() => {

    if (countdown === null) return;

    if (countdown <= 0) {

      setSosTriggered(true);

      setCrashDetected(false);

      setCountdown(null);

      console.log("🚨 SOS TRIGGERED");

      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);

  }, [countdown]); 

  // Background pre-fetch emergency route for offline use
  useEffect(() => {
    if (!userLocation) return;

    // Check if we already have a fresh cache for this location
    if (isCacheFresh() && !hasUserMoved(userLocation.lat, userLocation.lng)) {
      setOfflineCached(true);
      return;
    }

    // Pre-fetch in background (delay 3s to not block initial load)
    const timer = setTimeout(async () => {
      const result = await prefetchEmergencyRoute(userLocation.lat, userLocation.lng);
      if (result) setOfflineCached(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [userLocation]);

  const filtered =
    activeFilter === "all"
      ? services
      : services.filter((s) => s.type === activeFilter);

  // Fetch route from OSRM
  const fetchRoute = useCallback(async (service: ServiceData) => {
    if (!userLocation) return;
    setRouteLoading(service._id);

    const [destLng, destLat] = service.location.coordinates;

    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${userLocation.lng},${userLocation.lat};${destLng},${destLat}?overview=full&geometries=polyline&steps=true`
      );

      if (res.ok) {
        const data = await res.json();
        if (data.code === "Ok" && data.routes?.length) {
          const route = data.routes[0];
          const points = decodePolyline(route.geometry);

          setRouteData({
            points,
            distance: route.distance,
            duration: route.duration,
            destination: {
              name: service.name,
              lat: destLat,
              lng: destLng,
              type: service.type,
            },
          });
          setSidebarOpen(false);
        }
      }
    } catch (err) {
      console.error("Failed to fetch route:", err);
    } finally {
      setRouteLoading(null);
    }
  }, [userLocation]);

  const clearRoute = () => setRouteData(null);
  const cancelEmergency = () => {

    setCrashDetected(false);

    setCountdown(null);

    setSosTriggered(false);

    console.log("Emergency cancelled");
  };

  return (
    <div className="relative h-full w-full">
      <Map
        activeFilter={activeFilter}
        routeData={routeData}
        onServicesLoaded={(s) => setServices(s)}
        onLocationReady={(lat, lng) => setUserLocation({ lat, lng })}
        onError={(msg) => setDbNotice(msg)}
      />

      {/* Crash Detection Overlay */}
      <div className="absolute top-24 left-4 z-[9999] flex flex-col gap-3">

        <div className="bg-black/70 border border-white/10 rounded-xl px-4 py-2 text-white text-sm backdrop-blur">
          📈 Acceleration: {acceleration.toFixed(2)}
          <br />
          Speed: {currentSpeed.toFixed(1)} km/h
        </div>

        {crashDetected && (
          <div className="bg-red-600 text-white px-5 py-4 rounded-2xl shadow-2xl border border-red-300 flex flex-col gap-3 min-w-[260px]">

            <div className="text-lg font-bold animate-pulse">
              🚨 Possible Crash Detected!
            </div>

            <div className="text-sm text-red-100">
              Sending SOS in {countdown} seconds...
            </div>

            <button
              onClick={cancelEmergency}
              className="bg-white text-red-600 font-bold px-4 py-2 rounded-xl hover:bg-red-100 transition-all"
            >
              Cancel Emergency
            </button>

          </div>
        )}

        {sosTriggered && (
          <div className="bg-green-600 text-white px-5 py-4 rounded-2xl shadow-2xl border border-green-300">
            ✅ Emergency SOS Triggered
          </div>
        )}

      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-[1000] pointer-events-none">
        <div className="flex items-center justify-between px-4 pt-4">
          <div className="pointer-events-auto flex items-center gap-2">
            <Link
              href="/"
              className="glass-card w-10 h-10 flex items-center justify-center shadow-lg shadow-black/30 hover:bg-white/10 transition-colors"
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
            <div className="glass-card px-4 py-2.5 flex items-center gap-2.5 shadow-lg shadow-black/30">
              <div
                className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white font-black text-xs"
                style={{ fontFamily: "Outfit" }}
              >
                SOS
              </div>
              <div>
                <h1
                  className="text-base font-bold tracking-tight"
                  style={{ fontFamily: "Outfit" }}
                >
                  RoadSOS
                </h1>
                <p className="text-[10px] text-white/40 -mt-0.5">
                  {userProfile?.name || "User"} · {userProfile?.bloodGroup || "--"}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 pointer-events-auto">
            <Link
              href="/profile"
              className="glass-card w-10 h-10 flex items-center justify-center shadow-lg shadow-black/30 hover:bg-white/10 transition-colors text-sm"
              title="My Profile"
            >
              👤
            </Link>
            <button
              onClick={() => setTrafficOpen(!trafficOpen)}
              className={`glass-card w-10 h-10 flex items-center justify-center shadow-lg shadow-black/30 transition-all cursor-pointer ${trafficOpen ? "bg-blue-500/20 border-blue-500/30 text-blue-400" : "hover:bg-white/10 text-white/70"}`}
              title="Live Traffic"
            >
              <span className="text-base">🚦</span>
            </button>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="glass-card w-10 h-10 flex items-center justify-center shadow-lg shadow-black/30 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                {sidebarOpen ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <>
                    <path d="M3 12h18" />
                    <path d="M3 6h18" />
                    <path d="M3 18h18" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Category filters */}
        <div className="flex gap-2 px-4 mt-3 overflow-x-auto no-scrollbar pointer-events-auto">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveFilter(cat.id)}
              className={`category-btn flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap border cursor-pointer transition-all ${activeFilter === cat.id ? `bg-gradient-to-r ${cat.color} text-white border-transparent shadow-lg` : "glass-card text-white/60 hover:text-white/90 border-white/10"}`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* DB notice banner */}
        {dbNotice && (
          <div className="mx-4 mt-2 pointer-events-auto glass-card px-3 py-2 text-xs text-amber-400 border-amber-500/20 flex items-center gap-2">
            <span>⚠️</span>
            <span className="flex-1">{dbNotice}</span>
            <button
              onClick={() => setDbNotice(null)}
              className="text-white/40 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Route info panel */}
      {routeData && (
        <div className="absolute bottom-24 left-4 right-4 z-[1000] pointer-events-auto animate-fade-in-up">
          <div className="glass-card p-4 border-blue-500/20 bg-[#0a0a0f]/90 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ fontFamily: "Outfit" }}>{routeData.destination.name}</h3>
                  <p className="text-[11px] text-white/40">{routeData.destination.type}</p>
                </div>
              </div>
              <button
                onClick={clearRoute}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all cursor-pointer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-5 flex-1">
                <div>
                  <p className="text-lg font-bold text-blue-400" style={{ fontFamily: "Outfit" }}>{(routeData.distance / 1000).toFixed(1)} km</p>
                  <p className="text-[10px] text-white/30">Distance</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div>
                  <p className="text-lg font-bold text-emerald-400" style={{ fontFamily: "Outfit" }}>~{Math.round(routeData.duration / 60)} min</p>
                  <p className="text-[10px] text-white/30">ETA</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div>
                  <p className="text-lg font-bold text-amber-400" style={{ fontFamily: "Outfit" }}>{Math.round(routeData.distance / 1000 / (routeData.duration / 3600))} km/h</p>
                  <p className="text-[10px] text-white/30">Avg Speed</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Traffic Panel */}
      <TrafficPanel
        userLat={userLocation?.lat || null}
        userLng={userLocation?.lng || null}
        services={services}
        isVisible={trafficOpen}
        onClose={() => setTrafficOpen(false)}
      />

      {/* SOS Button */}
      <div className={`absolute ${routeData ? "bottom-44" : "bottom-8"} left-1/2 -translate-x-1/2 z-[1000] transition-all duration-300 flex flex-col items-center`}>
        <SOSButton
          userProfile={userProfile || getUserProfile()}
          userLocation={userLocation}
          externalTrigger={sosTriggered}
          onTriggered={(id) => {
            const lat = userLocation?.lat || 28.6139;
            const lng = userLocation?.lng || 77.209;
            router.push(`/emergency/${id}?lat=${lat}&lng=${lng}`);
          }}
        />
        {offlineCached && (
          <div className="mt-2 flex items-center gap-1.5 text-[9px] text-emerald-400/50 bg-emerald-500/5 px-2.5 py-1 rounded-full border border-emerald-500/10">
            <span className="w-1 h-1 rounded-full bg-emerald-400/60" />
            Offline ready
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div
        className={`absolute top-0 right-0 h-full w-80 z-[1001] transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="h-full bg-[#0a0a0f]/95 backdrop-blur-xl border-l border-white/10 flex flex-col">
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between mb-1">
              <h2
                className="text-lg font-bold"
                style={{ fontFamily: "Outfit" }}
              >
                Nearby Services
              </h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-white/40">
              {filtered.length} services found
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filtered.map((s) => {
              const isActive = routeData?.destination.name === s.name;
              return (
                <div
                  key={s._id}
                  className={`glass-card p-3 transition-colors cursor-pointer ${isActive ? "border-blue-500/30 bg-blue-500/[0.06]" : "hover:bg-white/[0.06]"}`}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <h3 className="text-sm font-semibold leading-tight pr-2">
                      {s.name}
                    </h3>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${typeColors[s.type] || ""}`}
                    >
                      {s.type}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/50">
                    <span>📞 {s.phone[0]}</span>
                    <span>📏 {s.distance} km</span>
                    <span>⭐ {s.rating}</span>
                  </div>
                  {s.address && (
                    <p className="text-[10px] text-white/30 mt-1 truncate">
                      📍 {s.address}
                    </p>
                  )}
                  <div className="flex gap-2 mt-2.5">
                    <a
                      href={`tel:${s.phone[0]}`}
                      className="flex-1 text-center py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
                    >
                      Call
                    </a>
                    <button
                      onClick={() => fetchRoute(s)}
                      disabled={routeLoading === s._id}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all border cursor-pointer text-center ${
                        isActive
                          ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                          : "bg-white/5 text-white/70 hover:bg-white/10 border-white/10"
                      } disabled:opacity-50`}
                    >
                      {routeLoading === s._id ? (
                        <span className="flex items-center justify-center gap-1">
                          <span className="w-3 h-3 border border-white/40 border-t-transparent rounded-full animate-spin" />
                          Loading
                        </span>
                      ) : isActive ? (
                        "✓ Route Active"
                      ) : (
                        "Directions"
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-white/30 text-sm">
                <p className="text-3xl mb-2">📍</p>
                <p>Waiting for location...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
