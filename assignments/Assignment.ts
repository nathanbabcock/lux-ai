import Turn from '../helpers/Turn'
import { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'

export default class Assignment {
  type: string
  target: Position

  constructor(type: string, target: Position) {
    this.type = type
    this.target = target
  }

  /**
   * Heuristic for estimated cost for a unit to do this assignment,
   * typically just the manhattan distance, but could have additional penalties
   * or rewards to (dis)incentive certain assignments.
   */
  getCost(unit: Unit, turn: Turn): number {
    return unit.pos.distanceTo(this.target)
  }

  getAction(unit: Unit, turn: Turn): string | undefined {
    return
  }
}