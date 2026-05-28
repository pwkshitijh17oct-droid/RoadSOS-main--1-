import { NextRequest, NextResponse } from "next/server";

const OVERPASS_API = "https://overpass-api.de/api/interpreter";

// Map OSM tags to our service types
interface OSMElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface NormalizedService {
  osmId: number;
  name: string;
  type: string;
  lat: number;
  lng: number;
  phone: string[];
  address: string;
  rating: number;
  availability: string;
  specializations: string[];
}

function classifyService(tags: Record<string, string>): string | null {
  if (tags.amenity === "hospital" || tags.healthcare === "hospital") return "hospital";
  if (tags.amenity === "clinic" || tags.healthcare === "clinic") return "hospital";
  if (tags.amenity === "police") return "police";
  if (tags.emergency === "ambulance_station") return "ambulance";
  if (tags.amenity === "fire_station") return "ambulance"; // fire stations often have ambulance
  if (tags.shop === "car_repair" || tags.craft === "car_repair") return "repair";
  if (tags.shop === "car" || tags.shop === "motorcycle") return "showroom";
  if (tags.shop === "tyres" || tags.shop === "tires") return "repair";
  if (tags.amenity === "car_rental" || tags.amenity === "vehicle_inspection") return "towing";
  return null;
}

function extractPhone(tags: Record<string, string>): string[] {
  const phones: string[] = [];
  if (tags.phone) phones.push(tags.phone);
  if (tags["contact:phone"]) phones.push(tags["contact:phone"]);
  if (tags["contact:mobile"]) phones.push(tags["contact:mobile"]);
  // Deduplicate
  return [...new Set(phones)];
}

function extractAddress(tags: Record<string, string>): string {
  const parts: string[] = [];
  if (tags["addr:housenumber"]) parts.push(tags["addr:housenumber"]);
  if (tags["addr:street"]) parts.push(tags["addr:street"]);
  if (tags["addr:suburb"] || tags["addr:neighbourhood"]) parts.push(tags["addr:suburb"] || tags["addr:neighbourhood"]);
  if (tags["addr:city"]) parts.push(tags["addr:city"]);
  if (tags["addr:postcode"]) parts.push(tags["addr:postcode"]);
  return parts.join(", ") || tags.address || "";
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET /api/services/scrape?lat=28.6&lng=77.2&radius=5000&type=all
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = parseFloat(searchParams.get("lat") || "0");
    const lng = parseFloat(searchParams.get("lng") || "0");
    const radius = parseInt(searchParams.get("radius") || "5000"); // meters
    const typeFilter = searchParams.get("type") || "all";

    if (!lat || !lng) {
      return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
    }

    // Cap radius at 15km to avoid Overpass timeouts
    const safeRadius = Math.min(radius, 15000);

    // Build Overpass query — remove extra whitespace
    const query = `[out:json][timeout:30];(nwr["amenity"="hospital"](around:${safeRadius},${lat},${lng});nwr["healthcare"="hospital"](around:${safeRadius},${lat},${lng});nwr["amenity"="clinic"](around:${safeRadius},${lat},${lng});nwr["amenity"="police"](around:${safeRadius},${lat},${lng});nwr["emergency"="ambulance_station"](around:${safeRadius},${lat},${lng});nwr["amenity"="fire_station"](around:${safeRadius},${lat},${lng});nwr["shop"="car_repair"](around:${safeRadius},${lat},${lng});nwr["craft"="car_repair"](around:${safeRadius},${lat},${lng});nwr["shop"="tyres"](around:${safeRadius},${lat},${lng});nwr["shop"="car"](around:${safeRadius},${lat},${lng}););out center tags;`;

    const url = `${OVERPASS_API}?data=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "RoadSOS/1.0 (Emergency Response App)",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Overpass API returned ${response.status}`);
    }

    const data = await response.json();
    const elements: OSMElement[] = data.elements || [];

    // Normalize OSM data into our service format
    const services: NormalizedService[] = [];

    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name || tags["name:en"] || "";
      if (!name) continue; // Skip unnamed POIs

      const serviceType = classifyService(tags);
      if (!serviceType) continue;
      if (typeFilter !== "all" && serviceType !== typeFilter) continue;

      const elLat = el.lat || el.center?.lat;
      const elLng = el.lon || el.center?.lon;
      if (!elLat || !elLng) continue;

      const phones = extractPhone(tags);
      const address = extractAddress(tags);
      const distance = haversineDistance(lat, lng, elLat, elLng);

      services.push({
        osmId: el.id,
        name,
        type: serviceType,
        lat: elLat,
        lng: elLng,
        phone: phones.length > 0 ? phones : ["Not available"],
        address: address || `${distance.toFixed(1)} km from your location`,
        rating: tags.stars ? parseFloat(tags.stars) : 0,
        availability: tags.opening_hours === "24/7" ? "24x7" : tags.opening_hours || "Unknown",
        specializations: tags.healthcare_speciality ? tags.healthcare_speciality.split(";") : [],
      });
    }

    // Sort by distance
    services.sort((a, b) => {
      const distA = haversineDistance(lat, lng, a.lat, a.lng);
      const distB = haversineDistance(lat, lng, b.lat, b.lng);
      return distA - distB;
    });

    // Format for frontend compatibility
    const formatted = services.map((s) => ({
      _id: `osm-${s.osmId}`,
      name: s.name,
      type: s.type,
      location: { type: "Point", coordinates: [s.lng, s.lat] },
      phone: s.phone,
      address: s.address,
      rating: s.rating,
      availability: s.availability,
      specializations: s.specializations,
      distance: Math.round(haversineDistance(lat, lng, s.lat, s.lng) * 10) / 10,
      source: "openstreetmap",
    }));

    return NextResponse.json({
      count: formatted.length,
      source: "OpenStreetMap Overpass API",
      radius: safeRadius,
      services: formatted,
    });
  } catch (error) {
    console.error("Overpass scrape error:", error);
    return NextResponse.json(
      { error: "Failed to fetch from OpenStreetMap: " + (error as Error).message },
      { status: 500 }
    );
  }
}
