// Helpers for classifying database / infrastructure errors.
//
// A "transient" error is one caused by temporary infrastructure unavailability
// (DNS blips, connection resets, pool timeouts, database restarts) rather than a
// genuine application/auth failure. These must NOT be treated as authentication
// failures — otherwise a momentary DB hiccup logs every user out.

// Node network / DNS error codes.
const TRANSIENT_SYSCALL_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
  'EHOSTUNREACH',
  'ENETUNREACH',
])

// PostgreSQL SQLSTATE class 08 (connection exceptions) + admin shutdown codes.
const TRANSIENT_PG_CODES = new Set([
  '08000', // connection_exception
  '08003', // connection_does_not_exist
  '08006', // connection_failure
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08004', // sqlserver_rejected_establishment_of_sqlconnection
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  '53300', // too_many_connections
])

const TRANSIENT_MESSAGE_PATTERNS = [
  /connection terminated/i,
  /connection timeout/i,
  /timeout exceeded when trying to connect/i,
  /connect etimedout/i,
  /getaddrinfo/i,
  /read econnreset/i,
  /server closed the connection/i,
  /terminating connection/i,
]

export const isTransientDbError = (err) => {
  if (!err) return false
  if (err.code && (TRANSIENT_SYSCALL_CODES.has(err.code) || TRANSIENT_PG_CODES.has(err.code))) {
    return true
  }
  const message = typeof err.message === 'string' ? err.message : ''
  return TRANSIENT_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))
}

export default isTransientDbError
