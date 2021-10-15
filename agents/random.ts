import { chooseRandom } from '../helpers/util'
import { GameState } from '../lux/Agent'
import GAME_CONSTANTS from '../lux/game_constants.json'

export function randomActions(gameState: GameState): string[] {
  const actions: string[] = []
  const gameMap = gameState.map

  const player = gameState.players[gameState.id]

  // we iterate over all our units and do something with them
  for (let i = 0; i < player.units.length; i++) {
    const unit = player.units[i]

    if (!unit.canAct()) continue

    const possibleActions = [
      unit.move(GAME_CONSTANTS.DIRECTIONS.NORTH),
      unit.move(GAME_CONSTANTS.DIRECTIONS.SOUTH),
      unit.move(GAME_CONSTANTS.DIRECTIONS.EAST),
      unit.move(GAME_CONSTANTS.DIRECTIONS.WEST),
      null, // represents a no-op, instead of move('c') which generates an error
    ]

    if (unit.canBuild(gameMap))
      possibleActions.push(unit.buildCity())

    const chosenAction = chooseRandom(possibleActions)
    if (chosenAction !== null) actions.push(chosenAction)
  }

  // Note that citytiles behave deterministically, not randomly
  player.cities.forEach((city) => {
    city.citytiles.forEach((citytile) => {
      if (citytile.cooldown >= 1) return
      if (player.units.length < player.cityTileCount)
        actions.push(citytile.buildWorker())
      else
        actions.push(citytile.research())
    })
  })

  return actions
}
