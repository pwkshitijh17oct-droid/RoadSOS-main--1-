import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISOSAlert extends Document {
  user: {
    name: string;
    phone: string;
    bloodGroup: string;
    emergencyContacts: { name: string; phone: string; relation: string }[];
    medicalConditions: string[];
    allergies: string[];
    vehicleNumber?: string;
    vehicleType?: string;
  };
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  severity: "low" | "medium" | "high" | "critical";
  status: "active" | "responding" | "resolved";
  description: string;

  // Emergency page fields
  canSelfReach: boolean | null;
  escalatedToCritical: boolean;
  nearestHospital?: {
    name: string;
    distance: number;
    eta: number;
    lat: number;
    lng: number;
  };
  survey?: {
    injuryLevel: string;
    bloodGroup: string;
    numberOfPatients: number;
    canDrive: boolean;
    needAmbulance: boolean;
    description: string;
  };

  // Live GPS tracking
  liveLocation?: {
    lat: number;
    lng: number;
    updatedAt: Date;
    speed?: number;
    heading?: number;
  };
  locationHistory?: {
    lat: number;
    lng: number;
    timestamp: Date;
  }[];

  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const sosAlertSchema = new Schema<ISOSAlert>(
  {
    user: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      bloodGroup: { type: String, default: "" },
      emergencyContacts: [
        { name: String, phone: String, relation: String, _id: false },
      ],
      medicalConditions: [{ type: String }],
      allergies: [{ type: String }],
      vehicleNumber: { type: String },
      vehicleType: { type: String },
    },
    location: {
      type: { type: String, enum: ["Point"], required: true, default: "Point" },
      coordinates: { type: [Number], required: true },
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "critical",
    },
    status: {
      type: String,
      enum: ["active", "responding", "resolved"],
      default: "active",
      index: true,
    },
    description: { type: String, default: "SOS Emergency" },

    canSelfReach: { type: Boolean, default: null },
    escalatedToCritical: { type: Boolean, default: false },
    nearestHospital: {
      name: { type: String },
      distance: { type: Number },
      eta: { type: Number },
      lat: { type: Number },
      lng: { type: Number },
    },
    survey: {
      injuryLevel: { type: String },
      bloodGroup: { type: String },
      numberOfPatients: { type: Number },
      canDrive: { type: Boolean },
      needAmbulance: { type: Boolean },
      description: { type: String },
    },

    liveLocation: {
      lat: { type: Number },
      lng: { type: Number },
      updatedAt: { type: Date },
      speed: { type: Number },
      heading: { type: Number },
    },
    locationHistory: [{
      lat: { type: Number },
      lng: { type: Number },
      timestamp: { type: Date },
      _id: false,
    }],

    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

sosAlertSchema.index({ location: "2dsphere" });
sosAlertSchema.index({ status: 1, createdAt: -1 });

const SOSAlert: Model<ISOSAlert> =
  mongoose.models.SOSAlert ||
  mongoose.model<ISOSAlert>("SOSAlert", sosAlertSchema);

export default SOSAlert;
