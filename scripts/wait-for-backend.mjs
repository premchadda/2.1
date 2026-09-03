import http from 'http'

const BACKEND_URL = process.env.VITE_BACKEND_URL || 'http://localhost:5001'
const MAX_RETRIES = 120
const RETRY_INTERVAL_MS = 1000

const parsedUrl = new URL(`${BACKEND_URL}/api/health`)

async function checkBackend() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/health`, { signal: AbortSignal.timeout(2000) })
    return res.status >= 200 && res.status < 500
  } catch {
    try {
      const fallbackUrl = BACKEND_URL.replace('localhost', '127.0.0.1')
      const res = await fetch(`${fallbackUrl}/api/health`, { signal: AbortSignal.timeout(2000) })
      return res.status >= 200 && res.status < 500
    } catch {
      return false
    }
  }
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
