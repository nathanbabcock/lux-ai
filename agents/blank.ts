import { clearLog, log } from '../helpers/logging'
import { Agent } from '../lux/Agent'

const agent = new Agent()

async function main() {
  clearLog()
  log('=================')
  log('Director Agent V2')
  log('=================')
  log(new Date().toLocaleString())

  agent.run(async gameState => {
    log(`=== TURN ${gameState.turn} ===`)
    const actions: string[] = []
    return actions
  })
}

main()
