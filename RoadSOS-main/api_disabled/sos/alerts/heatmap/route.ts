import { NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import SOSAlert from "@/lib/db/models/SOSAlert";

// GET /api/sos/alerts/heatmap — Fetch alert locations + metadata for heatmap
export async function GET() {
  try {
    await connectDB();

    const alerts = await SOSAlert.find({})
      .select("location severity status createdAt escalatedToCritical nearestHospital.name user.name")
      .sort({ createdAt: -1 })
      .lean();

    const points = alerts.map((alert) => {
      const coords = alert.location?.coordinates || [0, 0];
      // Weight: critical=1.0, high=0.7, medium=0.5, low=0.3
      const severityWeight: Record<string, number> = {
        critical: 1.0,
        high: 0.7,
        medium: 0.5,
        low: 0.3,
      };
      return {
        lat: coords[1],
        lng: coords[0],
        weight: severityWeight[alert.severity as string] || 0.5,
        severity: alert.severity,
        status: alert.status,
        escalated: alert.escalatedToCritical || false,
        hospital: alert.nearestHospital?.name || null,
        userName: alert.user?.name || "Unknown",
        createdAt: alert.createdAt,
      };
    });

    // Stats
    const stats = {
      total: alerts.length,
      critical: alerts.filter((a) => a.severity === "critical").length,
      escalated: alerts.filter((a) => a.escalatedToCritical).length,
      resolved: alerts.filter((a) => a.status === "resolved").length,
      active: alerts.filter((a) => a.status === "active").length,
    };

    return NextResponse.json({ points, stats });
  } catch (error) {
    console.error("Heatmap data error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
