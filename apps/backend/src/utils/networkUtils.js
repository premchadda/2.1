/**
 * Network and IP extraction utilities
 */

export function getClientIp(req) {
  if (!req) return "127.0.0.1";
  if (req.ip) {
    let ip = String(req.ip).trim();
    if (ip.startsWith("::ffff:")) ip = ip.slice(7);
    if (ip === "::1") return "127.0.0.1";
    if (ip) return ip;
  }
  const forwarded = req.headers?.["x-forwarded-for"];
  if (forwarded) {
    const first = String(forwarded).split(",")[0].trim();
    if (first.startsWith("::ffff:")) return first.slice(7);
    return first;
  }
  return (
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    req.ip ||
    "127.0.0.1"
  );
}

export default {
  getClientIp,
};
