import { GameState } from '../lux/Agent'
import { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'

export type PathNode = {
  pos: Position
  f: number
  g: number
  h: number
  parent?: PathNode
  action?: string // ??
  turn?: number // ??
}

export default class Pathfinding {
  static reconstruct_path(cameFrom: Map<Position, Position>, current: Position) {
    const total_path = [current]
    while (cameFrom.has(current)) {
      current = cameFrom.get(current)
      total_path.unshift(current)
    }
    return total_path
  }

  static manhattan(pos: Position, goal: Position) {
    return Math.abs(pos.x - goal.x) + Math.abs(pos.y - goal.y)
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
        const tentative_gScore = (gScore.get(cur) || Infinity) + h(cur, neighbor)
        if (tentative_gScore < gScore.get(neighbor) || !gScore.has(neighbor)) {
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