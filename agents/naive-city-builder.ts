import { buildCity, getClosestResourceTile } from '../helpers/helpers'
import { Agent, GameState } from '../lux/Agent'
import { Cell } from '../lux/Cell'

const agent = new Agent()
// agent.run takes care of running your code per tick
agent.run((gameState: GameState): Array<string> => {
  const actions = new Array<string>()

  const player = gameState.players[gameState.id]
  const opponent = gameState.players[(gameState.id + 1) % 2]
  const gameMap = gameState.map

  const resourceTiles: Array<Cell> = []
  for (let y = 0; y < gameMap.height; y++) {
    for (let x = 0; x < gameMap.width; x++) {
      const cell = gameMap.getCell(x, y)
      if (cell.hasResource()) {
        resourceTiles.push(cell)
      }
    }
  }
  
  // we iterate over all our units and do something with them
  for (let i = 0; i < player.units.length; i++) {
    const unit = player.units[i]
    if (unit.isWorker() && unit.canAct()) {
      if (unit.getCargoSpaceLeft() > 0) {
        const closestResourceTile = getClosestResourceTile(resourceTiles, player, unit)
        if (closestResourceTile != null) {
          const dir = unit.pos.directionTo(closestResourceTile.pos)
          // move the unit in the direction towards the closest resource tile's position.
          actions.push(unit.move(dir))
        }
      } else {
        // if the unit is a worker and we have no space in cargo, lets return to our cities
        // goHome(player, unit, actions)
        buildCity(gameState, unit, actions)
      }
    }
  }

  player.cities.forEach((city) => {
    city.citytiles.forEach((citytile) => {
      if (citytile.cooldown >= 1) return
      if (player.units.length < player.cityTileCount)
        actions.push(citytile.buildWorker())
      else
        actions.push(citytile.research())
    })
  })

  // return the array of actions
  return actions
})
