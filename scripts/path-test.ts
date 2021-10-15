import { GameMap as LuxGameMap } from '@lux-ai/2021-challenge'
import Pathfinding from '../helpers/Pathfinding'
import Sim from '../helpers/Sim'

const initSim = async () => {
  const sim = await Sim.create({
    storeReplay: false,
    debugAnnotations: true,
    mapType: LuxGameMap.Types.RANDOM,
    width: 12,
    height: 12,
    seed: 123456789,
  })

  // const unit = new Unit(0, GAME_CONSTANTS.UNIT_TYPES.WORKER, 'u_0', 0, 0, 0, 0, 0, 0)
  // const gameState = new GameState()
  // gameState.map = new GameMap(10, 10)
  // gameState.id = unit.team
  // gameState.players = [new Player(0), new Player(1)]
  // gameState.players[0].units = [unit]
  // gameState.turn = 0

  const gameState = sim.getGameState()
  const unit = gameState.players[gameState.id].units[0]
  return { unit, gameState, sim }
}

async function main() {
  const { unit, gameState, sim } = await initSim()
  console.time('Meta-A*')
  const path = await Pathfinding.astar_build(unit, gameState, sim)
  console.log(path)
  console.timeEnd('Meta-A*')
}

main()