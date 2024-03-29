import Pathfinding from '../helpers/Pathfinding'
import { PositionState } from '../helpers/StateNode'
import Turn from '../helpers/Turn'
import GAME_CONSTANTS from '../lux/game_constants.json'
import { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'
import Assignment from './Assignment'

/** Builds a citytile at a given location */
export default class Settler extends Assignment {
  constructor(target: Position) {
    super('settler', target)
  }

  getAction(unit: Unit, turn: Turn): string | undefined {
    if (!unit.canAct()) return turn.wait(unit) // skip pathfinding entirely
    let path: PositionState[] = []

    if (unit.getCargoSpaceLeft() > 0) {
      const closestResource = turn.getClosestResourceTile(unit, this.target, 'wood') // only use wood for building, for now
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
      const closestResource = turn.getClosestResourceTile(unit, this.target, 'wood') // only use wood for building, for now
      if (!closestResource) return Number.MAX_SAFE_INTEGER
      const resourceDist = unit.pos.distanceTo(closestResource.pos)
      const cityDist = closestResource.pos.distanceTo(this.target)
      return resourceDist + cityDist
    }

    return unit.pos.distanceTo(this.target)
  }

  static getAssignments(turn: Turn): Settler[] {
    const assignments: Settler[] = []
    for (const cluster of turn.clusters) {
      if (cluster.type === 'coal' && turn.player.researchPoints < GAME_CONSTANTS.PARAMETERS.RESEARCH_REQUIREMENTS.COAL * 0.8) continue
      if (cluster.type === 'uranium' && turn.player.researchPoints < GAME_CONSTANTS.PARAMETERS.RESEARCH_REQUIREMENTS.URANIUM * 0.8) continue
      const perimeter = cluster.getPerimeter(turn.map, false)
      for (const cell of perimeter) {
        const settler = new Settler(cell.pos)
        assignments.push(settler)
      }
    }
    return assignments
  }
}