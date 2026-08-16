import http from 'http'

const BACKEND_URL = process.env.VITE_BACKEND_URL || 'http://localhost:5001'
const MAX_RETRIES = 120
const RETRY_INTERVAL_MS = 1000

const parsedUrl = new URL(`${BACKEND_URL}/api/health`)

function checkBackend() {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname,
        method: 'GET',
        timeout: 3000,
      },
      (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 500)
      }
    )
    req.on('error', () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
    req.end()
  })
}

async function waitForBackend() {
  process.stdout.write('[wait-for-backend] Waiting for backend at ' + BACKEND_URL + ' ...')

  for (let i = 1; i <= MAX_RETRIES; i++) {
    const isUp = await checkBackend()
    if (isUp) {
      process.stdout.write('\n[wait-for-backend] Backend is ready! Starting frontend...\n')
      return true
    }
    if (i % 5 === 0) {
      process.stdout.write(`\n[wait-for-backend] Still waiting... (${i}/${MAX_RETRIES} attempts, ${Math.round(i * RETRY_INTERVAL_MS / 1000)}s elapsed)`)
    } else {
      process.stdout.write('.')
    }
    await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS))
  }

  process.stdout.write('\n[wait-for-backend] WARNING: Backend not ready after ' + MAX_RETRIES + 's. Starting frontend anyway (proxy will retry)...\n')
  return false
}

waitForBackend()
