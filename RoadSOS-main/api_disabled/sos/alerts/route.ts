import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import SOSAlert from "@/lib/db/models/SOSAlert";

// GET /api/sos/alerts — Fetch all SOS alerts for admin dashboard
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const query: Record<string, unknown> = {};
    if (status && status !== "all") query.status = status;

    const alerts = await SOSAlert.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({ count: alerts.length, alerts });
  } catch (error) {
    console.error("Fetch SOS alerts error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
