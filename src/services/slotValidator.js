/**
 * Validates appointment slot time:
 * 1. Must be a valid date
 * 2. Must be in the future
 * 3. Must be aligned to 30-minute boundaries (minutes: 00 or 30, seconds: 00, ms: 000)
 * 4. Must fall within working hours (09:00 to 17:00 UTC, last appointment slot is 16:30)
 *
 * @param {string|Date} slotTimeInput
 * @returns {{ valid: boolean, date?: Date, error?: string }}
 */
function validateSlotTime(slotTimeInput) {
  if (!slotTimeInput) {
    return { valid: false, error: 'slotTime is required' };
  }

  const slotDate = new Date(slotTimeInput);
  if (isNaN(slotDate.getTime())) {
    return { valid: false, error: 'slotTime must be a valid ISO 8601 date string' };
  }

  // 1. Future time check
  const now = new Date();
  if (slotDate.getTime() <= now.getTime()) {
    return {
      valid: false,
      error: 'Appointment slotTime must be in the future',
    };
  }

  // 2. Alignment to 30-minute slots (:00 or :30, 0 seconds, 0 ms)
  const minutes = slotDate.getUTCMinutes();
  const seconds = slotDate.getUTCSeconds();
  const ms = slotDate.getUTCMilliseconds();

  if ((minutes !== 0 && minutes !== 30) || seconds !== 0 || ms !== 0) {
    return {
      valid: false,
      error:
        'Appointment slotTime must be aligned to 30-minute slots (:00 or :30 minutes, 0 seconds)',
    };
  }

  // 3. Operating hours: 09:00 to 17:00 UTC (last 30-minute appointment starts at 16:30 UTC)
  const hours = slotDate.getUTCHours();
  if (hours < 9 || hours > 16 || (hours === 16 && minutes > 30)) {
    return {
      valid: false,
      error: `Appointment slotTime must be within operating hours (09:00 - 17:00 UTC). Slot start time ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} UTC is outside allowable window.`,
    };
  }

  return { valid: true, date: slotDate };
}

module.exports = {
  validateSlotTime,
};
