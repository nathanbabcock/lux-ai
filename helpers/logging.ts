import { appendFileSync, unlinkSync } from 'fs'

const LOG_FILE = '../../replays/log.txt'

export function clearLog() {
  unlinkSync(LOG_FILE)
}

export function log(...messages: any[]) {
  appendFileSync(LOG_FILE, `${messages.join(' ')}\n`)
}