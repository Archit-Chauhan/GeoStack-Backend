'use strict';
const request = require('supertest');
const app = require('../src/app');
const db = require('./db');
const { auth, makeWarehouse, makeProduct, bearer } = require('./factory');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

describe('inventory adjust', () => {
  test('applies positive and negative deltas and blocks going negative', async () => {
    const { company, token } = await auth();
    const wh = await makeWarehouse(company);
    const product = await makeProduct(company, { minStock: 10 });

    const base = {
      product: product._id.toString(),
      locationType: 'warehouse',
      warehouse: wh._id.toString(),
      field: 'available',
    };

    const up = await request(app)
      .post('/api/v1/inventory/adjust')
      .set(bearer(token))
      .send({ ...base, delta: 100 });
    expect(up.status).toBe(200);
    expect(up.body.data.available).toBe(100);

    const down = await request(app)
      .post('/api/v1/inventory/adjust')
      .set(bearer(token))
      .send({ ...base, delta: -30 });
    expect(down.status).toBe(200);
    expect(down.body.data.available).toBe(70);

    const negative = await request(app)
      .post('/api/v1/inventory/adjust')
      .set(bearer(token))
      .send({ ...base, delta: -1000 });
    expect(negative.status).toBe(400);
  });

  test('writes an audit log on adjust', async () => {
    const { company, token } = await auth();
    const wh = await makeWarehouse(company);
    const product = await makeProduct(company);
    await request(app)
      .post('/api/v1/inventory/adjust')
      .set(bearer(token))
      .send({
        product: product._id.toString(),
        locationType: 'warehouse',
        warehouse: wh._id.toString(),
        field: 'available',
        delta: 50,
      });

    const AuditLog = require('../src/models/AuditLog');
    const logs = await AuditLog.find({ company: company._id, action: 'inventory.adjust' });
    expect(logs.length).toBeGreaterThan(0);
  });
});
