'use strict';
const request = require('supertest');
const app = require('../src/app');
const db = require('./db');
const { auth, makeWarehouse, makeProduct, bearer } = require('./factory');
const Inventory = require('../src/models/Inventory');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

async function invAt(product, warehouse) {
  return Inventory.findOne({ product: product._id, warehouse: warehouse._id });
}

describe('transfer state machine', () => {
  test('walks requested → received and moves stock correctly', async () => {
    const { company, token } = await auth();
    const from = await makeWarehouse(company, { code: 'FROM', location: { lat: 32.7, lng: -96.8 } });
    const to = await makeWarehouse(company, { code: 'TO', location: { lat: 40.7, lng: -74.1 } });
    const product = await makeProduct(company, { minStock: 5 });

    // Seed 100 units at source.
    await Inventory.create({
      company: company._id,
      product: product._id,
      locationType: 'warehouse',
      warehouse: from._id,
      available: 100,
    });

    const create = await request(app)
      .post('/api/v1/transfers')
      .set(bearer(token))
      .send({
        fromType: 'warehouse',
        from: from._id.toString(),
        toType: 'warehouse',
        to: to._id.toString(),
        items: [{ product: product._id.toString(), quantity: 20 }],
      });
    expect(create.status).toBe(201);
    expect(create.body.data.status).toBe('requested');
    expect(create.body.data.distanceKm).toBeGreaterThan(0);
    const id = create.body.data._id || create.body.data.id;

    // Illegal jump: cannot receive before dispatch/deliver.
    const illegal = await request(app).post(`/api/v1/transfers/${id}/receive`).set(bearer(token));
    expect(illegal.status).toBe(400);

    await request(app).post(`/api/v1/transfers/${id}/approve`).set(bearer(token)).expect(200);
    await request(app).post(`/api/v1/transfers/${id}/dispatch`).set(bearer(token)).expect(200);

    // After dispatch: source available down, outgoing up; dest incoming up.
    let src = await invAt(product, from);
    let dst = await invAt(product, to);
    expect(src.available).toBe(80);
    expect(src.outgoing).toBe(20);
    expect(dst.incoming).toBe(20);

    await request(app).post(`/api/v1/transfers/${id}/in-transit`).set(bearer(token)).expect(200);
    await request(app).post(`/api/v1/transfers/${id}/deliver`).set(bearer(token)).expect(200);
    const received = await request(app).post(`/api/v1/transfers/${id}/receive`).set(bearer(token));
    expect(received.status).toBe(200);
    expect(received.body.data.status).toBe('received');

    // After receive: dest available up, incoming cleared; source outgoing cleared.
    src = await invAt(product, from);
    dst = await invAt(product, to);
    expect(dst.available).toBe(20);
    expect(dst.incoming).toBe(0);
    expect(src.outgoing).toBe(0);
  });
});
