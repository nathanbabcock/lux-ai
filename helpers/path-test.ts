import { GameState } from '../lux/Agent'
import { GameMap } from '../lux/GameMap'
import GAME_CONSTANTS from '../lux/game_constants.json'
import { Player } from '../lux/Player'
import { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'
import Pathfinding from './Pathfinding'

const init = () => {
  const unit = new Unit(0, GAME_CONSTANTS.UNIT_TYPES.WORKER, 'u_0', 0, 0, 0, 0, 0, 0)
  const gameState = new GameState()
  gameState.map = new GameMap(10, 10)
  gameState.id = unit.team
  gameState.players = [new Player(0), new Player(1)]
  return { unit, gameState }
}

const { unit, gameState } = init()
const goal = new Position(5, 5)
const path = Pathfinding.astar(unit.pos, goal, gameState)

console.log(JSON.stringify(path.map(n => `${n.x}, ${n.y}`), null, 2))