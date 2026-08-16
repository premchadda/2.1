// Generate PWA PNG icons from favicon.svg using sharp.
// Run: node scripts/generate-icons.mjs
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svgPath = resolve(__dirname, '../public/favicon.svg')
const outDir = resolve(__dirname, '../public/icons')

const svgBuffer = readFileSync(svgPath)

const sizes = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 192, name: 'icon-192-maskable.png', padding: 0.15 },
  { size: 512, name: 'icon-512-maskable.png', padding: 0.15 },
  { size: 180, name: 'apple-touch-icon.png' },
]

for (const { size, name, padding } of sizes) {
  const img = sharp(svgBuffer).resize(size, size)
  if (padding) {
    // For maskable icons, add padding so the safe zone is respected
    const bg = sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 99, g: 102, b: 241, alpha: 1 }, // brand-500
      },
    })
    const inner = await img.png().toBuffer()
    await bg.composite([{ input: inner, gravity: 'center' }]).png().toFile(resolve(outDir, name))
  } else {
    await img.png().toFile(resolve(outDir, name))
  }
  console.log(`Generated ${name} (${size}x${size})`)
}

console.log('All icons generated.')
