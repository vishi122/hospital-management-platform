const express = require('express');
const router = express.Router();
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * GET /doctors
 * List all registered doctors
 */
router.get('/', async (req, res, next) => {
  try {
    const { specialization, department } = req.query;
    const filter = {};
    if (specialization) filter.specialization = new RegExp(specialization, 'i');
    if (department) filter.department = new RegExp(department, 'i');

    const doctors = await Doctor.find(filter).sort({ name: 1 });
    return res.status(200).json({ count: doctors.length, doctors });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /doctors/:id/slots
 * Returns available 30-minute slots for a given doctor on a specified date (?date=YYYY-MM-DD)
 */
router.get('/:id/slots', async (req, res, next) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Doctor with ID '${req.params.id}' not found`,
      });
    }

    // Determine target date (default: tomorrow in UTC)
    let targetDateStr = req.query.date;
    let targetYear, targetMonth, targetDay;

    if (targetDateStr) {
      const parts = targetDateStr.split('-');
      if (parts.length !== 3) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Date must be formatted as YYYY-MM-DD',
        });
      }
      targetYear = parseInt(parts[0], 10);
      targetMonth = parseInt(parts[1], 10) - 1;
      targetDay = parseInt(parts[2], 10);
    } else {
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      targetYear = tomorrow.getUTCFullYear();
      targetMonth = tomorrow.getUTCMonth();
      targetDay = tomorrow.getUTCDate();
      targetDateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
    }

    // Operating hours: 09:00 to 17:00 UTC (last slot starts at 16:30)
    const allSlots = [];
    for (let hour = 9; hour < 17; hour++) {
      for (const minute of [0, 30]) {
        if (hour === 16 && minute > 30) continue;
        const slotDate = new Date(Date.UTC(targetYear, targetMonth, targetDay, hour, minute, 0, 0));
        // Only future slots
        if (slotDate.getTime() > Date.now()) {
          allSlots.push(slotDate);
        }
      }
    }

    // Query booked confirmed appointments for this doctor on this day
    const dayStart = new Date(Date.UTC(targetYear, targetMonth, targetDay, 0, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(targetYear, targetMonth, targetDay, 23, 59, 59, 999));

    const bookedAppointments = await Appointment.find({
      doctorId: doctor._id,
      status: 'confirmed',
      slotTime: { $gte: dayStart, $lte: dayEnd },
    }).select('slotTime');

    const bookedTimesSet = new Set(bookedAppointments.map((a) => a.slotTime.toISOString()));

    const slotResults = allSlots.map((slot) => {
      const iso = slot.toISOString();
      return {
        slotTime: iso,
        available: !bookedTimesSet.has(iso),
      };
    });

    return res.status(200).json({
      doctorId: doctor._id,
      doctorName: doctor.name,
      date: targetDateStr,
      workingHours: doctor.workingHours,
      slots: slotResults,
      availableCount: slotResults.filter((s) => s.available).length,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /doctors (Admin only)
 */
router.post('/', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { name, specialization, email, phone, department, workingHours } = req.body;
    if (!name || !specialization || !email) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'name, specialization, and email are required for doctors',
      });
    }

    const doctor = await Doctor.create({
      name,
      specialization,
      email,
      phone,
      department,
      workingHours,
    });

    return res.status(201).json({
      message: 'Doctor created successfully',
      doctor,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
