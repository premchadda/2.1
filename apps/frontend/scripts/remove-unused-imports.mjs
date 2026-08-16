// scripts/remove-unused-imports.mjs
// Parses ESLint output and removes unused import specifiers from source files.
// Usage: node scripts/remove-unused-imports.mjs

import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'

// Run eslint and capture output
let output
try {
  output = execSync('npx eslint src/ --no-error-on-unmatched-pattern --no-eslintrc --config eslint.config.js 2>&1', {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 5 * 1024 * 1024,
    timeout: 120000
  })
} catch (err) {
  // eslint exits non-zero when warnings found
  output = err.stdout || err.stderr || ''
}

// Parse: E:\...\File.jsx\n  4:50  warning  'Clock' is defined but never used.
const fileWarnings = {} // { filePath: [ { line, col, name, kind } ] }
const lines = output.split('\n')
let currentFile = ''

for (const line of lines) {
  // File path line (starts with drive letter or /)
  const fileMatch = line.match(/^([A-Z]:\\.+\.jsx?)$/)
  if (fileMatch) {
    currentFile = fileMatch[1]
    continue
  }

  // Warning line
  const warnMatch = line.match(/^\s+(\d+):(\d+)\s+warning\s+'(\w+)'\s+is\s+(defined|assigned)\s+but\s+never\s+used/)
  if (warnMatch && currentFile) {
    const [, lineNum, col, name, kind] = warnMatch
    if (!fileWarnings[currentFile]) fileWarnings[currentFile] = []
    fileWarnings[currentFile].push({
      line: parseInt(lineNum),
      col: parseInt(col),
      name,
      kind // 'defined' = unused import, 'assigned' = unused variable
    })
  }
}

let totalFixed = 0
let filesModified = 0

for (const [filePath, warnings] of Object.entries(fileWarnings)) {
  // Only fix unused imports (kind=defined), not unused variables
  const importWarnings = warnings.filter(w => w.kind === 'defined')
  if (importWarnings.length === 0) continue

  let content
  try {
    content = readFileSync(filePath, 'utf8')
  } catch {
    continue
  }
  const originalContent = content

  const unusedNames = new Set(importWarnings.map(w => w.name))

  // Process line by line, fixing import statements
  const fileLines = content.split('\n')
  const modifiedLines = []

  for (let i = 0; i < fileLines.length; i++) {
    const lineNum = i + 1
    const fileLine = fileLines[i]

    // Check if this line has any unused import warnings
    const lineWarnings = importWarnings.filter(w => w.line === lineNum)
    if (lineWarnings.length === 0) {
      modifiedLines.push(fileLine)
      continue
    }

    // This line has unused imports — fix it
    let line = fileLine
    const namesOnThisLine = lineWarnings.map(w => w.name)

    for (const name of namesOnThisLine) {
      // Try to remove from named import: { Clock, Star } → { Star }
      const namedImportRegex = new RegExp(`\\b${name}\\s*(?:,\\s*)?|(?:,\\s*)${name}\\b`, 'g')
      // First try: name with trailing comma
      let replaced = line.replace(new RegExp(`\\b${name}\\s*,\\s*`), '')
      if (replaced !== line) { line = replaced; continue }
      // Second try: name with leading comma  
      replaced = line.replace(new RegExp(`,\\s*\\b${name}\\b`), '')
      if (replaced !== line) { line = replaced; continue }
      // Third try: name only (last remaining specifier)
      replaced = line.replace(new RegExp(`\\b${name}\\b`), '')
      if (replaced !== line) { line = replaced; continue }
    }

    // Check if the import statement is now empty
    // Pattern: import { } from '...' or import React from '...' where React is removed
    const emptyNamedImport = line.match(/^import\s*\{\s*\}\s*from\s*/)
    const emptyDefaultImport = line.match(/^import\s+\w+\s+from\s*/)

    if (emptyNamedImport) {
      // Remove the entire empty import line
      totalFixed++
      filesModified++
      continue // skip this line entirely
    }

    // Check if we removed a default import entirely
    if (namesOnThisLine.some(name => {
      const defaultImportPattern = new RegExp(`^import\\s+${name}\\s+from\\s`)
      return defaultImportPattern.test(fileLine)
    })) {
      totalFixed++
      filesModified++
      continue // skip this line
    }

    if (line !== fileLine) {
      // Clean up: remove empty braces or trailing commas in destructured imports
      line = line.replace(/\{\s*,\s*/g, '{ ')
      line = line.replace(/,\s*\}/g, ' }')
      line = line.replace(/\{\s*\}/g, '{}')
      
      totalFixed += namesOnThisLine.length
      modifiedLines.push(line)
    } else {
      modifiedLines.push(fileLine)
    }
  }

  const newContent = modifiedLines.join('\n')
  if (newContent !== originalContent) {
    writeFileSync(filePath, newContent, 'utf8')
    filesModified++
    console.log(`Fixed ${filePath}: ${importWarnings.length} unused imports removed`)
  }
}

console.log(`\nDone: ${totalFixed} unused imports removed from ${filesModified} files`)
