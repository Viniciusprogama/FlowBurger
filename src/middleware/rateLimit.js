'use strict';

const { ApiError } = require('../utils/errors');

function createLimiter(options) {
  const opts = options || {};
  const windowMs = opts.windowMs || 60000;
  const max = opts.max || 60;
  const buckets = new Map();

  return function take(key) {
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    if (buckets.size > 5000) {
      for (const [k, v] of buckets) {
        if (now >= v.resetAt) buckets.delete(k);
      }
    }

    return {
      ok: bucket.count <= max,
      remaining: Math.max(0, max - bucket.count),
      resetAt: bucket.resetAt,
      limit: max
    };
  };
}

function clientIp(req, trustProxy) {
  if (trustProxy) {
    const xff = req.headers['x-forwarded-for'];
    if (xff) {
      const first = Array.isArray(xff) ? xff[0] : xff;
      const parts = String(first).split(',');
      if (parts[0] && parts[0].trim()) return parts[0].trim();
    }
  }
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function enforce(limiter, key, message) {
  const result = limiter(key);
  if (!result.ok) {
    const seconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    const err = new ApiError(429, message || 'Muitas requisicoes. Tente novamente em ' + seconds + 's.', 'RATE_LIMITED');
    err.retryAfterSeconds = seconds;
    throw err;
  }
  return result;
}

module.exports = { createLimiter: createLimiter, clientIp: clientIp, enforce: enforce, ApiError: ApiError };
