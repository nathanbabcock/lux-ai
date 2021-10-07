import { clearLog, log } from '../helpers/logging'
import Sim from '../helpers/Sim'
import Turn from '../helpers/Turn'
import { Agent } from '../lux/Agent'

const agent = new Agent()
let sim: Sim

async function main() {
  clearLog()
  log('=========')
  log('Sim Agent')
  log('=========')
  log(new Date().toLocaleString())

  sim = await Sim.create()
  agent.run(async gameState => {
    const turn = new Turn(gameState)
    log(`=== Turn #${gameState.turn} ===`)
    return await turn.settlerTreeSearch(sim)
  })
}

main()

