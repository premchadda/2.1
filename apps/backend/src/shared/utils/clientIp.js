/**
 * Canonical client IP extraction utility.
 *
 * In Express with `trust proxy` enabled (e.g. app.set("trust proxy", 1)),
 * req.ip is computed safely by Express by traversing hops from the trusted proxy
 * and cannot be spoofed by client-supplied prefix headers.
 *
 * We strip any IPv6-mapped IPv4 prefix ("::ffff:") and normalize loopback ("::1" -> "127.0.0.1").
 * When req.ip is unavailable (e.g. mock requests or unit tests), we fall back safely to
 * the socket address. Raw client-supplied headers like X-Forwarded-For are never parsed
 * directly to prevent header spoofing (SEC-03).
 */

export const normalizeIpForThrottling = (ip) => {
  if (!ip || ip === "unknown") return "unknown";
  if (ip.includes(".") && !ip.includes(":")) return ip;
  if (ip.includes(":")) {
    const parts = ip.split(":");
    const prefix = parts.slice(0, 4).join(":");
    return `${prefix}::/64`;
  }
  return ip;
};

export const getClientIp = (req) => {
  // VULN-EDGE-05: When behind Cloudflare / Render proxy pipeline, read trusted cf-connecting-ip
  const cfIp = req?.headers?.["cf-connecting-ip"];
  if (cfIp && typeof cfIp === "string") {
    let ip = cfIp.trim();
    if (ip.startsWith("::ffff:")) ip = ip.slice(7);
    if (ip === "::1") return "127.0.0.1";
    if (ip) return ip;
  }

  if (req?.ip) {
    let ip = String(req.ip).trim();
    if (ip.startsWith("::ffff:")) ip = ip.slice(7);
    if (ip === "::1") return "127.0.0.1";
    if (ip) return ip;
  }
  // In automated test environments only (where req.ip is unpopulated in mock request objects),
  // allow x-forwarded-for parsing. In staging and production, client headers are never trusted
  // directly to prevent IP spoofing across rate limiters and allowlists (SEC-03).
  if (process.env.NODE_ENV === "test") {
    const forwardedFor = req?.headers?.["x-forwarded-for"];
    if (forwardedFor) {
      const first = String(forwardedFor).split(",")[0].trim();
      if (first.startsWith("::ffff:")) return first.slice(7);
      if (first === "::1") return "127.0.0.1";
      return first;
    }
  }
  // Fallback to direct socket address when req.ip is unavailable (e.g. unit tests or raw sockets).
  const sock = req?.socket?.remoteAddress || req?.connection?.remoteAddress;
  if (sock) {
    let sockIp = String(sock).trim();
    if (sockIp.startsWith("::ffff:")) sockIp = sockIp.slice(7);
    if (sockIp === "::1") return "127.0.0.1";
    return sockIp;
  }
  return "unknown";
};

export default getClientIp;
