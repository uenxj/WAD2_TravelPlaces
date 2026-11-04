// Real Express routes and JSON-file store; deterministic exchange rates for E2E tests.
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { createApp } = require('../../server/src/app.js')
const { createStore } = require('../../server/src/store.js')
const directory = mkdtempSync(join(tmpdir(), 'travel-budget-e2e-'))
const server = createApp({
  store: createStore(join(directory, 'db.json')),
  rates: { async getRate(from, to) { return { from, to, rate: from === to ? 1 : 0.01, date: '2026-10-29', stale: false } } },
}).listen(3100, '127.0.0.1')
function cleanup() { server.close(() => { rmSync(directory, { recursive: true, force: true }); process.exit(0) }) }
process.on('SIGTERM', cleanup)
process.on('SIGINT', cleanup)
