import Turn from '../helpers/Turn'
import { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'
import Assignment from './Assignment'

/** Builds a citytile at a given location */
export default class Settler extends Assignment {
  constructor(target: Position) {
    super('settler', target)
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