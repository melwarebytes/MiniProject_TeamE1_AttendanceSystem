const { parse } = require('csv-parse/sync');
const crypto = require('crypto');
const prisma = require('../utils/prisma');
const { badRequest, notFound } = require('../utils/errors');
const { checkPasswordPolicy, hashPassword } = require('../utils/password');
const { recordAuditLog } = require('./auditService');
const publicFields = {
  id: true,
  name: true,
  email: true,
  role: true,
  srn: true,
  department: true,
  active: true,
};

function validateUser(input, existing) {
  const data = {};
  for (const key of Object.keys(input)) {
    if (!['name', 'email', 'role', 'srn', 'department', 'active', 'password'].includes(key))
      throw badRequest(`Unknown field: ${key}`);
  }
  for (const key of ['name', 'email', 'role', 'srn', 'department']) {
    if (input[key] !== undefined) {
      if (typeof input[key] !== 'string' || input[key].length > 254) throw badRequest(`Invalid ${key}`);
      data[key] = input[key].trim();
    }
  }
  if (data.email) data.email = data.email.toLowerCase();
  const merged = { ...existing, ...data };
  if (!merged.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(merged.email || ''))
    throw badRequest('Name and a valid email are required.');
  const domain = process.env.INSTITUTION_EMAIL_DOMAIN || 'pes.edu';
  if (!merged.email.endsWith(`@${domain}`)) throw badRequest(`Email must end with @${domain}.`);
  if (!['STUDENT', 'FACULTY'].includes(merged.role)) throw badRequest('Role must be STUDENT or FACULTY.');
  if (existing && data.role && data.role !== existing.role)
    throw badRequest('Role changes are not supported; deactivate and create the correct account.');
  if (merged.role === 'STUDENT' && !merged.srn) throw badRequest('SRN is required for students.');
  if (input.active !== undefined) {
    if (typeof input.active !== 'boolean') throw badRequest('active must be a boolean.');
    data.active = input.active;
  }
  if (input.password !== undefined) {
    const error = checkPasswordPolicy(input.password);
    if (error) throw badRequest(error);
  }
  if (data.srn === '') data.srn = null;
  return data;
}

async function saveUser(input, id, actor, ip, initialPasswordHash) {
  const existing = id ? await prisma.user.findUnique({ where: { id } }) : null;
  if (id && !existing) throw notFound('User not found.');
  if (existing?.anonymizedAt) throw badRequest('Anonymised accounts cannot be reactivated or edited.');
  const data = validateUser(input, existing);
  // Without a supplied password, a random unknown credential requires the normal reset flow.
  if (input.password) data.passwordHash = await hashPassword(input.password);
  else if (!existing)
    data.passwordHash =
      initialPasswordHash || (await hashPassword(crypto.randomBytes(32).toString('base64url')));
  return prisma.$transaction(async (tx) => {
    const user = id
      ? await tx.user.update({ where: { id }, data, select: publicFields })
      : await tx.user.create({ data, select: publicFields });
    if (input.active === false || input.password)
      await tx.refreshToken.deleteMany({ where: { userId: user.id } });
    await recordAuditLog({
      actorId: actor.id,
      action: id ? 'USER_UPDATED' : 'USER_CREATED',
      entity: 'users',
      entityId: user.id,
      oldValue: existing ? { role: existing.role, active: existing.active } : null,
      newValue: {
        role: user.role,
        active: user.active,
        changedFields: Object.keys(input).filter((k) => k !== 'password'),
      },
      ip,
      tx,
    });
    return user;
  });
}

async function importUsers(buffer, actor, ip) {
  let rows;
  try {
    rows = parse(buffer, {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      trim: true,
      info: true,
      relax_column_count: true,
      max_record_size: 4096,
    });
  } catch (_error) {
    throw badRequest('Malformed CSV. Check quoting and delimiters.');
  }
  if (rows.length > 5000) throw badRequest('CSV may contain at most 5,000 data rows.');
  if (!rows.length) throw badRequest('CSV contains no data rows.');
  const headers = rows[0].info.columns.map((c) => c.name);
  if (
    new Set(headers).size !== headers.length ||
    !['name', 'email', 'role'].every((k) => headers.includes(k))
  )
    throw badRequest('CSV needs unique name, email and role headers.');
  // A discarded random batch credential is unknowable; password reset is required.
  // Hash it once so importing 5,000 passwordless accounts does not block for minutes.
  const initialPasswordHash = await hashPassword(crypto.randomBytes(32).toString('base64url'));
  const report = { imported: 0, rejected: 0, errors: [] };
  for (const { record, info } of rows) {
    try {
      if (info.error) throw badRequest('Row has a different number of columns than the header.');
      if (record.active !== undefined) {
        if (!['true', 'false'].includes(record.active)) throw badRequest('active must be true or false.');
        record.active = record.active === 'true';
      }
      if (record.password === '') delete record.password;
      validateUser(record);
      const existing = await prisma.user.findUnique({ where: { email: String(record.email).toLowerCase() } });
      await saveUser(record, existing?.id, actor, ip, initialPasswordHash);
      report.imported++;
    } catch (error) {
      if (!error.status && error.code !== 'P2002') throw error;
      report.rejected++;
      report.errors.push({
        row: info.lines,
        reason: error.code === 'P2002' ? 'Email or SRN already exists.' : error.message,
      });
    }
  }
  return report;
}
module.exports = { saveUser, importUsers, publicFields };
