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
  astar(unit: Unit, pos: Position) {
    const openlist: PathNode[] = [{
      pos: unit.pos,
      f: 0,
      g: 0,
      h: 0,
    }]
    const closedlist: PathNode[] = []

    while (openlist.length > 0) {
      // I am not confident in sort order and comparison so 
      // lets manually and methodically sort the list
      let q: PathNode | undefined = undefined
      openlist.forEach(node => {
        if (q === undefined || node.f < q.f)
          q = node
      })
      openlist.splice(openlist.indexOf(q!), 1)

      // TODO: transcribe the rest of the algorithm
      // https://www.geeksforgeeks.org/a-search-algorithm/
    }
  }
}