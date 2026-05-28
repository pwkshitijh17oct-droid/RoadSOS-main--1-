import { NextRequest, NextResponse } from "next/server";

const OSRM_BASE = "https://router.project-osrm.org";

interface RouteResult {
  serviceId: string;
  serviceName: string;
  serviceType: string;
  distance: number; // km
  duration: number; // minutes
  durationInTraffic: number; // estimated with traffic factor
  trafficLevel: "free" | "moderate" | "heavy" | "severe";
  trafficFactor: number; // multiplier (1.0 = free flow)
  geometry?: string; // encoded polyline
}

// Estimate traffic factor based on time of day + day of week
function getTrafficFactor(): { factor: number; level: "free" | "moderate" | "heavy" | "severe" } {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0=Sun, 6=Sat

  const isWeekend = day === 0 || day === 6;

  // Peak hours (India): 8-10 AM, 5-8 PM on weekdays
  if (!isWeekend) {
    if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20)) {
      return { factor: 1.8, level: "heavy" };
    }
    if ((hour >= 7 && hour < 8) || (hour >= 10 && hour <= 12) || (hour >= 14 && hour < 17)) {
      return { factor: 1.4, level: "moderate" };
    }
    if (hour >= 20 && hour <= 23) {
      return { factor: 1.2, level: "moderate" };
    }
  } else {
    // Weekends — lighter traffic
    if (hour >= 10 && hour <= 14) {
      return { factor: 1.3, level: "moderate" };
    }
    if (hour >= 17 && hour <= 20) {
      return { factor: 1.4, level: "moderate" };
    }
  }

  // Late night / early morning — free flow
  if (hour >= 0 && hour < 6) {
    return { factor: 1.0, level: "free" };
  }

  return { factor: 1.15, level: "free" };
}

// Fetch route from OSRM (free, no API key)
async function getRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<{ distance: number; duration: number; geometry: string } | null> {
  try {
    const url = `${OSRM_BASE}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=polyline`;

    const res = await fetch(url, {
      headers: { "User-Agent": "RoadSOS/1.0" },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) return null;

    const route = data.routes[0];
    return {
      distance: Math.round((route.distance / 1000) * 10) / 10, // km
      duration: Math.round(route.duration / 60 * 10) / 10, // minutes
      geometry: route.geometry,
    };
  } catch {
    return null;
  }
}

// GET /api/traffic/eta?lat=28.6&lng=77.2&services=id1,id2,...
// Also accepts: serviceLats=lat1,lat2&serviceLngs=lng1,lng2&serviceNames=name1,name2&serviceTypes=type1,type2
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userLat = parseFloat(searchParams.get("lat") || "0");
    const userLng = parseFloat(searchParams.get("lng") || "0");

    if (!userLat || !userLng) {
      return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
    }

    // Parse service coordinates from query params
    const serviceLats = (searchParams.get("serviceLats") || "").split(",").filter(Boolean).map(Number);
    const serviceLngs = (searchParams.get("serviceLngs") || "").split(",").filter(Boolean).map(Number);
    const serviceNames = (searchParams.get("serviceNames") || "").split(",").filter(Boolean);
    const serviceTypes = (searchParams.get("serviceTypes") || "").split(",").filter(Boolean);
    const serviceIds = (searchParams.get("serviceIds") || "").split(",").filter(Boolean);

    if (serviceLats.length === 0) {
      return NextResponse.json({ error: "No services provided" }, { status: 400 });
    }

    const traffic = getTrafficFactor();
    const results: RouteResult[] = [];

    // Calculate routes — limit to first 5 to avoid rate limiting OSRM
    const limit = Math.min(serviceLats.length, 5);

    for (let i = 0; i < limit; i++) {
      const route = await getRoute(userLat, userLng, serviceLats[i], serviceLngs[i]);

      if (route) {
        const durationInTraffic = Math.round(route.duration * traffic.factor * 10) / 10;

        // Determine per-route traffic level based on duration increase
        let trafficLevel: "free" | "moderate" | "heavy" | "severe" = traffic.level;
        if (route.distance > 10) {
          // Longer routes are more likely to hit traffic
          trafficLevel = traffic.factor > 1.5 ? "severe" : traffic.level;
        }

        results.push({
          serviceId: serviceIds[i] || `service-${i}`,
          serviceName: serviceNames[i] || `Service ${i + 1}`,
          serviceType: serviceTypes[i] || "unknown",
          distance: route.distance,
          duration: route.duration,
          durationInTraffic,
          trafficLevel,
          trafficFactor: traffic.factor,
          geometry: route.geometry,
        });
      }
    }

    // Sort by ETA
    results.sort((a, b) => a.durationInTraffic - b.durationInTraffic);

    return NextResponse.json({
      userLocation: { lat: userLat, lng: userLng },
      timestamp: new Date().toISOString(),
      trafficConditions: {
        overall: traffic.level,
        factor: traffic.factor,
        description: {
          free: "Roads are clear — minimal delays",
          moderate: "Moderate traffic — expect slight delays",
          heavy: "Heavy traffic — significant delays expected",
          severe: "Severe congestion — consider alternate routes",
        }[traffic.level],
      },
      routes: results,
    });
  } catch (error) {
    console.error("Traffic ETA error:", error);
    return NextResponse.json({ error: "Failed to calculate traffic" }, { status: 500 });
  }
}
