import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import SOSAlert from "@/lib/db/models/SOSAlert";
import { sendCriticalEscalationSMS, sendResolvedSMS, sendSurveyCompletedSMS } from "@/lib/sms";
import { alertEmitter, ALERT_EVENTS } from "@/lib/events";

// GET /api/sos/alerts/[id] — Fetch a single alert
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const alert = await SOSAlert.findById(id).lean();
    if (!alert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }
    return NextResponse.json({ alert });
  } catch (error) {
    console.error("Get alert error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/sos/alerts/[id] — Update alert (status, survey, escalation, hospital)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json();

    const update: Record<string, unknown> = {};

    // Status update
    if (body.status) {
      if (!["active", "responding", "resolved"].includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      update.status = body.status;
      if (body.status === "resolved") update.resolvedAt = new Date();
    }

    // Severity update
    if (body.severity) update.severity = body.severity;

    // Self-reach + escalation
    if (body.canSelfReach !== undefined) update.canSelfReach = body.canSelfReach;
    if (body.escalatedToCritical !== undefined) {
      update.escalatedToCritical = body.escalatedToCritical;
      if (body.escalatedToCritical) update.severity = "critical";
    }

    // Nearest hospital
    if (body.nearestHospital) update.nearestHospital = body.nearestHospital;

    // Survey data
    if (body.survey) update.survey = body.survey;

    const alert = await SOSAlert.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!alert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const alertDoc = alert as any;

    // Send SMS + emit SSE for critical escalation
    if (body.escalatedToCritical === true) {
      alertEmitter.emit(ALERT_EVENTS.ALERT_ESCALATED, { alertId: id, timestamp: new Date().toISOString() });
      const coords = alertDoc.location?.coordinates || [0, 0];
      sendCriticalEscalationSMS(alertDoc.user?.emergencyContacts || [], {
        userName: alertDoc.user?.name || "Unknown",
        userPhone: alertDoc.user?.phone || "",
        bloodGroup: alertDoc.user?.bloodGroup,
        latitude: coords[1],
        longitude: coords[0],
        severity: "critical",
        vehicleNumber: alertDoc.user?.vehicleNumber,
        nearestHospital: alertDoc.nearestHospital?.name,
      }).catch((err) => console.error("[SMS] Escalation SMS failed:", err));
    }

    // Send SMS + emit SSE for resolution
    if (body.status === "resolved") {
      alertEmitter.emit(ALERT_EVENTS.ALERT_RESOLVED, { alertId: id, timestamp: new Date().toISOString() });
      sendResolvedSMS(
        alertDoc.user?.emergencyContacts || [],
        alertDoc.user?.name || "Unknown"
      ).catch((err) => console.error("[SMS] Resolution SMS failed:", err));
    }

    // Send SMS + emit SSE for survey completion
    if (body.survey) {
      alertEmitter.emit(ALERT_EVENTS.SURVEY_SUBMITTED, { alertId: id, timestamp: new Date().toISOString() });
      const coords = alertDoc.location?.coordinates || [0, 0];
      sendSurveyCompletedSMS({
        userName: alertDoc.user?.name || "Unknown",
        userPhone: alertDoc.user?.phone || "",
        bloodGroup: body.survey.bloodGroup,
        latitude: coords[1],
        longitude: coords[0],
        severity: alertDoc.severity || "unknown",
        injuryLevel: body.survey.injuryLevel,
        numberOfPatients: body.survey.numberOfPatients,
        needAmbulance: body.survey.needAmbulance,
      }).catch((err) => console.error("[SMS] Survey SMS failed:", err));
    }

    // Emit general update event
    alertEmitter.emit(ALERT_EVENTS.ALERT_UPDATED, { alertId: id, changes: Object.keys(update), timestamp: new Date().toISOString() });

    return NextResponse.json({ message: "Alert updated", alert, smsSent: true });
  } catch (error) {
    console.error("Update alert error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
