import { GameState } from '../lux/Agent'
import { GameMap } from '../lux/GameMap'
import GAME_CONSTANTS from '../lux/game_constants.json'
import { Player } from '../lux/Player'
import { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'
import DirectorV2 from './DirectorV2'
import Pathfinding from './Pathfinding'
import Sim from './Sim'
import { initSeed } from './test-util'
import { clone } from './util'

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

describe(`Simulation-driven pathfinding w/ 'turns' heuristic`, () => {
  test('Finds a solution', async () => {
    const { unit, gameState, sim } = await initSim()
    const goal = new Position(5, 5)

    const result = await Pathfinding.astar_move(unit, goal, gameState, sim)

    expect(result).not.toBeNull()
    expect(result.path.length).toBe(Pathfinding.manhattan(unit.pos, goal) * 2)
  })

  test('Returns null if path is impossible', async () => {
    const { unit, gameState, sim } = await initSim()
    const goal = new Position(-1, -1)

    const path = await Pathfinding.astar_move(unit, goal, gameState, sim)

    expect(path).toBeNull()
  })

  test('Navigates around an obstacle', async () => {
    const { unit, gameState, sim } = await initSim()
    const goal = new Position(0, 5)
    const obstacle = new Unit(1, GAME_CONSTANTS.UNIT_TYPES.WORKER, 'u_1', 0, 2, 0, 0, 0, 0)
    gameState.players[1].units.push(obstacle)

    const path = await Pathfinding.astar_move(unit, goal, gameState, sim)

    expect(path).not.toBeNull()
    // console.log(path.map(node => `(${node.pos.x}, ${node.pos.y}) => ${node.action}`).join('\n'))
  })

  test('Build a city as fast as possible', async () => {
    const sim = await initSeed()
    const replaySim = await initSeed('replays/test-astar-build-city.json')
    const gameState = sim.getGameState()
    const unit = gameState.players[0].units[0]

    const result = await Pathfinding.astar_build(unit, gameState, sim)

    expect(result).not.toBeNull()
    expect(result.path.length).toBe(6)

    const actions = result.path.map(node => node.action).filter(action => !!action)
    for (const action of actions)
      await replaySim.action(action)

    const newPlayer = replaySim.getGameState().players[0]
    const newUnit = newPlayer.units[0]
    const newCities = Array.from(newPlayer.cities.values())
    expect(newUnit.pos.equals(new Position(1, 5))).toBe(true)
    expect(newCities.length).toBe(2)

    replaySim.saveReplay()
  })

  test('Two units avoid collision course', async () => {
    const sim = await Sim.create()
    const unit1 = new Unit(0, GAME_CONSTANTS.UNIT_TYPES.WORKER, 'u_0', 0, 2, 0, 0, 0, 0)
    const unit2 = new Unit(0, GAME_CONSTANTS.UNIT_TYPES.WORKER, 'u_1', 2, 0, 0, 0, 0, 0)
    const gameState = new GameState()
    gameState.map = new GameMap(10, 10)
    gameState.id = unit1.team
    gameState.players = [new Player(0), new Player(1)]
    gameState.players[0].units = [unit1, unit2]
    gameState.turn = 0
    const goal1 = new Position(5, 2)
    const goal2 = new Position(2, 5)
    const director = new DirectorV2()

    const pathResult1 = await Pathfinding.astar_move(unit1, goal1, clone(gameState), sim)
    expect(pathResult1).not.toBeNull()

    director.setPath(unit1.id, pathResult1.path)

    const pathResult2 = await Pathfinding.astar_move(unit2, goal2, clone(gameState), sim, director)
    expect(pathResult2).not.toBeNull()
    expect(pathResult2.path[3].pos.equals(pathResult1.path[3].pos)).toBe(false)
  })
})
