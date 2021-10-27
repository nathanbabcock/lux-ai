import { clearLog, log } from '../helpers/logging'
import Turn from '../helpers/Turn'
import { Agent } from '../lux/Agent'

const agent = new Agent()

export type Assignment = {

}

function getAssignments(turn: Turn): Assignment[] {
  throw new Error('Not implemented')
}

async function main() {
  clearLog()
  log('=======================')
  log('Assignment Solver Agent')
  log('=======================')
  log(new Date().toLocaleString())

  agent.run(async gameState => {
    log(`=== TURN ${gameState.turn} ===`)
    const turn = new Turn(gameState)
    const actions = turn.actions

    const assignments = getAssignments(turn)
    const units = turn.player.units

    return actions
  })
}

main()
