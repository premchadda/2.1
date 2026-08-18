import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SPEC_PATH = path.join(__dirname, 'openapi.json')

export function setupSwagger(app) {
  // In production, disable public Swagger docs UI for security unless explicitly opted in
  const isProduction = process.env.NODE_ENV === 'production';
  const enableInProd = process.env.ENABLE_SWAGGER_IN_PROD === 'true' || process.env.ENABLE_SWAGGER === 'true';

  if (isProduction && !enableInProd) {
    console.log('[docs] Swagger UI disabled in production mode for security (set ENABLE_SWAGGER_IN_PROD=true to enable)');
    return;
  }

  let swaggerUi
  try {
    swaggerUi = require('swagger-ui-express')
  } catch {
    console.warn(
      '[docs] swagger-ui-express is not installed — skipping /api/docs mount. ' +
        'Install it with `npm install swagger-ui-express` to enable the API docs UI.'
    )
    return
  }

  let spec
  try {
    const raw = fs.readFileSync(SPEC_PATH, 'utf8')
    spec = JSON.parse(raw)
  } catch (err) {
    console.error('[docs] Failed to read or parse openapi.json:', err.message)
    return
  }

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec))
  app.get('/api/docs.json', (req, res) => {
    res.json(spec)
  })

  console.log('[docs] OpenAPI docs mounted at /api/docs (spec also at /api/docs.json)')
}

export default setupSwagger
