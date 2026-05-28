"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface UserProfile {
  name: string;
  phone: string;
  bloodGroup: string;
  emergencyContacts: { name: string; phone: string; relation: string }[];
  medicalConditions: string[];
  allergies: string[];
  vehicleNumber?: string;
  vehicleType?: string;
}

interface SOSButtonProps {
  userProfile: UserProfile;
  userLocation: { lat: number; lng: number } | null;
  onTriggered?: (alertId: string) => void;
  externalTrigger?: boolean;
}

export default function SOSButton({
  userProfile,
  userLocation,
  onTriggered,
  externalTrigger,
}: SOSButtonProps) {
  const [triggered, setTriggered] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearCountdown = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setCountdown(null);
  }, []);

  const triggerSOS = async () => {

    setSending(true);

    try {

      const lat = userLocation?.lat || 28.6139;
      const lng = userLocation?.lng || 77.209;

      const emergencyMessage =
        `🚨 Emergency Alert!\n\n` +
        `Possible accident detected.\n\n` +
        `User: ${userProfile.name}\n` +
        `Blood Group: ${userProfile.bloodGroup}\n\n` +
        `Location:\n` +
        `https://maps.google.com/?q=${lat},${lng}`;

      const contacts = userProfile.emergencyContacts
        .map((c) => c.phone)
        .join(",");

      window.location.href =
        `sms:${contacts}?body=${encodeURIComponent(emergencyMessage)}`;

      setTriggered(true);

      setTimeout(() => setTriggered(false), 5000);

    } catch (error) {

      console.error(error);

      alert("Failed to open SMS app.");

    } finally {

      setSending(false);

    }
  };

  const handleSOS = () => {
    if (triggered || sending) return;
    let count = 3;
    setCountdown(count);

    intervalRef.current = setInterval(() => {
      count--;
      if (count <= 0) {
        clearCountdown();
        triggerSOS();
      } else {
        setCountdown(count);
      }
    }, 1000);
  };

  useEffect(() => {

    if (externalTrigger) {
      triggerSOS();
    }

  }, [externalTrigger]);

  return (
    <>
      <button
        onClick={handleSOS}
        disabled={triggered || sending}
        className={`relative w-[82px] h-[82px] rounded-full flex items-center justify-center font-black text-white text-base tracking-wider transition-all duration-300 cursor-pointer shadow-2xl before:content-[''] before:absolute before:inset-[-9px] before:rounded-full before:border before:border-white/12 before:bg-white/[0.03] before:backdrop-blur-md after:content-[''] after:absolute after:inset-[7px] after:rounded-full after:border after:border-white/20 after:pointer-events-none ${
          triggered
            ? "bg-gradient-to-br from-emerald-400 to-teal-700 scale-95 shadow-emerald-500/35"
            : sending
              ? "bg-gradient-to-br from-amber-400 to-orange-700 scale-95 shadow-amber-500/35"
              : "bg-gradient-to-br from-rose-400 via-red-500 to-orange-700 hover:from-rose-300 hover:via-red-400 hover:to-orange-600 sos-pulse hover:scale-105 active:scale-95 shadow-red-500/40"
        }`}
        style={{ fontFamily: "Outfit, sans-serif" }}
      >
        {triggered ? (
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : sending ? (
          <div className="w-6 h-6 border-[3px] border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <span className="relative z-10 drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">SOS</span>
        )}
      </button>

      {countdown !== null && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="text-8xl font-black text-red-500 mb-4 animate-pulse">
              {countdown}
            </div>
            <p className="text-white/70 text-lg mb-6">
              Sending SOS in {countdown}s...
            </p>
            <button
              onClick={clearCountdown}
              className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full font-semibold transition-all border border-white/20 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {triggered && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 glass-card px-4 py-2 text-emerald-400 text-xs font-semibold whitespace-nowrap">
          ✅ SOS sent — Help is on the way!
        </div>
      )}
    </>
  );
}
