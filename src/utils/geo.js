'use strict';

/** Haversine great-circle distance in kilometres between two {lat,lng} points. */
function haversineKm(a, b) {
  if (!a || !b) return 0;
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad((b.lat || 0) - (a.lat || 0));
  const dLng = toRad((b.lng || 0) - (a.lng || 0));
  const lat1 = toRad(a.lat || 0);
  const lat2 = toRad(b.lat || 0);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Rough road ETA in hours assuming ~58 km/h average incl. stops. */
function etaHours(distanceKm, avgSpeedKmh = 58) {
  if (!distanceKm) return 0;
  return Math.round((distanceKm / avgSpeedKmh) * 10) / 10;
}

module.exports = { haversineKm, etaHours };
