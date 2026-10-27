const bcrypt = require('bcryptjs');

// SR-01: bcrypt with cost factor 12.
const BCRYPT_COST = 12;

// A short list of the most common breached passwords. Extend as needed.
const BREACHED = new Set([
  '123456', '123456789', '12345678', 'password', 'qwerty123', 'qwerty', '1234567890', '111111',
  '1234567', 'password1', '123123', 'abc123', 'iloveyou', 'password123', 'admin123', 'welcome1',
  'letmein', 'monkey', 'dragon', 'football', 'baseball', 'sunshine', 'princess', 'qwertyuiop',
  'passw0rd', 'p@ssw0rd', 'p@ssword1', 'password@123', 'welcome123', 'india@123', 'student123',
  'pesuniversity', 'changeme123', 'administrator', 'qwerty@123', '1q2w3e4r5t', 'zaq12wsx',
]);

/** Returns an error message, or null if the password meets the policy. */
function checkPasswordPolicy(password) {
  if (typeof password !== 'string' || password.length < 10) {
    return 'Password must be at least 10 characters long.';
  }
  if (password.length > 128) return 'Password must be at most 128 characters long.';
  if (BREACHED.has(password.toLowerCase())) {
    return 'This password appears in lists of breached passwords. Choose another.';
  }
  return null;
}

const hashPassword = (password) => bcrypt.hash(password, BCRYPT_COST);
const verifyPassword = (password, hash) => bcrypt.compare(password, hash);

module.exports = { checkPasswordPolicy, hashPassword, verifyPassword, BCRYPT_COST };
