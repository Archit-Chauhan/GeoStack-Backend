'use strict';
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const config = require('./config');
const apiRouter = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

// Behind Render/Vercel proxies — needed for correct req.ip + secure cookies.
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(config.cookieSecret));
if (!config.isTest) app.use(morgan(config.isProd ? 'combined' : 'dev'));

app.get('/', (_req, res) => res.json({ success: true, message: 'GeoStock API', data: { docs: '/api/v1/health' } }));
app.use('/api/v1', apiRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
