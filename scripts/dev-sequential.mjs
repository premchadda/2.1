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

let backendExited = false
let backendExitCode = null

async function waitForBackendReady() {
  console.log(`[dev:seq] ⏳ Step 1/3: Waiting for backend to initialize at ${HEALTH_URL}...`)
  let attempts = 0
  const maxAttempts = 60
  while (attempts < maxAttempts) {
    if (backendExited) {
      throw new Error(`trstprep-backend exited prematurely with code ${backendExitCode}. Aborting startup.`)
    }
    attempts++
    const ready = await checkHealth()
    if (ready) {
      console.log(`\n[dev:seq] ✅ Backend is up and healthy!\n`)
      return
    }
    if (attempts % 5 === 0) {
      process.stdout.write(`\n[dev:seq] Backend initializing... (${attempts}s)`)
    } else {
      process.stdout.write('.')
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`Timed out after ${maxAttempts}s waiting for backend at ${HEALTH_URL}`)
}

const processes = []

function spawnProcess(name, shellCommand) {
  console.log(`[dev:seq] 🚀 Starting ${name}...`)
  // Command strings are our own constants (workspace filter names), never
  // user input, so spawning via shell without a separate args array avoids
  // Node's DEP0190 (args + shell:true) deprecation warning.
  const child = spawn(shellCommand, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true,
  })
  processes.push(child)
  child.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.log(`[dev:seq] ${name} exited with code ${code}`)
    }
    if (name === 'trstprep-backend') {
      backendExited = true
      backendExitCode = code
    }
  })
  return child
}

const pkgMgr = (process.env.npm_config_user_agent?.includes('pnpm') || process.env.npm_execpath?.includes('pnpm')) ? 'pnpm' : 'npm'

async function main() {
  // Step 1: Start backend
  spawnProcess('trstprep-backend', `${pkgMgr} --filter trstprep-backend run dev`)

  // Step 2: Wait for backend health check
  await waitForBackendReady()

  // Step 3: Start frontend
  console.log(`[dev:seq] ⏳ Step 2/3: Launching frontend...`)
  spawnProcess('trstprep-frontend', `${pkgMgr} --filter trstprep-frontend run dev`)
  
  // Wait 2 seconds before launching admin panel
  await new Promise((r) => setTimeout(r, 2000))

  // Step 4: Start admin panel
  console.log(`[dev:seq] ⏳ Step 3/3: Launching admin panel...`)
  spawnProcess('trstprep-admin', `${pkgMgr} --filter trstprep-admin run dev`)
}

function cleanup() {
  console.log('\n[dev:seq] Shutting down all processes...')
  processes.forEach((proc) => {
    if (proc && proc.pid) {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/F', '/T', '/PID', proc.pid.toString()], { stdio: 'ignore' })
        } else {
          proc.kill('SIGINT')
        }
      } catch {}
    }
  })
  setTimeout(() => process.exit(0), 500)
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

main().catch((err) => {
  console.error('[dev:seq] Error:', err)
  cleanup()
})
