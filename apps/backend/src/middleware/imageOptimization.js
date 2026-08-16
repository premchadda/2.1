import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_ROOT = path.resolve(__dirname, '..', 'uploads');

// `sharp` is a native module; load it lazily (once) so it is not required into
// the backend startup path / memory unless image transforms are actually hit.
let sharpPromise
const getSharp = async () => {
  if (!sharpPromise) sharpPromise = import('sharp').then((m) => m.default)
  return sharpPromise
}

/**
 * SECURITY FIX (H4): resolve the requested path against the uploads root and
 * reject anything that escapes it (path traversal via `..`, encoded segments,
 * or absolute paths). Returns null when the path is not safely contained.
 */
const resolveWithinUploads = (requestPath) => {
  const decoded = decodeURIComponent(requestPath);
  const resolved = path.resolve(UPLOADS_ROOT, '.' + path.posix.normalize('/' + decoded));
  if (resolved !== UPLOADS_ROOT && !resolved.startsWith(UPLOADS_ROOT + path.sep)) {
    return null;
  }
  return resolved;
};

const imageOptimization = async (req, res, next) => {
  if (!req.path.match(/\.(jpg|jpeg|png|gif)$/i)) return next();

  const width = parseInt(req.query.w) || undefined;
  const quality = parseInt(req.query.q) || 80;
  const format = req.query.format || 'webp';

  const filePath = resolveWithinUploads(req.path);
  if (!filePath) {
    return res.status(400).json({ success: false, message: 'Invalid image path' });
  }

  if (!width && format === 'webp' && req.query.format) {
    try {
      const sharp = await getSharp()
      const buffer = await sharp(filePath)
        .webp({ quality })
        .toBuffer();

      res.set('Content-Type', 'image/webp');
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(buffer);
    } catch (err) {
      return next();
    }
  }

  if (width) {
    try {
      const sharp = await getSharp()
      const pipeline = sharp(filePath).resize(width);
      
      if (format === 'webp') pipeline.webp({ quality });
      else pipeline.jpeg({ quality });
      
      const buffer = await pipeline.toBuffer();
      res.set('Content-Type', `image/${format}`);
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(buffer);
    } catch (err) {
      return next();
    }
  }

  next();
};

export default imageOptimization;