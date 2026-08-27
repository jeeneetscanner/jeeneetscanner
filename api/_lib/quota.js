// Lightweight daily-quota tracker using Upstash Redis's REST API (no SDK needed).
// Free tier: https://upstash.com — create a Redis DB, copy the REST URL + token into
// your deployment's environment variables (UPSTASH_REDIS_REST_URL / _TOKEN).

const DAILY_LIMIT = parseInt(process.env.DAILY_AI_LIMIT || '15', 10);

function todayKey(deviceId) {
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  return `jee:usage:${deviceId}:${day}`;
}

async function redis(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null; // quota tracking disabled if not configured
  const res = await fetch(`${url}/${command.join('/')}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.result;
}

/**
 * Checks and increments today's usage count for a device.
 * Returns { allowed, used, limit }.
 * If Redis isn't configured, quota checking is skipped (allowed=true) so local
 * dev works without setting it up — but you should configure it before shipping.
 */
async function checkAndIncrement(deviceId) {
  const limit = DAILY_LIMIT;
  if (!deviceId) return { allowed: false, used: 0, limit, error: 'missing device id' };

  const key = todayKey(deviceId);
  const current = await redis(['GET', key]);

  if (current === null) {
    // Redis not configured — allow through without tracking.
    if (!process.env.UPSTASH_REDIS_REST_URL) {
      return { allowed: true, used: 0, limit };
    }
  }

  const used = current ? parseInt(current, 10) : 0;
  if (used >= limit) {
    return { allowed: false, used, limit };
  }

  const newVal = await redis(['INCR', key]);
  // Set a 2-day expiry the first time this key is created, so old counters clean themselves up.
  if (newVal === 1) {
    await redis(['EXPIRE', key, '172800']);
  }
  return { allowed: true, used: (newVal || used + 1), limit };
}

async function getUsage(deviceId) {
  const limit = DAILY_LIMIT;
  if (!deviceId) return { used: 0, limit };
  const key = todayKey(deviceId);
  const current = await redis(['GET', key]);
  return { used: current ? parseInt(current, 10) : 0, limit };
}

module.exports = { checkAndIncrement, getUsage, DAILY_LIMIT };
