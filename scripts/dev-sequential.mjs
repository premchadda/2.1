import { spawn } from 'child_process'
import http from 'http'

const BACKEND_URL = process.env.VITE_BACKEND_URL || 'http://localhost:5001'
const HEALTH_URL = `${BACKEND_URL}/api/health`

function checkHealth() {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(HEALTH_URL)
      const req = http.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          path: parsedUrl.pathname,
          method: 'GET',
          timeout: 3000,
        },
        (res) => resolve(res.statusCode >= 200 && res.statusCode < 500)
      )
      req.on('error', () => resolve(false))
      req.on('timeout', () => {
        req.destroy()
        resolve(false)
      })
      req.end()
    } catch {
      resolve(false)
    }
  })
}

async function waitForBackendReady() {
  console.log(`[dev:seq] ⏳ Step 1/3: Waiting for backend to initialize at ${HEALTH_URL}...`)
  let attempts = 0
  while (true) {
    attempts++
    const ready = await checkHealth()
    if (ready) {
      console.log(`\n[dev:seq] ✅ Backend is up and healthy!\n`)
      break
    }
    if (attempts % 5 === 0) {
      process.stdout.write(`\n[dev:seq] Backend initializing... (${attempts}s)`)
    } else {
      process.stdout.write('.')
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
}

const processes = []

function spawnProcess(name, command, args) {
  console.log(`[dev:seq] 🚀 Starting ${name}...`)
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true,
  })
  processes.push(child)
  child.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.log(`[dev:seq] ${name} exited with code ${code}`)
    }
  })
  return child
}

const pkgMgr = (process.env.npm_config_user_agent?.includes('pnpm') || process.env.npm_execpath?.includes('pnpm')) ? 'pnpm' : 'npm'

async function main() {
  // Step 1: Start backend
  spawnProcess('trstprep-backend', pkgMgr, ['run', 'dev:backend'])

  // Step 2: Wait for backend health check
  await waitForBackendReady()

  // Step 3: Start frontend
  console.log(`[dev:seq] ⏳ Step 2/3: Launching frontend...`)
  spawnProcess('trstprep-frontend', pkgMgr, ['run', 'dev:frontend'])
  
  // Wait 3 seconds before launching admin panel
  await new Promise((r) => setTimeout(r, 3000))

  // Step 4: Start admin panel
  console.log(`[dev:seq] ⏳ Step 3/3: Launching admin panel...`)
  spawnProcess('trstprep-admin', pkgMgr, ['run', 'dev:admin'])
}

function cleanup() {
  console.log('\n[dev:seq] Shutting down all processes...')
  processes.forEach((proc) => {
    if (proc && !proc.killed) {
      try {
        proc.kill('SIGINT')
      } catch {}
    }
  })
  process.exit(0)
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

main().catch((err) => {
  console.error('[dev:seq] Error:', err)
  cleanup()
})
