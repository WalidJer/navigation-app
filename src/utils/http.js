export function sendError(res, status, message) {
  return res.status(status).json({ error: { message, status } });
}