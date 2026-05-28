import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import SOSAlert from "@/lib/db/models/SOSAlert";
import { alertEmitter, ALERT_EVENTS } from "@/lib/events";

// PATCH /api/sos/alerts/[id]/location — Update live GPS location
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const { lat, lng, speed, heading } = await req.json();

    if (lat === undefined || lng === undefined) {
      return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
    }

    const now = new Date();

    const alert = await SOSAlert.findByIdAndUpdate(
      id,
      {
        liveLocation: { lat, lng, updatedAt: now, speed, heading },
        $push: {
          locationHistory: {
            $each: [{ lat, lng, timestamp: now }],
            $slice: -100, // Keep last 100 points
          },
        },
      },
      { new: true }
    ).lean();

    if (!alert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    // Emit SSE event for real-time tracking
    alertEmitter.emit(ALERT_EVENTS.ALERT_UPDATED, {
      alertId: id,
      type: "location_update",
      liveLocation: { lat, lng, speed, heading, updatedAt: now.toISOString() },
      timestamp: now.toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Location update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
