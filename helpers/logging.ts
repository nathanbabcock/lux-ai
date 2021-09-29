import { appendFileSync, unlinkSync } from 'fs'

const LOG_FILE = '../../replays/log.txt'

export function clearLog() {
  try {
    unlinkSync(LOG_FILE)
  } catch (e) {}
}

export function log(...messages: any[]) {
  appendFileSync(LOG_FILE, `${messages.join(' ')}\n`)
}
