export interface Logger {
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  log: (...args: any[]) => void;
}

declare const logger: Logger;
// Named export mirrors `export const logger` in logger.js. Required because
// index.d.ts forwards this module via `export *`, which does NOT forward
// default exports — a bare `export default` would make `{ logger }` untyped.
export { logger };
export default logger;
