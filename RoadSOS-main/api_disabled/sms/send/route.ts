import { NextRequest, NextResponse } from "next/server";
import {
  sendSOSAlertSMS,
  sendCriticalEscalationSMS,
  sendSurveyCompletedSMS,
  sendResolvedSMS,
} from "@/lib/sms";

// POST /api/sms/send — Send SMS notifications
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, alertData, emergencyContacts } = body;

    if (!type) {
      return NextResponse.json({ error: "SMS type is required" }, { status: 400 });
    }

    let result;

    switch (type) {
      case "sos_alert":
        result = await sendSOSAlertSMS(emergencyContacts || [], alertData);
        break;
      case "critical_escalation":
        result = await sendCriticalEscalationSMS(emergencyContacts || [], alertData);
        break;
      case "survey_completed":
        result = await sendSurveyCompletedSMS(alertData);
        break;
      case "resolved":
        result = await sendResolvedSMS(
          emergencyContacts || [],
          alertData?.userName || "Unknown"
        );
        break;
      default:
        return NextResponse.json({ error: "Invalid SMS type" }, { status: 400 });
    }

    return NextResponse.json({ success: result.success, message: result.message, provider: result.provider });
  } catch (error) {
    console.error("SMS API error:", error);
    return NextResponse.json({ error: "Failed to send SMS" }, { status: 500 });
  }
}
