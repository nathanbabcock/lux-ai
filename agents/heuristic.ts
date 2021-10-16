import { clearLog, log } from '../helpers/logging'
import Pathfinding from '../helpers/Pathfinding'
import { UnitState } from '../helpers/StateNode'
import { Agent, annotate } from '../lux/Agent'
import { Position } from '../lux/Position'

const agent = new Agent()

async function main() {
  clearLog()
  log('====================')
  log('Build Heuristic Test')
  log('====================')
  log(new Date().toLocaleString())

  agent.run(async gameState => {
    const actions: string[] = []
    if (gameState.turn > 0) return actions

    // O(n^4)
    const start = new Date().getTime()
    const map = gameState.map
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const stateCargoEmpty = new UnitState(new Position(x, y), true, false)
        const stateCargoFull = new UnitState(new Position(x, y), true, true)
        const heuristicEmpty = Pathfinding.build_heuristic(stateCargoEmpty, gameState)
        const heuristicFull = Pathfinding.build_heuristic(stateCargoFull, gameState)
        actions.push(annotate.text(x, y, `${heuristicEmpty}/${heuristicFull}`))
      }
    }
    log(`O(n^4) heuristic completed in ${new Date().getTime() - start}ms`)

    return actions
  })
}

main()

