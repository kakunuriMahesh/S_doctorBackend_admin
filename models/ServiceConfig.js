const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
});

const serviceConfigSchema = new mongoose.Schema({
  mode: { type: String, enum: ['online', 'offline'], required: true, unique: true },
  timeStart: { type: String, required: true },   // e.g. "05:00"
  timeEnd: { type: String, required: true },     // e.g. "08:00"
  sessionDuration: { type: Number, default: 45 }, // in minutes
  location: { type: String, default: '' },        // for offline: "Asha Neuro Clinic"
  services: [serviceSchema],
  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,
});

module.exports = mongoose.model('ServiceConfig', serviceConfigSchema);
