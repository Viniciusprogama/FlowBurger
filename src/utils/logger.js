'use strict';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

const SECRET_KEY_RE = /secret|token|password|passwd|authorization|signature|client_id|cpf|document/i;

function redact(value, depth) {
  if (depth === undefined) depth = 0;
  if (value === null || value === undefined) return value;
  if (depth > 4) return '[deep]';
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) {
      if (SECRET_KEY_RE.test(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = redact(value[key], depth + 1);
      }
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 500) return value.slice(0, 500) + '...';
  return value;
}

function serialize(args) {
  return args
    .map((a) => {
      if (typeof a === 'string') return a;
      if (a instanceof Error) return a.stack || a.message;
      try {
        return JSON.stringify(redact(a));
      } catch (e) {
        return String(a);
      }
    })
    .join(' ');
}

function createLogger(levelName) {
  const threshold = LEVELS[levelName] || LEVELS.info;

  function log(level, args) {
    if (LEVELS[level] < threshold) return;
    const line = '[flow] ' + level.toUpperCase() + ' ' + serialize(args);
    if (level === 'error') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  }

  return {
    debug: (...args) => log('debug', args),
    info: (...args) => log('info', args),
    warn: (...args) => log('warn', args),
    error: (...args) => log('error', args),
    redact: redact
  };
}

module.exports = { createLogger: createLogger, redact: redact };
