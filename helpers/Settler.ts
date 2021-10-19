import { annotate, GameState } from '../lux/Agent'
import GAME_CONSTANTS from '../lux/game_constants.json'
import { Player } from '../lux/Player'
import { Position } from '../lux/Position'
import { buildCityWithCollisionAvoidance, getClosestResourceTile, getResources, moveWithCollisionAvoidance } from './helpers'
import { Mission } from './MonteCarlo'

export default class SettlerAgent {
  static updateCities(player: Player, actions: string[]) {
    for (const city of player.cities.values()) {
      for (const citytile of city.citytiles) {
        if (citytile.cooldown > 0) continue
        if (player.units.length < player.cityTileCount)
          actions.push(citytile.buildWorker())
        else
          actions.push(citytile.research())
      }
    }
  }

  static updateUnits(
    gameState: GameState,
    assignments: Map<string, Mission>,
    otherUnitMoves: Position[],
    actions: string[]
  ) {
    const player = gameState.players[gameState.id]
    for (const unit of player.units) {
      const mission = assignments.get(unit.id)
      const destination = mission.city_pos
      actions.push(annotate.line(unit.pos.x, unit.pos.y, destination.x, destination.y))
      const resourceTiles = getResources(gameState.map)

      if (!unit.canAct()) continue
      if (unit.type !== GAME_CONSTANTS.UNIT_TYPES.WORKER) continue

      if (unit.getCargoSpaceLeft() > 0) {
        const closestResourceTile = getClosestResourceTile(resourceTiles, player, unit)
        if (closestResourceTile === null) continue 
        const dir = unit.pos.directionTo(closestResourceTile.pos)
        moveWithCollisionAvoidance(gameState, unit, dir, otherUnitMoves, actions)
      } else {
        buildCityWithCollisionAvoidance(gameState, unit, destination, actions, otherUnitMoves)
      }
    }
  }

  static turn(
    gameState: GameState,
    assignments: Map<string, Mission>,
  ): string[] {
    const actions: string[] = []
    const player = gameState.players[gameState.id]
    const otherUnitMoves: Position[] = []
    SettlerAgent.updateCities(player, actions)
    SettlerAgent.updateUnits(gameState, assignments, otherUnitMoves, actions)
    return actions
  }
}
