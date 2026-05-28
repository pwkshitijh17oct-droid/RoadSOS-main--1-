import mongoose, { Schema, Document, Model } from "mongoose";

export type ServiceType =
  | "hospital"
  | "police"
  | "ambulance"
  | "towing"
  | "repair"
  | "showroom";

export interface IEmergencyService extends Document {
  name: string;
  type: ServiceType;
  location: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  address: string;
  phone: string[];
  rating: number;
  availability: "24x7" | "limited";
  specializations: string[];
  country: string;
  city: string;
  state: string;
  verified: boolean;
  operatingHours?: {
    open: string;
    close: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const emergencyServiceSchema = new Schema<IEmergencyService>(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: ["hospital", "police", "ambulance", "towing", "repair", "showroom"],
      index: true,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: function (val: number[]) {
            return val.length === 2;
          },
          message: "Coordinates must be [longitude, latitude]",
        },
      },
    },
    address: { type: String, required: true, trim: true },
    phone: {
      type: [String],
      required: true,
      validate: {
        validator: function (val: string[]) {
          return val.length > 0;
        },
        message: "At least one phone number is required",
      },
    },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    availability: {
      type: String,
      enum: ["24x7", "limited"],
      default: "limited",
    },
    specializations: [{ type: String }],
    country: { type: String, default: "IN", index: true },
    city: { type: String, required: true, trim: true, index: true },
    state: { type: String, required: true, trim: true },
    verified: { type: Boolean, default: false },
    operatingHours: {
      open: { type: String },
      close: { type: String },
    },
  },
  { timestamps: true }
);

// 2dsphere index for geospatial queries
emergencyServiceSchema.index({ location: "2dsphere" });

// Compound index for type + location queries
emergencyServiceSchema.index({ type: 1, location: "2dsphere" });

const EmergencyService: Model<IEmergencyService> =
  mongoose.models.EmergencyService ||
  mongoose.model<IEmergencyService>("EmergencyService", emergencyServiceSchema);

export default EmergencyService;
