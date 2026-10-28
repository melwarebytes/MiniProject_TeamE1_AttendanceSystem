const { badRequest } = require('./errors');
function dateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw badRequest('Dates must use YYYY-MM-DD.');
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== value)
    throw badRequest('Invalid calendar date.');
  return date;
}
function text(value, label, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw badRequest(`${label} is required (maximum ${max} characters).`);
  return value.trim();
}
function ids(value) {
  if (
    !Array.isArray(value) ||
    value.length > 5000 ||
    value.some((v) => typeof v !== 'string' || v.length > 100) ||
    new Set(value).size !== value.length
  )
    throw badRequest('Expected a list of unique user IDs (maximum 5,000).');
  return value;
}
function page(query) {
  const page = Number(query.page || 1),
    size = Number(query.size || 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(size) || size < 1 || size > 100)
    throw badRequest('Invalid pagination.');
  return { page, size, skip: (page - 1) * size };
}
module.exports = { dateOnly, text, ids, page };
