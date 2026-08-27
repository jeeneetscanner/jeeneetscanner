// GET /api/usage — returns { used, limit } for the requesting device, without
// incrementing the counter. Used by the app's Settings panel.

const { getUsage } = require('./_lib/quota');

module.exports = async (req, res) => {
  const deviceId = req.headers['x-device-id'];
  const usage = await getUsage(deviceId);
  res.status(200).json(usage);
};
