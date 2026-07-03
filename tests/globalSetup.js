'use strict';
const { MongoMemoryServer } = require('mongodb-memory-server');

/* Start ONE in-memory MongoDB for the whole test run (started before workers fork,
   so MONGO_URI_TEST is inherited by every test file). */
module.exports = async function globalSetup() {
  const mongo = await MongoMemoryServer.create();
  globalThis.__MONGO__ = mongo;
  process.env.MONGO_URI_TEST = mongo.getUri();
};
