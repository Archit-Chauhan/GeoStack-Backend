'use strict';
require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/geostock',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  cookieSecret: process.env.COOKIE_SECRET || 'dev-cookie-secret',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    refreshTtl: process.env.JWT_REFRESH_TTL || '7d',
  },
};

config.isProd = config.env === 'production';
config.isTest = config.env === 'test';

// Fail fast in production if secrets were left at defaults.
if (config.isProd) {
  const weak = [];
  if (config.jwt.accessSecret.startsWith('dev-')) weak.push('JWT_ACCESS_SECRET');
  if (config.jwt.refreshSecret.startsWith('dev-')) weak.push('JWT_REFRESH_SECRET');
  if (config.cookieSecret.startsWith('dev-')) weak.push('COOKIE_SECRET');
  if (weak.length) {
    // eslint-disable-next-line no-console
    console.error(`[config] Refusing to start: set strong values for ${weak.join(', ')}`);
    process.exit(1);
  }
}

module.exports = config;
