import mongoose, { Schema, Document, Model } from "mongoose";
import bcrypt from "bcryptjs";

export interface IEmergencyContact {
  name: string;
  phone: string;
  relation: string;
}

export interface IMedicalInfo {
  bloodGroup: string;
  allergies: string[];
  conditions: string[];
}

export interface IUser extends Document {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: "user" | "admin";
  bloodGroup?: string;
  vehicleNumber?: string;
  vehicleType?: string;
  age?: string;
  gender?: string;
  emergencyContacts: IEmergencyContact[];
  medicalInfo?: IMedicalInfo;
  country: string;
  preferredLanguage: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const emergencyContactSchema = new Schema<IEmergencyContact>(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    relation: { type: String, required: true },
  },
  { _id: false }
);

const medicalInfoSchema = new Schema<IMedicalInfo>(
  {
    bloodGroup: { type: String, default: "" },
    allergies: [{ type: String }],
    conditions: [{ type: String }],
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, required: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    bloodGroup: { type: String, default: "" },
    vehicleNumber: { type: String, default: "" },
    vehicleType: { type: String, default: "" },
    age: { type: String, default: "" },
    gender: { type: String, default: "" },
    emergencyContacts: {
      type: [emergencyContactSchema],
      default: [],
    },
    medicalInfo: { type: medicalInfoSchema, default: undefined },
    country: { type: String, default: "IN" },
    preferredLanguage: { type: String, default: "en" },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", userSchema);

export default User;
