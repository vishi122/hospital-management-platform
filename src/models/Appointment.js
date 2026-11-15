const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient ID is required'],
      index: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: [true, 'Doctor ID is required'],
      index: true,
    },
    slotTime: {
      type: Date,
      required: [true, 'Slot time is required'],
    },
    status: {
      type: String,
      enum: ['confirmed', 'cancelled', 'completed'],
      default: 'confirmed',
      index: true,
    },
    reason: {
      type: String,
      default: 'Routine Consultation',
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// CRITICAL: Partial unique index enforcing that no two CONFIRMED appointments
// can exist for the same doctor at the same slotTime.
// Cancelled or completed appointments do NOT block subsequent bookings.
appointmentSchema.index(
  { doctorId: 1, slotTime: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'confirmed' },
    name: 'unique_confirmed_doctor_slot',
  }
);

module.exports = mongoose.model('Appointment', appointmentSchema);
