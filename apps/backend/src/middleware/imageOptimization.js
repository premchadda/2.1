import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_ROOT = path.resolve(__dirname, '..', '..', 'uploads');

// `sharp` is a native module; load it lazily (once) so it is not required into
// the backend startup path / memory unless image transforms are actually hit.
let sharpPromise = null
const getSharp = async () => {
  if (!sharpPromise) {
    sharpPromise = import('sharp').then((m) => m.default).catch((err) => {
      sharpPromise = null
      throw err
    })
  }
  return sharpPromise
}

/**
 * SECURITY FIX (H4): resolve the requested path against the uploads root and
 * reject anything that escapes it (path traversal via `..`, encoded segments,
 * or absolute paths). Returns null when the path is not safely contained.
 */
const resolveWithinUploads = (requestPath) => {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return { error: "malformed" };
  }
  const resolved = path.resolve(UPLOADS_ROOT, '.' + path.posix.normalize('/' + decoded));
  if (resolved !== UPLOADS_ROOT && !resolved.startsWith(UPLOADS_ROOT + path.sep)) {
    return null;
  }
  return resolved;
};

const imageOptimization = async (req, res, next) => {
  if (!req.path.match(/\.(jpg|jpeg|png|gif)$/i)) return next();

  // Cap requested width at 1200px to bound CPU/memory per transform.
  // Guard: non-positive w is ignored (serve original) instead of clamping to 1.
  const rawWidth = parseInt(req.query.w, 10) || undefined;
  const width = rawWidth && rawWidth > 0 ? Math.min(rawWidth, 1200) : undefined;
  // Clamp quality to 1-100 (parseInt || 80, then min/max).
  const parsedQuality = parseInt(req.query.q, 10) || 80;
  const quality = Math.min(Math.max(parsedQuality, 1), 100);
  const requestedFormat = String(req.query.format || 'webp').toLowerCase();
  const normalizedFormat = requestedFormat === 'jpg' ? 'jpeg' : requestedFormat;
  const format = ['webp', 'jpeg', 'png'].includes(normalizedFormat) ? normalizedFormat : 'webp';

  const filePath = resolveWithinUploads(req.path);
  if (filePath && filePath.error === "malformed") {
    return res.status(400).json({ success: false, message: 'Malformed image path encoding' });
  }
  if (!filePath) {
    return res.status(400).json({ success: false, message: 'Invalid image path' });
  }

  if (!width && format === 'webp' && req.query.format) {
    try {
      // Input cap: bound decompression work per transform (default sharp
      // limit is ~268M px; 50M px still covers 8K-class images).
      // NOTE: sharp exposes no timeout option — transforms are CPU-bound and
      // bounded by the width cap (1200px) + this pixel cap instead.
      // NOTE (gif): sharp processes only the first frame (animated gifs are
      // flattened to a single frame) — documented, no code change.
      const sharp = await getSharp()
      const buffer = await sharp(filePath, { limitInputPixels: 50_000_000 })
        .webp({ quality })
        .toBuffer();

      res.set('Content-Type', 'image/webp');
      // Vary on the transform query so shared caches key transformed
      // variants separately from the original file bytes.
      res.set('Vary', 'Accept, Accept-Encoding');
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(buffer);
    } catch (err) {
      sharpPromise = null;
      return next();
    }
  }

  if (width) {
    try {
      const sharp = await getSharp()
      // Same input cap as above (see NOTE on timeout/gif there).
      const pipeline = sharp(filePath, { limitInputPixels: 50_000_000 }).resize(width);
      
      if (format === 'webp') pipeline.webp({ quality });
      else if (format === 'png') pipeline.png({ quality });
      else pipeline.jpeg({ quality });
      
      const buffer = await pipeline.toBuffer();
      res.set('Content-Type', `image/${format}`);
      res.set('Vary', 'Accept, Accept-Encoding');
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(buffer);
    } catch (err) {
      sharpPromise = null;
      return next();
    }
  }

  next();
};

export default imageOptimization;