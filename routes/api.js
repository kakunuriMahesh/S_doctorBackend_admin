const express = require('express');
const router = express.Router();
const DoctorSettings = require('../models/DoctorSettings');
const Appointment = require('../models/Appointment');
const Coupon = require('../models/Coupon');
const Availability = require('../models/Availability');
const ServiceConfig = require('../models/ServiceConfig');
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
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied, no token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = await Admin.findById(decoded.id).select('_id email');
    if (!req.admin) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ============================================================
// AUTH ROUTES (Active)
// ============================================================

// Admin Signup
router.post('/admin/signup', async (req, res) => {
  const { email, password, confirmPassword } = req.body;
  console.log('Signup attempt:', { email });

  if (!validateFields({ email, password, confirmPassword }, res)) return;

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters with letters and numbers' });
  }

  try {
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = new Admin({ email, password: hashedPassword });
    await admin.save();

    res.status(201).json({ message: 'Admin created successfully' });
  } catch (error) {
    console.error('Signup error:', error.message);
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

// Admin Login
router.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;

  if (!validateFields({ email, password }, res)) return;

  try {
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, message: 'Login successful' });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Forgot Password
router.post('/admin/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!validateFields({ email }, res)) return;

  try {
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const resetToken = Math.random().toString(36).substr(2, 10);
    const resetTokenExpiry = new Date(Date.now() + 3600000);
    admin.resetToken = resetToken;
    admin.resetTokenExpiry = resetTokenExpiry;
    await admin.save();

    res.json({ message: 'Reset token generated', resetToken });
  } catch (error) {
    console.error('Forgot password error:', error.message);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Reset Password
router.post('/admin/reset-password', async (req, res) => {
  const { email, resetToken, newPassword, confirmPassword } = req.body;

  if (!validateFields({ email, resetToken, newPassword, confirmPassword }, res)) return;
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }
  if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(newPassword)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters with letters and numbers' });
  }

  try {
    const admin = await Admin.findOne({
      email,
      resetToken,
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!admin) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    admin.password = await bcrypt.hash(newPassword, 10);
    admin.resetToken = null;
    admin.resetTokenExpiry = null;
    await admin.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error.message);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ============================================================
// SETTINGS ROUTES (Active — Price only)
// ============================================================

// Get Settings
router.get('/settings', authenticateJWT, async (req, res) => {
  try {
    const settings = await DoctorSettings.findOne({ doctorId: 'doctor1' });
    res.json(settings || { basePrice: 1000, bookingMessage: '', isMessageEnabled: false });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update Price
router.post('/settings/price', authenticateJWT, async (req, res) => {
  const { doctorId, basePrice } = req.body;
  if (!validateFields({ doctorId, basePrice }, res)) return;
  if (isNaN(basePrice) || basePrice <= 0) {
    return res.status(400).json({ error: 'Base price must be a positive number' });
  }
  try {
    await DoctorSettings.updateOne(
      { doctorId },
      { basePrice },
      { upsert: true }
    );
    res.json({ message: 'Price updated' });
  } catch (error) {
    console.error('Error updating price:', error);
    res.status(500).json({ error: 'Failed to update price' });
  }
});

/* ===== OLD FEATURE — BOOKING MESSAGE (COMMENTED OUT) =====
router.post('/settings/message', authenticateJWT, async (req, res) => {
  const { doctorId, bookingMessage, isMessageEnabled } = req.body;
  if (!validateFields({ doctorId }, res)) return;
  if (isMessageEnabled && !bookingMessage) {
    return res.status(400).json({ error: 'Message is required when enabled' });
  }
  try {
    await DoctorSettings.updateOne(
      { doctorId },
      { bookingMessage, isMessageEnabled },
      { upsert: true }
    );
    res.json({ message: 'Message updated' });
  } catch (error) {
    console.error('Error updating message:', error);
    res.status(500).json({ error: 'Failed to update message' });
  }
});
===== END OLD FEATURE — BOOKING MESSAGE ===== */

/* ===== OLD FEATURE — COUPON ROUTES (COMMENTED OUT) =====
router.post('/coupon', authenticateJWT, async (req, res) => {
  const { doctorId, discountPercentage } = req.body;
  if (!validateFields({ doctorId, discountPercentage }, res)) return;
  if (isNaN(discountPercentage) || discountPercentage < 0 || discountPercentage > 100) {
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
    res.json({ code });
  } catch (error) {
    console.error('Error creating coupon:', error);
    res.status(500).json({ error: 'Failed to create coupon' });
  }
});

router.delete('/coupon/:code', authenticateJWT, async (req, res) => {
  const { code } = req.params;
  if (!validateFields({ code }, res)) return;
  try {
    const result = await Coupon.deleteOne({ code });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Coupon not found' });
    }
    res.json({ message: 'Coupon deleted' });
  } catch (error) {
    console.error('Error deleting coupon:', error);
    res.status(500).json({ error: 'Failed to delete coupon' });
  }
});

router.get('/coupons', authenticateJWT, async (req, res) => {
  try {
    const coupons = await Coupon.find({});
    res.json(coupons);
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
});
===== END OLD FEATURE — COUPON ROUTES ===== */

// ============================================================
// AVAILABILITY ROUTES (GET & DELETE active, POST commented out)
// ============================================================

// Create Availability
router.post('/availability', authenticateJWT, async (req, res) => {
  const { doctorId = 'doctor1', fromDate, toDate, startTime, endTime, slotDuration, breakDuration, pricePerSlot } = req.body;
  
  if (!fromDate || !toDate || !startTime || !endTime || !slotDuration || !pricePerSlot) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const slotDurationNum = parseInt(slotDuration);
  const breakDurationNum = parseInt(breakDuration || 0);
  const pricePerSlotNum = parseInt(pricePerSlot);

  if (new Date(toDate) < new Date(fromDate)) {
    return res.status(400).json({ error: 'To date must be on or after from date' });
  }
  if (new Date(`2000-01-01T${startTime}`) >= new Date(`2000-01-01T${endTime}`)) {
    return res.status(400).json({ error: 'End time must be after start time' });
  }
  if (isNaN(slotDurationNum) || slotDurationNum <= 0 || isNaN(breakDurationNum) || breakDurationNum < 0 || isNaN(pricePerSlotNum) || pricePerSlotNum <= 0) {
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
    res.json({ message: 'Availability set', availability: saved });
  } catch (error) {
    console.error('Error saving availability:', error);
    res.status(500).json({ error: 'Failed to set availability' });
  }
});

// Get All Availabilities (Active — needed for display)
router.get('/availability', authenticateJWT, async (req, res) => {
  try {
    const availabilities = await Availability.find({ doctorId: 'doctor1' }).sort({ fromDate: 1 });
    res.json(availabilities);
  } catch (error) {
    console.error('Error fetching availabilities:', error);
    res.status(500).json({ error: 'Failed to fetch availabilities' });
  }
});

// Delete Availability (Active — needed for management)
router.delete('/availability/:id', authenticateJWT, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await Availability.deleteOne({ _id: id, doctorId: 'doctor1' });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Availability not found' });
    }
    res.json({ message: 'Availability deleted' });
  } catch (error) {
    console.error('Error deleting availability:', error);
    res.status(500).json({ error: 'Failed to delete availability' });
  }
});

// Update Availability (Active — needed for editing saved availabilities)
router.put('/availability/:id', authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const { startTime, endTime, slotDuration, breakDuration, pricePerSlot } = req.body;
  try {
    const update = {};
    if (startTime) update.startTime = startTime;
    if (endTime) update.endTime = endTime;
    if (slotDuration) update.slotDuration = parseInt(slotDuration);
    if (breakDuration !== undefined) update.breakDuration = parseInt(breakDuration);
    if (pricePerSlot) update.pricePerSlot = parseInt(pricePerSlot);

    const result = await Availability.findByIdAndUpdate(id, update, { new: true });
    if (!result) {
      return res.status(404).json({ error: 'Availability not found' });
    }
    res.json({ message: 'Availability updated', availability: result });
  } catch (error) {
    console.error('Error updating availability:', error);
    res.status(500).json({ error: 'Failed to update availability' });
  }
});

// Get Available Slots for a Date (Public — used by booking form)
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
      status: { $nin: ['cancelled', 'no-show', 'expired'] },
    });
    const availableSlots = slots.filter(slot =>
      !bookedAppointments.some(b => b.appointmentTime === slot.time)
    );

    res.json(availableSlots);
  } catch (error) {
    console.error('Error fetching slots:', error);
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

// ============================================================
// APPOINTMENT ROUTES (Active)
// ============================================================

// Get All Appointments (with optional mode filter)
router.get('/appointments', authenticateJWT, async (req, res) => {
  try {
    const filter = {};
    if (req.query.mode && ['online', 'offline'].includes(req.query.mode)) {
      filter.bookingMode = req.query.mode;
    }

    const appointments = await Appointment.find(filter).sort({ createdAt: -1 });
    res.json(appointments);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Update Appointment Status
router.put('/appointment/:id/status', authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['new', 'confirmed', 'completed', 'cancelled', 'no-show', 'success'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const appointment = await Appointment.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    res.json({ message: 'Status updated', appointment });
  } catch (error) {
    console.error('Error updating appointment status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Delete Appointments
router.delete('/appointment', authenticateJWT, async (req, res) => {
  const { ids } = req.body;
  try {
    const idArray = Array.isArray(ids) ? ids : [ids];
    const result = await Appointment.deleteMany({ _id: { $in: idArray } });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'No appointments found to delete' });
    }
    res.json({ message: 'Appointment(s) deleted' });
  } catch (error) {
    console.error('Error deleting appointments:', error);
    res.status(500).json({ error: 'Failed to delete appointments' });
  }
});

/* ===== OLD FEATURE — APPOINTMENT BOOKING (COMMENTED OUT) =====
This was the admin-side booking endpoint with coupon/rebooking logic.
The new booking flow is handled by the DoctorForm component on the patient-facing site.

router.post('/appointment', authenticateJWT, async (req, res) => {
  const { firstName, lastName, phone, email, appointmentDate, appointmentTime, couponCode } = req.body;
  if (!validateFields({ firstName, lastName, phone, email, appointmentDate, appointmentTime }, res)) return;

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
        if (rebooking) {
          price = 0;
          rebooking.rebookingUsed = true;
          await rebooking.save();
        } else {
          return res.status(400).json({ error: 'Invalid or expired re-booking code' });
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
    }

    res.json({ message: 'Appointment booked', appointment: saved });
  } catch (error) {
    console.error('Error booking appointment:', error);
    res.status(500).json({ error: 'Failed to book appointment' });
  }
});
===== END OLD FEATURE — APPOINTMENT BOOKING ===== */

// ============================================================
// SERVICE CONFIG ROUTES (Active)
// ============================================================

// Get all service configs (both online & offline)
router.get('/service-configs', async (req, res) => {
  try {
    const configs = await ServiceConfig.find({}).sort({ mode: 1 });
    res.json(configs);
  } catch (error) {
    console.error('Error fetching service configs:', error);
    res.status(500).json({ error: 'Failed to fetch service configs' });
  }
});

// Get single service config by mode (online/offline)
router.get('/service-config/:mode', async (req, res) => {
  const { mode } = req.params;
  if (!['online', 'offline'].includes(mode)) {
    return res.status(400).json({ error: 'Mode must be online or offline' });
  }
  try {
    const config = await ServiceConfig.findOne({ mode });
    if (!config) {
      return res.status(404).json({ error: `No ${mode} config found` });
    }
    res.json(config);
  } catch (error) {
    console.error('Error fetching service config:', error);
    res.status(500).json({ error: 'Failed to fetch service config' });
  }
});

// Create or Update service config (upsert by mode)
router.post('/service-config', authenticateJWT, async (req, res) => {
  const { mode, timeStart, timeEnd, sessionDuration, location, services, isActive } = req.body;

  if (!mode || !['online', 'offline'].includes(mode)) {
    return res.status(400).json({ error: 'Mode must be online or offline' });
  }
  if (!timeStart || !timeEnd) {
    return res.status(400).json({ error: 'Time range is required' });
  }
  if (!services || !Array.isArray(services) || services.length === 0) {
    return res.status(400).json({ error: 'At least one service is required' });
  }

  // Validate each service has name and price
  for (const svc of services) {
    if (!svc.name || svc.price === undefined || svc.price === null) {
      return res.status(400).json({ error: 'Each service must have a name and price' });
    }
  }

  try {
    const config = await ServiceConfig.findOneAndUpdate(
      { mode },
      {
        mode,
        timeStart,
        timeEnd,
        sessionDuration: sessionDuration || 45,
        location: location || '',
        services,
        isActive: isActive !== undefined ? isActive : true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ message: `${mode} config saved`, config });
  } catch (error) {
    console.error('Error saving service config:', error);
    res.status(500).json({ error: 'Failed to save service config' });
  }
});

// Update a single service within a config
router.put('/service-config/:mode/service/:serviceId', authenticateJWT, async (req, res) => {
  const { mode, serviceId } = req.params;
  const { name, price, isActive } = req.body;

  try {
    const config = await ServiceConfig.findOne({ mode });
    if (!config) {
      return res.status(404).json({ error: 'Config not found' });
    }

    const service = config.services.id(serviceId);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    if (name !== undefined) service.name = name;
    if (price !== undefined) service.price = price;
    if (isActive !== undefined) service.isActive = isActive;

    await config.save();
    res.json({ message: 'Service updated', config });
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

// Delete a service from a config
router.delete('/service-config/:mode/service/:serviceId', authenticateJWT, async (req, res) => {
  const { mode, serviceId } = req.params;

  try {
    const config = await ServiceConfig.findOne({ mode });
    if (!config) {
      return res.status(404).json({ error: 'Config not found' });
    }

    config.services = config.services.filter(s => s._id.toString() !== serviceId);
    await config.save();
    res.json({ message: 'Service deleted', config });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

// Delete entire service config
router.delete('/service-config/:mode', authenticateJWT, async (req, res) => {
  const { mode } = req.params;
  try {
    const result = await ServiceConfig.deleteOne({ mode });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Config not found' });
    }
    res.json({ message: `${mode} config deleted` });
  } catch (error) {
    console.error('Error deleting service config:', error);
    res.status(500).json({ error: 'Failed to delete service config' });
  }
});

module.exports = router;