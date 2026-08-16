import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

// Note: Tailwind v3 already purges unused classes via its JIT engine based on
// the `content` globs in tailwind.config.js. Running @fullhuman/postcss-purgecss
// on top of that was double-purging and dropping arbitrary-value classes
// (e.g. `bg-[#ff0000]`) and dynamic-string classes. Removed per Phase 1.9.

const plugins = [tailwindcss, autoprefixer]

export default { plugins }
