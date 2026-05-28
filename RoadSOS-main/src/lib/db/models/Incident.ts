import mongoose, { Schema, Document, Model } from "mongoose";

export interface IIncident extends Document {
  reportedBy?: mongoose.Types.ObjectId;
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  severity: "low" | "medium" | "high" | "critical";
  mlSeverityScore: number;
  description: string;
  images: string[];
  vehiclesInvolved: number;
  injuriesReported: boolean;
  servicesContacted: mongoose.Types.ObjectId[];
  status: "active" | "responding" | "resolved";
  weather?: string;
  roadType?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const incidentSchema = new Schema<IIncident>(
  {
    reportedBy: { type: Schema.Types.ObjectId, ref: "User" },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
        default: "Point",
      },
      coordinates: { type: [Number], required: true },
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
      default: "medium",
    },
    mlSeverityScore: { type: Number, default: 0, min: 0, max: 1 },
    description: { type: String, default: "" },
    images: [{ type: String }],
    vehiclesInvolved: { type: Number, default: 1, min: 1 },
    injuriesReported: { type: Boolean, default: false },
    servicesContacted: [{ type: Schema.Types.ObjectId, ref: "EmergencyService" }],
    status: {
      type: String,
      enum: ["active", "responding", "resolved"],
      default: "active",
      index: true,
    },
    weather: { type: String },
    roadType: { type: String },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

incidentSchema.index({ location: "2dsphere" });
incidentSchema.index({ status: 1, createdAt: -1 });

const Incident: Model<IIncident> =
  mongoose.models.Incident ||
  mongoose.model<IIncident>("Incident", incidentSchema);

export default Incident;
