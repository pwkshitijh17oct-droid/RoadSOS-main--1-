"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getUserProfile } from "@/lib/profiles";
import { loadEmergencyCache } from "@/lib/offlineCache";

type Phase = "loading" | "timer" | "escalated" | "survey" | "done";

interface HospitalInfo {
  name: string;
  distance: number;
  eta: number;
  lat: number;
  lng: number;
  phone: string;
}

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

export default function EmergencyPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const alertId = params.id as string;
  const userLat = parseFloat(searchParams.get("lat") || "28.6139");
  const userLng = parseFloat(searchParams.get("lng") || "77.209");

  const [phase, setPhase] = useState<Phase>("loading");
  const [timer, setTimer] = useState(10);
  const [hospital, setHospital] = useState<HospitalInfo | null>(null);
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [alertStatus, setAlertStatus] = useState<string>("active");
  const [adminNotification, setAdminNotification] = useState<string | null>(null);

  // Load dynamic profile
  const userProfile = typeof window !== "undefined" ? getUserProfile() : null;

  // Survey state
  const [injuryLevel, setInjuryLevel] = useState("minor");
  const [bloodGroup, setBloodGroup] = useState(userProfile?.bloodGroup || "O+");
  const [numPatients, setNumPatients] = useState(1);
  const [canDrive, setCanDrive] = useState(true);
  const [needAmbulance, setNeedAmbulance] = useState(false);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gpsWatchRef = useRef<number | null>(null);
  const lastSentRef = useRef<number>(0);
  const [gpsActive, setGpsActive] = useState(false);

  // Update alert in MongoDB
  const updateAlert = useCallback(async (data: Record<string, unknown>) => {
    try {
      await fetch(`/api/sos/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch (err) {
      console.error("Failed to update alert:", err);
    }
  }, [alertId]);

  // Live GPS tracking — stream position to server every 5s
  useEffect(() => {
    if (phase === "done" || !alertId) return;
    if (!navigator.geolocation) return;

    const sendLocation = (lat: number, lng: number, speed: number | null, heading: number | null) => {
      const now = Date.now();
      if (now - lastSentRef.current < 5000) return; // Throttle to every 5s
      lastSentRef.current = now;

      fetch(`/api/sos/alerts/${alertId}/location`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, speed, heading }),
      }).catch((err) => console.error("[GPS] Failed to send location:", err));
    };

    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsActive(true);
        sendLocation(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.speed,
          pos.coords.heading
        );
      },
      (err) => {
        console.error("[GPS] Watch error:", err);
        setGpsActive(false);
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );

    return () => {
      if (gpsWatchRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
        gpsWatchRef.current = null;
      }
    };
  }, [alertId, phase]);

  // Poll alert status for admin response notifications
  useEffect(() => {
    if (!alertId || phase === "loading") return;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/sos/alerts/${alertId}`);
        if (res.ok) {
          const data = await res.json();
          const newStatus = data.alert?.status;
          if (newStatus && newStatus !== alertStatus) {
            if (newStatus === "responding" && alertStatus === "active") {
              setAdminNotification("responding");
              setTimeout(() => setAdminNotification(null), 10000);
            } else if (newStatus === "resolved") {
              setAdminNotification("resolved");
            }
            setAlertStatus(newStatus);
          }
        }
      } catch { /* ignore */ }
    };

    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [alertId, alertStatus, phase]);

  // Find nearest hospital + get route
  useEffect(() => {
    async function findHospital() {
      let hospitals: { name: string; lat: number; lng: number; phone: string; distance: number }[] = [];

      // Try scrape API
      try {
        const res = await fetch(`/api/services/scrape?lat=${userLat}&lng=${userLng}&radius=10000`);
        if (res.ok) {
          const data = await res.json();
          const h = (data.services || []).filter((s: { type: string }) => s.type === "hospital");
          hospitals = h.map((s: { name: string; location: { coordinates: [number, number] }; phone: string[]; distance: number }) => ({
            name: s.name,
            lat: s.location.coordinates[1],
            lng: s.location.coordinates[0],
            phone: s.phone?.[0] || "102",
            distance: s.distance,
          }));
        }
      } catch { /* ignore */ }

      // Try nearby API
      if (hospitals.length === 0) {
        try {
          const res = await fetch(`/api/services/nearby?lat=${userLat}&lng=${userLng}&radius=15&type=hospital`);
          if (res.ok) {
            const data = await res.json();
            hospitals = (data.services || []).map((s: { name: string; location: { coordinates: [number, number] }; phone: string[]; distance: number }) => ({
              name: s.name,
              lat: s.location.coordinates[1],
              lng: s.location.coordinates[0],
              phone: s.phone?.[0] || "102",
              distance: s.distance,
            }));
          }
        } catch { /* ignore */ }
      }

      // Offline fallback — use pre-cached hospital data
      if (hospitals.length === 0) {
        const cached = loadEmergencyCache();
        if (cached) {
          console.log("[Offline] Using cached hospital:", cached.hospital.name);
          const info: HospitalInfo = {
            name: cached.hospital.name,
            lat: cached.hospital.lat,
            lng: cached.hospital.lng,
            phone: cached.hospital.phone,
            distance: cached.hospital.distance,
            eta: cached.hospital.eta,
          };
          setHospital(info);
          setRoutePoints(cached.routePoints);

          // Try to save to alert (will fail silently if offline)
          updateAlert({
            nearestHospital: { name: info.name, distance: info.distance, eta: info.eta, lat: info.lat, lng: info.lng },
          }).catch(() => {});

          setPhase("timer");
          return;
        }

        // Last resort hardcoded fallback
        hospitals = [{
          name: "Nearest Hospital",
          lat: userLat + 0.008,
          lng: userLng + 0.012,
          phone: "102",
          distance: 1.5,
        }];
      }

      const closest = hospitals[0];

      // Get OSRM route
      let eta = Math.round(closest.distance * 3);
      let geometry: [number, number][] = [];
      try {
        const osrmRes = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${closest.lng},${closest.lat}?overview=full&geometries=polyline`
        );
        if (osrmRes.ok) {
          const osrmData = await osrmRes.json();
          if (osrmData.code === "Ok" && osrmData.routes?.length) {
            eta = Math.round(osrmData.routes[0].duration / 60);
            geometry = decodePolyline(osrmData.routes[0].geometry);
          }
        }
      } catch { /* ignore */ }

      const info: HospitalInfo = { ...closest, eta };
      setHospital(info);
      setRoutePoints(geometry);

      // Save nearest hospital to alert
      await updateAlert({
        nearestHospital: { name: info.name, distance: info.distance, eta: info.eta, lat: info.lat, lng: info.lng },
      });

      setPhase("timer");
    }

    findHospital();
  }, [userLat, userLng, updateAlert]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    if (!hospital) return;

    const map = L.map(mapContainerRef.current, { zoomControl: false, attributionControl: false });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd", maxZoom: 19,
    }).addTo(map);

    // User marker
    const userIcon = L.divIcon({
      className: "",
      html: `<div style="width:18px;height:18px;background:radial-gradient(circle,#3b82f6,#1d4ed8);border:3px solid #fff;border-radius:50%;box-shadow:0 0 12px rgba(59,130,246,0.6);"></div>`,
      iconSize: [18, 18], iconAnchor: [9, 9],
    });
    L.marker([userLat, userLng], { icon: userIcon }).addTo(map);

    // Hospital marker
    const hospIcon = L.divIcon({
      className: "",
      html: `<div style="width:40px;height:40px;background:linear-gradient(135deg,#dc2626,#991b1b);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(220,38,38,0.5);border:2px solid rgba(255,255,255,0.3);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M12 2v20M2 12h20"/></svg></div>`,
      iconSize: [40, 40], iconAnchor: [20, 20],
    });
    L.marker([hospital.lat, hospital.lng], { icon: hospIcon }).addTo(map);

    // Route polyline
    if (routePoints.length > 0) {
      L.polyline(routePoints, { color: "#3b82f6", weight: 5, opacity: 0.8, dashArray: "10, 6" }).addTo(map);
    }

    // Fit bounds
    const bounds = L.latLngBounds([
      [userLat, userLng],
      [hospital.lat, hospital.lng],
    ]);
    map.fitBounds(bounds, { padding: [50, 50] });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [hospital, routePoints, userLat, userLng]);

  // Timer countdown
  useEffect(() => {
    if (phase !== "timer") return;

    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          // Escalate to critical
          setPhase("escalated");
          updateAlert({
            canSelfReach: false,
            escalatedToCritical: true,
            severity: "critical",
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, updateAlert]);

  // User pressed "ABLE TO REACH"
  const handleCanReach = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("survey");
    updateAlert({ canSelfReach: true, severity: "high" });
  };

  // Submit survey
  const handleSubmitSurvey = async () => {
    setSubmitting(true);
    await updateAlert({
      survey: {
        injuryLevel,
        bloodGroup,
        numberOfPatients: numPatients,
        canDrive,
        needAmbulance,
        description,
      },
      severity: needAmbulance ? "critical" : injuryLevel === "severe" ? "critical" : injuryLevel === "moderate" ? "high" : "medium",
    });
    setPhase("done");
    setSubmitting(false);
  };

  // Cancel escalation
  const handleFalseAlarm = async () => {
    await updateAlert({
      canSelfReach: true,
      escalatedToCritical: false,
      severity: "low",
      status: "resolved",
    });
    setPhase("done");
  };

  const timerProgress = (timer / 10) * 100;

  return (
    <div className="h-full w-full flex flex-col bg-[#06060c] overflow-auto">
      {/* Emergency header */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${phase === "escalated" ? "bg-red-500/20 border border-red-500/30 animate-border-glow" : phase === "done" ? "bg-emerald-500/20 border border-emerald-500/30" : "bg-red-500/20 border border-red-500/30"}`}>
              {phase === "escalated" ? "🚨" : phase === "done" ? "✅" : "🆘"}
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent" style={{ fontFamily: "Outfit" }}>
                {phase === "escalated" ? "CRITICAL — ESCALATED" : phase === "done" ? "Help Confirmed" : "Emergency Mode"}
              </h1>
              <p className="text-[10px] text-white/40 flex items-center gap-1.5">
                <span>{userProfile?.name || "User"} · Alert #{alertId.slice(-6)}</span>
                {gpsActive && phase !== "done" && (
                  <span className="flex items-center gap-1 text-emerald-400/70">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-dot-pulse" />
                    GPS
                  </span>
                )}
              </p>
            </div>
          </div>
          {phase === "done" && (
            <Link href="/user" className="glass-card px-3 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/10 transition-all">
              ← Back to Map
            </Link>
          )}
        </div>
      </div>

      {/* Admin Response Notification */}
      {adminNotification === "responding" && (
        <div className="shrink-0 mx-4 mb-2 animate-fade-in-up">
          <div className="bg-emerald-500/15 border border-emerald-500/25 rounded-2xl px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-lg shrink-0">
              🚑
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-emerald-400" style={{ fontFamily: "Outfit" }}>
                Authorities have been alerted!
              </p>
              <p className="text-[10px] text-emerald-400/60 mt-0.5">
                Emergency services are responding to your location. Stay calm and safe.
              </p>
            </div>
            <button
              onClick={() => setAdminNotification(null)}
              className="text-emerald-400/40 hover:text-emerald-400 transition-colors shrink-0 cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      {adminNotification === "resolved" && (
        <div className="shrink-0 mx-4 mb-2 animate-fade-in-up">
          <div className="bg-blue-500/15 border border-blue-500/25 rounded-2xl px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-lg shrink-0">
              ✅
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-blue-400" style={{ fontFamily: "Outfit" }}>
                Emergency Resolved
              </p>
              <p className="text-[10px] text-blue-400/60 mt-0.5">
                Your emergency has been marked as resolved by the control room. Stay safe!
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Map */}
      <div className="shrink-0 h-[35vh] relative">
        {phase === "loading" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#06060c]">
            <div className="text-center animate-fade-in">
              <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-white/50">Finding nearest hospital...</p>
            </div>
          </div>
        )}
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* Hospital info */}
      {hospital && (
        <div className="shrink-0 mx-4 -mt-6 relative z-10">
          <div className="glass-card p-3.5 border-blue-500/20 animate-fade-in-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/20">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2v20M2 12h20"/></svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold">{hospital.name}</h3>
                  <p className="text-[11px] text-white/40">{hospital.distance} km away · ~{hospital.eta} min ETA</p>
                </div>
              </div>
              <a href={`tel:${hospital.phone}`} className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white text-xs font-bold rounded-lg shadow-lg shadow-emerald-600/20">
                📞 Call
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Phase content */}
      <div className="flex-1 px-4 pt-4 pb-8">
        {/* TIMER PHASE */}
        {phase === "timer" && (
          <div className="animate-fade-in-up space-y-5">
            {/* Timer display */}
            <div className="text-center">
              <div className="relative w-32 h-32 mx-auto mb-3">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                  <circle cx="60" cy="60" r="52" fill="none" stroke="url(#timerGrad)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${timerProgress * 3.27} 327`} className="transition-all duration-1000 ease-linear" />
                  <defs>
                    <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#dc2626" />
                      <stop offset="100%" stopColor="#f59e0b" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl font-black text-red-400" style={{ fontFamily: "Outfit" }}>{timer}</span>
                </div>
              </div>
              <p className="text-xs text-white/40">seconds remaining</p>
            </div>

            {/* Message */}
            <div className="glass-card p-4 border-amber-500/20 bg-amber-500/[0.05] text-center">
              <p className="text-sm text-amber-400 font-semibold mb-1">Can you reach the hospital yourself?</p>
              <p className="text-[11px] text-white/40 leading-relaxed">
                If you don&apos;t press the button below in {timer}s, your situation will be <span className="text-red-400 font-bold">ESCALATED TO CRITICAL</span> and emergency services will be dispatched.
              </p>
            </div>

            {/* Reach button */}
            <button
              onClick={handleCanReach}
              className="w-full py-4 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white text-base font-bold rounded-2xl shadow-xl shadow-emerald-600/30 hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer animate-gradient-shift"
              style={{ fontFamily: "Outfit" }}
            >
              ✅ ABLE TO REACH HOSPITAL MYSELF
            </button>

            <p className="text-center text-[10px] text-white/20">
              Press if you can drive or walk to the hospital
            </p>
          </div>
        )}

        {/* ESCALATED PHASE */}
        {phase === "escalated" && (
          <div className="animate-scale-in space-y-5 text-center">
            <div className="w-24 h-24 mx-auto rounded-3xl bg-red-500/15 border border-red-500/30 flex items-center justify-center animate-border-glow">
              <span className="text-5xl animate-pulse">🚨</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-red-400 mb-2" style={{ fontFamily: "Outfit" }}>
                SITUATION ESCALATED
              </h2>
              <p className="text-sm text-white/50 max-w-sm mx-auto leading-relaxed">
                Your situation has been escalated to <span className="text-red-400 font-bold">CRITICAL</span>. Emergency services and the admin control room have been notified.
              </p>
            </div>

            <div className="glass-card p-4 border-red-500/20 bg-red-500/[0.05] space-y-2 text-left">
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <span>✅</span><span>Admin control room alerted</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <span>✅</span><span>Location shared with responders</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <span>✅</span><span>Nearest hospital notified</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-amber-400">
                <span>⏳</span><span>Emergency contacts being notified...</span>
              </div>
            </div>

            <p className="text-white/60 text-sm font-semibold animate-pulse">Help is on the way!</p>

            <button
              onClick={handleFalseAlarm}
              className="w-full py-3 bg-white/[0.04] border border-white/10 text-white/50 text-xs font-semibold rounded-xl hover:bg-white/[0.08] hover:text-white/80 transition-all cursor-pointer"
            >
              I&apos;m OK — Cancel Escalation
            </button>
          </div>
        )}

        {/* SURVEY PHASE */}
        {phase === "survey" && (
          <div className="animate-fade-in-up space-y-4">
            <div className="text-center mb-2">
              <h2 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent" style={{ fontFamily: "Outfit" }}>
                Quick Assessment
              </h2>
              <p className="text-[11px] text-white/40">Help us understand your situation (optional but recommended)</p>
            </div>

            {/* Injury Level */}
            <div>
              <label className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-2 block">Injury Level</label>
              <div className="grid grid-cols-4 gap-2">
                {["none", "minor", "moderate", "severe"].map((level) => (
                  <button key={level} onClick={() => setInjuryLevel(level)}
                    className={`py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer capitalize ${
                      injuryLevel === level
                        ? level === "severe" ? "bg-red-500/20 text-red-400 border-red-500/30"
                          : level === "moderate" ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                          : level === "minor" ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                          : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : "glass-card text-white/40 hover:bg-white/[0.06]"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Blood Group */}
            <div>
              <label className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-2 block">Blood Group</label>
              <div className="grid grid-cols-4 gap-2">
                {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((bg) => (
                  <button key={bg} onClick={() => setBloodGroup(bg)}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      bloodGroup === bg ? "bg-red-500/20 text-red-400 border-red-500/30" : "glass-card text-white/40 hover:bg-white/[0.06]"
                    }`}
                  >
                    {bg}
                  </button>
                ))}
              </div>
            </div>

            {/* Number of patients */}
            <div>
              <label className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-2 block">Number of Patients</label>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setNumPatients(n)}
                    className={`py-2.5 rounded-xl text-sm font-bold border transition-all cursor-pointer ${
                      numPatients === n ? "bg-purple-500/20 text-purple-400 border-purple-500/30" : "glass-card text-white/40 hover:bg-white/[0.06]"
                    }`}
                  >
                    {n}{n === 5 ? "+" : ""}
                  </button>
                ))}
              </div>
            </div>

            {/* Can Drive + Need Ambulance */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-2 block">Can Drive?</label>
                <div className="grid grid-cols-2 gap-2">
                  {[true, false].map((v) => (
                    <button key={String(v)} onClick={() => setCanDrive(v)}
                      className={`py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        canDrive === v
                          ? v ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"
                          : "glass-card text-white/40 hover:bg-white/[0.06]"
                      }`}
                    >
                      {v ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-2 block">Need Ambulance?</label>
                <div className="grid grid-cols-2 gap-2">
                  {[true, false].map((v) => (
                    <button key={String(v)} onClick={() => setNeedAmbulance(v)}
                      className={`py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        needAmbulance === v
                          ? v ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : "glass-card text-white/40 hover:bg-white/[0.06]"
                      }`}
                    >
                      {v ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-2 block">Brief Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Minor fender bender, no major injuries..."
                rows={2}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white/80 placeholder-white/20 focus:outline-none focus:border-blue-500/30 transition-colors resize-none"
              />
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmitSurvey}
              disabled={submitting}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-sm font-bold rounded-2xl shadow-xl shadow-blue-600/20 hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              style={{ fontFamily: "Outfit" }}
            >
              {submitting ? "Sending..." : "Submit & Navigate to Hospital →"}
            </button>

            <button
              onClick={() => { setPhase("done"); }}
              className="w-full py-2 text-white/30 text-[11px] hover:text-white/50 transition-colors cursor-pointer"
            >
              Skip survey
            </button>
          </div>
        )}

        {/* DONE PHASE */}
        {phase === "done" && (
          <div className="animate-fade-in-up space-y-5 text-center pt-4">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <span className="text-4xl">✅</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-emerald-400 mb-1" style={{ fontFamily: "Outfit" }}>
                Information Sent
              </h2>
              <p className="text-xs text-white/40">Admin has been notified with all your details</p>
            </div>

            {hospital && (
              <a
                href={`https://www.google.com/maps/dir/${userLat},${userLng}/${hospital.lat},${hospital.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-sm font-bold rounded-2xl shadow-xl shadow-blue-600/20 hover:opacity-90 transition-all"
                style={{ fontFamily: "Outfit" }}
              >
                🗺️ Navigate to {hospital.name}
              </a>
            )}

            <Link
              href="/user"
              className="block w-full py-3 bg-white/[0.04] border border-white/10 text-white/50 text-xs font-semibold rounded-xl hover:bg-white/[0.08] hover:text-white/80 transition-all"
            >
              ← Back to Map
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
