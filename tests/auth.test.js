'use strict';
const request = require('supertest');
const app = require('../src/app');
const db = require('./db');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

const validReg = {
  companyName: 'Northwind',
  name: 'Owner One',
  email: 'owner@northwind.co',
  password: 'Demo1234!',
};

describe('auth', () => {
  test('registers a company + owner and returns an access token', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(validReg);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.role).toBe('company_owner');
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  test('rejects a weak password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validReg, password: 'weak' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('rejects duplicate email', async () => {
    await request(app).post('/api/v1/auth/register').send(validReg);
    const res = await request(app).post('/api/v1/auth/register').send(validReg);
    expect(res.status).toBe(409);
  });

  test('logs in with correct credentials and rejects wrong password', async () => {
    await request(app).post('/api/v1/auth/register').send(validReg);

    const good = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validReg.email, password: validReg.password });
    expect(good.status).toBe(200);
    expect(good.body.data.accessToken).toBeTruthy();

    const bad = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validReg.email, password: 'wrongpass1' });
    expect(bad.status).toBe(401);
  });

  test('GET /auth/me requires a token and returns the user', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(validReg);
    const token = reg.body.data.accessToken;

    const noAuth = await request(app).get('/api/v1/auth/me');
    expect(noAuth.status).toBe(401);

    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(validReg.email);
  });
});
