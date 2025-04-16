const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  appointmentDate: { type: Date, required: true },
  appointmentTime: { type: String, required: true },
  price: { type: Number, required: true },
  couponCode: { type: String },
  meetingLink: { type: String, required: true },
  status: { type: String, enum: ["pending", "expired"], default: "pending" },
  rebookingCode: { type: String },
  rebookingValidFrom: { type: Date },
  rebookingValidUntil: { type: Date },
  rebookingUsed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Appointment", appointmentSchema);

// TODO: fix the pendind status for rebooking

// const mongoose = require('mongoose');

// const AppointmentSchema = new mongoose.Schema({
//   firstName: String,
//   lastName: String,
//   phone: String,
//   email: String,
//   appointmentDate: Date,
//   appointmentTime: String,
//   meetingLink: String,
//   paymentId: String,
//   orderId: String,
//   price: Number,
//   couponCode: String,
//   couponType: String, // "personal" or null (rebooking handled separately)
//   rebookingCode: String, // New field for re-booking code
//   rebookingValidFrom: Date, // When re-booking is valid
//   rebookingValidUntil: Date, // Expiry of re-booking code
//   rebookingUsed: { type: Boolean, default: false }, // Track if re-booking code is used
//   status: { type: String, default: 'pending', enum: ['pending', 'completed', 'missed'] }, // Appointment status
//   createdAt: { type: Date, default: Date.now },
// });

// module.exports = mongoose.model('Appointment', AppointmentSchema);
