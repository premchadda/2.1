/**
 * Network and IP extraction utilities
 */

export function getClientIp(req) {
  if (!req) return '127.0.0.1';
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.connection?.remoteAddress || req.ip || '127.0.0.1';
}

export default {
  getClientIp
};
