import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import User from "@/lib/db/models/User";
import { signToken } from "@/lib/auth";

// POST /api/auth/register
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();
    const {
      name,
      email,
      phone,
      password,
      role,
      bloodGroup,
      vehicleNumber,
      vehicleType,
      age,
      gender,
      emergencyContacts,
    } = body;

    if (!name || !email || !phone || !password) {
      return NextResponse.json(
        { error: "Name, email, phone, and password are required" },
        { status: 400 }
      );
    }

    if (role && !["user", "admin"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be 'user' or 'admin'" },
        { status: 400 }
      );
    }

    // Check if user exists
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }

    // Create user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      password,
      role: role || "user",
      bloodGroup: bloodGroup || "",
      vehicleNumber: vehicleNumber || "",
      vehicleType: vehicleType || "",
      age: age || "",
      gender: gender || "",
      emergencyContacts: emergencyContacts || [],
    });

    // Generate token
    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    const response = NextResponse.json(
      {
        message: "Registration successful",
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          bloodGroup: user.bloodGroup || "",
          vehicleNumber: user.vehicleNumber || "",
          vehicleType: user.vehicleType || "",
          age: user.age || "",
          gender: user.gender || "",
          emergencyContacts: user.emergencyContacts || [],
        },
        token,
      },
      { status: 201 }
    );

    // Set cookie
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
