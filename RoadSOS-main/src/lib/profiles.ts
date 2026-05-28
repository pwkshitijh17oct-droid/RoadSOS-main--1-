export interface UserProfile {
  name: string;
  phone: string;
  bloodGroup: string;
  emergencyContacts: { name: string; phone: string; relation: string }[];
  medicalConditions: string[];
  allergies: string[];
  vehicleNumber: string;
  vehicleType: string;
  vehicleModel: string;
  vehicleColor: string;
  drivingLicense: string;
  insuranceId: string;
  age: string;
  gender: string;
}

const DEFAULT_PROFILE: UserProfile = {
  name: "Rahul Sharma",
  phone: "+91 98765 43210",
  bloodGroup: "O+",
  emergencyContacts: [
    { name: "Priya Sharma", phone: "+91 87654 32100", relation: "Wife" },
    { name: "Amit Sharma", phone: "+91 76543 21000", relation: "Brother" },
  ],
  medicalConditions: [],
  allergies: [],
  vehicleNumber: "DL 01 AB 1234",
  vehicleType: "Sedan",
  vehicleModel: "",
  vehicleColor: "",
  drivingLicense: "",
  insuranceId: "",
  age: "",
  gender: "",
};

const STORAGE_KEY = "roadsos_user_profile";

export function getUserProfile(): UserProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to ensure all fields exist
      return { ...DEFAULT_PROFILE, ...parsed };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_PROFILE };
}

export function saveUserProfile(profile: UserProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

// Keep backward compat export
export const USER_PROFILE = DEFAULT_PROFILE;

export const ADMIN_PROFILE = {
  name: "Control Room",
  role: "Emergency Response Coordinator",
};
