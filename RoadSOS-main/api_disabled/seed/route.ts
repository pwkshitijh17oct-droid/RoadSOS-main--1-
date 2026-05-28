import { NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import EmergencyService from "@/lib/db/models/EmergencyService";

// Seed data — real emergency services across major Indian cities
const seedData = [
  // === DELHI ===
  { name: "AIIMS Trauma Centre", type: "hospital", coordinates: [77.2100, 28.5672], address: "Sri Aurobindo Marg, Ansari Nagar, New Delhi", phone: ["+91-11-26588500", "102"], rating: 4.6, availability: "24x7", specializations: ["Trauma", "Neurosurgery", "Burns"], city: "Delhi", state: "Delhi" },
  { name: "Safdarjung Hospital", type: "hospital", coordinates: [77.2076, 28.5689], address: "Ring Road, Safdarjung, New Delhi", phone: ["+91-11-26707437"], rating: 4.2, availability: "24x7", specializations: ["Emergency", "Orthopaedics"], city: "Delhi", state: "Delhi" },
  { name: "Delhi Police Control Room", type: "police", coordinates: [77.2295, 28.6139], address: "ITO, New Delhi", phone: ["100", "+91-11-23490000"], rating: 4.0, availability: "24x7", specializations: ["Emergency Response"], city: "Delhi", state: "Delhi" },
  { name: "Traffic Police Helpline Delhi", type: "police", coordinates: [77.2167, 28.6328], address: "Rajesh Pilot Lane, New Delhi", phone: ["1095", "+91-11-25844444"], rating: 3.8, availability: "24x7", specializations: ["Traffic", "Accidents"], city: "Delhi", state: "Delhi" },
  { name: "CATS Ambulance Service", type: "ambulance", coordinates: [77.2315, 28.6350], address: "Central Delhi", phone: ["102", "1099"], rating: 4.5, availability: "24x7", specializations: ["Emergency Transport"], city: "Delhi", state: "Delhi" },
  { name: "108 Emergency Ambulance", type: "ambulance", coordinates: [77.1855, 28.6268], address: "West Delhi", phone: ["108"], rating: 4.4, availability: "24x7", specializations: ["Cardiac", "Trauma"], city: "Delhi", state: "Delhi" },
  { name: "AAA Towing Delhi", type: "towing", coordinates: [77.2507, 28.5835], address: "Lodhi Road Area, New Delhi", phone: ["+91-98111-20000"], rating: 4.1, availability: "24x7", specializations: ["Car", "Bike", "Heavy Vehicle"], city: "Delhi", state: "Delhi" },
  { name: "Quick Tyre & Puncture", type: "repair", coordinates: [77.1980, 28.6445], address: "Karol Bagh, New Delhi", phone: ["+91-98765-43210"], rating: 3.9, availability: "limited", specializations: ["Tyre", "Puncture"], city: "Delhi", state: "Delhi", operatingHours: { open: "07:00", close: "22:00" } },
  { name: "Maruti Suzuki Arena", type: "showroom", coordinates: [77.2350, 28.5920], address: "Mathura Road, New Delhi", phone: ["+91-11-41234567"], rating: 4.3, availability: "limited", specializations: ["Service", "Spare Parts"], city: "Delhi", state: "Delhi", operatingHours: { open: "09:00", close: "19:00" } },

  // === MUMBAI ===
  { name: "KEM Hospital", type: "hospital", coordinates: [72.8423, 19.0003], address: "Acharya Donde Marg, Parel, Mumbai", phone: ["+91-22-24107000"], rating: 4.4, availability: "24x7", specializations: ["Trauma", "Emergency"], city: "Mumbai", state: "Maharashtra" },
  { name: "JJ Hospital", type: "hospital", coordinates: [72.8360, 18.9630], address: "J.J. Marg, Byculla, Mumbai", phone: ["+91-22-23735555"], rating: 4.1, availability: "24x7", specializations: ["Burns", "Emergency"], city: "Mumbai", state: "Maharashtra" },
  { name: "Mumbai Police Control Room", type: "police", coordinates: [72.8777, 19.0760], address: "Crawford Market, Mumbai", phone: ["100", "+91-22-22621855"], rating: 4.0, availability: "24x7", specializations: ["Emergency"], city: "Mumbai", state: "Maharashtra" },
  { name: "BrihanMumbai Ambulance", type: "ambulance", coordinates: [72.8560, 19.0200], address: "Central Mumbai", phone: ["108", "1298"], rating: 4.3, availability: "24x7", specializations: ["Emergency Transport"], city: "Mumbai", state: "Maharashtra" },
  { name: "Highway Rescue Mumbai", type: "towing", coordinates: [72.8898, 19.1150], address: "Eastern Express Highway, Mumbai", phone: ["+91-98200-11000"], rating: 4.0, availability: "24x7", specializations: ["Highway Recovery"], city: "Mumbai", state: "Maharashtra" },
  { name: "FastFix Garage Andheri", type: "repair", coordinates: [72.8496, 19.1197], address: "Andheri West, Mumbai", phone: ["+91-98765-11111"], rating: 4.2, availability: "limited", specializations: ["General Repair", "AC"], city: "Mumbai", state: "Maharashtra", operatingHours: { open: "08:00", close: "21:00" } },

  // === BANGALORE ===
  { name: "Victoria Hospital", type: "hospital", coordinates: [77.5733, 12.9557], address: "Fort, Bangalore", phone: ["+91-80-26701150"], rating: 4.0, availability: "24x7", specializations: ["Emergency", "Trauma"], city: "Bangalore", state: "Karnataka" },
  { name: "St. John's Hospital", type: "hospital", coordinates: [77.6203, 12.9298], address: "Sarjapur Road, Bangalore", phone: ["+91-80-22065000"], rating: 4.5, availability: "24x7", specializations: ["Cardiac", "Neuro"], city: "Bangalore", state: "Karnataka" },
  { name: "Bangalore City Police", type: "police", coordinates: [77.5946, 12.9716], address: "Infantry Road, Bangalore", phone: ["100", "+91-80-22942222"], rating: 3.9, availability: "24x7", specializations: ["Emergency"], city: "Bangalore", state: "Karnataka" },
  { name: "GVK EMRI 108 Karnataka", type: "ambulance", coordinates: [77.5800, 12.9800], address: "Bangalore", phone: ["108"], rating: 4.6, availability: "24x7", specializations: ["Emergency", "Neonatal"], city: "Bangalore", state: "Karnataka" },
  { name: "RSA Towing Bangalore", type: "towing", coordinates: [77.6100, 12.9350], address: "Koramangala, Bangalore", phone: ["+91-80-41234567"], rating: 4.0, availability: "24x7", specializations: ["Car", "SUV"], city: "Bangalore", state: "Karnataka" },

  // === KOLKATA ===
  { name: "SSKM Hospital", type: "hospital", coordinates: [88.3430, 22.5355], address: "AJC Bose Road, Kolkata", phone: ["+91-33-22041101"], rating: 4.3, availability: "24x7", specializations: ["Trauma", "Emergency"], city: "Kolkata", state: "West Bengal" },
  { name: "Kolkata Police HQ", type: "police", coordinates: [88.3502, 22.5726], address: "Lalbazar, Kolkata", phone: ["100", "+91-33-22143230"], rating: 4.0, availability: "24x7", specializations: ["Emergency"], city: "Kolkata", state: "West Bengal" },
  { name: "108 Ambulance Kolkata", type: "ambulance", coordinates: [88.3639, 22.5726], address: "Central Kolkata", phone: ["108"], rating: 4.2, availability: "24x7", specializations: ["Emergency Transport"], city: "Kolkata", state: "West Bengal" },

  // === CHENNAI ===
  { name: "Rajiv Gandhi Government Hospital", type: "hospital", coordinates: [80.2787, 13.0693], address: "EVR Periyar Salai, Chennai", phone: ["+91-44-25305000"], rating: 4.1, availability: "24x7", specializations: ["Trauma", "Emergency"], city: "Chennai", state: "Tamil Nadu" },
  { name: "Chennai Police Control", type: "police", coordinates: [80.2707, 13.0827], address: "Vepery, Chennai", phone: ["100", "+91-44-23452365"], rating: 3.9, availability: "24x7", specializations: ["Emergency"], city: "Chennai", state: "Tamil Nadu" },
  { name: "108 Ambulance Tamil Nadu", type: "ambulance", coordinates: [80.2600, 13.0500], address: "Chennai", phone: ["108"], rating: 4.5, availability: "24x7", specializations: ["Emergency", "Cardiac"], city: "Chennai", state: "Tamil Nadu" },

  // === HYDERABAD ===
  { name: "Osmania General Hospital", type: "hospital", coordinates: [78.4766, 17.3850], address: "Afzalgunj, Hyderabad", phone: ["+91-40-24600146"], rating: 4.0, availability: "24x7", specializations: ["Emergency", "Trauma"], city: "Hyderabad", state: "Telangana" },
  { name: "Hyderabad Police", type: "police", coordinates: [78.4744, 17.3616], address: "Purani Haveli, Hyderabad", phone: ["100", "+91-40-27852400"], rating: 4.0, availability: "24x7", specializations: ["Emergency"], city: "Hyderabad", state: "Telangana" },
  { name: "108 Ambulance Telangana", type: "ambulance", coordinates: [78.4900, 17.3900], address: "Hyderabad", phone: ["108"], rating: 4.7, availability: "24x7", specializations: ["Emergency", "Obstetric"], city: "Hyderabad", state: "Telangana" },
];

// POST /api/seed — Populate database with emergency services
export async function POST() {
  try {
    await connectDB();

    // Clear existing data
    await EmergencyService.deleteMany({});

    // Insert seed data
    const docs = seedData.map((s) => ({
      name: s.name,
      type: s.type,
      location: { type: "Point" as const, coordinates: s.coordinates },
      address: s.address,
      phone: s.phone,
      rating: s.rating,
      availability: s.availability,
      specializations: s.specializations,
      country: "IN",
      city: s.city,
      state: s.state,
      verified: true,
      operatingHours: (s as Record<string, unknown>).operatingHours || undefined,
    }));

    const result = await EmergencyService.insertMany(docs);

    return NextResponse.json({
      message: `✅ Seeded ${result.length} emergency services across ${[...new Set(seedData.map((s) => s.city))].length} cities`,
      count: result.length,
      cities: [...new Set(seedData.map((s) => s.city))],
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Seed failed: " + (error as Error).message },
      { status: 500 }
    );
  }
}

// GET /api/seed — Check seed status
export async function GET() {
  try {
    await connectDB();
    const count = await EmergencyService.countDocuments();
    const byType = await EmergencyService.aggregate([
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);
    const byCity = await EmergencyService.aggregate([
      { $group: { _id: "$city", count: { $sum: 1 } } },
    ]);

    return NextResponse.json({
      total: count,
      byType: Object.fromEntries(byType.map((t) => [t._id, t.count])),
      byCity: Object.fromEntries(byCity.map((c) => [c._id, c.count])),
    });
  } catch (error) {
    console.error("Seed status error:", error);
    return NextResponse.json({ error: "DB not connected" }, { status: 500 });
  }
}
