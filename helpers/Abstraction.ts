import { Cell, Game, Position, Unit } from '@lux-ai/2021-challenge'
import GAME_CONSTANTS from '../lux/game_constants.json'

function distanceTo(position: Position, target: Position): number {
  return Math.abs(target.x - position.x) + Math.abs(target.y - position.y)
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
  static simulateBuildingCity(cityPos: Position, team: 0 | 1, game: Game) {
    const teamState = game.state.teamStates[team]
    const map = game.map

    const cityCell = map.getCellByPos(cityPos)
    if (cityCell.citytile) return false

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

    if (!closestResource) return false

    let closestUnit: Unit = undefined
    let closestUnitDist = Infinity
    for (const unit of teamState.units.values()) {
      const dist = distanceTo(unit.pos, closestResource.pos)
      if (dist < closestUnitDist) {
        closestUnit = unit
        closestUnitDist = dist
      }
    }
    if (!closestUnit) return false

    game.state.turn += (closestResourceDist + closestUnitDist) * 2
    closestResource.resource.amount = Math.max(closestResource.resource.amount - 100, 0)
    game.spawnCityTile(team, cityPos.x, cityPos.y)
  }
}

export function isNight(turn: number): boolean {
  const dayLength = GAME_CONSTANTS.PARAMETERS.DAY_LENGTH
  const cycleLength = dayLength + GAME_CONSTANTS.PARAMETERS.NIGHT_LENGTH
  return turn % cycleLength >= dayLength
}
