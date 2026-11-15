const AuditEvent = require('../models/AuditEvent');
const { logger } = require('../logger');

/**
 * Record an audit event into MongoDB
 * @param {Object} params
 * @param {string} params.who - User identifier (ID, email)
 * @param {string} params.role - User role
 * @param {'LOGIN'|'CREATE_APPOINTMENT'|'RESCHEDULE_APPOINTMENT'|'CANCEL_APPOINTMENT'} params.action
 * @param {'User'|'Appointment'|'Doctor'} params.entity
 * @param {string} params.entityId
 * @param {Object} [params.details]
 * @param {string} [params.ipAddress]
 */
async function recordAudit({ who, role, action, entity, entityId, details = {}, ipAddress = '' }) {
  try {
    const event = await AuditEvent.create({
      who: String(who),
      role: role || 'anonymous',
      action,
      entity,
      entityId: String(entityId),
      details,
      ipAddress,
      timestamp: new Date(),
    });
    return event;
  } catch (err) {
    // Log error but do not disrupt main transaction unless critical
    logger.error({ err, action, entity, entityId }, 'Failed to record audit event');
  }
}

module.exports = {
  recordAudit,
};
