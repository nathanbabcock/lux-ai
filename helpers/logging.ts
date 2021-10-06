import { appendFileSync, unlinkSync } from 'fs'

const LOG_FILE = '../../replays/log.txt'

export function clearLog() {
  try {
    unlinkSync(LOG_FILE)
  } catch (e) {
    // If the log file or folder doesn't exist, nothing needs to be done
  }
}

export function log(...messages: any[]) {
  try {
    appendFileSync(LOG_FILE, `${messages.join(' ')}\n`)
  } catch (e) {
    // If the log folder doesn't exist, fail silently
    // This is the case on Kaggle submissions, run in isolation with `--storeReplays=false`
  }
}

/** Wraps a function call in a try-catch. Is this convenient, or just incredibly lazy? */
export function _try(fn: Function): void {
  try {
    fn()
  } catch (e) {
    log(e.stack)
  }
}

export async function tryAsync(fn: Function): Promise<void> {
  try {
    await fn()
  } catch (e) {
    log(e.stack)
  }
}
