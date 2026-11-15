const mongoose = require('mongoose');

const auditEventSchema = new mongoose.Schema(
  {
    who: {
      type: String,
      required: [true, 'Audited user identity is required'],
      index: true,
    },
    role: {
      type: String,
      default: 'anonymous',
    },
    action: {
      type: String,
      required: [true, 'Audit action is required'],
      enum: ['LOGIN', 'CREATE_APPOINTMENT', 'RESCHEDULE_APPOINTMENT', 'CANCEL_APPOINTMENT'],
      index: true,
    },
    entity: {
      type: String,
      required: [true, 'Audit entity type is required'],
      enum: ['User', 'Appointment', 'Doctor'],
      index: true,
    },
    entityId: {
      type: String,
      required: [true, 'Audit entity ID is required'],
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

module.exports = mongoose.model('AuditEvent', auditEventSchema);
