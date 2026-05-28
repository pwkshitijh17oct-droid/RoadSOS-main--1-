import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import EmergencyService from "@/lib/db/models/EmergencyService";

// GET /api/services/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    const service = await EmergencyService.findById(id).lean();
    if (!service) {
      return NextResponse.json(
        { error: "Service not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ service });
  } catch (error) {
    console.error("Get service error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
