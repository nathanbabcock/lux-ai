const ChromeLauncher = require('chrome-launcher')

async function main() {
  // copyFileSync('./replays/replay.json', '../Lux-Viewer-2021/dist')
  const url = 'http://localhost:8080/'
  await ChromeLauncher.launch({
    startingUrl: url,
    chromeFlags: [`--app=${url}`],
  })
}

main()