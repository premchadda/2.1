import { generateCsrfToken } from '../middleware/csrf.middleware.js';

describe('CSRF token generator', () => {
  test('should generate a 64-character hex string', () => {
    const token = generateCsrfToken();
    expect(typeof token).toBe('string');
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });
});
