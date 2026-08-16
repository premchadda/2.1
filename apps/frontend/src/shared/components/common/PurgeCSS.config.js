export default {
  content: [
    './src/**/*.{js,jsx}',
    './index.html'
  ],
  safelist: {
    standard: [
      'animate-pulse',
      'animate-spin',
      'animate-bounce',
      'opacity-0',
      'opacity-50',
      'opacity-100',
    ],
    deep: [
      /^bg-/,
      /^text-/,
      /^border-/,
      /^shadow-/,
    ]
  },
  theme: {
    extend: {}
  },
  plugins: []
};