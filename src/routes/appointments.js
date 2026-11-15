const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { validateSlotTime } = require('../services/slotValidator');
const { recordAudit } = require('../services/auditService');
const { appointmentCounter } = require('../metrics');
const { logger } = require('../logger');

// All appointment endpoints require authentication
router.use(authenticate);

/**
 * Helper to check whether patient user owns the appointment
 */
function verifyPatientOwnership(req, res, targetPatientId) {
  if (req.user.role === 'patient') {
    if (targetPatientId.toString() !== req.user.id) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Patients can only view or modify their own appointments',
      });
      return false;
    }
  }
  return true;
}

/**
 * POST /appointments
 * Book a new doctor appointment
 * Body: { doctorId, slotTime, patientId?, reason? }
 */
router.post('/', async (req, res, next) => {
  try {
    const { doctorId, slotTime, reason, notes } = req.body;
    let patientId = req.body.patientId;

    // RBAC: Patient can only book for themselves
    if (req.user.role === 'patient') {
      if (patientId && patientId !== req.user.id) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Patients are not permitted to book appointments on behalf of other patients',
        });
      }
      patientId = req.user.id;
    } else {
      // Admin / doctor can specify patientId, or fallback to current user
      if (!patientId) {
        patientId = req.user.id;
      }
    }

    // Validate ID formats
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid doctorId format',
      });
    }
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid patientId format',
      });
    }

    // Validate Doctor existence
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Doctor with ID '${doctorId}' does not exist`,
      });
    }

    // Validate Patient existence
    const patient = await User.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Patient with ID '${patientId}' does not exist`,
      });
    }

    // Validate slot time window and alignment
    const slotValidation = validateSlotTime(slotTime);
    if (!slotValidation.valid) {
      return res.status(400).json({
        error: 'Bad Request',
        message: slotValidation.error,
      });
    }

    // Attempt to create appointment
    // Relies on MongoDB partial unique index { doctorId: 1, slotTime: 1, status: "confirmed" }
    try {
      const appointment = await Appointment.create({
        patientId,
        doctorId,
        slotTime: slotValidation.date,
        status: 'confirmed',
        reason: reason || 'Routine Consultation',
        notes,
      });

      // Record audit event
      await recordAudit({
        who: req.user.email,
        role: req.user.role,
        action: 'CREATE_APPOINTMENT',
        entity: 'Appointment',
        entityId: appointment._id.toString(),
        details: {
          doctorId,
          patientId,
          slotTime: slotValidation.date.toISOString(),
        },
        ipAddress: req.ip || '',
      });

      appointmentCounter.inc({ action: 'booked', status: 'success' });

      return res.status(201).json({
        message: 'Appointment booked successfully',
        appointment,
      });
    } catch (createErr) {
      if (createErr.code === 11000) {
        appointmentCounter.inc({ action: 'booked', status: 'conflict' });
        logger.warn(
          { doctorId, slotTime: slotValidation.date.toISOString() },
          'Appointment booking collision caught by unique index'
        );
        return res.status(409).json({
          error: 'Conflict',
          code: 'SLOT_ALREADY_BOOKED',
          message: 'The requested doctor already has a confirmed appointment at this slot time.',
        });
      }
      throw createErr;
    }
  } catch (err) {
    next(err);
  }
});

/**
 * GET /appointments
 * List appointments with role-based filtering
 */
router.get('/', async (req, res, next) => {
  try {
    const filter = {};

    // Patient sees only their own appointments
    if (req.user.role === 'patient') {
      filter.patientId = req.user.id;
    } else if (req.user.role === 'doctor') {
      // If doctor user is linked to a Doctor profile, filter by doctorId
      const linkedDoctor = await Doctor.findOne({
        $or: [{ userId: req.user.id }, { email: req.user.email }],
      });
      if (linkedDoctor) {
        filter.doctorId = linkedDoctor._id;
      }
    } else if (req.user.role === 'admin') {
      if (req.query.patientId) filter.patientId = req.query.patientId;
      if (req.query.doctorId) filter.doctorId = req.query.doctorId;
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const appointments = await Appointment.find(filter)
      .populate('doctorId', 'name specialization email department')
      .populate('patientId', 'name email')
      .sort({ slotTime: 1 });

    return res.status(200).json({
      count: appointments.length,
      appointments,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /appointments/:id
 * Retrieve a specific appointment
 */
router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid appointment ID' });
    }

    const appointment = await Appointment.findById(req.params.id)
      .populate('doctorId', 'name specialization email department')
      .populate('patientId', 'name email');

    if (!appointment) {
      return res.status(404).json({ error: 'Not Found', message: 'Appointment not found' });
    }

    // RBAC: Patient can only view their own
    if (!verifyPatientOwnership(req, res, appointment.patientId._id || appointment.patientId)) {
      return;
    }

    return res.status(200).json({ appointment });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /appointments/:id/reschedule
 * Reschedule appointment to a new slot time
 * Body: { slotTime }
 */
router.put('/:id/reschedule', async (req, res, next) => {
  try {
    const { slotTime } = req.body;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid appointment ID' });
    }

    const existingAppointment = await Appointment.findById(req.params.id);
    if (!existingAppointment) {
      return res.status(404).json({ error: 'Not Found', message: 'Appointment not found' });
    }

    // RBAC: Patient can only reschedule their own appointment
    if (!verifyPatientOwnership(req, res, existingAppointment.patientId)) {
      return;
    }

    if (existingAppointment.status !== 'confirmed') {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Cannot reschedule appointment with status '${existingAppointment.status}'. Only confirmed appointments can be rescheduled.`,
      });
    }

    // Validate new slot time
    const slotValidation = validateSlotTime(slotTime);
    if (!slotValidation.valid) {
      return res.status(400).json({
        error: 'Bad Request',
        message: slotValidation.error,
      });
    }

    // Atomic update using findOneAndUpdate to respect partial unique index
    try {
      const updated = await Appointment.findOneAndUpdate(
        { _id: req.params.id, status: 'confirmed' },
        { $set: { slotTime: slotValidation.date } },
        { new: true, runValidators: true }
      );

      if (!updated) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Appointment was cancelled or not found during update',
        });
      }

      // Record audit event
      await recordAudit({
        who: req.user.email,
        role: req.user.role,
        action: 'RESCHEDULE_APPOINTMENT',
        entity: 'Appointment',
        entityId: updated._id.toString(),
        details: {
          previousSlotTime: existingAppointment.slotTime.toISOString(),
          newSlotTime: slotValidation.date.toISOString(),
          doctorId: updated.doctorId,
        },
        ipAddress: req.ip || '',
      });

      appointmentCounter.inc({ action: 'rescheduled', status: 'success' });

      return res.status(200).json({
        message: 'Appointment rescheduled successfully',
        appointment: updated,
      });
    } catch (updateErr) {
      if (updateErr.code === 11000) {
        appointmentCounter.inc({ action: 'rescheduled', status: 'conflict' });
        return res.status(409).json({
          error: 'Conflict',
          code: 'SLOT_ALREADY_BOOKED',
          message: 'The requested doctor already has a confirmed appointment at this slot time.',
        });
      }
      throw updateErr;
    }
  } catch (err) {
    next(err);
  }
});

/**
 * POST /appointments/:id/cancel
 * Cancel an appointment
 */
router.post('/:id/cancel', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid appointment ID' });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ error: 'Not Found', message: 'Appointment not found' });
    }

    // RBAC: Patient can only cancel their own appointment
    if (!verifyPatientOwnership(req, res, appointment.patientId)) {
      return;
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Appointment is already cancelled',
      });
    }

    appointment.status = 'cancelled';
    await appointment.save();

    // Record audit event
    await recordAudit({
      who: req.user.email,
      role: req.user.role,
      action: 'CANCEL_APPOINTMENT',
      entity: 'Appointment',
      entityId: appointment._id.toString(),
      details: {
        slotTime: appointment.slotTime.toISOString(),
        doctorId: appointment.doctorId,
      },
      ipAddress: req.ip || '',
    });

    appointmentCounter.inc({ action: 'cancelled', status: 'success' });

    return res.status(200).json({
      message: 'Appointment cancelled successfully',
      appointment,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
