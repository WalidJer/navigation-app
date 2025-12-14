export function rateLimit({ windowMs, max }) {
  const hits = new Map(); 

  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();

    const entry = hits.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }

    entry.count += 1;
    hits.set(key, entry);

    if (entry.count > max) {
      const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        error: { message: "Too many requests. Please slow down.", status: 429 }
      });
    }

    next();
  };
}