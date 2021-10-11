import { GameState } from '../lux/Agent'
import { GameMap } from '../lux/GameMap'
import GAME_CONSTANTS from '../lux/game_constants.json'
import { Player } from '../lux/Player'
import { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'
import Pathfinding from './Pathfinding'
import Sim from './Sim'

const init = () => {
  const unit = new Unit(0, GAME_CONSTANTS.UNIT_TYPES.WORKER, 'u_0', 0, 0, 0, 0, 0, 0)
  const gameState = new GameState()
  gameState.map = new GameMap(10, 10)
  gameState.id = unit.team
  gameState.players = [new Player(0), new Player(1)]
  return { unit, gameState }
}

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

describe('Simple (position) pathfinding', () => {
  test('Finds a solution', async () => {
    const { unit, gameState } = init()
    const goal = new Position(5, 5)
    const path = Pathfinding.astar(unit.pos, goal, gameState)

    expect(path).not.toBeNull()
    expect(path.length).toBe(Pathfinding.manhattan(unit.pos, goal) + 1)
  })

  test('Returns null if path is impossible', async () => {
    const { unit, gameState } = init()
    const goal = new Position(-1, -1)
    const path = Pathfinding.astar(unit.pos, goal, gameState)

    expect(path).toBeNull()
  })

  test('Navigates around an obstacle', async () => {
    const { unit, gameState } = init()
    const obstacle = new Unit(1, GAME_CONSTANTS.UNIT_TYPES.WORKER, 'u_1', 0, 2, 0, 0, 0, 0)
    gameState.players[1].units.push(obstacle)
    const goal = new Position(0, 5)
    const path = Pathfinding.astar(unit.pos, goal, gameState)

    expect(path).not.toBeNull()

    // console.log(path.map(p => `(${p.x}, ${p.y})`).join('\n'))
  })
})

describe('Simulation-driven pathfinding', () => {
  test('Finds a solution', async () => {
    const { unit, gameState, sim } = await initSim()
    const goal = new Position(5, 5)

    const path = await Pathfinding.astar_sim(unit, goal, gameState, sim)

    expect(path).not.toBeNull()
    expect(path.length).toBe(Pathfinding.manhattan(unit.pos, goal) * 2)
  })

  test('Returns null if path is impossible', async () => {
    const { unit, gameState, sim } = await initSim()
    const goal = new Position(-1, -1)

    const path = await Pathfinding.astar_sim(unit, goal, gameState, sim)

    expect(path).toBeNull()
  })

  test('Navigates around an obstacle', async () => {
    const { unit, gameState, sim } = await initSim()
    const goal = new Position(0, 5)
    const obstacle = new Unit(1, GAME_CONSTANTS.UNIT_TYPES.WORKER, 'u_1', 0, 2, 0, 0, 0, 0)
    gameState.players[1].units.push(obstacle)

    const path = await Pathfinding.astar_sim(unit, goal, gameState, sim)

    expect(path).not.toBeNull()
    // console.log(path.map(node => `(${node.pos.x}, ${node.pos.y}) => ${node.action}`).join('\n'))
  })
})

describe('Simulation-driven pathfinding w/ Turns heuristic', () => {
  test('Finds a solution', async () => {
    const { unit, gameState, sim } = await initSim()
    const goal = new Position(5, 5)

    const path = await Pathfinding.astar_sim_turns(unit, goal, gameState, sim)

    expect(path).not.toBeNull()
    expect(path.length).toBe(Pathfinding.manhattan(unit.pos, goal) * 2)
  })

  test('Returns null if path is impossible', async () => {
    const { unit, gameState, sim } = await initSim()
    const goal = new Position(-1, -1)

    const path = await Pathfinding.astar_sim_turns(unit, goal, gameState, sim)

    expect(path).toBeNull()
  })

  test('Navigates around an obstacle', async () => {
    const { unit, gameState, sim } = await initSim()
    const goal = new Position(0, 5)
    const obstacle = new Unit(1, GAME_CONSTANTS.UNIT_TYPES.WORKER, 'u_1', 0, 2, 0, 0, 0, 0)
    gameState.players[1].units.push(obstacle)

    const path = await Pathfinding.astar_sim_turns(unit, goal, gameState, sim)

    expect(path).not.toBeNull()
    // console.log(path.map(node => `(${node.pos.x}, ${node.pos.y}) => ${node.action}`).join('\n'))
  })
})