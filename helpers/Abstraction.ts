import { Cell, Game, Position, Unit } from '@lux-ai/2021-challenge'
import GAME_CONSTANTS from '../lux/game_constants.json'

function distanceTo(position: Position, target: Position): number {
  return Math.abs(target.x - position.x) + Math.abs(target.y - position.y)
}

export type CityTreeNode = {
  game: Game
  
  /** `∀ u ∈ units (u.turn <= game.turn)` */
  units: UnitLocalState[]
}

/** Unit location in space *and time (!)* */
export type UnitLocalState = {
  id: string
  team: 0 | 1
  pos: Position
  turn: number
}

/**
 * This class will hold simulation code for a
 * higher-level view of the gameplay, looking only
 * at citytile locations and resulting changes in gamestate.
 * Units will be teleported around accordingly, resources costs
 * will be estimated and deducted, and the day/night cycle will
 * be kept track of.
 * 
 * Tree search (MCTS or alpha-beta) will be used,
 * possibly in combination with RL for gamestate evaluation.
 */
export default class Abstraction {
  /**
   * @param {Game} game modified in place (including `game.state.turn`, resources collected, and citytiles built)
   * @returns a new {@link UnitLocalState} after this simulation
   */
  static simulateBuildingCity(cityPos: Position, unit: UnitLocalState, game: Game): UnitLocalState | undefined {
    const teamState = game.state.teamStates[unit.team]
    const map = game.map

    const cityCell = map.getCellByPos(cityPos)
    if (cityCell.citytile) return undefined

    const resources = map.resources
    let closestResource: Cell | undefined
    let closestResourceDist = Infinity
    for (const cell of resources) {
      if (cell.resource.type === 'coal' && !teamState.researched.coal) continue
      if (cell.resource.type === 'uranium' && !teamState.researched.wood) continue
      const dist = distanceTo(cell.pos, cityPos)
      if (dist < closestResourceDist) {
        closestResource = cell
        closestResourceDist = dist
      }
    }

    if (!closestResource) return undefined

    const unitDist = distanceTo(unit.pos, closestResource.pos)
    let turnCost = (unitDist + closestResourceDist) * 2
    closestResource.resource.amount = Math.max(closestResource.resource.amount - 100, 0)
    game.spawnCityTile(unit.team, cityPos.x, cityPos.y)

    turnCost++
    game.spawnWorker(unit.team, cityPos.x, cityPos.y)

    const newUnit: UnitLocalState = {
      pos: cityPos,
      turn: unit.turn + turnCost,
      team: unit.team,
      id: unit.id,
    }

    game.state.turn = Math.max(game.state.turn, newUnit.turn)

    return newUnit
  }
}

export function isNight(turn: number): boolean {
  const dayLength = GAME_CONSTANTS.PARAMETERS.DAY_LENGTH
  const cycleLength = dayLength + GAME_CONSTANTS.PARAMETERS.NIGHT_LENGTH
  return turn % cycleLength >= dayLength
}
