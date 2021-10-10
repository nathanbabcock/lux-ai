import { GameState } from '../lux/Agent'
import { GameMap } from '../lux/GameMap'
import GAME_CONSTANTS from '../lux/game_constants.json'
import { Player } from '../lux/Player'
import { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'
import Pathfinding from './Pathfinding'
import Sim from './Sim'

const initSim = async () => {
  const sim = await Sim.create()
  const unit = new Unit(0, GAME_CONSTANTS.UNIT_TYPES.WORKER, 'u_0', 0, 0, 0, 0, 0, 0)
  const gameState = new GameState()
  gameState.map = new GameMap(10, 10)
  gameState.id = unit.team
  gameState.players = [new Player(0), new Player(1)]
  gameState.players[0].units = [unit]
  gameState.turn = 0
  return { unit, gameState, sim }
}

async function main() {
  const { unit, gameState, sim } = await initSim()
  const goal = new Position(5, 5)

  const path = await Pathfinding.astar_sim(unit, goal, gameState, sim)

  console.log(path)
  // expect(path.length).toBe(Pathfinding.manhattan(unit.pos, goal) + 1)
}

main()