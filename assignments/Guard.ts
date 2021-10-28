import Pathfinding from '../helpers/Pathfinding'
import Turn from '../helpers/Turn'
import GAME_CONSTANTS from '../lux/game_constants.json'
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

  static getAssignments(turn: Turn): Guard[] {
    const assignments: Guard[] = []
    for (const cluster of turn.clusters) {
      if (cluster.type === 'coal' && turn.player.researchPoints < GAME_CONSTANTS.PARAMETERS.RESEARCH_REQUIREMENTS.COAL * 0.8) continue
      if (cluster.type === 'uranium' && turn.player.researchPoints < GAME_CONSTANTS.PARAMETERS.RESEARCH_REQUIREMENTS.URANIUM * 0.8) continue
      const perimeter = cluster.getPerimeter(turn.map, false)
      const numGuards = Math.max(cluster.cells.length - perimeter.length, 0)
      for (let i = 0; i < numGuards; i++) {
        // Which specific cells will be guarded is arbitrary AND deterministic (stable across turns)
        const cell = cluster.cells[i]
        const guard = new Guard(cell.pos)
        assignments.push(guard)
      }
    }
    return assignments
  }
}