const { app, prisma, request, asUser } = require('./helpers');

afterAll(async () => {
  await prisma.$disconnect();
  await require('../utils/redis').quit();
});

describe('[FR-13] Audit log viewer', () => {
  test('admins can search by actor and action; results are newest first', async () => {
    const { user: admin, token } = await asUser('ADMIN');
    const res = await request(app)
      .get('/api/v1/audit-logs')
      .query({ actor: admin.email, action: 'LOGIN_SUCCESS' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0]).toMatchObject({ action: 'LOGIN_SUCCESS', actor: { email: admin.email } });
    expect(res.body.actions).toContain('LOGIN_SUCCESS');
  });

  test('non-admins cannot read the audit log, and the attempt is itself logged (SR-02)', async () => {
    const { user, token } = await asUser('FACULTY');
    const res = await request(app).get('/api/v1/audit-logs').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    await new Promise((r) => setTimeout(r, 100));
    expect(await prisma.auditLog.count({ where: { actorId: user.id, action: 'ACCESS_DENIED' } })).toBe(1);
  });

  test('TC-17: PATCH and DELETE on audit entries return 405 and change nothing', async () => {
    const { user: admin, token } = await asUser('ADMIN');
    const entry = await prisma.auditLog.findFirst({ where: { actorId: admin.id } });
    const patch = await request(app).patch(`/api/v1/audit-logs/${entry.id}`).set('Authorization', `Bearer ${token}`).send({ action: 'X' });
    const del = await request(app).delete(`/api/v1/audit-logs/${entry.id}`).set('Authorization', `Bearer ${token}`);
    expect(patch.status).toBe(405);
    expect(del.status).toBe(405);
    expect((await prisma.auditLog.findUnique({ where: { id: entry.id } })).action).toBe(entry.action);
  });

  test('invalid date filters are rejected', async () => {
    const { token } = await asUser('ADMIN');
    const res = await request(app).get('/api/v1/audit-logs').query({ from: 'yesterday' }).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('[NFR-03] Health check', () => {
  test('reports database and Redis status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.checks).toEqual({ database: 'ok', redis: 'ok' });
  });
});
