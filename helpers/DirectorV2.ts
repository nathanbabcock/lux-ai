import { Position } from '../lux/Position'
import GAME_CONSTANTS from '../lux/game_constants.json'
import { Unit } from '../lux/Unit'

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
  missions: Record<string, Mission> = {}
  positions: Record<string, Position> = {}
}

export class Mission {
  destination: Position

  getAction(unit: Unit): string {
    return unit.move(GAME_CONSTANTS.DIRECTIONS.CENTER)
  }

  checkCompleted(): boolean {
    return false
  }
}
