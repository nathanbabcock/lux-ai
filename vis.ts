const ChromeLauncher = require('chrome-launcher')
const handler = require('serve-handler')
import { ChildProcess } from 'child_process'
import { copyFileSync } from 'fs'
import { createServer } from 'http'

const port = 8080

function runServer() {
  createServer((req, res) => handler(req, res, { public: '../Lux-Viewer-2021/dist' })).listen(port)
  console.log(`Temporary Lux-AI-Vis HTTP server running on port ${port}`)
}

function copyReplay() {
  let from = './replays/replay.json'
  let to = '../Lux-Viewer-2021/dist/replay.json'

  if (process.argv.length >= 3)
    from = process.argv[2]

  try {
    copyFileSync(from, to)
    console.log(`Copied from ${from} to ${to}`)
  } catch (err) {
    console.error(err)
  }
}

async function launchChrome() {
  const url = `http://localhost:${port}/`
  const chrome = await ChromeLauncher.launch({
    startingUrl: url,
    chromeFlags: [`--app=${url}`],
  })
  const childProcess = chrome.process as ChildProcess
  childProcess.on('exit', () => process.exit(0))
}

async function main() {
  copyReplay()
  runServer()
  await launchChrome()
}

main()