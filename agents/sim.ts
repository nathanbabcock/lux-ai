import { clearLog, log, tryAsync } from '../helpers/logging'
import Sim from '../helpers/Sim'
import Turn from '../helpers/Turn'
import { Agent, GameState } from '../lux/Agent'

const agent = new Agent()
let sim: Sim

//// MAIN
async function main() {
  clearLog()
  log('=========')
  log('Sim Agent')
  log('=========')

  sim = await Sim.create()
  agent.run(turn)
}

main()

export async function turn(gameState: GameState): Promise<Array<string>> {
  const turn = new Turn(gameState)
  const { actions } = turn
  
  if (gameState.turn > 0) return actions

  const unit = turn.player.units[0]
  if (!unit) {
    turn.sidetext(`Player appears to have no units remaining`)
    return actions
  }

  // for (let i = 0; i < turn.clusters.length; i++) {
  { let i = 0
    const cluster = turn.clusters[i]
    log(`Simulating mission to cluster ${i} ===`)

    const citySite = cluster.getCitySite(turn.gameMap)
    if (!citySite) {
      log(`No valid city site for cluster ${i}`)
      return
    }

    await tryAsync(async () => {
      const { annotations } = await sim.settler(unit, citySite.pos, gameState)
      actions.push(...annotations)
    })
  }

  return actions
}


