import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import Incident from "@/lib/db/models/Incident";
import { getUserFromRequest } from "@/lib/auth";

// POST /api/incidents — Create a new incident report
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const user = getUserFromRequest(req);
    const body = await req.json();
    const {
      latitude,
      longitude,
      severity,
      description,
      vehiclesInvolved,
      injuriesReported,
    } = body;

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: "Location coordinates are required" },
        { status: 400 }
      );
    }

    const incident = await Incident.create({
      reportedBy: user?.userId || undefined,
      location: {
        type: "Point",
        coordinates: [longitude, latitude],
      },
      severity: severity || "medium",
      description: description || "",
      vehiclesInvolved: vehiclesInvolved || 1,
      injuriesReported: injuriesReported || false,
    });

    return NextResponse.json(
      { message: "Incident reported successfully", incident },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create incident error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/incidents — List active incidents (optionally near a location)
export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const lat = parseFloat(searchParams.get("lat") || "0");
    const lng = parseFloat(searchParams.get("lng") || "0");
    const status = searchParams.get("status") || "active";

    const query: Record<string, unknown> = { status };

    if (lat && lng) {
      query.location = {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: 50000, // 50km
        },
      };
    }

    const incidents = await Incident.find(query)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return NextResponse.json({ count: incidents.length, incidents });
  } catch (error) {
    console.error("List incidents error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
