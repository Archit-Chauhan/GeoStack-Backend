'use strict';
const request = require('supertest');
const app = require('../src/app');
const db = require('./db');
const { auth, bearer } = require('./factory');
const { ROLES } = require('../src/constants/roles');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

describe('RBAC on warehouses', () => {
  test('owner can create a warehouse', async () => {
    const { token } = await auth(ROLES.COMPANY_OWNER);
    const res = await request(app)
      .post('/api/v1/warehouses')
      .set(bearer(token))
      .send({ name: 'Dallas DC', code: 'DAL', location: { lat: 32.7, lng: -96.8 } });
    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('DAL');
  });

  test('analyst is read-only (403 on create, 200 on list)', async () => {
    const { token } = await auth(ROLES.ANALYST);
    const create = await request(app)
      .post('/api/v1/warehouses')
      .set(bearer(token))
      .send({ name: 'X', code: 'X1' });
    expect(create.status).toBe(403);

    const list = await request(app).get('/api/v1/warehouses').set(bearer(token));
    expect(list.status).toBe(200);
  });

  test('tenant isolation: a company cannot see another company\'s warehouses', async () => {
    const a = await auth(ROLES.COMPANY_OWNER);
    const b = await auth(ROLES.COMPANY_OWNER);
    await request(app)
      .post('/api/v1/warehouses')
      .set(bearer(a.token))
      .send({ name: 'A-WH', code: 'AWH' });

    const list = await request(app).get('/api/v1/warehouses').set(bearer(b.token));
    expect(list.status).toBe(200);
    expect(list.body.data.items).toHaveLength(0);
  });
});
