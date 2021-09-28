import { getClosestEmptyTile, getClosestResourceTile, moveWithCollisionAvoidance } from '../helpers/helpers'
import { Agent, GameState } from '../lux/Agent'
import { Cell } from '../lux/Cell'
import type { Position } from '../lux/Position'
import type { Unit } from '../lux/Unit'

function buildCityWithCollisionAvoidance(gameState: GameState, unit: Unit, actions: Array<string>, otherUnitMoves: Array<Position>) {
  const player = gameState.players[gameState.id]

  const closestEmptyTile = getClosestEmptyTile(gameState.map, unit)
  if (!closestEmptyTile) return console.warn('no empty tile found')

  if (unit.pos.distanceTo(closestEmptyTile.pos) === 0) {
    actions.push(unit.buildCity())
  } else {
    const dir = unit.pos.directionTo(closestEmptyTile.pos)
    moveWithCollisionAvoidance(gameState, unit, dir, otherUnitMoves, actions)
  }
}

const agent = new Agent()
agent.run((gameState: GameState): Array<string> => {
  const actions = new Array<string>()
  const otherUnitMoves = new Array<Position>()

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
          // actions.push(unit.move(dir))
          moveWithCollisionAvoidance(gameState, unit, dir, otherUnitMoves, actions)
        }
      } else {
        // if the unit is a worker and we have no space in cargo, lets return to our cities
        // goHome(player, unit, actions)
        buildCityWithCollisionAvoidance(gameState, unit, actions, otherUnitMoves)
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
