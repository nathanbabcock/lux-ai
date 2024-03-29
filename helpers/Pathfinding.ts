import { GameState } from '../lux/Agent'
import { Cell } from '../lux/Cell'
import { GameMap } from '../lux/GameMap'
import GAME_CONSTANTS from '../lux/game_constants.json'
import { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'
import Convert from './Convert'
import DirectorV2 from './DirectorV2'
import { getResourceAdjacency } from './helpers'
import { log } from './logging'
import Sim from './Sim'
import { MovementState, PositionState, StateMap, StateNode, UnitState } from './StateNode'
import Turn from './Turn'

export type MetaPathNode = {
  pos: Position
  estimatedDistance: number
  actualDistance?: number
  cargoFull?: boolean
  path?: MovementState[]
  detours?: Map<Cell, MetaPathNode>
  parent?: MetaPathNode
}

export type PathfindingResult<T> = {
  path: T[]
  gameState: GameState
  tries?: number
}

export default class Pathfinding {
  static reconstruct_path<T extends StateNode>(current: T): T[] {
    const total_path = [current]
    while (current.cameFrom)
      total_path.unshift(current = current.cameFrom as T)
    return total_path
  }

  static manhattan(pos: Position, goal: Position) {
    return Math.abs(pos.x - goal.x) + Math.abs(pos.y - goal.y)
  }

  static turns(startPos: Position, startCanAct: boolean, goalPos: Position, goalCanAct: boolean): number {
    return (Pathfinding.manhattan(startPos, goalPos) * 2) // 1 turn of movement, 1 turn of cooldown, per tile
      + (startCanAct ? 0 : 1) // 1 turn of initial cooldown if can't act
      - (goalCanAct ? 0 : 1) // Whether to wait for cooldown on goal tile
  }

  static closest_empty_tile(state: UnitState, map: GameMap): number {
    let closestEmptyTileDist: number = Infinity
    let closestEmptyTile: Position = null

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const cell = map.getCell(x, y)
        if (cell.citytile) continue
        if (cell.resource && cell.resource.amount > 0) continue
        const dist = Pathfinding.turns(state.pos, state.canAct, cell.pos, true)
        if (dist < closestEmptyTileDist) {
          closestEmptyTileDist = dist
          closestEmptyTile = cell.pos
        }
      }
    }

    if (!closestEmptyTile)
      return Infinity
    return closestEmptyTileDist
  }

  static closest_resource(state: UnitState, map: GameMap): number {
    let closestResourceDist: number = Infinity
    let closestResource: Position = null

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const cell = map.getCell(x, y)
        if (cell.citytile) continue
        if (getResourceAdjacency(cell, map) === 0) continue
        const dist = Pathfinding.turns(state.pos, state.canAct, cell.pos, true)
        if (dist < closestResourceDist) {
          closestResourceDist = dist
          closestResource = cell.pos
        }
      }
    }

    if (!closestResource)
      return Infinity
    return closestResourceDist
  }

  /**
   * Heuristic function for building a city.
   * 
   * Returns the minimum number of turns to reach a state where a city can be built
   * 
   * - If cargo is full, return the movement cost to the closest potential city location
   *   (optimistically hoping that resources are found along the way, the best case scenario)
   * - If cargo is not full:
   *   - If not currently on a resource-giving tile, return the movement cost to the closest resource
   *     (without going to *some* resource, the goal will never be reached)
   *   - If currently on a resource-giving tile, return the movement cost to the closest potential city location
   *     (again hopefully assuming that resources are found along the way)
   * 
   * This ignores ROADS and CARTS, making the heuristic technically not [admissible](https://en.wikipedia.org/wiki/Admissible_heuristic)
   * (at least for an exhaustive search of all possible strategies)
   * 
   * Complexity: O(n^2), for n = map size ∈ [12, 16, 24, 32]
   * Reasoning: Must check every tile (either city or resource) on the map for its distance to the given tile
   */
  static build_heuristic(state: UnitState, gameState: GameState): number {
    const map = gameState.map
    const cell = map.getCell(state.pos.x, state.pos.y)
    const onResourceAdjacentTile = !cell.citytile && getResourceAdjacency(cell, map) > 0

    if (state.cargoFull || onResourceAdjacentTile)
      return Pathfinding.closest_empty_tile(state, map)
    else
      return Pathfinding.closest_resource(state, map)
  }

  /**
   * Extremely basic A* search on the grid map only,
   * with no collision avoidance or cooldown simulation.
   * @param avoidCityTiles default `true`
   */
  static simple_astar(
    unit: Unit,
    goal: Position,
    turn: Turn,
    avoidCityTiles: boolean = true,
  ): PositionState[] | null {
    /** Simple manhattan distance */
    const h = (start: PositionState, goal: PositionState) =>
      start.pos.distanceTo(goal.pos)

    const startState = new PositionState(unit.pos)
    const goalState = new PositionState(goal)
    const openSet = [startState]

    const gScore = new StateMap()
    gScore.set(startState, 0)

    const fScore = new StateMap()
    fScore.set(startState, h(startState, goalState))

    const MAX_TRIES = 500
    let tries = 0
    while (openSet.length > 0) {
      tries++

      if (tries > MAX_TRIES) {
        log(`A* pathfinding hit ${MAX_TRIES} iteration limit`)
        return null
      }

      let cur = openSet[0]
      openSet.forEach(node => {
        if (fScore.get(node) < fScore.get(cur)) cur = node
      })

      if (cur.equals(goalState))
        return Pathfinding.reconstruct_path(cur)

      openSet.splice(openSet.indexOf(cur), 1)
      
      const directions = ['n', 'e', 's', 'w']
      for (const dir of directions) {
        const destination = cur.pos.translate(dir, 1)
        if (destination.x < 0 || destination.y < 0) continue
        if (destination.x >= turn.map.width) continue
        if (destination.y >= turn.map.width) continue
        const cell = turn.map.getCell(destination.x, destination.y)
        if (cell.citytile && cell.citytile.team !== unit.team) continue // can't move onto enemy city tiles
        if (cell.citytile && avoidCityTiles) continue // avoid all city tiles if necessary
        if (turn.opponent.units.find(unit => unit.pos.equals(destination))) continue // can't move onto enemy units (even if they might move away)
        // avoid collisions with other units
        // might need to know the turn as well as the position to do this
        // ...or skip that, and keep this *extremely* simple until proven necessary?

        const neighbor = new PositionState(destination)
        neighbor.cameFrom = cur

        const tentative_gScore = gScore.get(cur) + h(cur, neighbor)
        //console.log(`gScore(${neighbor.pos.x}, ${neighbor.pos.y}, ${neighbor.canAct}) = ${tentative_gScore}`)
        if (tentative_gScore < gScore.get(neighbor) || !gScore.has(neighbor)) {
          gScore.set(neighbor, tentative_gScore)
          fScore.set(neighbor, tentative_gScore + h(neighbor, goalState))
          if (!openSet.find(node => node.equals(neighbor)))
            openSet.push(neighbor)
        }
      }
    }

    return null
  }

  static async astar_build(
    startUnit: Unit,
    startGameState: GameState,
    sim: Sim,
    director?: DirectorV2,
  ): Promise<PathfindingResult<UnitState> | null> {
    const h = Pathfinding.build_heuristic
    
    const startState = new UnitState(startUnit.pos, startUnit.canAct(), startUnit.getCargoSpaceLeft() === 0)
    startState.gameState = startGameState

    /** @returns true if a unit is ready to build here immediately in the next turn (cooldown = 0, cargo = full, empty tile) */
    const isGoal = (state: UnitState): boolean => {
      if (!state.cargoFull) return false
      if (!state.canAct) return false
      const cell = state.gameState.map.getCell(state.pos.x, state.pos.y)
      if (cell.citytile) return false
      if (cell.resource && cell.resource.amount > 0) return false
      return true
    }

    const openSet = [startState]

    const gScore = new StateMap()
    gScore.set(startState, 0)

    const fScore = new StateMap()
    fScore.set(startState, h(startState, startGameState))

    const MAX_TRIES = 100
    let tries = 0
    while (openSet.length > 0) {
      tries++

      // if (tries > MAX_TRIES) {
      //   log(`Bailing out of pathfinding after 100 tries`)
      //   return null
      // }

      let cur = openSet[0]
      openSet.forEach(node => {
        if (fScore.get(node) < fScore.get(cur)) cur = node
      })

      if (isGoal(cur)) {
        const path = Pathfinding.reconstruct_path(cur)
        const last = path[path.length - 1]
        const build = new UnitState(last.pos, false, false)
        build.action = startUnit.buildCity()
        path.push(build)

        return {
          path,
          gameState: cur.gameState,
          tries,
        }
      }

      openSet.splice(openSet.indexOf(cur), 1)
      
      const curGameState = cur.gameState
      const curSerializedState = Convert.toSerializedState(curGameState)
      const curUnit = curGameState.players[startUnit.team].units.find(unit => unit.id === startUnit.id)

      const actions: string[] = []
      if (!cur.canAct)
        actions.push(curUnit.move('c'))
      else {
        const directions = ['n', 'e', 's', 'w', 'c']
        directions.forEach(dir => actions.push(startUnit.move(dir)))
      }

      for (const action of actions) {
        sim.reset(curSerializedState)
        const actions = [action]
        if (director)
          actions.push(...director.getTurnActions(curSerializedState.turn + 1))

        const simState = await sim.action(actions)
        const newGameState = simState.gameState
        const newUnit = newGameState.players[startUnit.team].units.find(u => u.id === startUnit.id)

        if (!newUnit) {
          //console.warn(`Unit used for pathfinding has disappeared on turn ${curGameState.turn}, presumed DEAD`)
          continue
        }

        const isWaitAction = action.startsWith('m') && action.endsWith('c')
        if (!isWaitAction && newUnit.pos.equals(curUnit.pos)) {
          //console.warn(`Attempted move failed -- skipping to next node`)
          continue
        }

        const neighbor = new UnitState(newUnit.pos, newUnit.canAct(), newUnit.getCargoSpaceLeft() === 0, newGameState)
        neighbor.cameFrom = cur
        neighbor.action = action

        const tentative_gScore = gScore.get(cur) + 1 // movement cost from cur to neighbor = 1 turn
        if (tentative_gScore < gScore.get(neighbor) || !gScore.has(neighbor)) {
          gScore.set(neighbor, tentative_gScore)
          fScore.set(neighbor, tentative_gScore + h(neighbor, newGameState))
          if (!openSet.find(node => node.equals(neighbor)))
            openSet.push(neighbor)
        }
      }
    }

    return null
  }

  static async astar_move(
    startUnit: Unit,
    goal: Position,
    startGameState: GameState,
    sim: Sim,
    director?: DirectorV2,
  ): Promise<PathfindingResult<MovementState> | null> {
    /** Heuristic for *minimum* number of turns required to get from @param start state to @param goal state */
    const h = (start: MovementState, goal: MovementState) =>
      Pathfinding.turns(start.pos, start.canAct, goal.pos, goal.canAct)
    
    const startState = new MovementState(startUnit.pos, startUnit.canAct())
    startState.gameState = startGameState

    const goalState = new MovementState(goal, false)

    const openSet = [startState]

    const gScore = new StateMap()
    gScore.set(startState, 0)

    const fScore = new StateMap()
    fScore.set(startState, h(startState, goalState))


    const MAX_TRIES = Infinity
    let tries = 0
    while (openSet.length > 0) {
      tries++
      let cur = openSet[0]
      openSet.forEach(node => {
        if (fScore.get(node) < fScore.get(cur)) cur = node
      })

      if (tries > MAX_TRIES) {
        log(`astar_move bailout(${MAX_TRIES})`)
        return null
      }

      if (cur.equals(goalState)) {
        return {
          path: Pathfinding.reconstruct_path(cur),
          gameState: cur.gameState,
        }
      }

      openSet.splice(openSet.indexOf(cur), 1)
      
      const curGameState = cur.gameState
      const curSerializedState = Convert.toSerializedState(curGameState)
      const curUnit = curGameState.players[startUnit.team].units.find(unit => unit.id === startUnit.id)

      const actions: string[] = []
      if (!cur.canAct)
        actions.push(curUnit.move('c'))
      else {
        const directions = ['n', 'e', 's', 'w']
        directions.forEach(dir => actions.push(startUnit.move(dir)))
      }

      for (const action of actions) {
        sim.reset(curSerializedState)
        const actions = [action]
        if (director)
          actions.push(...director.getTurnActions(curSerializedState.turn + 1))

        const simState = await sim.action(actions)
        const newGameState = simState.gameState
        const newUnit = newGameState.players[startUnit.team].units.find(u => u.id === startUnit.id)

        if (!newUnit) {
          //console.warn(`Unit used for pathfinding has disappeared on turn ${curGameState.turn}, presumed DEAD`)
          continue
        }

        if (cur.canAct && newUnit.pos.equals(curUnit.pos)) {
          //console.warn(`Attempted move failed -- skipping to next node`)
          continue
        }

        const neighbor = new MovementState(newUnit.pos, newUnit.canAct(), newGameState)
        neighbor.cameFrom = cur
        neighbor.action = action

        const tentative_gScore = gScore.get(cur) + h(cur, neighbor)
        //console.log(`gScore(${neighbor.pos.x}, ${neighbor.pos.y}, ${neighbor.canAct}) = ${tentative_gScore}`)
        if (tentative_gScore < gScore.get(neighbor) || !gScore.has(neighbor)) {
          gScore.set(neighbor, tentative_gScore)
          fScore.set(neighbor, tentative_gScore + h(neighbor, goalState))
          if (!openSet.find(node => node.equals(neighbor)))
            openSet.push(neighbor)
        }
      }
    }

    return null
  }

  /**
   * @deprecated
   * Works (believe it or not) but crashes when there are too many units in a small area
   */
  static async meta_astar_build(
    startUnit: Unit,
    startGameState: GameState,
    sim: Sim,
    director?: DirectorV2,
  ): Promise<MovementState[] | null> {
    const destinations = new Map<Cell, MetaPathNode>()
    const map = startGameState.map
    const player = startGameState.players[startUnit.team]
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const cell = map.getCell(x, y)
        if (cell.resource && cell.resource.amount > 0) continue
        if (cell.citytile) continue
        if (director && director.getBuildAssignment(x, y)) continue
        destinations.set(cell, {
          pos: cell.pos,
          estimatedDistance: Pathfinding.turns(startUnit.pos, startUnit.canAct(), cell.pos, true),
          actualDistance: undefined,
          detours: new Map<Cell, MetaPathNode>(),
        })
      }
    }

    Array.from(destinations.values()).forEach(dest => {
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const cell = map.getCell(x, y)
          if (!cell.resource) continue
          if (cell.resource.type === GAME_CONSTANTS.RESOURCE_TYPES.COAL && !player.researchedCoal) continue
          if (cell.resource.type === GAME_CONSTANTS.RESOURCE_TYPES.URANIUM && !player.researchedUranium) continue
          dest.detours.set(cell, {
            pos: cell.pos,
            parent: dest,
            estimatedDistance: Pathfinding.turns(startUnit.pos, startUnit.canAct(), cell.pos, true)
              + Pathfinding.turns(cell.pos, true, dest.pos, true),
            actualDistance: undefined,
          })
        }
      }
    })

    const getNextNodeToCheck = () => {
      const uncheckedDestinations = Array.from(destinations.values())
        .filter(dest => dest.actualDistance === undefined)
        .sort((a, b) => a.estimatedDistance - b.estimatedDistance)
      const closestUncheckedDest = uncheckedDestinations.length === 0 ? undefined : uncheckedDestinations[0]
      
      const uncheckedDetours = Array.from(destinations.values())
        .map(dest => Array.from(dest.detours.values())).flat()
        .filter(detour => detour.actualDistance === undefined)
        .sort((a, b) => a.estimatedDistance - b.estimatedDistance)
      const closestUncheckedDetour = uncheckedDetours.length === 0 ? undefined : uncheckedDetours[0]
      
      if (!closestUncheckedDest && !closestUncheckedDetour)
        return null
      else if (!closestUncheckedDest || closestUncheckedDest.estimatedDistance > closestUncheckedDetour.estimatedDistance)
        return closestUncheckedDetour
      else
        return closestUncheckedDest
    }

    const MAX_TRIES = Infinity
    let tries = 0
    let curBestSolution: null | MetaPathNode = null
    let next: MetaPathNode
    while (next = getNextNodeToCheck()) {
      if (tries > MAX_TRIES)
        log(`astar_build bailout(${MAX_TRIES})`)

      if (curBestSolution && (tries > MAX_TRIES || next.estimatedDistance >= curBestSolution.actualDistance)) {
        const path = curBestSolution.path

        const wait = new MovementState(curBestSolution.path[curBestSolution.path.length - 1].pos, true)
        wait.action = startUnit.move('c')
        path.push(wait)

        const build = new MovementState(curBestSolution.path[curBestSolution.path.length - 1].pos, false)
        build.action = startUnit.buildCity()
        path.push(build)

        return path
      }

      if (tries > MAX_TRIES)
        return null

      tries++

      let pathfindingResult: PathfindingResult<MovementState>
      if (next.parent) {
        const pathPart1 = await Pathfinding.astar_move(startUnit, next.pos, startGameState, sim, director)
        if (!pathPart1) {
          next.actualDistance = Infinity
          continue
        }

        const newGameState = pathPart1.gameState
        const newUnit = newGameState.players[startUnit.team].units.find(unit => unit.id === startUnit.id)
        const pathPart2 = await Pathfinding.astar_move(newUnit, next.parent.pos, newGameState, sim, director)

        if (!pathPart2) {
          next.actualDistance = Infinity
          continue
        }

        next.path = [
          ...pathPart1.path,
          ...pathPart2.path,
        ]
        next.actualDistance = pathPart1.path.length + pathPart2.path.length

        const endGameState = pathPart2.gameState
        const endUnit = endGameState.players[startUnit.team].units.find(unit => unit.id === startUnit.id)
        next.cargoFull = endUnit.getCargoSpaceLeft() === 0
      } else {
        pathfindingResult = await Pathfinding.astar_move(startUnit, next.pos, startGameState, sim, director)
        if (!pathfindingResult) {
          next.actualDistance = Infinity
          continue
        }
        
        next.path = pathfindingResult.path
        next.actualDistance = pathfindingResult.path.length

        const endGameState = pathfindingResult.gameState
        const endUnit = endGameState.players[startUnit.team].units.find(unit => unit.id === startUnit.id)
        next.cargoFull = endUnit.getCargoSpaceLeft() === 0
      }

      if (next.cargoFull && (!curBestSolution || next.actualDistance < curBestSolution.actualDistance))
        curBestSolution = next
    }

    return curBestSolution ? curBestSolution.path : null
  }
}
