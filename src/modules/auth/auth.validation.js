'use strict';
const { z } = require('zod');

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

const register = {
  body: z.object({
    companyName: z.string().min(2).max(80),
    name: z.string().min(2).max(80),
    email: z.string().email(),
    password,
    industry: z.string().max(60).optional(),
    currency: z.string().max(8).optional(),
  }),
};

const login = {
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
};

const forgotPassword = {
  body: z.object({ email: z.string().email() }),
};

const resetPassword = {
  body: z.object({ token: z.string().min(10), password }),
};

const updateMe = {
  body: z.object({
    name: z.string().min(2).max(80).optional(),
    phone: z.string().max(30).optional(),
    avatarColor: z.string().max(9).optional(),
    currentPassword: z.string().optional(),
    newPassword: password.optional(),
  }),
};

module.exports = { register, login, forgotPassword, resetPassword, updateMe };
