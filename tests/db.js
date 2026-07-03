'use strict';
const mongoose = require('mongoose');

/* Connects to the shared in-memory MongoDB started in globalSetup.js.
   Each test file connects/disconnects its own mongoose instance to the same server. */
async function connect() {
  await mongoose.connect(process.env.MONGO_URI_TEST, { serverSelectionTimeoutMS: 20000 });
}

async function clear() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

async function close() {
  await mongoose.disconnect();
}

module.exports = { connect, clear, close };
