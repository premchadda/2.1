import compression from 'compression';

// SEC: Compression can no longer be disabled by a client-supplied
// `x-no-compression` header. The built-in filter already disables
// compression for clients that don't advertise gzip support via
// `Accept-Encoding`; we rely on that and never trust a client header.
const compressionMiddleware = compression({
  level: 6,
  threshold: 1024,
});

export default compressionMiddleware;
