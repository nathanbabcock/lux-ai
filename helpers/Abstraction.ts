import { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'
import Pathfinding from './Pathfinding'
import GAME_CONSTANTS from '../lux/game_constants.json'

/**
 * This class will hold simulation code for a
 * higher-level view of the gameplay, looking at unit
 * assignments, their cost in turns, in resulting output
 * or changes in gamestate.
 * 
 * Tree search (MCTS or alpha-beta) will be used,
 * possibly in combination with RL for gamestate evaluation.
 */
export default class Abstraction {
  /** 
   * - How long does it take to move to the position and build?
   */
  simulateBuildingCity(unit: Unit, cityPos: Position) {
    // how long is it gonna take?
    // does it result in +1 unit?
    // where does that leave the unit? (and where will it branch to next?)
  }

  /**
   * - How long does it take to move there? (in a straight line, ignoring collision)
   * - Will any part of the journey happen at night, draining resources or resulting in death?
   */
  simulateMoving() {

  }

  /**
   * - How long does it take to do this?
   */
  simulateFuelingCity() {

  }
}

/**
 * Heuristic for the cost of a unit travelling between any two positions
 * 
 * Does take into account:
 * - Cooldown difference between day and night
 * - Resource cost of moving at night
 * - Death at night
 * 
 * Ignores:
 * - All collision
 * - Resources which might be collected along the way
 */
export class TravelProgress {
  unit: Unit
  from: Position
  to: Position
  curTurn: number
  distance: number
  remaining: number

  constructor(unit: Unit, to: Position, turn: number) {
    this.unit = unit
    this.from = unit.pos
    this.to = to
    this.curTurn = turn
    this.distance = Pathfinding.manhattan(unit.pos, to)
    this.remaining = this.distance
  }

  turn() {
    const night = isNight(this.curTurn)
    
    if (this.unit.canAct()) {
      this.remaining--
      this.unit.cooldown += GAME_CONSTANTS.PARAMETERS.UNIT_ACTION_COOLDOWN.WORKER * (night ? 2 : 1)
    }

    if (night) {
      // TODO spendFuelToSurvive() (/Unit/index.ts:44)
    }

    this.unit.cooldown = Math.min(this.unit.cooldown - 1, 0)
    this.curTurn++
  }
}

export function isNight(turn: number): boolean {
  const dayLength = GAME_CONSTANTS.PARAMETERS.DAY_LENGTH
  const cycleLength = dayLength + GAME_CONSTANTS.PARAMETERS.NIGHT_LENGTH
  return turn % cycleLength >= dayLength
}
