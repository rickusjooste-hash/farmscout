// Runs before every `next build` — stamps a new cache name into sw.js
// so the browser always detects a new service worker after deployment.
const fs = require('fs')
const path = require('path')

const swPath = path.join(__dirname, '..', 'public', 'sw.js')
let content = fs.readFileSync(swPath, 'utf8')
const newVersion = `farmscout-${Date.now()}`
content = content.replace(/const CACHE_NAME = 'farmscout-[^']*'/, `const CACHE_NAME = '${newVersion}'`)
fs.writeFileSync(swPath, content)
console.log(`[sw] Cache version → ${newVersion}`)
