"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getUserProfile, ADMIN_PROFILE, type UserProfile } from "@/lib/profiles";
import { Geolocation } from '@capacitor/geolocation';

export default function Home() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    setUserProfile(getUserProfile());
  }, []);

  const profile = userProfile || getUserProfile();

  const getLocation = async () => {
    try {
      const permission = await Geolocation.requestPermissions();

      if (permission.location === "granted") {
        const position = await Geolocation.getCurrentPosition();

        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });

        alert(
          `Latitude: ${position.coords.latitude}
Longitude: ${position.coords.longitude}`
        );
      } else {
        alert("Location permission denied");
      }
    } catch (error) {
      console.error(error);
      alert("Error getting location");
    }
  };

  return (
    <div className="h-full w-full flex flex-col items-center justify-center px-4 overflow-auto">
      {/* Background glow effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[20%] left-[15%] w-[500px] h-[500px] bg-blue-600/[0.06] rounded-full blur-[140px] animate-glow-pulse" />
        <div className="absolute bottom-[20%] right-[15%] w-[500px] h-[500px] bg-purple-600/[0.06] rounded-full blur-[140px] animate-glow-pulse delay-500" />
        <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-red-600/[0.04] rounded-full blur-[100px]" />
      </div>

      {/* Logo */}
      <div className="relative z-10 flex items-center gap-3.5 mb-3 animate-fade-in-up">
        <div
          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 via-red-600 to-red-800 flex items-center justify-center text-white font-black text-xl shadow-xl shadow-red-500/30 animate-gradient-shift"
          style={{ fontFamily: "Outfit" }}
        >
          SOS
        </div>
        <div>
          <h1
            className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent"
            style={{ fontFamily: "Outfit" }}
          >
            RoadSOS
          </h1>
          <p className="text-xs text-white/40 -mt-0.5 tracking-wide">
            Emergency Road Assistance
          </p>
        </div>
      </div>

      <p
        className="relative z-10 text-white/30 text-sm mb-10 text-center max-w-md animate-fade-in-up delay-100"
        style={{ animationFillMode: "both" }}
      >
        Select your profile to continue
      </p>

      {/* LOCATION BUTTON */}
      <div className="relative z-10 mb-6 flex flex-col items-center gap-3">
        <button
          onClick={getLocation}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold shadow-lg hover:brightness-110 transition-all"
        >
          Get My Location
        </button>

        {location && (
          <div className="text-white/70 text-sm text-center">
            <p>Latitude: {location.latitude}</p>
            <p>Longitude: {location.longitude}</p>
          </div>
        )}
      </div>

      {/* Profile cards */}
      <div className="relative z-10 flex flex-col sm:flex-row gap-5 w-full max-w-2xl">
        {/* User Card */}
        <Link
          href="/user"
          className="flex-1 animate-fade-in-up delay-200"
          style={{ animationFillMode: "both" }}
        >
          <div
            className="profile-card p-6 cursor-pointer h-full"
            style={
              {
                "--card-glow": "rgba(59, 130, 246, 0.08)",
                "--card-border-hover": "rgba(59, 130, 246, 0.35)",
                "--card-shadow": "rgba(59, 130, 246, 0.12)",
              } as React.CSSProperties
            }
          >
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/25">
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>

              <h2
                className="text-xl font-bold mb-1 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent"
                style={{ fontFamily: "Outfit" }}
              >
                User
              </h2>

              <p className="text-xs text-white/40 mb-4">
                Report emergencies and get help nearby
              </p>

              <div className="border-t border-white/[0.06] pt-3 space-y-2">
                <div className="flex items-center gap-2.5 text-xs text-white/50">
                  <span className="w-5 text-center">👤</span>
                  <span>{profile.name}</span>
                </div>

                <div className="flex items-center gap-2.5 text-xs text-white/50">
                  <span className="w-5 text-center">📞</span>
                  <span>{profile.phone}</span>
                </div>

                <div className="flex items-center gap-2.5 text-xs text-white/50">
                  <span className="w-5 text-center">🩸</span>
                  <span>Blood Group: {profile.bloodGroup}</span>
                </div>

                <div className="flex items-center gap-2.5 text-xs text-white/50">
                  <span className="w-5 text-center">🚗</span>
                  <span>
                    {profile.vehicleType} · {profile.vehicleNumber}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Link>

        {/* Admin Card */}
        <Link
          href="/admin"
          className="flex-1 animate-fade-in-up delay-300"
          style={{ animationFillMode: "both" }}
        >
          <div
            className="profile-card p-6 cursor-pointer h-full"
            style={
              {
                "--card-glow": "rgba(124, 58, 237, 0.08)",
                "--card-border-hover": "rgba(168, 85, 247, 0.35)",
                "--card-shadow": "rgba(124, 58, 237, 0.12)",
              } as React.CSSProperties
            }
          >
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-600 flex items-center justify-center mb-4 shadow-lg shadow-purple-500/25">
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>

              <h2
                className="text-xl font-bold mb-1 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"
                style={{ fontFamily: "Outfit" }}
              >
                Admin
              </h2>

              <p className="text-xs text-white/40 mb-4">
                Monitor SOS alerts and coordinate response
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}