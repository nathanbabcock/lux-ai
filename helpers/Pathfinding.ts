import { GameState } from '../lux/Agent'
import { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'
import Convert from './Convert'
import { PositionActionState, UniqueMap } from './UniqueMap'
import Sim from './Sim'
import { deepClone } from './util'

export type PathNode = {
  pos: Position
  f: number
  g: number
  h: number
  parent?: PathNode
  action?: string // ??
  turn?: number // ??
}

export type SimPathNode = {
  pos: Position
  canAct: boolean
  turn: number

  /** How we arrived at this node */
  cameFrom?: SimPathNode

  /**
   * The action taken to arrive at this node
   * (technically, it could be interpolated by analyzing cameFrom,
   * but that may change with future action types)
   */
  action?: string
}

/**
 * @todo it's probably redundant to represent both a SimPathNode and a PositionActionState,
 * as they both represent fundamentally the same thing on a graph */
export type SimPathNodeV2 = {
  state: PositionActionState
  turn: number

  /** How we arrived at this node */
  cameFrom?: SimPathNodeV2

  /**
   * The action taken to arrive at this node
   * (technically, it could be interpolated by analyzing cameFrom,
   * but that may change with future action types)
   */
  action?: string
}

export default class Pathfinding {
  static reconstruct_path_sim(current: SimPathNode): SimPathNode[] {
    const total_path = [current]
    while (current.cameFrom)
      total_path.unshift(current = current.cameFrom)
    return total_path
  }

  static reconstruct_path_sim_v2(current: SimPathNodeV2): SimPathNodeV2[] {
    const total_path = [current]
    while (current.cameFrom)
      total_path.unshift(current = current.cameFrom)
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

  static neighbors(node: Position, gameState: GameState) {
    const map = gameState.map
    const neighbors: Position[] = []

    const deltas = [
      {x:  0, y: -1},
      {x:  0, y:  1},
      {x: -1, y:  0},
      {x:  1, y:  0},
    ]

    deltas.forEach(delta => {
      const x = node.x + delta.x
      const y = node.y + delta.y
      if (x < 0 || x >= map.width) return
      if (y < 0 || y >= map.height) return
      const cell = map.getCell(x, y)
      if (cell.citytile && cell.citytile.team !== gameState.id) return
      const opponent = gameState.players[(gameState.id + 1) % 2]
      for (const unit of opponent.units)
        if (unit.pos.x === x && unit.pos.y === y) return

      neighbors.push(cell.pos)
    })

    return neighbors
  }

  static async astar_sim_turns(startUnit: Unit, goal: Position, startGameState: GameState, sim: Sim): Promise<SimPathNodeV2[] | null> {
    const start = startUnit.pos

    const h = Pathfinding.turns

    const startState = new PositionActionState(start, startUnit.canAct())

    const openSet: SimPathNodeV2[] = [{
      state: startState,
      turn: startGameState.turn,
    }]

    const gScore = new UniqueMap<PositionActionState>()
    gScore.set(startState, 0)

    const fScore = new UniqueMap<PositionActionState>()
    fScore.set(startState, h(startUnit.pos, startUnit.canAct(), goal, false))

    while (openSet.length > 0) {
      let cur: SimPathNodeV2 = openSet[0]
      openSet.forEach(node => {
        if (fScore.get(node.state) < fScore.get(cur.state)) cur = node
      })

      if (cur.state.pos.equals(goal))
        return Pathfinding.reconstruct_path_sim_v2(cur)

      openSet.splice(openSet.indexOf(cur), 1)
      const curGameState = deepClone(GameState, startGameState)
      const curUnit = curGameState.players[startUnit.team].units.find(unit => unit.id === startUnit.id)
      curGameState.turn = cur.turn
      curUnit.pos.x = cur.state.pos.x
      curUnit.pos.y = cur.state.pos.y
      if (cur.state.canAct) curUnit.cooldown = 0

      if (!cur.state.canAct) {
        const action = curUnit.move('c')
        
        // Simulate the waiting move
        const serializedState = Convert.toSerializedState(curGameState)
        sim.reset(serializedState)
        const simState = await sim.action(action)
        const newGameState = simState.gameState
        const newUnit = newGameState.players[startUnit.team].units.find(u => u.id === startUnit.id)

        const waitingNode: SimPathNodeV2 = {
          state: new PositionActionState(
            newUnit.pos,
            newUnit.canAct()
          ),
          turn: newGameState.turn,
          cameFrom: cur,
          action: action,
        }
        
        // TODO redundant with directions code
        const tentative_gScore = gScore.get(cur.state) + h(cur.state.pos, cur.state.canAct, waitingNode.state.pos, waitingNode.state.canAct)
        console.log(`gScore(${waitingNode.state.pos.x}, ${waitingNode.state.pos.y}, ${waitingNode.state.canAct}) = ${tentative_gScore}`)
        if (tentative_gScore < gScore.get(waitingNode.state) || !gScore.has(waitingNode.state)) {
          gScore.set(waitingNode.state, tentative_gScore)
          fScore.set(waitingNode.state, tentative_gScore + h(newUnit.pos, newUnit.canAct(), goal, false))
          if (!openSet.find(node => node.state.equals(waitingNode.state)))
            openSet.push(waitingNode)
        }

        openSet.push(waitingNode)
        continue // instead of bailing out of this iteration, can we just proceed?
      }

      const directions = ['n', 'e', 's', 'w']
      for (const dir of directions) {
        // Simulate the directional move
        const action = startUnit.move(dir)
        const serializedState = Convert.toSerializedState(curGameState)
        sim.reset(serializedState)
        let simState
        simState = await sim.action(action)
        const newGameState = simState.gameState
        const newUnit = newGameState.players[startUnit.team].units.find(u => u.id === startUnit.id)

        if (!newUnit) {
          //console.warn(`Unit used for pathfinding has disappeared on turn ${curGameState.turn}, presumed DEAD`)
          continue
        }

        if (newUnit.pos.equals(curUnit.pos)) {
          //console.warn(`Attempted move failed -- skipping to next node`)
          continue
        }

        const neighbor: SimPathNodeV2 = {
          state: new PositionActionState(
            newUnit.pos,
            newUnit.canAct(),
          ),
          turn: newGameState.turn,
          cameFrom: cur,
          action,
        }

        const tentative_gScore = gScore.get(cur.state) + h(cur.state.pos, cur.state.canAct, neighbor.state.pos, neighbor.state.canAct)
        console.log(`gScore(${neighbor.state.pos.x}, ${neighbor.state.pos.y}, ${neighbor.state.canAct}) = ${tentative_gScore}`)
        if (tentative_gScore < gScore.get(neighbor.state) || !gScore.has(neighbor.state)) {
          gScore.set(neighbor.state, tentative_gScore)
          fScore.set(neighbor.state, tentative_gScore + h(newUnit.pos, newUnit.canAct(), goal, false))
          if (!openSet.find(node => node.state.equals(neighbor.state)))
            openSet.push(neighbor)
        }
      }
    }

    return null
  }

  static async astar_sim(startUnit: Unit, goal: Position, startGameState: GameState, sim: Sim): Promise<SimPathNode[] | null> {
    const start = startUnit.pos

    /** @todo this heuristic should become TURNS until destination, rather than solely distance */
    const h = (start: Position, end: Position) => Pathfinding.manhattan(start, end)

    const openSet: SimPathNode[] = [{
      pos: start,
      canAct: startUnit.canAct(),
      turn: startGameState.turn,
    }]

    const gScore = new UniqueMap()
    gScore.set(start, 0)

    const fScore = new UniqueMap()
    fScore.set(start, h(start, goal))

    while (openSet.length > 0) {
      let cur: SimPathNode = openSet[0]
      openSet.forEach(node => {
        if (fScore.get(node.pos) < fScore.get(cur.pos)) cur = node
      })

      if (cur.pos.equals(goal))
        return Pathfinding.reconstruct_path_sim(cur)

      openSet.splice(openSet.indexOf(cur), 1)
      const curGameState = deepClone(GameState, startGameState)
      const curUnit = curGameState.players[startUnit.team].units.find(unit => unit.id === startUnit.id)
      curGameState.turn = cur.turn
      curUnit.pos.x = cur.pos.x
      curUnit.pos.y = cur.pos.y
      if (cur.canAct) curUnit.cooldown = 0

      if (!cur.canAct) {
        const action = curUnit.move('c')
        
        // Simulate the waiting move
        const serializedState = Convert.toSerializedState(curGameState)
        sim.reset(serializedState)
        const simState = await sim.action(action)
        const newGameState = simState.gameState
        const newUnit = newGameState.players[startUnit.team].units.find(u => u.id === startUnit.id)

        const waitingNode: SimPathNode = {
          pos: newUnit.pos,
          canAct: newUnit.canAct(),
          turn: newGameState.turn,
          cameFrom: cur,
          action: action,
        }
        
        openSet.push(waitingNode)
        continue // instead of bailing out of this iteration, can we just proceed?
      }

      const directions = ['n', 'e', 's', 'w']
      for (const dir of directions) {
        // Simulate the directional move
        const action = startUnit.move(dir)
        const serializedState = Convert.toSerializedState(curGameState)
        sim.reset(serializedState)
        let simState
        simState = await sim.action(action)
        const newGameState = simState.gameState
        const newUnit = newGameState.players[startUnit.team].units.find(u => u.id === startUnit.id)

        if (!newUnit) {
          //console.warn(`Unit used for pathfinding has disappeared on turn ${curGameState.turn}, presumed DEAD`)
          continue
        }

        if (newUnit.pos.equals(curUnit.pos)) {
          //console.warn(`Attempted move failed -- skipping to next node`)
          continue
        }

        const neighbor: SimPathNode = {
          pos: newUnit.pos,
          canAct: newUnit.canAct(),
          turn: newGameState.turn,
          cameFrom: cur,
          action,
        }

        const tentative_gScore = gScore.get(cur.pos) + h(cur.pos, neighbor.pos)
        if (tentative_gScore < gScore.get(neighbor.pos) || !gScore.has(neighbor.pos)) {
          gScore.set(neighbor.pos, tentative_gScore)
          fScore.set(neighbor.pos, tentative_gScore + h(neighbor.pos, goal))
          if (!openSet.find(node => node.pos.equals(neighbor.pos) && node.canAct === neighbor.canAct))
            openSet.push(neighbor)
        }
      }
    }

    return null
  }

  /** @deprecated only used for older pathfinding implementations */
  static reconstruct_path(cameFrom: Map<Position, Position>, current: Position): Position[] {
    const total_path = [current]
    while (cameFrom.has(current)) {
      current = cameFrom.get(current)
      total_path.unshift(current)
    }
    return total_path
  }

  /** @todo potentially incorrect gScores resulting in longer running times */
  static astar(start: Position, goal: Position, gameState: GameState): Position[] | null {
    const h = (start, goal) => Pathfinding.manhattan(start, goal)

    const openSet: Position[] = [start]
    const cameFrom: Map<Position, Position> = new Map()
    const gScore: Map<Position, number> = new Map()
    gScore.set(start, 0)

    const fScore: Map<Position, number> = new Map()
    fScore.set(start, h(start, goal))

    while (openSet.length > 0) {
      let cur: Position = openSet[0]
      openSet.forEach(node => {
        if (fScore.get(node) < fScore.get(cur)) cur = node
      })

      if (cur.equals(goal))
        return Pathfinding.reconstruct_path(cameFrom, cur)

      openSet.splice(openSet.indexOf(cur), 1)
      const neighbors = Pathfinding.neighbors(cur, gameState)
      for (const neighbor of neighbors) {
        const tentative_gScore = gScore.get(cur) + h(cur, neighbor)
        if (!gScore.has(neighbor) || tentative_gScore < gScore.get(neighbor)) {
          cameFrom.set(neighbor, cur)
          gScore.set(neighbor, tentative_gScore)
          fScore.set(neighbor, gScore.get(neighbor) + h(neighbor, goal))
          if (!openSet.find(pos => pos.equals(neighbor)))
            openSet.push(neighbor)
        }
      }
    }

    return null
  }

  /**
   * @source https://www.geeksforgeeks.org/a-search-algorithm/
   * @deprecated use wiki pseudocode version {@link astar} instead
   */
  static bad_astar(unit: Unit, goal: Position, gameState: GameState): PathNode[] | null {
    const openlist: PathNode[] = [{
      pos: unit.pos,
      f: Pathfinding.manhattan(unit.pos, goal),
      g: 0,
      h: Pathfinding.manhattan(unit.pos, goal),
    }]
    const closedlist: PathNode[] = []

    while (openlist.length > 0) {
      // I am not immediately confident in sort order and comparators so 
      // lets manually and methodically find the node with min f
      let cur: PathNode = openlist[0]
      openlist.forEach(node => {
        if (node.f < cur.f) cur = node
      })
      openlist.splice(openlist.indexOf(cur), 1)

      const succs = Pathfinding.succ(cur, gameState)

      for (const succ of succs) {
        if (succ.pos.equals(goal))
          return Pathfinding.badReconstructPath(succ)

        succ.g = cur.g + Pathfinding.manhattan(succ.pos, cur.pos)
        succ.h = Pathfinding.manhattan(succ.pos, goal)
        succ.f = succ.g + succ.h

        const betterOpen = openlist.find(node => node.pos.equals(succ.pos) && node.f < succ.f)
        if (betterOpen) continue

        const betterClosed = closedlist.find(node => node.pos.equals(succ.pos) && node.f < succ.f)
        if (betterClosed) continue

        openlist.push(succ)
      }

      closedlist.push(cur)
    }

    return null
  }

  /** @deprecated use {@link reconstruct_path} instead */
  static badReconstructPath(cur: PathNode) {
    const path = [cur]
    while (cur.parent)
      path.unshift(cur = cur.parent)
    return path
  }

  /** @deprecated use {@link neighbors} instead */
  static succ(node: PathNode, gameState: GameState) {
    const map = gameState.map
    const succs: PathNode[] = []

    const deltas = [
      {x: 0,  y: -1},
      {x: 0,  y: 1},
      {x: -1, y: 0},
      {x: 1,  y: 0},
    ]

    deltas.forEach(delta => {
      const x = node.pos.x + delta.x
      const y = node.pos.y + delta.y
      if (x < 0 || x >= map.width) return
      if (y < 0 || y >= map.height) return
      const cell = map.getCell(x, y)
      if (cell.citytile && cell.citytile.team !== gameState.id) return
      const opponent = gameState.players[(gameState.id + 1) % 2]
      for (const unit of opponent.units)
        if (unit.pos.x === x && unit.pos.y === y) return

      const succ = {
        pos: cell.pos,
        f: Infinity,
        g: Infinity,
        h: 0,
        parent: node,
      }
      succs.push(succ)
    })

    return succs
  }
}