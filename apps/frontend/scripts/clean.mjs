import { rmSync, existsSync } from 'fs'

const targets = ['dist', 'node_modules/.vite']
for (const dir of targets) {
  if (existsSync(dir)) {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch (err) {
      console.error('Failed to remove', dir, err.message)
    }
  }
}
console.log('Clean completed.')
