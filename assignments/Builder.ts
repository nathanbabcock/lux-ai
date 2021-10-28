import { getCityAdjacency, getCityPerimeter, nightTurnsLeft } from '../helpers/helpers'
import Turn from '../helpers/Turn'
import GAME_CONSTANTS from '../lux/game_constants.json'
import { Position } from '../lux/Position'
import Settler from './Settler'

/** Exactly the same as a Settler, but appends tiles to existing cities */
export default class Builder extends Settler {
  constructor(target: Position) {
    super(target)
    this.type = 'builder'
  }

  static getAssignments(turn: Turn): Builder[] {
    const assignments: Builder[] = []
    const nightTurns = nightTurnsLeft(turn.gameState.turn)
    for (const [cityId, city] of turn.player.cities) {
      const totalUpkeep = city.getLightUpkeep() * nightTurns

      const surplus = city.fuel - totalUpkeep
      const cityTileUpkeep = GAME_CONSTANTS.PARAMETERS.LIGHT_UPKEEP.CITY - 5 // minimum 1-tile adajacency bonus
      const capacity = Math.max(Math.round(surplus / cityTileUpkeep), 0)
      if (capacity <= 0) continue

      const cityPerim = getCityPerimeter(city, turn.map)
      cityPerim.sort((a, b) => getCityAdjacency(b.pos, turn.map) - getCityAdjacency(a.pos, turn.map))
      for (let i = 0; i < Math.min(capacity, cityPerim.length); i++) {
        const builder = new Builder(cityPerim[i].pos)
        assignments.push(builder)
      }
    }
    return assignments
  }
}
