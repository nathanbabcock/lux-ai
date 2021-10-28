import { clearLog, log } from '../helpers/logging'
import MonteCarlo, { Mission } from '../helpers/MonteCarlo'
import SettlerAgent from '../helpers/SettlerAgent'
import { chooseRandom } from '../helpers/util'
import { Agent } from '../lux/Agent'

const agent = new Agent()
const assignments = new Map<string, Mission>()

async function main() {
  // clearLog()
  // log('==============')
  // log('Random Settler')
  // log('==============')
  // log(new Date().toLocaleString())

  agent.run(async gameState => {
    const player = gameState.players[gameState.id]

    // Make assignments if necessary
    player.units.forEach(unit => {
      const mission = assignments.get(unit.id)
      if (mission && gameState.map.getCellByPos(mission.city_pos).citytile)
        assignments.delete(unit.id)

      if (!assignments.has(unit.id)) {
        const possibleAssignments = MonteCarlo.generateAllUnitMissions(unit, gameState.map)
        assignments.set(unit.id, chooseRandom(possibleAssignments))
      }
    })

    const actions = SettlerAgent.turn(gameState, player, assignments)
    return actions
  })
}

main()

