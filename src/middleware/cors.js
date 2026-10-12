'use strict';

const ALLOW_METHODS = 'GET, POST, OPTIONS';
const ALLOW_HEADERS = 'Content-Type, Authorization, X-Admin-Token';
const MAX_AGE = '600';

function isAllowedOrigin(origin, cfg) {
  if (!origin) return false;
  const allowed = cfg.server.corsOrigins || [];
  if (allowed.indexOf(origin) !== -1) return true;
  if (cfg.server.appUrl && cfg.server.appUrl === origin) return true;
  return false;
}

function applyCors(req, res, cfg) {
  const origin = req.headers.origin;
  if (!origin) return false;

  if (!isAllowedOrigin(origin, cfg)) {
    return false;
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', ALLOW_METHODS);
  res.setHeader('Access-Control-Allow-Headers', ALLOW_HEADERS);
  res.setHeader('Access-Control-Max-Age', MAX_AGE);
  return true;
}

module.exports = { applyCors: applyCors, isAllowedOrigin: isAllowedOrigin };
