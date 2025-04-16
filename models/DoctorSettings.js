const mongoose = require('mongoose');

const DoctorSettingsSchema = new mongoose.Schema({
  doctorId: { type: String, required: true, unique: true },
  basePrice: { type: Number, default: 1000 },
  bookingMessage: { type: String, default: '' },
  isMessageEnabled: { type: Boolean, default: false },
}, {
  timestamps: true,
});

module.exports = mongoose.model('DoctorSettings', DoctorSettingsSchema);

// FIXME: chaged due to 404 error while getting data and updating

// const mongoose = require('mongoose');

// const DoctorSettingsSchema = new mongoose.Schema({
//   doctorId: { type: String, required: true },
//   basePrice: { type: Number, default: 1000 },
//   bookingMessage: { type: String, default: 'In the last 24 hrs, {count} slots were booked.' },
//   isMessageEnabled: { type: Boolean, default: false },
// });

// module.exports = mongoose.model('DoctorSettings', DoctorSettingsSchema);