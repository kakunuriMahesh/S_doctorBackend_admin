const express = require('express');
const router = express.Router();
const DoctorSettings = require('../models/DoctorSettings');
const Appointment = require('../models/Appointment');
const Coupon = require('../models/Coupon');
const Availability = require('../models/Availability');
const Admin = require('../models/Admin');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Validation helper function
const validateFields = (fields, res) => {
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
      console.error(`Validation failed: ${key} is missing or empty`);
      res.status(400).json({ error: `${key} is required` });
      return false;
    }
  }
  return true;
};

// JWT Middleware
const authenticateJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log('Authorization header:', authHeader);
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('No token provided');
    return res.status(401).json({ error: 'Access denied, no token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = await Admin.findById(decoded.id).select('_id email');
    if (!req.admin) {
      console.error('Invalid token, admin not found');
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.log('Authenticated admin:', req.admin.email);
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Admin Signup (Protected by secret key)
// router.post('/admin/signup', async (req, res) => {
//   console.log('Admin signup attempt:', req.body);
//   const { email, password, confirmPassword, secret } = req.body;
//   console.log('Signup attempt:', { email });

//   if (!validateFields({ email, password, confirmPassword, secret }, res)) return;
//   if (secret !== process.env.ADMIN_SIGNUP_SECRET) {
//     console.error('Invalid signup secret');
//     return res.status(403).json({ error: 'Invalid secret key' });
//   }
//   if (password !== confirmPassword) {
//     console.error('Passwords do not match');
//     return res.status(400).json({ error: 'Passwords do not match' });
//   }
//   if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
//     console.error('Invalid email format');
//     return res.status(400).json({ error: 'Invalid email format' });
//   }
//   if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password)) {
//     console.error('Weak password');
//     return res.status(400).json({ error: 'Password must be at least 8 characters with letters and numbers' });
//   }

//   try {
//     const existingAdmin = await Admin.findOne({ email });
//     if (existingAdmin) {
//       console.error('Email already exists:', email);
//       return res.status(400).json({ error: 'Email already exists' });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);
//     const admin = new Admin({ email, password: hashedPassword });
//     await admin.save();

//     console.log('Admin created:', email);
//     res.status(201).json({ message: 'Admin created successfully' });
//   } catch (error) {
//     console.error('Signup error:', error.message);
//     res.status(500).json({ error: 'Failed to create admin' });
//   }
// });

router.post('/admin/signup', async (req, res) => {
  const { email, password, confirmPassword } = req.body;
  console.log('Signup attempt:', { email });

  if (!validateFields({ email, password, confirmPassword }, res)) return;

  if (password !== confirmPassword) {
    console.error('Passwords do not match');
    return res.status(400).json({ error: 'Passwords do not match' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Invalid email format');
    return res.status(400).json({ error: 'Invalid email format' });
  }
  if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password)) {
    console.error('Weak password');
    return res.status(400).json({ error: 'Password must be at least 8 characters with letters and numbers' });
  }

  try {
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      console.error('Email already exists:', email);
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = new Admin({ email, password: hashedPassword });
    await admin.save();

    console.log('Admin created:', email);
    res.status(201).json({ message: 'Admin created successfully' });
  } catch (error) {
    console.error('Signup error:', error.message);
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

// ... other routes ...

// Admin Login
router.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('Login attempt:', { email });

  if (!validateFields({ email, password }, res)) return;

  try {
    const admin = await Admin.findOne({ email });
    if (!admin) {
      console.error('Admin not found:', email);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      console.error('Incorrect password for:', email);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    console.log('Login successful:', email);
    res.json({ token, message: 'Login successful' });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Forgot Password (Generate Reset Token)
router.post('/admin/forgot-password', async (req, res) => {
  const { email } = req.body;
  console.log('Forgot password request:', { email });

  if (!validateFields({ email }, res)) return;

  try {
    const admin = await Admin.findOne({ email });
    if (!admin) {
      console.error('Admin not found:', email);
      return res.status(404).json({ error: 'Email not found' });
    }

    const resetToken = Math.random().toString(36).substr(2, 10);
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour
    admin.resetToken = resetToken;
    admin.resetTokenExpiry = resetTokenExpiry;
    await admin.save();

    console.log('Reset token generated:', { email, resetToken });
    res.json({ message: 'Reset token generated', resetToken }); // Simulate email by returning token
  } catch (error) {
    console.error('Forgot password error:', error.message);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Reset Password
router.post('/admin/reset-password', async (req, res) => {
  const { email, resetToken, newPassword, confirmPassword } = req.body;
  console.log('Reset password attempt:', { email });

  if (!validateFields({ email, resetToken, newPassword, confirmPassword }, res)) return;
  if (newPassword !== confirmPassword) {
    console.error('Passwords do not match');
    return res.status(400).json({ error: 'Passwords do not match' });
  }
  if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(newPassword)) {
    console.error('Weak password');
    return res.status(400).json({ error: 'Password must be at least 8 characters with letters and numbers' });
  }

  try {
    const admin = await Admin.findOne({
      email,
      resetToken,
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!admin) {
      console.error('Invalid or expired reset token for:', email);
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    admin.password = await bcrypt.hash(newPassword, 10);
    admin.resetToken = null;
    admin.resetTokenExpiry = null;
    await admin.save();

    console.log('Password reset successful:', email);
    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error.message);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Protect existing routes
router.post('/settings/price', authenticateJWT, async (req, res) => {
  const { doctorId, basePrice } = req.body;
  if (!validateFields({ doctorId, basePrice }, res)) return;
  if (isNaN(basePrice) || basePrice <= 0) {
    console.error(`Invalid basePrice: ${basePrice}`);
    return res.status(400).json({ error: 'Base price must be a positive number' });
  }
  try {
    const result = await DoctorSettings.updateOne(
      { doctorId },
      { basePrice },
      { upsert: true }
    );
    console.log(`Price update result:`, result);
    res.json({ message: 'Price updated' });
  } catch (error) {
    console.error(`Error updating price:`, error);
    res.status(500).json({ error: 'Failed to update price' });
  }
});

router.post('/settings/message', authenticateJWT, async (req, res) => {
  const { doctorId, bookingMessage, isMessageEnabled } = req.body;
  if (!validateFields({ doctorId }, res)) return;
  if (isMessageEnabled && !bookingMessage) {
    console.error(`Message required when enabled`);
    return res.status(400).json({ error: 'Message is required when enabled' });
  }
  try {
    const result = await DoctorSettings.updateOne(
      { doctorId },
      { bookingMessage, isMessageEnabled },
      { upsert: true }
    );
    console.log(`Message update result:`, result);
    res.json({ message: 'Message updated' });
  } catch (error) {
    console.error(`Error updating message:`, error);
    res.status(500).json({ error: 'Failed to update message' });
  }
});

router.get('/settings', authenticateJWT, async (req, res) => {
  try {
    const settings = await DoctorSettings.findOne({ doctorId: 'doctor1' });
    console.log(`Settings fetched:`, settings);
    res.json(settings || { basePrice: 1000, bookingMessage: '', isMessageEnabled: false });
  } catch (error) {
    console.error(`Error fetching settings:`, error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.post('/coupon', authenticateJWT, async (req, res) => {
  const { doctorId, discountPercentage } = req.body;
  if (!validateFields({ doctorId, discountPercentage }, res)) return;
  if (isNaN(discountPercentage) || discountPercentage < 0 || discountPercentage > 100) {
    console.error(`Invalid discountPercentage: ${discountPercentage}`);
    return res.status(400).json({ error: 'Discount percentage must be between 0 and 100' });
  }
  try {
    const code = `DISCOUNT${discountPercentage}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const coupon = new Coupon({
      code,
      discountPercentage,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isUsed: false,
    });
    await coupon.save();
    console.log(`Coupon created: ${code}`);
    res.json({ code });
  } catch (error) {
    console.error(`Error creating coupon:`, error);
    res.status(500).json({ error: 'Failed to create coupon' });
  }
});

router.delete('/coupon/:code', authenticateJWT, async (req, res) => {
  const { code } = req.params;
  if (!validateFields({ code }, res)) return;
  try {
    const result = await Coupon.deleteOne({ code });
    console.log(`Coupon delete result:`, result);
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Coupon not found' });
    }
    res.json({ message: 'Coupon deleted' });
  } catch (error) {
    console.error(`Error deleting coupon:`, error);
    res.status(500).json({ error: 'Failed to delete coupon' });
  }
});

router.get('/coupons', authenticateJWT, async (req, res) => {
  try {
    const coupons = await Coupon.find({});
    console.log(`Coupons fetched:`, coupons.length);
    res.json(coupons);
  } catch (error) {
    console.error(`Error fetching coupons:`, error);
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
});

router.post('/availability', authenticateJWT, async (req, res) => {
  const { doctorId, fromDate, toDate, startTime, endTime, slotDuration, breakDuration, pricePerSlot } = req.body;
  if (!validateFields({ doctorId, fromDate, toDate, startTime, endTime, slotDuration, breakDuration, pricePerSlot }, res)) return;

  const slotDurationNum = parseInt(slotDuration);
  const breakDurationNum = parseInt(breakDuration);
  const pricePerSlotNum = parseInt(pricePerSlot);

  if (new Date(toDate) < new Date(fromDate)) {
    console.error(`Invalid date range: ${fromDate} to ${toDate}`);
    return res.status(400).json({ error: 'To date must be on or after from date' });
  }
  if (new Date(`2000-01-01T${startTime}`) >= new Date(`2000-01-01T${endTime}`)) {
    console.error(`Invalid time range: ${startTime} to ${endTime}`);
    return res.status(400).json({ error: 'End time must be after start time' });
  }
  if (isNaN(slotDurationNum) || slotDurationNum <= 0 || isNaN(breakDurationNum) || breakDurationNum < 0 || isNaN(pricePerSlotNum) || pricePerSlotNum <= 0) {
    console.error(`Invalid numerics: slot=${slotDurationNum}, break=${breakDurationNum}, price=${pricePerSlotNum}`);
    return res.status(400).json({ error: 'Invalid numeric values' });
  }

  try {
    const overlapping = await Availability.findOne({
      doctorId,
      $or: [
        { fromDate: { $lte: new Date(toDate) }, toDate: { $gte: new Date(fromDate) } },
      ],
    });

    if (overlapping) {
      console.error(`Overlap found:`, overlapping);
      return res.status(400).json({ error: 'Availability range overlaps with an existing range' });
    }

    const availability = new Availability({
      doctorId,
      fromDate: new Date(fromDate),
      toDate: new Date(toDate),
      startTime,
      endTime,
      slotDuration: slotDurationNum,
      breakDuration: breakDurationNum,
      pricePerSlot: pricePerSlotNum,
    });

    const saved = await availability.save();
    console.log(`Availability saved:`, saved);
    res.json({ message: 'Availability set', availability: saved });
  } catch (error) {
    console.error(`Error saving availability:`, error);
    res.status(500).json({ error: 'Failed to set availability' });
  }
});

router.get('/availability', authenticateJWT, async (req, res) => {
  try {
    const availabilities = await Availability.find({ doctorId: 'doctor1' }).sort({ fromDate: 1 });
    console.log(`Availabilities fetched:`, availabilities.length);
    res.json(availabilities);
  } catch (error) {
    console.error(`Error fetching availabilities:`, error);
    res.status(500).json({ error: 'Failed to fetch availabilities' });
  }
});

router.delete('/availability/:id', authenticateJWT, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await Availability.deleteOne({ _id: id, doctorId: 'doctor1' });
    console.log(`Availability delete result:`, result);
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Availability not found' });
    }
    res.json({ message: 'Availability deleted' });
  } catch (error) {
    console.error(`Error deleting availability:`, error);
    res.status(500).json({ error: 'Failed to delete availability' });
  }
});

router.get('/slots/:date', async (req, res) => {
  const date = new Date(req.params.date);
  try {
    const availability = await Availability.findOne({
      doctorId: 'doctor1',
      fromDate: { $lte: date },
      toDate: { $gte: date },
    });

    let startTime, endTime, slotDuration, breakDuration, pricePerSlot;
    if (availability) {
      startTime = availability.startTime;
      endTime = availability.endTime;
      slotDuration = availability.slotDuration;
      breakDuration = availability.breakDuration;
      pricePerSlot = availability.pricePerSlot;
    } else {
      startTime = '09:00';
      endTime = '17:00';
      slotDuration = 45;
      breakDuration = 15;
      const settings = await DoctorSettings.findOne({ doctorId: 'doctor1' }) || { basePrice: 1000 };
      pricePerSlot = settings.basePrice;
    }

    const slots = [];
    let currentTime = new Date(`${req.params.date}T${startTime}:00`);
    const end = new Date(`${req.params.date}T${endTime}:00`);

    while (currentTime < end) {
      const slotEnd = new Date(currentTime.getTime() + slotDuration * 60000);
      if (slotEnd <= end) {
        const slot = {
          time: `${currentTime.getHours()}:${currentTime.getMinutes().toString().padStart(2, '0')} - ${slotEnd.getHours()}:${slotEnd.getMinutes().toString().padStart(2, '0')}`,
          duration: slotDuration,
          price: (pricePerSlot / slotDuration) * slotDuration,
        };
        slots.push(slot);
      }
      currentTime = new Date(slotEnd.getTime() + breakDuration * 60000);
    }

    const bookedAppointments = await Appointment.find({
      appointmentDate: date,
      status: 'pending',
    });
    const availableSlots = slots.filter(slot =>
      !bookedAppointments.some(b => b.appointmentTime === slot.time)
    );

    console.log(`Slots for ${req.params.date}:`, availableSlots.length);
    res.json(availableSlots);
  } catch (error) {
    console.error(`Error fetching slots:`, error);
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

router.post('/appointment', authenticateJWT, async (req, res) => {
  const { firstName, lastName, phone, email, appointmentDate, appointmentTime, couponCode } = req.body;
  if (!validateFields({ firstName, lastName, phone, email, appointmentDate, appointmentTime }, res)) return;

  console.log('Booking attempt:', { firstName, lastName, phone, email, appointmentDate, appointmentTime, couponCode });

  try {
    const availability = await Availability.findOne({
      doctorId: 'doctor1',
      fromDate: { $lte: new Date(appointmentDate) },
      toDate: { $gte: new Date(appointmentDate) },
    });
    const settings = await DoctorSettings.findOne({ doctorId: 'doctor1' }) || { basePrice: 1200 };
    let price, slotDuration;
    if (availability) {
      const [startHour, startMinute] = appointmentTime.split(' - ')[0].split(':').map(Number);
      const [endHour, endMinute] = appointmentTime.split(' - ')[1].split(':').map(Number);
      slotDuration = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
      price = (availability.pricePerSlot / availability.slotDuration) * slotDuration;
    } else {
      slotDuration = 45;
      price = settings.basePrice;
    }

    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode, isUsed: false });
      if (coupon) {
        console.log('Coupon found:', coupon);
        price = price * (1 - coupon.discountPercentage / 100);
        coupon.isUsed = true;
        await coupon.save();
      } else {
        const now = new Date();
        const rebooking = await Appointment.findOne({
          rebookingCode: couponCode,
          rebookingUsed: false,
          email,
          phone,
          rebookingValidFrom: { $lte: now },
          rebookingValidUntil: { $gte: now },
        });
        console.log('Re-booking check:', {
          rebookingCode: couponCode,
          rebookingUsed: false,
          email,
          phone,
          rebookingValidFromLTE: now,
          rebookingValidUntilGTE: now,
          foundRebooking: rebooking ? rebooking : 'Not found',
        });
        if (rebooking) {
          price = 0;
          rebooking.rebookingUsed = true;
          await rebooking.save();
          console.log('Re-booking applied:', rebooking);
        } else {
          return res.status(400).json({ error: 'Invalid or expired re-booking code, or re-booking not yet valid' });
        }
      }
    }

    const appointment = new Appointment({
      ...req.body,
      price,
      meetingLink: 'https://meet.google.com/xyz',
      status: 'pending',
    });
    const saved = await appointment.save();

    if (price > 0) {
      const rebookingCode = `REBOOK-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const [endHour, endMinute] = appointmentTime.split(' - ')[1].split(':').map(Number);
      const validFrom = new Date(appointmentDate);
      validFrom.setHours(endHour, endMinute, 0, 0);
      appointment.rebookingCode = rebookingCode;
      appointment.rebookingValidFrom = validFrom;
      appointment.rebookingValidUntil = new Date(validFrom.getTime() + 14 * 24 * 60 * 60 * 1000);
      await appointment.save();
      console.log('New appointment with re-booking code:', appointment);
    }

    console.log(`Appointment saved:`, saved);
    res.json({ message: 'Appointment booked', appointment: saved });
  } catch (error) {
    console.error(`Error booking appointment:`, error);
    res.status(500).json({ error: 'Failed to book appointment' });
  }
});

router.get('/appointments', authenticateJWT, async (req, res) => {
  try {
    const now = new Date();
    const result = await Appointment.updateMany(
      {
        appointmentDate: { $lte: now },
        appointmentTime: {
          $regex: /^(\d{2}):(\d{2}) - (\d{2}):(\d{2})$/,
          $lt: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
        },
        status: 'pending',
      },
      { status: 'expired' }
    );
    console.log(`Expired appointments updated:`, result);

    const appointments = await Appointment.find({}).sort({ createdAt: -1 });
    console.log(`Appointments fetched:`, appointments.length);
    res.json(appointments);
  } catch (error) {
    console.error(`Error fetching appointments:`, error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

router.delete('/appointment', authenticateJWT, async (req, res) => {
  const { ids } = req.body;
  try {
    const idArray = Array.isArray(ids) ? ids : [ids];
    const result = await Appointment.deleteMany({ _id: { $in: idArray } });
    console.log(`Appointments delete result:`, result);
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'No appointments found to delete' });
    }
    res.json({ message: 'Appointment(s) deleted' });
  } catch (error) {
    console.error(`Error deleting appointments:`, error);
    res.status(500).json({ error: 'Failed to delete appointments' });
  }
});

module.exports = router;

// FIXME: adding login and sigup for admin

// const express = require('express');
// const router = express.Router();
// const DoctorSettings = require('../models/DoctorSettings');
// const Appointment = require('../models/Appointment');
// const Coupon = require('../models/Coupon');
// const Availability = require('../models/Availability');

// // Validation helper function
// const validateFields = (fields, res) => {
//   for (const [key, value] of Object.entries(fields)) {
//     if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
//       console.error(`Validation failed: ${key} is missing or empty`);
//       res.status(400).json({ error: `${key} is required` });
//       return false;
//     }
//   }
//   return true;
// };

// // Update Price
// router.post('/settings/price', async (req, res) => {
//   const { doctorId, basePrice } = req.body;
//   if (!validateFields({ doctorId, basePrice }, res)) return;
//   if (isNaN(basePrice) || basePrice <= 0) {
//     console.error(`Invalid basePrice: ${basePrice}`);
//     return res.status(400).json({ error: 'Base price must be a positive number' });
//   }
//   try {
//     const result = await DoctorSettings.updateOne(
//       { doctorId },
//       { basePrice },
//       { upsert: true }
//     );
//     console.log(`Price update result:`, result);
//     res.json({ message: 'Price updated' });
//   } catch (error) {
//     console.error(`Error updating price:`, error);
//     res.status(500).json({ error: 'Failed to update price' });
//   }
// });

// // Update Booking Message
// router.post('/settings/message', async (req, res) => {
//   const { doctorId, bookingMessage, isMessageEnabled } = req.body;
//   if (!validateFields({ doctorId }, res)) return;
//   if (isMessageEnabled && !bookingMessage) {
//     console.error(`Message required when enabled`);
//     return res.status(400).json({ error: 'Message is required when enabled' });
//   }
//   try {
//     const result = await DoctorSettings.updateOne(
//       { doctorId },
//       { bookingMessage, isMessageEnabled },
//       { upsert: true }
//     );
//     console.log(`Message update result:`, result);
//     res.json({ message: 'Message updated' });
//   } catch (error) {
//     console.error(`Error updating message:`, error);
//     res.status(500).json({ error: 'Failed to update message' });
//   }
// });

// // Get Settings (Price and Message)
// router.get('/settings', async (req, res) => {
//   try {
//     const settings = await DoctorSettings.findOne({ doctorId: 'doctor1' });
//     console.log(`Settings fetched:`, settings);
//     res.json(settings || { basePrice: 1000, bookingMessage: '', isMessageEnabled: false });
//   } catch (error) {
//     console.error(`Error fetching settings:`, error);
//     res.status(500).json({ error: 'Failed to fetch settings' });
//   }
// });

// // Generate Coupon (Personal Discount)
// router.post('/coupon', async (req, res) => {
//   const { doctorId, discountPercentage } = req.body;
//   if (!validateFields({ doctorId, discountPercentage }, res)) return;
//   if (isNaN(discountPercentage) || discountPercentage < 0 || discountPercentage > 100) {
//     console.error(`Invalid discountPercentage: ${discountPercentage}`);
//     return res.status(400).json({ error: 'Discount percentage must be between 0 and 100' });
//   }
//   try {
//     const code = `DISCOUNT${discountPercentage}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
//     const coupon = new Coupon({
//       code,
//       discountPercentage,
//       validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
//       isUsed: false,
//     });
//     await coupon.save();
//     console.log(`Coupon created: ${code}`);
//     res.json({ code });
//   } catch (error) {
//     console.error(`Error creating coupon:`, error);
//     res.status(500).json({ error: 'Failed to create coupon' });
//   }
// });

// // Delete Coupon
// router.delete('/coupon/:code', async (req, res) => {
//   const { code } = req.params;
//   if (!validateFields({ code }, res)) return;
//   try {
//     const result = await Coupon.deleteOne({ code });
//     console.log(`Coupon delete result:`, result);
//     if (result.deletedCount === 0) {
//       return res.status(404).json({ error: 'Coupon not found' });
//     }
//     res.json({ message: 'Coupon deleted' });
//   } catch (error) {
//     console.error(`Error deleting coupon:`, error);
//     res.status(500).json({ error: 'Failed to delete coupon' });
//   }
// });

// // Get All Coupons
// router.get('/coupons', async (req, res) => {
//   try {
//     const coupons = await Coupon.find({});
//     console.log(`Coupons fetched:`, coupons.length);
//     res.json(coupons);
//   } catch (error) {
//     console.error(`Error fetching coupons:`, error);
//     res.status(500).json({ error: 'Failed to fetch coupons' });
//   }
// });

// // Set Availability (Date Range)
// router.post('/availability', async (req, res) => {
//   const { doctorId, fromDate, toDate, startTime, endTime, slotDuration, breakDuration, pricePerSlot } = req.body;
//   if (!validateFields({ doctorId, fromDate, toDate, startTime, endTime, slotDuration, breakDuration, pricePerSlot }, res)) return;

//   const slotDurationNum = parseInt(slotDuration);
//   const breakDurationNum = parseInt(breakDuration);
//   const pricePerSlotNum = parseInt(pricePerSlot);

//   if (new Date(toDate) < new Date(fromDate)) {
//     console.error(`Invalid date range: ${fromDate} to ${toDate}`);
//     return res.status(400).json({ error: 'To date must be on or after from date' });
//   }
//   if (new Date(`2000-01-01T${startTime}`) >= new Date(`2000-01-01T${endTime}`)) {
//     console.error(`Invalid time range: ${startTime} to ${endTime}`);
//     return res.status(400).json({ error: 'End time must be after start time' });
//   }
//   if (isNaN(slotDurationNum) || slotDurationNum <= 0 || isNaN(breakDurationNum) || breakDurationNum < 0 || isNaN(pricePerSlotNum) || pricePerSlotNum <= 0) {
//     console.error(`Invalid numerics: slot=${slotDurationNum}, break=${breakDurationNum}, price=${pricePerSlotNum}`);
//     return res.status(400).json({ error: 'Invalid numeric values' });
//   }

//   try {
//     // Check for overlapping ranges
//     const overlapping = await Availability.findOne({
//       doctorId,
//       $or: [
//         { fromDate: { $lte: new Date(toDate) }, toDate: { $gte: new Date(fromDate) } },
//       ],
//     });

//     if (overlapping) {
//       console.error(`Overlap found:`, overlapping);
//       return res.status(400).json({ error: 'Availability range overlaps with an existing range' });
//     }

//     // Save the new availability range
//     const availability = new Availability({
//       doctorId,
//       fromDate: new Date(fromDate),
//       toDate: new Date(toDate),
//       startTime,
//       endTime,
//       slotDuration: slotDurationNum,
//       breakDuration: breakDurationNum,
//       pricePerSlot: pricePerSlotNum,
//     });

//     const saved = await availability.save();
//     console.log(`Availability saved:`, saved);
//     res.json({ message: 'Availability set', availability: saved });
//   } catch (error) {
//     console.error(`Error saving availability:`, error);
//     res.status(500).json({ error: 'Failed to set availability' });
//   }
// });

// // Get All Availabilities
// router.get('/availability', async (req, res) => {
//   try {
//     const availabilities = await Availability.find({ doctorId: 'doctor1' }).sort({ fromDate: 1 });
//     console.log(`Availabilities fetched:`, availabilities.length);
//     res.json(availabilities);
//   } catch (error) {
//     console.error(`Error fetching availabilities:`, error);
//     res.status(500).json({ error: 'Failed to fetch availabilities' });
//   }
// });

// // Delete Availability
// router.delete('/availability/:id', async (req, res) => {
//   const { id } = req.params;
//   try {
//     const result = await Availability.deleteOne({ _id: id, doctorId: 'doctor1' });
//     console.log(`Availability delete result:`, result);
//     if (result.deletedCount === 0) {
//       return res.status(404).json({ error: 'Availability not found' });
//     }
//     res.json({ message: 'Availability deleted' });
//   } catch (error) {
//     console.error(`Error deleting availability:`, error);
//     res.status(500).json({ error: 'Failed to delete availability' });
//   }
// });

// // Get Available Slots for a Date
// router.get('/slots/:date', async (req, res) => {
//   const date = new Date(req.params.date);
//   try {
//     const availability = await Availability.findOne({
//       doctorId: 'doctor1',
//       fromDate: { $lte: date },
//       toDate: { $gte: date },
//     });

//     let startTime, endTime, slotDuration, breakDuration, pricePerSlot;
//     if (availability) {
//       startTime = availability.startTime;
//       endTime = availability.endTime;
//       slotDuration = availability.slotDuration;
//       breakDuration = availability.breakDuration;
//       pricePerSlot = availability.pricePerSlot;
//     } else {
//       startTime = '09:00';
//       endTime = '17:00';
//       slotDuration = 45;
//       breakDuration = 15;
//       const settings = await DoctorSettings.findOne({ doctorId: 'doctor1' }) || { basePrice: 1000 };
//       pricePerSlot = settings.basePrice;
//     }

//     const slots = [];
//     let currentTime = new Date(`${req.params.date}T${startTime}:00`);
//     const end = new Date(`${req.params.date}T${endTime}:00`);

//     while (currentTime < end) {
//       const slotEnd = new Date(currentTime.getTime() + slotDuration * 60000);
//       if (slotEnd <= end) {
//         const slot = {
//           time: `${currentTime.getHours()}:${currentTime.getMinutes().toString().padStart(2, '0')} - ${slotEnd.getHours()}:${slotEnd.getMinutes().toString().padStart(2, '0')}`,
//           duration: slotDuration,
//           price: (pricePerSlot / slotDuration) * slotDuration,
//         };
//         slots.push(slot);
//       }
//       currentTime = new Date(slotEnd.getTime() + breakDuration * 60000);
//     }

//     const bookedAppointments = await Appointment.find({
//       appointmentDate: date,
//       status: 'pending',
//     });
//     const availableSlots = slots.filter(slot =>
//       !bookedAppointments.some(b => b.appointmentTime === slot.time)
//     );

//     console.log(`Slots for ${req.params.date}:`, availableSlots.length);
//     res.json(availableSlots);
//   } catch (error) {
//     console.error(`Error fetching slots:`, error);
//     res.status(500).json({ error: 'Failed to fetch slots' });
//   }
// });

// // Book Appointment
// router.post('/appointment', async (req, res) => {
//   const { firstName, lastName, phone, email, appointmentDate, appointmentTime, couponCode } = req.body;
//   if (!validateFields({ firstName, lastName, phone, email, appointmentDate, appointmentTime }, res)) return;

//   console.log('Booking attempt:', { firstName, lastName, phone, email, appointmentDate, appointmentTime, couponCode });

//   try {
//     const availability = await Availability.findOne({
//       doctorId: 'doctor1',
//       fromDate: { $lte: new Date(appointmentDate) },
//       toDate: { $gte: new Date(appointmentDate) },
//     });
//     const settings = await DoctorSettings.findOne({ doctorId: 'doctor1' }) || { basePrice: 1200 };
//     let price, slotDuration;
//     if (availability) {
//       const [startHour, startMinute] = appointmentTime.split(' - ')[0].split(':').map(Number);
//       const [endHour, endMinute] = appointmentTime.split(' - ')[1].split(':').map(Number);
//       slotDuration = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
//       price = (availability.pricePerSlot / availability.slotDuration) * slotDuration;
//     } else {
//       slotDuration = 45;
//       price = settings.basePrice;
//     }

//     if (couponCode) {
//       const coupon = await Coupon.findOne({ code: couponCode, isUsed: false });
//       if (coupon) {
//         console.log('Coupon found:', coupon);
//         price = price * (1 - coupon.discountPercentage / 100);
//         coupon.isUsed = true;
//         await coupon.save();
//       } else {
//         const now = new Date();
//         const rebooking = await Appointment.findOne({
//           rebookingCode: couponCode,
//           rebookingUsed: false,
//           email,
//           phone,
//           rebookingValidFrom: { $lte: now },
//           rebookingValidUntil: { $gte: now },
//         });
//         console.log('Re-booking check:', {
//           rebookingCode: couponCode,
//           rebookingUsed: false,
//           email,
//           phone,
//           rebookingValidFromLTE: now,
//           rebookingValidUntilGTE: now,
//           foundRebooking: rebooking ? rebooking : 'Not found',
//         });
//         if (rebooking) {
//           price = 0;
//           rebooking.rebookingUsed = true;
//           await rebooking.save();
//           console.log('Re-booking applied:', rebooking);
//         } else {
//           return res.status(400).json({ error: 'Invalid or expired re-booking code, or re-booking not yet valid' });
//         }
//       }
//     }

//     const appointment = new Appointment({
//       ...req.body,
//       price,
//       meetingLink: 'https://meet.google.com/xyz',
//       status: 'pending',
//     });
//     const saved = await appointment.save();

//     if (price > 0) {
//       const rebookingCode = `REBOOK-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
//       const [endHour, endMinute] = appointmentTime.split(' - ')[1].split(':').map(Number);
//       const validFrom = new Date(appointmentDate);
//       validFrom.setHours(endHour, endMinute, 0, 0);
//       appointment.rebookingCode = rebookingCode;
//       appointment.rebookingValidFrom = validFrom;
//       appointment.rebookingValidUntil = new Date(validFrom.getTime() + 14 * 24 * 60 * 60 * 1000);
//       await appointment.save();
//       console.log('New appointment with re-booking code:', appointment);
//     }

//     console.log(`Appointment saved:`, saved);
//     res.json({ message: 'Appointment booked', appointment: saved });
//   } catch (error) {
//     console.error(`Error booking appointment:`, error);
//     res.status(500).json({ error: 'Failed to book appointment' });
//   }
// });

// // Get Appointments (for tabs)
// router.get('/appointments', async (req, res) => {
//   try {
//     const now = new Date();
//     const result = await Appointment.updateMany(
//       {
//         appointmentDate: { $lte: now },
//         appointmentTime: {
//           $regex: /^(\d{2}):(\d{2}) - (\d{2}):(\d{2})$/,
//           $lt: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
//         },
//         status: 'pending',
//       },
//       { status: 'expired' }
//     );
//     console.log(`Expired appointments updated:`, result);

//     const appointments = await Appointment.find({}).sort({ createdAt: -1 });
//     console.log(`Appointments fetched:`, appointments.length);
//     res.json(appointments);
//   } catch (error) {
//     console.error(`Error fetching appointments:`, error);
//     res.status(500).json({ error: 'Failed to fetch appointments' });
//   }
// });

// // Delete Appointment(s)
// router.delete('/appointment', async (req, res) => {
//   const { ids } = req.body;
//   try {
//     const idArray = Array.isArray(ids) ? ids : [ids];
//     const result = await Appointment.deleteMany({ _id: { $in: idArray } });
//     console.log(`Appointments delete result:`, result);
//     if (result.deletedCount === 0) {
//       return res.status(404).json({ error: 'No appointments found to delete' });
//     }
//     res.json({ message: 'Appointment(s) deleted' });
//   } catch (error) {
//     console.error(`Error deleting appointments:`, error);
//     res.status(500).json({ error: 'Failed to delete appointments' });
//   }
// });

// module.exports = router;

// FIXME: set availability change to from date and to date

// const express = require('express');
// const router = express.Router();
// const DoctorSettings = require('../models/DoctorSettings');
// const Appointment = require('../models/Appointment');
// const Coupon = require('../models/Coupon');
// const Availability = require('../models/Availability');

// // Validation helper function
// const validateFields = (fields, res) => {
//   for (const [key, value] of Object.entries(fields)) {
//     if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
//       return res.status(400).json({ error: `${key} is required` });
//     }
//   }
// };

// // Update Price
// router.post('/settings/price', async (req, res) => {
//   const { doctorId, basePrice } = req.body;
//   validateFields({ doctorId, basePrice }, res);
//   if (isNaN(basePrice) || basePrice <= 0) return res.status(400).json({ error: 'Base price must be a positive number' });
//   await DoctorSettings.updateOne({ doctorId }, { basePrice }, { upsert: true });
//   res.json({ message: 'Price updated' });
// });

// // Update Booking Message
// router.post('/settings/message', async (req, res) => {
//   const { doctorId, bookingMessage, isMessageEnabled } = req.body;
//   validateFields({ doctorId }, res);
//   if (isMessageEnabled && !bookingMessage) return res.status(400).json({ error: 'Message is required when enabled' });
//   await DoctorSettings.updateOne(
//     { doctorId },
//     { bookingMessage, isMessageEnabled },
//     { upsert: true }
//   );
//   res.json({ message: 'Message updated' });
// });

// // Get Settings (Price and Message)
// router.get('/settings', async (req, res) => {
//   const settings = await DoctorSettings.findOne({ doctorId: 'doctor1' }) || { basePrice: 1000, bookingMessage: '', isMessageEnabled: false };
//   res.json(settings);
// });

// // Generate Coupon (Personal Discount)
// router.post('/coupon', async (req, res) => {
//   const { doctorId, discountPercentage } = req.body;
//   validateFields({ doctorId, discountPercentage }, res);
//   if (isNaN(discountPercentage) || discountPercentage < 0 || discountPercentage > 100) {
//     return res.status(400).json({ error: 'Discount percentage must be between 0 and 100' });
//   }
//   const code = `DISCOUNT${discountPercentage}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
//   const coupon = new Coupon({
//     code,
//     discountPercentage,
//     validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
//     isUsed: false,
//   });
//   await coupon.save();
//   res.json({ code });
// });

// // Delete Coupon
// router.delete('/coupon/:code', async (req, res) => {
//   const { code } = req.params;
//   validateFields({ code }, res);
//   await Coupon.deleteOne({ code });
//   res.json({ message: 'Coupon deleted' });
// });

// // Get All Coupons
// router.get('/coupons', async (req, res) => {
//   const coupons = await Coupon.find({});
//   res.json(coupons);
// });

// // Set Availability (Multiple Days)
// router.post('/availability', async (req, res) => {
//   const availabilities = Array.isArray(req.body) ? req.body : [req.body];
//   for (const a of availabilities) {
//     const slotDuration = parseInt(a.slotDuration);
//     const breakDuration = parseInt(a.breakDuration);
//     const pricePerSlot = parseInt(a.pricePerSlot);
//     validateFields({
//       doctorId: a.doctorId,
//       date: a.date,
//       startTime: a.startTime,
//       endTime: a.endTime,
//       slotDuration,
//       breakDuration,
//       pricePerSlot,
//     }, res);
//     if (new Date(`2000-01-01T${a.startTime}`) >= new Date(`2000-01-01T${a.endTime}`)) {
//       return res.status(400).json({ error: 'End time must be after start time' });
//     }
//     if (isNaN(slotDuration) || slotDuration <= 0 || isNaN(breakDuration) || breakDuration < 0 || isNaN(pricePerSlot) || pricePerSlot <= 0) {
//       return res.status(400).json({ error: 'Invalid numeric values' });
//     }
//   }
//   await Availability.deleteMany({ doctorId: 'doctor1' });
//   await Availability.insertMany(availabilities.map(a => ({
//     doctorId: 'doctor1',
//     date: a.date,
//     startTime: a.startTime,
//     endTime: a.endTime,
//     slotDuration: parseInt(a.slotDuration),
//     breakDuration: parseInt(a.breakDuration),
//     pricePerSlot: parseInt(a.pricePerSlot),
//   })));
//   res.json({ message: 'Availability set' });
// });

// // Get All Availabilities
// router.get('/availability', async (req, res) => {
//   const availabilities = await Availability.find({ doctorId: 'doctor1' });
//   res.json(availabilities);
// });

// // Delete Availability
// router.delete('/availability/:id', async (req, res) => {
//   const { id } = req.params;
//   await Availability.deleteOne({ _id: id, doctorId: 'doctor1' });
//   res.json({ message: 'Availability deleted' });
// });

// // Get Available Slots for a Date
// router.get('/slots/:date', async (req, res) => {
//   const date = new Date(req.params.date);
//   const availability = await Availability.findOne({ date });

//   let startTime, endTime, slotDuration, breakDuration, pricePerSlot;
//   if (availability) {
//     startTime = availability.startTime;
//     endTime = availability.endTime;
//     slotDuration = availability.slotDuration;
//     breakDuration = availability.breakDuration;
//     pricePerSlot = availability.pricePerSlot;
//   } else {
//     startTime = '09:00';
//     endTime = '17:00';
//     slotDuration = 45;
//     breakDuration = 15;
//     const settings = await DoctorSettings.findOne({ doctorId: 'doctor1' }) || { basePrice: 1000 };
//     pricePerSlot = settings.basePrice;
//   }

//   const slots = [];
//   let currentTime = new Date(`${req.params.date}T${startTime}:00`);
//   const end = new Date(`${req.params.date}T${endTime}:00`);

//   while (currentTime < end) {
//     const slotEnd = new Date(currentTime.getTime() + slotDuration * 60000);
//     if (slotEnd <= end) {
//       const slot = {
//         time: `${currentTime.getHours()}:${currentTime.getMinutes().toString().padStart(2, '0')} - ${slotEnd.getHours()}:${slotEnd.getMinutes().toString().padStart(2, '0')}`,
//         duration: slotDuration,
//         price: (pricePerSlot / slotDuration) * slotDuration
//       };
//       slots.push(slot);
//     }
//     currentTime = new Date(slotEnd.getTime() + breakDuration * 60000);
//   }

//   const bookedAppointments = await Appointment.find({ 
//     appointmentDate: date, 
//     status: 'pending' 
//   });
//   const availableSlots = slots.filter(slot => 
//     !bookedAppointments.some(b => b.appointmentTime === slot.time)
//   );

//   res.json(availableSlots);
// });

// // Book Appointment
// // Book Appointment
// router.post('/appointment', async (req, res) => {
//   const { firstName, lastName, phone, email, appointmentDate, appointmentTime, couponCode } = req.body;
//   validateFields({ firstName, lastName, phone, email, appointmentDate, appointmentTime }, res);

//   console.log('Booking attempt:', { firstName, lastName, phone, email, appointmentDate, appointmentTime, couponCode });

//   // Determine price based on availability or default settings
//   const availability = await Availability.findOne({ date: new Date(appointmentDate) });
//   const settings = await DoctorSettings.findOne({ doctorId: 'doctor1' }) || { basePrice: 1200 };
//   let price, slotDuration;
//   if (availability) {
//     const [startHour, startMinute] = appointmentTime.split(' - ')[0].split(':').map(Number);
//     const [endHour, endMinute] = appointmentTime.split(' - ')[1].split(':').map(Number);
//     slotDuration = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
//     price = (availability.pricePerSlot / availability.slotDuration) * slotDuration;
//   } else {
//     slotDuration = 45;
//     price = settings.basePrice;
//   }

//   // Apply discount if couponCode is provided
//   if (couponCode) {
//     const coupon = await Coupon.findOne({ code: couponCode, isUsed: false });
//     if (coupon) {
//       console.log('Coupon found:', coupon);
//       price = price * (1 - coupon.discountPercentage / 100);
//       coupon.isUsed = true;
//       await coupon.save();
//     } else {
//       const now = new Date();
//       const rebooking = await Appointment.findOne({
//         rebookingCode: couponCode,
//         rebookingUsed: false,
//         email,
//         phone,
//         rebookingValidFrom: { $lte: now },
//         rebookingValidUntil: { $gte: now },
//       });
//       console.log('Re-booking check:', {
//         rebookingCode: couponCode,
//         rebookingUsed: false,
//         email,
//         phone,
//         rebookingValidFromLTE: now,
//         rebookingValidUntilGTE: now,
//         foundRebooking: rebooking ? rebooking : 'Not found'
//       });
//       if (rebooking) {
//         price = 0;
//         rebooking.rebookingUsed = true;
//         await rebooking.save();
//         console.log('Re-booking applied:', rebooking);
//       } else {
//         return res.status(400).json({ error: 'Invalid or expired re-booking code, or re-booking not yet valid' });
//       }
//     }
//   }

//   const appointment = new Appointment({
//     ...req.body,
//     price,
//     meetingLink: 'https://meet.google.com/xyz',
//     status: 'pending',
//   });
//   await appointment.save();

//   if (price > 0) {
//     const rebookingCode = `REBOOK-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
//     const [endHour, endMinute] = appointmentTime.split(' - ')[1].split(':').map(Number);
//     const validFrom = new Date(appointmentDate);
//     validFrom.setHours(endHour, endMinute, 0, 0);
//     appointment.rebookingCode = rebookingCode;
//     appointment.rebookingValidFrom = validFrom;
//     appointment.rebookingValidUntil = new Date(validFrom.getTime() + 14 * 24 * 60 * 60 * 1000);
//     await appointment.save();
//     console.log('New appointment with re-booking code:', appointment);
//   }

//   res.json({ message: 'Appointment booked', appointment });
// });
// // router.post('/appointment', async (req, res) => {
// //   const { firstName, lastName, phone, email, appointmentDate, appointmentTime, couponCode } = req.body;
// //   validateFields({ firstName, lastName, phone, email, appointmentDate, appointmentTime }, res);

// //   console.log('Booking attempt:', { firstName, lastName, phone, email, appointmentDate, appointmentTime, couponCode });

// //   // Determine price based on availability or default settings
// //   const availability = await Availability.findOne({ date: new Date(appointmentDate) });
// //   const settings = await DoctorSettings.findOne({ doctorId: 'doctor1' }) || { basePrice: 1200 }; // Updated default basePrice to 1200
// //   let price, slotDuration;
// //   if (availability) {
// //     const [startHour, startMinute] = appointmentTime.split(' - ')[0].split(':').map(Number);
// //     const [endHour, endMinute] = appointmentTime.split(' - ')[1].split(':').map(Number);
// //     slotDuration = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
// //     price = (availability.pricePerSlot / availability.slotDuration) * slotDuration;
// //   } else {
// //     slotDuration = 45;
// //     price = settings.basePrice;
// //   }

// //   // Apply discount if couponCode is provided
// //   if (couponCode) {
// //     const coupon = await Coupon.findOne({ code: couponCode, isUsed: false });
// //     if (coupon) {
// //       console.log('Coupon found:', coupon);
// //       price = price * (1 - coupon.discountPercentage / 100);
// //       coupon.isUsed = true;
// //       await coupon.save();
// //     } else {
// //       const now = new Date();
// //       const rebooking = await Appointment.findOne({
// //         rebookingCode: couponCode,
// //         rebookingUsed: false,
// //         email,
// //         phone,
// //         rebookingValidFrom: { $lte: now }, // Valid after original appointment time
// //         rebookingValidUntil: { $gte: now },
// //       });
// //       console.log('Re-booking check:', {
// //         rebookingCode: couponCode,
// //         rebookingUsed: false,
// //         email,
// //         phone,
// //         rebookingValidFromLTE: now,
// //         rebookingValidUntilGTE: now,
// //         foundRebooking: rebooking ? rebooking : 'Not found'
// //       });
// //       if (rebooking) {
// //         price = 0; // Free for valid re-booking
// //         rebooking.rebookingUsed = true;
// //         await rebooking.save();
// //         console.log('Re-booking applied:', rebooking);
// //       } else {
// //         return res.status(400).json({ error: 'Invalid or expired re-booking code, or re-booking not yet valid' });
// //       }
// //     }
// //   }

// //   const appointment = new Appointment({
// //     ...req.body,
// //     price,
// //     meetingLink: 'https://meet.google.com/xyz',
// //     status: 'pending',
// //   });
// //   await appointment.save();

// //   if (price > 0) {
// //     const rebookingCode = `REBOOK-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
// //     const [endHour, endMinute] = appointmentTime.split(' - ')[1].split(':').map(Number);
// //     const validFrom = new Date(appointmentDate);
// //     validFrom.setHours(endHour, endMinute, 0, 0);
// //     appointment.rebookingCode = rebookingCode;
// //     appointment.rebookingValidFrom = validFrom;
// //     appointment.rebookingValidUntil = new Date(validFrom.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days from validFrom
// //     await appointment.save();
// //     console.log('New appointment with re-booking code:', appointment);
// //   }

// //   res.json({ message: 'Appointment booked', appointment });
// // });

// // Get Appointments (for tabs)
// router.get('/appointments', async (req, res) => {
//   const now = new Date();
//   await Appointment.updateMany(
//     { 
//       appointmentDate: { $lte: now },
//       appointmentTime: { 
//         $regex: /^(\d{2}):(\d{2}) - (\d{2}):(\d{2})$/,
//         $lt: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
//       },
//       status: 'pending' 
//     }, 
//     { status: 'expired' }
//   );

//   const appointments = await Appointment.find({}).sort({ createdAt: -1 });
//   res.json(appointments);
// });

// // Delete Appointment(s)
// router.delete('/appointment', async (req, res) => {
//   const { ids } = req.body;
//   const idArray = Array.isArray(ids) ? ids : [ids];
//   await Appointment.deleteMany({ _id: { $in: idArray } });
//   res.json({ message: 'Appointment(s) deleted' });
// });

// module.exports = router;

// TODO: fix rebooking invalid

// const express = require('express');
// const router = express.Router();
// const DoctorSettings = require('../models/DoctorSettings');
// const Appointment = require('../models/Appointment');
// const Coupon = require('../models/Coupon');
// const Availability = require('../models/Availability');

// // Validation helper function
// const validateFields = (fields, res) => {
//   for (const [key, value] of Object.entries(fields)) {
//     if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
//       return res.status(400).json({ error: `${key} is required` });
//     }
//   }
// };

// // Update Price
// router.post('/settings/price', async (req, res) => {
//   const { doctorId, basePrice } = req.body;
//   validateFields({ doctorId, basePrice }, res);
//   if (isNaN(basePrice) || basePrice <= 0) return res.status(400).json({ error: 'Base price must be a positive number' });
//   await DoctorSettings.updateOne({ doctorId }, { basePrice }, { upsert: true });
//   res.json({ message: 'Price updated' });
// });

// // Update Booking Message
// router.post('/settings/message', async (req, res) => {
//   const { doctorId, bookingMessage, isMessageEnabled } = req.body;
//   validateFields({ doctorId }, res);
//   if (isMessageEnabled && !bookingMessage) return res.status(400).json({ error: 'Message is required when enabled' });
//   await DoctorSettings.updateOne(
//     { doctorId },
//     { bookingMessage, isMessageEnabled },
//     { upsert: true }
//   );
//   res.json({ message: 'Message updated' });
// });

// // Get Settings (Price and Message)
// router.get('/settings', async (req, res) => {
//   const settings = await DoctorSettings.findOne({ doctorId: 'doctor1' }) || { basePrice: 1000, bookingMessage: '', isMessageEnabled: false };
//   res.json(settings);
// });

// // Generate Coupon (Personal Discount)
// router.post('/coupon', async (req, res) => {
//   const { doctorId, discountPercentage } = req.body;
//   validateFields({ doctorId, discountPercentage }, res);
//   if (isNaN(discountPercentage) || discountPercentage < 0 || discountPercentage > 100) {
//     return res.status(400).json({ error: 'Discount percentage must be between 0 and 100' });
//   }
//   const code = `DISCOUNT${discountPercentage}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
//   const coupon = new Coupon({
//     code,
//     discountPercentage,
//     validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
//     isUsed: false,
//   });
//   await coupon.save();
//   res.json({ code });
// });

// // Delete Coupon
// router.delete('/coupon/:code', async (req, res) => {
//   const { code } = req.params;
//   validateFields({ code }, res);
//   await Coupon.deleteOne({ code });
//   res.json({ message: 'Coupon deleted' });
// });

// // Get All Coupons
// router.get('/coupons', async (req, res) => {
//   const coupons = await Coupon.find({});
//   res.json(coupons);
// });

// // Set Availability (Multiple Days)
// router.post('/availability', async (req, res) => {
//   const availabilities = Array.isArray(req.body) ? req.body : [req.body];
//   for (const a of availabilities) {
//     const slotDuration = parseInt(a.slotDuration);
//     const breakDuration = parseInt(a.breakDuration);
//     const pricePerSlot = parseInt(a.pricePerSlot);
//     validateFields({
//       doctorId: a.doctorId,
//       date: a.date,
//       startTime: a.startTime,
//       endTime: a.endTime,
//       slotDuration,
//       breakDuration,
//       pricePerSlot,
//     }, res);
//     if (new Date(`2000-01-01T${a.startTime}`) >= new Date(`2000-01-01T${a.endTime}`)) {
//       return res.status(400).json({ error: 'End time must be after start time' });
//     }
//     if (isNaN(slotDuration) || slotDuration <= 0 || isNaN(breakDuration) || breakDuration < 0 || isNaN(pricePerSlot) || pricePerSlot <= 0) {
//       return res.status(400).json({ error: 'Invalid numeric values' });
//     }
//   }
//   await Availability.deleteMany({ doctorId: 'doctor1' });
//   await Availability.insertMany(availabilities.map(a => ({
//     doctorId: 'doctor1',
//     date: a.date,
//     startTime: a.startTime,
//     endTime: a.endTime,
//     slotDuration: parseInt(a.slotDuration),
//     breakDuration: parseInt(a.breakDuration),
//     pricePerSlot: parseInt(a.pricePerSlot),
//   })));
//   res.json({ message: 'Availability set' });
// });

// // Get All Availabilities
// router.get('/availability', async (req, res) => {
//   const availabilities = await Availability.find({ doctorId: 'doctor1' });
//   res.json(availabilities);
// });

// // Delete Availability
// router.delete('/availability/:id', async (req, res) => {
//   const { id } = req.params;
//   await Availability.deleteOne({ _id: id, doctorId: 'doctor1' });
//   res.json({ message: 'Availability deleted' });
// });

// // Get Available Slots for a Date
// router.get('/slots/:date', async (req, res) => {
//   const availability = await Availability.findOne({ date: new Date(req.params.date) });
//   if (!availability) return res.json([]);

//   const { startTime, endTime, slotDuration, breakDuration } = availability;
//   const slots = [];
//   let currentTime = new Date(`${req.params.date}T${startTime}:00`);
//   const end = new Date(`${req.params.date}T${endTime}:00`);

//   while (currentTime < end) {
//     const slotEnd = new Date(currentTime.getTime() + slotDuration * 60000);
//     slots.push(`${currentTime.getHours()}:${currentTime.getMinutes().toString().padStart(2, '0')} - ${slotEnd.getHours()}:${slotEnd.getMinutes().toString().padStart(2, '0')}`);
//     currentTime = new Date(slotEnd.getTime() + breakDuration * 60000);
//   }

//   const bookedAppointments = await Appointment.find({ 
//     appointmentDate: new Date(req.params.date), 
//     status: 'pending' 
//   });
//   const availableSlots = slots.filter(slot => 
//     !bookedAppointments.some(b => b.appointmentTime === slot)
//   );
//   res.json(availableSlots);
// });

// // Book Appointment
// router.post('/appointment', async (req, res) => {
//   const { firstName, lastName, phone, email, appointmentDate, appointmentTime, couponCode } = req.body;
//   validateFields({ firstName, lastName, phone, email, appointmentDate, appointmentTime }, res);

//   // Determine price based on availability or default settings
//   const availability = await Availability.findOne({ date: new Date(appointmentDate) });
//   const settings = await DoctorSettings.findOne({ doctorId: 'doctor1' }) || { basePrice: 1000 };
//   let price;
//   if (availability) {
//     // Calculate price based on slot duration and pricePerSlot
//     const [startHour, startMinute] = appointmentTime.split(' - ')[0].split(':').map(Number);
//     const [endHour, endMinute] = appointmentTime.split(' - ')[1].split(':').map(Number);
//     const durationMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
//     price = (availability.pricePerSlot / availability.slotDuration) * durationMinutes;
//   } else {
//     price = settings.basePrice;
//   }

//   // Apply discount if couponCode is provided
//   if (couponCode) {
//     const coupon = await Coupon.findOne({ code: couponCode, isUsed: false });
//     if (coupon) {
//       price = price * (1 - coupon.discountPercentage / 100);
//       coupon.isUsed = true;
//       await coupon.save();
//     } else {
//       const rebooking = await Appointment.findOne({
//         rebookingCode: couponCode,
//         rebookingUsed: false,
//         email,
//         phone,
//         rebookingValidFrom: { $lte: new Date() },
//         rebookingValidUntil: { $gte: new Date() },
//       });
//       if (rebooking) {
//         price = 0; // Free for valid re-booking
//         rebooking.rebookingUsed = true;
//         await rebooking.save();
//       } else {
//         return res.status(400).json({ error: 'Invalid or expired coupon' });
//       }
//     }
//   }

//   const appointment = new Appointment({
//     ...req.body,
//     price,
//     meetingLink: 'https://meet.google.com/xyz',
//     status: 'pending', // Explicitly set to pending
//   });
//   await appointment.save();

//   if (price > 0) {
//     const rebookingCode = `REBOOK-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
//     appointment.rebookingCode = rebookingCode;
//     appointment.rebookingValidFrom = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
//     appointment.rebookingValidUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
//     await appointment.save();
//   }

//   res.json({ message: 'Appointment booked', appointment });
// });

// // Get Appointments (for tabs)
// router.get('/appointments', async (req, res) => {
//   const now = new Date();
//   await Appointment.updateMany(
//     { 
//       appointmentDate: { $lt: now }, 
//       status: 'pending' 
//     }, 
//     { status: 'expired' }
//   );

//   const appointments = await Appointment.find({}).sort({ createdAt: -1 });
//   res.json(appointments);
// });

// // Delete Appointment(s)
// router.delete('/appointment', async (req, res) => {
//   const { ids } = req.body;
//   const idArray = Array.isArray(ids) ? ids : [ids];
//   await Appointment.deleteMany({ _id: { $in: idArray } });
//   res.json({ message: 'Appointment(s) deleted' });
// });

// module.exports = router;


// FIXME:
// const express = require('express');
// const router = express.Router();
// const DoctorSettings = require('../models/DoctorSettings');
// const Appointment = require('../models/Appointment');
// const Coupon = require('../models/Coupon');
// const Availability = require('../models/Availability');

// // Update Price
// router.post('/settings/price', async (req, res) => {
//   const { doctorId, basePrice } = req.body;
//   await DoctorSettings.updateOne({ doctorId }, { basePrice }, { upsert: true });
//   res.json({ message: 'Price updated' });
// });

// // Update Booking Message
// router.post('/settings/message', async (req, res) => {
//   const { doctorId, bookingMessage, isMessageEnabled } = req.body;
//   await DoctorSettings.updateOne(
//     { doctorId },
//     { bookingMessage, isMessageEnabled },
//     { upsert: true }
//   );
//   res.json({ message: 'Message updated' });
// });

// // Generate Coupon
// router.post('/coupon', async (req, res) => {
//   const { doctorId, discountPercentage } = req.body;
//   const code = `DISCOUNT${discountPercentage}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
//   const coupon = new Coupon({
//     code,
//     discountPercentage,
//     couponType: 'personal',
//     validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
//     isUsed: false,
//   });
//   await coupon.save();
//   res.json({ code });
// });

// // Delete Coupon
// router.delete('/coupon/:code', async (req, res) => {
//   await Coupon.deleteOne({ code: req.params.code });
//   res.json({ message: 'Coupon deleted' });
// });

// // Set Availability
// router.post('/availability', async (req, res) => {
//   const { doctorId, date, startTime, endTime, slotDuration, breakDuration, pricePerSlot } = req.body;
//   const availability = new Availability({
//     doctorId,
//     date,
//     startTime,
//     endTime,
//     slotDuration,
//     breakDuration,
//     pricePerSlot,
//   });
//   await availability.save();
//   res.json({ message: 'Availability set' });
// });

// // Get Available Slots
// router.get('/slots/:date', async (req, res) => {
//   const availability = await Availability.findOne({ date: req.params.date });
//   if (!availability) return res.json([]);

//   const { startTime, endTime, slotDuration, breakDuration } = availability;
//   const slots = [];
//   let currentTime = new Date(`2025-04-06T${startTime}:00`);
//   const end = new Date(`2025-04-06T${endTime}:00`);

//   while (currentTime < end) {
//     const slotEnd = new Date(currentTime.getTime() + slotDuration * 60000);
//     slots.push(`${currentTime.getHours()}:${currentTime.getMinutes().toString().padStart(2, '0')} - ${slotEnd.getHours()}:${slotEnd.getMinutes().toString().padStart(2, '0')}`);
//     currentTime = new Date(slotEnd.getTime() + breakDuration * 60000);
//   }
//   res.json(slots);
// });

// // Book Appointment
// router.post('/appointment', async (req, res) => {
//   const { email, couponCode, appointmentDate, appointmentTime } = req.body;
//   const settings = await DoctorSettings.findOne({ doctorId: 'doctor1' }) || { basePrice: 1000 };
//   let price = settings.basePrice;

//   let rebookingCode = null;
//   if (couponCode) {
//     const coupon = await Coupon.findOne({ code: couponCode, isUsed: false });
//     if (coupon) {
//       if (coupon.couponType === 'rebooking' && coupon.patientEmail === email && new Date() >= new Date(coupon.validFrom)) {
//         price = 0;
//         coupon.isUsed = true;
//         await coupon.save();
//       } else if (coupon.couponType === 'personal') {
//         price = price * (1 - coupon.discountPercentage / 100);
//       } else {
//         return res.status(400).json({ error: 'Invalid or expired coupon' });
//       }
//     } else {
//       return res.status(400).json({ error: 'Invalid or expired coupon' });
//     }
//   }

//   const appointment = new Appointment({
//     ...req.body,
//     price,
//     meetingLink: 'https://meet.google.com/xyz',
//   });
//   await appointment.save();

//   // Generate re-booking coupon
//   if (price > 0) {
//     rebookingCode = `REBOOK-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
//     const rebookingCoupon = new Coupon({
//       code: rebookingCode,
//       couponType: 'rebooking',
//       patientEmail: email,
//       validFrom: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days later
//       validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days validity
//       isUsed: false,
//     });
//     await rebookingCoupon.save();
//   }

//   res.json({ message: 'Appointment booked', appointment, rebookingCode });
// });

// // Get Appointments (for tabs)
// router.get('/appointments', async (req, res) => {
//   const appointments = await Appointment.find({}).sort({ createdAt: -1 });
//   res.json(appointments);
// });

// module.exports = router;