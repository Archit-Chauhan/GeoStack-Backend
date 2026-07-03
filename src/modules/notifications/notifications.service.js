'use strict';
const Notification = require('../../models/Notification');
const ApiError = require('../../utils/ApiError');

/** Notifications visible to this user: addressed to them, or a company broadcast (user:null). */
function visibilityFilter(user) {
  return { company: user.company, $or: [{ user: user.id }, { user: null }] };
}

async function list(user, query) {
  const { page, limit, unread } = query;
  const filter = visibilityFilter(user);
  if (unread) filter.read = false;

  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...visibilityFilter(user), read: false }),
  ]);

  return { items, total, unreadCount };
}

async function markRead(user, id) {
  const notification = await Notification.findOne({ _id: id, ...visibilityFilter(user) });
  if (!notification) throw ApiError.notFound('Notification not found');

  if (!notification.read) {
    notification.read = true;
    await notification.save();
  }
  return notification;
}

async function markAllRead(user) {
  const filter = { ...visibilityFilter(user), read: false };
  const result = await Notification.updateMany(filter, { $set: { read: true } });
  return { modified: result.modifiedCount };
}

module.exports = { list, markRead, markAllRead };
