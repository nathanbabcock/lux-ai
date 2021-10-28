import Pathfinding from '../helpers/Pathfinding'
import Turn from '../helpers/Turn'
import { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'
import Assignment from './Assignment'

/** Move to a location and stay there until future assignment */
export default class Guard extends Assignment {
  constructor(target: Position) {
    super('guard', target)
  }

  getAction(unit: Unit, turn: Turn): string | undefined {
    if (!unit.canAct()) return turn.idle(unit) // skip pathfinding entirely

    const dist = unit.pos.distanceTo(this.target)
    if (dist === 0) return turn.idle(unit)
    const path = Pathfinding.simple_astar(unit, this.target, turn, false)

    if (!path || path.length <= 1)
      return

    const dir = unit.pos.directionTo(path[1].pos)
    return turn.moveWithCollisionAvoidance(unit, dir)
  }

  getCost(unit: Unit, turn: Turn): number {
    return unit.pos.distanceTo(this.target)
  }
}