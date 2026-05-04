#!/usr/bin/env node
/**
 * Documentation watch script.
 * Watches for changes in documentation and triggers updates.
 * Can be extended to:
 *   - Watch markdown/files for changes
 *   - Rebuild documentation on changes
 *   - Live reload for documentation development
 */

const chokidar = require('chokidar');
const { execSync } = require('child_process');
const path = require('path');

console.log('Starting documentation watcher...');

const docsPath = path.join(__dirname, '..', '..', 'docs');
const watcher = chokidar.watch(docsPath, {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true,
  ignoreInitial: true
});

function onChange(event, filePath) {
  console.log(`File ${event}: ${filePath}`);
  // Run docs update script when documentation changes
  try {
    execSync('npm run docs', { stdio: 'inherit' });
  } catch (error) {
    console.error('Error running docs update:', error.message);
  }
}

watcher
  .on('add', (filePath) => onChange('added', filePath))
  .on('change', (filePath) => onChange('changed', filePath))
  .on('unlink', (filePath) => onChange('removed', filePath));

console.log(`Watching ${docsPath} for changes...`);