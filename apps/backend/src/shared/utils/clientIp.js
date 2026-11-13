/**
 * Canonical client IP extraction utility.
 *
 * In Express with `trust proxy` enabled (e.g. app.set("trust proxy", 1)),
 * req.ip is computed safely by Express by traversing hops from the trusted proxy
 * and cannot be spoofed by client-supplied prefix headers.
 *
 * We strip any IPv6-mapped IPv4 prefix ("::ffff:") and normalize loopback ("::1" -> "127.0.0.1").
 * When req.ip is unavailable (e.g. mock requests or unit tests), we fall back safely to
 * the socket address, or in non-production environments to x-forwarded-for.
 */

export const getClientIp = (req) => {
  if (req?.ip) {
    let ip = String(req.ip).trim();
    if (ip.startsWith("::ffff:")) ip = ip.slice(7);
    if (ip === "::1") return "127.0.0.1";
    if (ip) return ip;
  }
  // In non-production only, allow X-Forwarded-For fallback if req.ip is unset
  if (process.env.NODE_ENV !== "production") {
    const forwardedFor = req?.headers?.["x-forwarded-for"];
    if (forwardedFor) {
      const first = String(forwardedFor).split(",")[0].trim();
      if (first.startsWith("::ffff:")) return first.slice(7);
      if (first === "::1") return "127.0.0.1";
      return first;
    }
  }
  const sock = req?.socket?.remoteAddress || req?.connection?.remoteAddress;
  if (sock) {
    if (sock.startsWith("::ffff:")) return sock.slice(7);
    if (sock === "::1") return "127.0.0.1";
    return sock;
  }
  return "unknown";
};

export default getClientIp;
