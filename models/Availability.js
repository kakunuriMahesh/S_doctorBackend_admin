const mongoose = require('mongoose');

const AvailabilitySchema = new mongoose.Schema({
  doctorId: { type: String, required: true },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  slotDuration: { type: Number, default: 45, required: true },
  breakDuration: { type: Number, default: 15, required: true },
  pricePerSlot: { type: Number, required: true },
}, {
  timestamps: true,
});

// Ensure unique ranges per doctor
AvailabilitySchema.index({ doctorId: 1, fromDate: 1, toDate: 1 }, { unique: true });

module.exports = mongoose.model('Availability', AvailabilitySchema);


// FIXME: fromdate and todate

// const mongoose = require('mongoose');

// const AvailabilitySchema = new mongoose.Schema({
//   doctorId: { type: String, required: true },
//   date: { type: Date, required: true }, // Unique date for each availability
//   startTime: String,
//   endTime: String,
//   slotDuration: { type: Number, default: 30 }, // in minutes
//   breakDuration: { type: Number, default: 15 }, // in minutes
//   pricePerSlot: Number,
// });

// module.exports = mongoose.model('Availability', AvailabilitySchema);


// const mongoose = require('mongoose');

// const AvailabilitySchema = new mongoose.Schema({
//   doctorId: { type: String, required: true },
//   date: Date,
//   startTime: String,
//   endTime: String,
//   slotDuration: { type: Number, default: 30 }, // in minutes
//   breakDuration: { type: Number, default: 15 }, // in minutes
//   pricePerSlot: Number,
// });

// module.exports = mongoose.model('Availability', AvailabilitySchema);