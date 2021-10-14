import { Position } from '../lux/Position'
import { MovementState } from './StateNode'

/**
 * The Director (V2)'s job is to assign Missions to units,
 * keep track of Mission completion, prevent movement collisions
 * between units during their execution of their Missions, and
 * (later) to conduct iterative multi-agent pathfinding.
 * 
 * Deterministic missions VS. Mission memory
 * - Missions must have memory across turns, for the purposes
 *   of tree search and hypothetical exploration of options\
 * 
 * TODO next week?
 */
export default class DirectorV2 {
	pathAssignments: Map<string, Map<number, string>> = new Map()
	buildAssignments: Map<string, Position> = new Map()
 
  setPath(unit_id: string, path: MovementState[], startTurn: number = path[0].gameState.turn) {
    let turn = startTurn
    const map = new Map<number, string>()
    path.forEach(node => map.set(turn++, node.action))
    this.pathAssignments.set(unit_id, map)
  }

  getUnitAction(unit_id: string, turn: number): string | null {
    const unitPath = this.pathAssignments.get(unit_id)
    if (!unitPath) return null
    const action = unitPath.get(turn)
    return action
  }

  getTurnActions(turn: number) {
    const actions: string[] = []
    for (const path of this.pathAssignments.values()) {
      const action = path.get(turn)
      if (action) actions.push(action)
    }
    return actions
  }

  clone(): DirectorV2 {
    const director = new DirectorV2()
    director.pathAssignments = new Map()
    for (const [unit_id, path] of this.pathAssignments.entries())
      director.pathAssignments.set(unit_id, new Map(path))
    director.buildAssignments = new Map(this.buildAssignments)
    return director
  }
}
