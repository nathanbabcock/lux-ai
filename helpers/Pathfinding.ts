import { GameState } from '../lux/Agent'
import { Cell } from '../lux/Cell'
import GAME_CONSTANTS from '../lux/game_constants.json'
import { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'
import Convert from './Convert'
import Sim from './Sim'
import { MovementState, StateMap, StateNode } from './StateNode'

export type MetaPathNode = {
  pos: Position
  estimatedDistance: number
  actualDistance?: number
  cargoFull?: boolean
  path?: MovementState[]
  detours?: Map<Cell, MetaPathNode>
  parent?: MetaPathNode
}

export type PathfindingResult = {
  path: MovementState[]
  gameState: GameState
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

  static async astar_build_city(startUnit: Unit, startGameState: GameState, sim: Sim): Promise<MovementState[] | null> {
    const destinations = new Map<Cell, MetaPathNode>()
    const map = startGameState.map
    const player = startGameState.players[startUnit.team]
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const cell = map.getCell(x, y)
        if (cell.resource && cell.resource.amount > 0) continue
        if (cell.citytile) continue
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
      if (closestUncheckedDest)
        console.log(`Closest empty pos: d(${closestUncheckedDest.pos.x}, ${closestUncheckedDest.pos.y})=${closestUncheckedDest.estimatedDistance}`)

      const uncheckedDetours = Array.from(destinations.values())
        .map(dest => Array.from(dest.detours.values())).flat()
        .filter(detour => detour.actualDistance === undefined)
        .sort((a, b) => a.estimatedDistance - b.estimatedDistance)
      const closestUncheckedDetour = uncheckedDetours.length === 0 ? undefined : uncheckedDetours[0]
      console.log(`Closest detour: d((${closestUncheckedDetour.pos.x}, ${closestUncheckedDetour.pos.y}) => (${closestUncheckedDetour.parent.pos.x}, ${closestUncheckedDetour.parent.pos.y})) = ${closestUncheckedDetour.estimatedDistance}`)

      if (!closestUncheckedDest && !closestUncheckedDetour)
        return null
      else if (!closestUncheckedDest || closestUncheckedDest.estimatedDistance > closestUncheckedDetour.estimatedDistance)
        return closestUncheckedDetour
      else
        return closestUncheckedDest
    }

    let curBestSolution: null | MetaPathNode = null

    let next: MetaPathNode
    while (next = getNextNodeToCheck()) {
      if (curBestSolution && next.estimatedDistance >= curBestSolution.actualDistance) {
        const path = curBestSolution.path

        const wait = new MovementState(curBestSolution.path[curBestSolution.path.length - 1].pos, true)
        wait.action = startUnit.move('c')
        path.push(wait)

        const build = new MovementState(curBestSolution.path[curBestSolution.path.length - 1].pos, false)
        build.action = startUnit.buildCity()
        path.push(build)

        return path
      }

      let pathfindingResult: PathfindingResult
      if (next.parent) {
        const pathPart1 = await Pathfinding.astar_move(startUnit, curBestSolution.pos, startGameState, sim)
        if (!pathPart1) {
          next.actualDistance = Infinity
          continue
        }

        const newGameState = pathPart1.gameState
        const newUnit = newGameState.players[startUnit.team].units.find(unit => unit.id === startUnit.id)
        const pathPart2 = await Pathfinding.astar_move(newUnit, curBestSolution.parent.pos, newGameState, sim)

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
        pathfindingResult = await Pathfinding.astar_move(startUnit, next.pos, startGameState, sim)
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

  static async astar_move(startUnit: Unit, goal: Position, startGameState: GameState, sim: Sim): Promise<PathfindingResult | null> {
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

    while (openSet.length > 0) {
      let cur = openSet[0]
      openSet.forEach(node => {
        if (fScore.get(node) < fScore.get(cur)) cur = node
      })

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
        const simState = await sim.action(action)
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
}
