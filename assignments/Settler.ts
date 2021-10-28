import { log } from '../helpers/logging'
import Pathfinding from '../helpers/Pathfinding'
import { PositionState } from '../helpers/StateNode'
import Turn from '../helpers/Turn'
import { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'
import Assignment from './Assignment'

/** Builds a citytile at a given location */
export default class Settler extends Assignment {
  constructor(target: Position) {
    super('settler', target)
  }

  getAction(unit: Unit, turn: Turn): string | undefined {
    if (!unit.canAct()) return // skip pathfinding entirely
    let path: PositionState[] = []

    if (unit.getCargoSpaceLeft() > 0) {
      const closestResource = turn.getClosestResourceTile(unit, 'wood') // only use wood for building, for now
      if (!closestResource) return

      const empty = unit.getCargoSpaceLeft() === 100 // If empty, you can safely move over friendly citytiles
      path = Pathfinding.simple_astar(unit, closestResource.pos, turn, !empty) 
    } else {
      const dist = unit.pos.distanceTo(this.target)
      if (dist === 0) return unit.buildCity()
      path = Pathfinding.simple_astar(unit, this.target, turn, true)
    }

    if (!path || path.length <= 1)
      return

    const dir = unit.pos.directionTo(path[1].pos)
    return turn.moveWithCollisionAvoidance(unit, dir)
  }

  getCost(unit: Unit, turn: Turn): number {
    // Must gather resources first
    if (unit.getCargoSpaceLeft() > 0) {
      const closestResource = turn.getClosestResourceTile(unit, 'wood') // only use wood for building, for now
      const resourceDist = unit.pos.distanceTo(closestResource.pos)
      const cityDist = closestResource.pos.distanceTo(this.target)
      return resourceDist + cityDist
    }

    return unit.pos.distanceTo(this.target)
  }
}