const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  discountPercentage: { type: Number, required: true },
  validUntil: { type: Date, required: true },
  isUsed: { type: Boolean, default: false },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Coupon', CouponSchema);

// FIXME: chaged due to 404 error while getting data and updating

// const mongoose = require('mongoose');

// const CouponSchema = new mongoose.Schema({
//   code: { type: String, required: true },
//   discountPercentage: Number,
//   couponType: { type: String, default: 'personal' }, // Only "personal"
//   validUntil: Date,
//   isUsed: { type: Boolean, default: false },
//   createdAt: { type: Date, default: Date.now },
// });

// module.exports = mongoose.model('Coupon', CouponSchema);


// const mongoose = require('mongoose');

// const CouponSchema = new mongoose.Schema({
//   code: { type: String, required: true },
//   discountPercentage: Number,
//   couponType: String, // "personal" or "rebooking"
//   validFrom: Date,
//   validUntil: Date,
//   isUsed: { type: Boolean, default: false },
//   patientEmail: String, // for re-bookings
//   createdAt: { type: Date, default: Date.now },
// });

// module.exports = mongoose.model('Coupon', CouponSchema);