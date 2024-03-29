import { Game, SerializedState } from '@lux-ai/2021-challenge'
import type { GameState } from '../lux/Agent'
import { Cell } from '../lux/Cell'
import { City } from '../lux/City'
import { CityTile } from '../lux/CityTile'
import type { GameMap } from '../lux/GameMap'
import GAME_CONSTANTS from '../lux/game_constants.json'
import type { Player } from '../lux/Player'
import { Position } from '../lux/Position'
import type { Unit } from '../lux/Unit'
import { getClusters } from './Cluster'
import Director from './Director'

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

export function getClosestEmptyTile(gameMap: GameMap, pos: Position): Cell | null {
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
    const dist = cell.pos.distanceTo(pos)
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

  const closestEmptyTile = getClosestEmptyTile(gameState.map, unit.pos)
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
  const teamUnitCollision = otherUnitMoves
    .some((pos) => pos.equals(destination))
  const cityCollision = gameState.players
    .map(player => Array.from(player.cities.values())).flat() 
    .map(city => city.citytiles).flat()
    .some(citytile => citytile.pos.equals(destination))
  if (teamUnitCollision || cityCollision) {
    // Try to go around
    if (sidestep(unit, dir, otherUnitMoves, actions)) return

    // Otherwise stay where you are (never go backwards)
    otherUnitMoves.push(unit.pos)
    //actions.push(unit.move('center'))
  } else {
    otherUnitMoves.push(destination)
    actions.push(unit.move(dir))
  }
}

export function buildCityWithCollisionAvoidance(gameState: GameState, unit: Unit, city_pos: Position, actions: Array<string>, otherUnitMoves: Array<Position>) {
  const player = gameState.players[gameState.id]

  if (unit.pos.distanceTo(city_pos) === 0) {
    actions.push(unit.buildCity())
  } else {
    const dir = unit.pos.directionTo(city_pos)
    moveWithCollisionAvoidance(gameState, unit, dir, otherUnitMoves, actions)
  }
}

export function sidestep(unit: Unit, dir: string, otherUnitMoves: Array<Position>, actions: Array<string>): boolean {
  // Move perpendicular if you're blocked
  const alternatives = getPerpendicularDirections(dir)
  for (let i = 0; i < alternatives.length; i++) {
    const alternative = alternatives[i]
    const alternativeDestination = unit.pos.translate(alternative, 1)
    if (!otherUnitMoves.some((pos) => pos.equals(alternativeDestination))) {
      otherUnitMoves.push(alternativeDestination)
      actions.push(unit.move(alternative))
      return true
    }
  }
  return false
}

export function getPerpendicularDirections(dir: string): string[] {
  switch (dir) {
    case GAME_CONSTANTS.DIRECTIONS.NORTH:
    case GAME_CONSTANTS.DIRECTIONS.SOUTH:
      return [GAME_CONSTANTS.DIRECTIONS.EAST, GAME_CONSTANTS.DIRECTIONS.WEST]
    case GAME_CONSTANTS.DIRECTIONS.EAST:
    case GAME_CONSTANTS.DIRECTIONS.WEST:
      return [GAME_CONSTANTS.DIRECTIONS.NORTH, GAME_CONSTANTS.DIRECTIONS.SOUTH]
    case GAME_CONSTANTS.DIRECTIONS.CENTER:
    default:
      return [GAME_CONSTANTS.DIRECTIONS.CENTER]
  }
}

export function getCityTiles(player: Player) {
  // return Array.from(player.cities.values()).map(city => city.citytiles).flat()
  const cityTiles: Array<CityTile> = []
  player.cities.forEach(city => cityTiles.push(...city.citytiles))
  return cityTiles
}

export function getResources(gameMap: GameMap): Array<Cell> {
  const resourceTiles: Array<Cell> = []
  for (let y = 0; y < gameMap.height; y++) {
    for (let x = 0; x < gameMap.width; x++) {
      const cell = gameMap.getCell(x, y)
      if (cell.hasResource()) {
        resourceTiles.push(cell)
      }
    }
  }
  return resourceTiles
}

export function getResourcesSerialized(
  serializedMap: SerializedState['map'],
  width: number,
): Cell[] {
  const resourceTiles: Cell[] = []
  for (let y = 0; y < width; y++) {
    for (let x = 0; x < width; x++) {
      const serializedCell = serializedMap[y][x]
      if (serializedCell.resource) {
        const cell = new Cell(x, y)
        cell.resource = serializedCell.resource
        resourceTiles.push(cell)
      }
    }
  }
  return resourceTiles
}

/** Return all cells adjacent to this cell. Skip cells outside the map boundaries. */
export function getNeighbors(cell: Cell, gameMap: GameMap): Array<Cell> {
  const neighbors: Array<Cell> = []
  const { x, y } = cell.pos
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      if (i === j || i === -j) continue
      if (x + i < 0 || x + i >= gameMap.width || y + j < 0 || y + j >= gameMap.height) continue
      const neighbor = gameMap.getCell(x + i, y + j)
      if (neighbor) neighbors.push(neighbor)
    }
  }
  return neighbors
}

/**  Get the number of resources accessible to a worker on the given Cell, between 0-5 */
export function getResourceAdjacency(cell: Cell, gameMap: GameMap, player?: Player): number {
  const cells = [cell, ...getNeighbors(cell, gameMap)]
  let adjacency = 0
  cells.forEach((neighbor) => {
    if (!neighbor.hasResource()) return
    const canGather = !player
      || neighbor.resource.type === 'wood'
      || (neighbor.resource.type === 'coal' && player.researchedCoal())
      || (neighbor.resource.type === 'uranium' && player.researchedUranium())
    if (!canGather) return
    adjacency++
  })
  return adjacency
}

export function getMapCenter(gameMap: GameMap): Position {
  return new Position(Math.round(gameMap.width / 2), Math.round(gameMap.height / 2))
}

export function initTurn(gameState) {
  const actions = new Array<string>()
  const otherUnitMoves = new Array<Position>()
  const player = gameState.players[gameState.id]
  const opponent = gameState.players[(gameState.id + 1) % 2]
  const gameMap = gameState.map
  const resourceTiles = getResources(gameState.map)
  const clusters = getClusters(gameMap)
  const director = new Director()
  director.setClusters(clusters)

  return { actions, otherUnitMoves, player, opponent, gameMap, resourceTiles, clusters, director }
}

export function otherTeam(team: 0 | 1): 0 | 1 {
  return (team + 1) % 2 as 0 | 1
}

export function getClosestCell(reference: Cell, cells: Cell[]): Cell {
  let closestDist = Infinity
  let closestCell: Cell = undefined
  for (const cell of cells) {
    const dist = cell.pos.distanceTo(reference.pos)
    if (dist < closestDist) {
      closestDist = dist
      closestCell = cell
    }
  }
  return closestCell
}

export function isNight(turn: number): boolean {
  const dayLength = GAME_CONSTANTS.PARAMETERS.DAY_LENGTH
  const cycleLength = dayLength + GAME_CONSTANTS.PARAMETERS.NIGHT_LENGTH
  return turn % cycleLength >= dayLength
}

export function countCityTiles(game: Game, team: 0 | 1) {
  const cityTileCount = [0, 0]
  game.cities.forEach((city) => {
    cityTileCount[city.team] += city.citycells.length
  })
  return cityTileCount[team]
}

export function nightTurnsLeft(turn: number): number {
  const maxDays = GAME_CONSTANTS.PARAMETERS.MAX_DAYS
  const nightLength = GAME_CONSTANTS.PARAMETERS.NIGHT_LENGTH
  const dayLength = GAME_CONSTANTS.PARAMETERS.DAY_LENGTH
  const cycleLength = dayLength + nightLength
  const cyclePos = turn % cycleLength
  let curTurn = turn
  let nightTurns = 0
  if (cyclePos > dayLength) {
    const turnsTilMorning = cycleLength - cyclePos
    curTurn += turnsTilMorning
    nightTurns += turnsTilMorning
  }

  while (curTurn < maxDays) {
    curTurn += dayLength + nightLength
    nightTurns += nightLength
  }

  return nightTurns
}

/**
 * Get all cells adjacent to a citytile in this city, but not a part of the city itself
 * @see Cluster.getPerimeter()
*/
export function getCityPerimeter(city: City, map: GameMap): Cell[] {
  const perimeter: Cell[] = []
  city.citytiles.forEach(citytile => {
    const cell = map.getCellByPos(citytile.pos)
    const neighbors = getNeighbors(cell, map)
    neighbors.forEach(neighbor => {
      if (city.citytiles.find(cell => cell.pos.equals(neighbor.pos))) return
      if (perimeter.find(cell => cell.pos.equals(neighbor.pos))) return
      if (neighbor.citytile) return
      if (neighbor.resource) return
      perimeter.push(neighbor)
    })
  })
  return perimeter
}

export function getCityAdjacency(pos: Position, map: GameMap): number {
  const cell = map.getCellByPos(pos)
  const neighbors = getNeighbors(cell, map)
  let adjacency = 0
  for (const neighbor of neighbors) {
    if (neighbor.citytile) adjacency++
  }
  return adjacency
}
