// Shared helpers for API integration tests. Each test creates its own data with
// unique emails, so tests never depend on each other or on seed data.
const crypto = require('crypto');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../app');
const prisma = require('../utils/prisma');

const PASSWORD = 'Correct-Horse-42';
let passwordHash;

const uid = () => crypto.randomBytes(4).toString('hex');

async function createUser(role = 'STUDENT', extra = {}) {
  // cost 4 keeps tests fast; production hashing uses cost 12 (see utils/password.js)
  passwordHash = passwordHash || (await bcrypt.hash(PASSWORD, 4));
  const id = uid();
  return prisma.user.create({
    data: {
      name: `${role.toLowerCase()} ${id}`,
      email: `${role.toLowerCase()}.${id}@test.pes.edu`,
      srn: role === 'STUDENT' ? `PES1UG24T${id}` : null,
      passwordHash,
      role,
      ...extra,
    },
  });
}

async function login(user) {
  const res = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.accessToken;
}

async function asUser(role = 'STUDENT', extra = {}) {
  const user = await createUser(role, extra);
  return { user, token: await login(user) };
}

const refreshCookie = (res) =>
  (res.headers['set-cookie'] || []).find((c) => c.startsWith('sams_rt='))?.split(';')[0];

module.exports = { app, prisma, request, PASSWORD, uid, createUser, login, asUser, refreshCookie };
