// SMS Service using Fast2SMS (India)
// Get your free API key at https://www.fast2sms.com/

const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY || "";
const ADMIN_ALERT_NUMBER = "8957318789";

interface SMSResult {
  success: boolean;
  message: string;
  provider: string;
}

/**
 * Send an SMS via Fast2SMS API
 */
async function sendViaFast2SMS(numbers: string[], message: string): Promise<SMSResult> {
  if (!FAST2SMS_API_KEY) {
    console.log("[SMS-FALLBACK] No Fast2SMS API key configured.");
    console.log(`[SMS-FALLBACK] Would send to: ${numbers.join(", ")}`);
    console.log(`[SMS-FALLBACK] Message: ${message}`);
    return { success: true, message: "Logged to console (no API key)", provider: "console" };
  }

  try {
    const cleanNumbers = numbers.map((n) =>
      n.replace(/\D/g, "").replace(/^(\+?91)/, "").slice(-10)
    );

    const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        "authorization": FAST2SMS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        route: "q",
        message: message,
        language: "english",
        flash: 0,
        numbers: cleanNumbers.join(","),
      }),
    });

    const data = await res.json();

    if (data.return === true) {
      console.log(`[SMS] Sent successfully to ${cleanNumbers.join(", ")}`);
      return { success: true, message: "SMS sent via Fast2SMS", provider: "fast2sms" };
    } else {
      console.error("[SMS] Fast2SMS error:", data);
      return { success: false, message: data.message || "Failed to send", provider: "fast2sms" };
    }
  } catch (error) {
    console.error("[SMS] Error:", error);
    return { success: false, message: String(error), provider: "fast2sms" };
  }
}

// ─── PUBLIC API ──────────────────────────────────────────

export interface SOSAlertSMSData {
  userName: string;
  userPhone: string;
  bloodGroup?: string;
  latitude: number;
  longitude: number;
  severity: string;
  vehicleNumber?: string;
  nearestHospital?: string;
}

/**
 * Send SOS alert SMS to emergency contacts + admin
 */
export async function sendSOSAlertSMS(
  emergencyContacts: { name: string; phone: string; relation: string }[],
  alertData: SOSAlertSMSData
): Promise<SMSResult> {
  const mapsLink = `https://maps.google.com/?q=${alertData.latitude},${alertData.longitude}`;
  const message =
    `🚨 SOS EMERGENCY ALERT!\n` +
    `${alertData.userName} has triggered an SOS.\n` +
    `📞 ${alertData.userPhone}\n` +
    `🩸 Blood: ${alertData.bloodGroup || "N/A"}\n` +
    `🚗 Vehicle: ${alertData.vehicleNumber || "N/A"}\n` +
    `📍 Location: ${mapsLink}\n` +
    `⚠️ Severity: ${alertData.severity.toUpperCase()}`;

  // Collect all numbers: emergency contacts + admin
  const numbers = [
    ADMIN_ALERT_NUMBER,
    ...emergencyContacts.map((c) => c.phone),
  ].filter(Boolean);

  // Deduplicate
  const uniqueNumbers = [...new Set(numbers)];

  return sendViaFast2SMS(uniqueNumbers, message);
}

/**
 * Send critical escalation SMS
 */
export async function sendCriticalEscalationSMS(
  emergencyContacts: { name: string; phone: string; relation: string }[],
  alertData: SOSAlertSMSData
): Promise<SMSResult> {
  const mapsLink = `https://maps.google.com/?q=${alertData.latitude},${alertData.longitude}`;
  const message =
    `🚨🚨 CRITICAL ESCALATION!\n` +
    `${alertData.userName} could NOT confirm they can reach the hospital.\n` +
    `Situation auto-escalated to CRITICAL.\n` +
    `📞 ${alertData.userPhone}\n` +
    `🩸 Blood: ${alertData.bloodGroup || "N/A"}\n` +
    `📍 Location: ${mapsLink}\n` +
    `🏥 Hospital: ${alertData.nearestHospital || "Unknown"}\n` +
    `IMMEDIATE RESPONSE REQUIRED!`;

  const numbers = [
    ADMIN_ALERT_NUMBER,
    ...emergencyContacts.map((c) => c.phone),
  ].filter(Boolean);

  const uniqueNumbers = [...new Set(numbers)];

  return sendViaFast2SMS(uniqueNumbers, message);
}

/**
 * Send survey completion SMS to admin
 */
export async function sendSurveyCompletedSMS(
  alertData: SOSAlertSMSData & {
    injuryLevel?: string;
    numberOfPatients?: number;
    needAmbulance?: boolean;
  }
): Promise<SMSResult> {
  const message =
    `📋 Survey Update — ${alertData.userName}\n` +
    `Injury: ${alertData.injuryLevel || "N/A"}\n` +
    `Patients: ${alertData.numberOfPatients || 1}\n` +
    `Ambulance: ${alertData.needAmbulance ? "YES NEEDED" : "No"}\n` +
    `🩸 Blood: ${alertData.bloodGroup || "N/A"}\n` +
    `📞 ${alertData.userPhone}`;

  return sendViaFast2SMS([ADMIN_ALERT_NUMBER], message);
}

/**
 * Send resolution SMS to emergency contacts
 */
export async function sendResolvedSMS(
  emergencyContacts: { name: string; phone: string; relation: string }[],
  userName: string
): Promise<SMSResult> {
  const message =
    `✅ RESOLVED — ${userName}'s emergency has been resolved.\n` +
    `The situation has been handled. No further action needed.`;

  const numbers = [
    ADMIN_ALERT_NUMBER,
    ...emergencyContacts.map((c) => c.phone),
  ].filter(Boolean);

  const uniqueNumbers = [...new Set(numbers)];

  return sendViaFast2SMS(uniqueNumbers, message);
}
