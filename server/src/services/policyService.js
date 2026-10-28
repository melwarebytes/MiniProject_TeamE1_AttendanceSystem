const prisma = require('../utils/prisma');
const { badRequest } = require('../utils/errors');
const { recordAuditLog } = require('./auditService');
const defaults = { attendanceThreshold: 75, editWindowHours: 48, qrWindowMinutes: 5 };
const { dateOnly } = require('../utils/input');
async function getPolicy(tx = prisma) {
  const policy = await tx.policy.findUnique({ where: { id: 'institution' } });
  const holidays = await tx.holiday.findMany({ where: { sectionId: null }, orderBy: { date: 'asc' } });
  return { ...(policy || defaults), holidays: holidays.map(h => ({ date: h.date.toISOString().slice(0, 10), reason: h.reason || '' })) };
}
async function setPolicy(input, actor, ip) {
  const keys = [...Object.keys(defaults), 'holidays'];
  if (Object.keys(input).some(k => !keys.includes(k))) throw badRequest('Unknown policy field.');
  const data = {};
  for (const [key, min, max, integer] of [['attendanceThreshold', 50, 100, false], ['editWindowHours', 0, 168, true], ['qrWindowMinutes', 1, 10, true]]) {
    if (typeof input[key] !== 'number' || !Number.isFinite(input[key]) || input[key] < min || input[key] > max || (integer && !Number.isInteger(input[key]))) throw badRequest(`${key} must be ${min}–${max}${integer ? ' (integer)' : ''}.`);
    data[key] = input[key];
  }
  if (!Array.isArray(input.holidays) || input.holidays.length > 366) throw badRequest('holidays must contain at most 366 dates.');
  const holidays = input.holidays.map(h => ({ date: dateOnly(h.date), reason: typeof h.reason === 'string' ? h.reason.slice(0, 200) : '' }));
  if (new Set(holidays.map(h => +h.date)).size !== holidays.length) throw badRequest('Holiday dates must be unique.');
  return prisma.$transaction(async tx => {
    // Serialise updates so the audit oldValue always describes the preceding policy.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(14001)`;
    const oldValue = await getPolicy(tx);
    await tx.policy.upsert({ where: { id: 'institution' }, create: data, update: data });
    await tx.section.updateMany({ data });
    await tx.holiday.deleteMany({ where: { sectionId: null } });
    await tx.holiday.createMany({ data: holidays });
    const newValue = await getPolicy(tx);
    await recordAuditLog({ actorId: actor.id, action: 'POLICY_UPDATED', entity: 'policies', entityId: 'institution', oldValue, newValue, ip, tx });
    return newValue;
  });
}
module.exports = { getPolicy, setPolicy, defaults };
