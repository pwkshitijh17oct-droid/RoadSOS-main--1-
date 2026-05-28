import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import SOSAlert from "@/lib/db/models/SOSAlert";
import { sendSOSAlertSMS } from "@/lib/sms";
import { alertEmitter, ALERT_EVENTS } from "@/lib/events";

// POST /api/sos/trigger — Save SOS alert to MongoDB + Send SMS
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const { user, latitude, longitude, description } = body;

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: "Location is required for SOS" },
        { status: 400 }
      );
    }

    if (!user || !user.name || !user.phone) {
      return NextResponse.json(
        { error: "User details are required" },
        { status: 400 }
      );
    }

    const alert = await SOSAlert.create({
      user: {
        name: user.name,
        phone: user.phone,
        bloodGroup: user.bloodGroup || "",
        emergencyContacts: user.emergencyContacts || [],
        medicalConditions: user.medicalConditions || [],
        allergies: user.allergies || [],
        vehicleNumber: user.vehicleNumber || "",
        vehicleType: user.vehicleType || "",
      },
      location: {
        type: "Point",
        coordinates: [longitude, latitude],
      },
      severity: "critical",
      description: description || "SOS Emergency",
      status: "active",
    });

    // Emit real-time event for admin SSE
    alertEmitter.emit(ALERT_EVENTS.NEW_ALERT, {
      alertId: alert._id,
      userName: user.name,
      severity: "critical",
      timestamp: new Date().toISOString(),
    });

    // Send SMS to emergency contacts + admin (non-blocking)
    sendSOSAlertSMS(user.emergencyContacts || [], {
      userName: user.name,
      userPhone: user.phone,
      bloodGroup: user.bloodGroup,
      latitude,
      longitude,
      severity: "critical",
      vehicleNumber: user.vehicleNumber,
    }).catch((err) => console.error("[SMS] Failed to send SOS SMS:", err));

    return NextResponse.json(
      {
        message: "SOS triggered successfully",
        alertId: alert._id,
        status: "active",
        smsSent: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("SOS trigger error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
