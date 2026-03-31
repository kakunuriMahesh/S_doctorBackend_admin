const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  appointmentDate: { type: Date, required: true },
  appointmentTime: { type: String, required: true },
  price: { type: Number, default: 0 },
  bookingMode: { type: String, enum: ["online", "offline"], default: "offline" },
  serviceType: { type: String, default: "" },
  meetingType: { type: String, default: "" },
  meetingContact: { type: String, default: "" },
  status: {
    type: String,
    enum: ["new", "confirmed", "completed", "cancelled", "no-show", "success", "pending", "expired"],
    default: "new",
  },

  /* ===== OLD FIELDS — COMMENTED OUT =====
  couponCode: { type: String },
  meetingLink: { type: String, required: true },
  rebookingCode: { type: String },
  rebookingValidFrom: { type: Date },
  rebookingValidUntil: { type: Date },
  rebookingUsed: { type: Boolean, default: false },
  ===== END OLD FIELDS ===== */

}, {
  timestamps: true, // adds createdAt and updatedAt automatically
});

module.exports = mongoose.model("Appointment", appointmentSchema);
