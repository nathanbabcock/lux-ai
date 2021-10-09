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

describe('Pathfinding', () => {
  test('Core A* algorithm finds a solution', async () => {
    const { unit, gameState } = init()
    const goal = new Position(5, 5)
    const path = Pathfinding.astar(unit.pos, goal, gameState)

    expect(path).not.toBeNull()
    expect(path.length).toBe(Pathfinding.manhattan(unit.pos, goal) + 1)
  })

  test('Core A* algorithm returns null if path is impossible', async () => {
    const { unit, gameState } = init()
    const goal = new Position(-1, -1)
    const path = Pathfinding.astar(unit.pos, goal, gameState)

    expect(path).toBeNull()
  })
})
