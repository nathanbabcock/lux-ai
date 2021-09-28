import type { GameState } from '../lux/Agent'
import type { Cell } from '../lux/Cell'
import { City } from '../lux/City'
import { CityTile } from '../lux/CityTile'
import type { GameMap } from '../lux/GameMap'
import GAME_CONSTANTS from '../lux/game_constants.json'
import type { Player } from '../lux/Player'
import { Position } from '../lux/Position'
import type { Unit } from '../lux/Unit'

export function getClosestResourceTile(resourceTiles: Array<Cell>, player: Player, unit: Unit): Cell | null {
  // if the unit is a worker and we have space in cargo, lets find the nearest resource tile and try to mine it
  let closestResourceTile: Cell = null
  let closestDist = 9999999
  resourceTiles.forEach((cell) => {
    if (cell.resource.type === GAME_CONSTANTS.RESOURCE_TYPES.COAL && !player.researchedCoal()) return
    if (cell.resource.type === GAME_CONSTANTS.RESOURCE_TYPES.URANIUM && !player.researchedUranium()) return
    const dist = cell.pos.distanceTo(unit.pos)
    if (dist < closestDist) {
      closestDist = dist
      closestResourceTile = cell
    }
  })

  return closestResourceTile
}

export function getClosestEmptyTile(gameMap: GameMap, unit: Unit): Cell | null {
  const emptyTiles: Array<Cell> = []
  for (let y = 0; y < gameMap.height; y++) {
    for (let x = 0; x < gameMap.width; x++) {
      const cell = gameMap.getCell(x, y)
      if (!cell.hasResource() && !cell.citytile) {
        emptyTiles.push(cell)
      }
    }
  }

  let closestEmptyTile: Cell = null
  let closestDist = 9999999
  emptyTiles.forEach((cell) => {
    const dist = cell.pos.distanceTo(unit.pos)
    if (dist < closestDist) {
      closestDist = dist
      closestEmptyTile = cell
    }
  })

  return closestEmptyTile
}

export function goHome(player: Player, unit: Unit, actions: Array<string>) {
  // if unit is a worker and there is no cargo space left, and we have cities, lets return to them
  if (player.cities.size > 0) {
    const city: City = player.cities.values().next().value
    let closestDist = 999999
    let closestCityTile: CityTile = null

    city.citytiles.forEach((citytile) => {
      const dist = citytile.pos.distanceTo(unit.pos)
      if (dist < closestDist) {
        closestCityTile = citytile
        closestDist = dist
      }
    })

    if (closestCityTile != null) {
      const dir = unit.pos.directionTo(closestCityTile.pos)
      actions.push(unit.move(dir))
    }
  }
}

export function buildCity(gameState: GameState, unit: Unit, actions: Array<string>) {
  const player = gameState.players[gameState.id]

  const closestEmptyTile = getClosestEmptyTile(gameState.map, unit)
  if (!closestEmptyTile) return console.warn('no empty tile found')

  if (unit.pos.distanceTo(closestEmptyTile.pos) === 0) {
    actions.push(unit.buildCity())
  } else {
    const dir = unit.pos.directionTo(closestEmptyTile.pos)
    actions.push(unit.move(dir))
  }
}

export function moveWithCollisionAvoidance(gameState: GameState, unit: Unit, dir: string, otherUnitMoves: Array<Position>, actions: Array<string>) {
  const destination = unit.pos.translate(dir, 1)
  if (otherUnitMoves.some((pos) => pos.equals(destination))) {
    otherUnitMoves.push(unit.pos)
    actions.push(unit.move('center'))
  } else {
    otherUnitMoves.push(destination)
    actions.push(unit.move(dir))
  }
}
