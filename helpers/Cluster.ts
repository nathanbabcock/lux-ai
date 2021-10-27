import { GameState } from '../lux/Agent'
import { Cell } from '../lux/Cell'
import { CityTile } from '../lux/CityTile'
import { GameMap } from '../lux/GameMap'
import { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'
import { getMapCenter, getNeighbors, getResourceAdjacency, getResources } from './helpers'
import { log } from './logging'

export default class Cluster {
  public type: string
  public cells: Cell[] = []
  public units: Unit[] = []

  constructor(type: string) {
    this.type = type
  }

  /** Returns units from either team who are inside of this cluster or on its perimeter */
  getUnits(gameState: GameState): Unit[] {
    const map = gameState.map
    const units: Unit[] = []
    const perimeter = this.getPerimeter(map, true)
    const cells = [...this.cells, ...perimeter]
    for (const player of gameState.players)
      for (const unit of player.units)
        for (const cell of cells)
          if (cell.pos.equals(unit.pos))
            units.push(unit)
    return units
  }

  getClosestUnits(clusters: Array<Cluster>, units: Array<Unit>): Array<Unit> {
    return units.filter(unit => getClosestCluster(clusters, unit.pos) === this)
  }

  getCityTiles(clusters: Array<Cluster>, cityTiles: Array<CityTile>): Array<CityTile> {
    return cityTiles.filter(cityTile => getClosestCluster(clusters, cityTile.pos) === this)
  }

  /** Returns average position of the cluster's Cells, rounded to the nearest integer */
  getCenter(): Position {
    const x = this.cells.reduce((sum, cell) => sum + cell.pos.x, 0) / this.cells.length
    const y = this.cells.reduce((sum, cell) => sum + cell.pos.y, 0) / this.cells.length
    return new Position(Math.round(x), Math.round(y))
  }

  /**
   * Get all cells adjacent to a cell in this cluster, but not a part of the cluster itself
   * @param allowCityTiles default = false
  */
  getPerimeter(gameMap: GameMap, allowCityTiles: boolean = false): Array<Cell> {
    const perimeter: Array<Cell> = []
    this.cells.forEach(cell => {
      const neighbors = getNeighbors(cell, gameMap)
      neighbors.forEach(neighbor => {
        if (this.cells.find(cell => cell.pos.equals(neighbor.pos))) return
        if (perimeter.find(cell => cell.pos.equals(neighbor.pos))) return
        if (neighbor.citytile && !allowCityTiles) return
        if (neighbor.resource) return
        perimeter.push(neighbor)
      })
    })
    return perimeter
  }

  /** Returns the best spot for a city on the perimeter of this cluster */
  getCitySite(gameMap: GameMap, perimeter?: Array<Cell>): Cell | null {
    if (!perimeter) perimeter = this.getPerimeter(gameMap)
    let bestCells: Array<Cell> = []
    let bestResourceAdjacency = 0

    perimeter.forEach(cell => {
      const adjacency = getResourceAdjacency(cell, gameMap)
      if (adjacency > bestResourceAdjacency) {
        bestResourceAdjacency = adjacency
        bestCells = [cell]
      } else if (adjacency === bestResourceAdjacency) {
        bestCells.push(cell)
      }
    })

    bestCells = bestCells.filter(cell => !cell.citytile)

    if (bestCells.length === 0) return null
    const mapCenter = getMapCenter(gameMap)
    bestCells.sort((a, b) => a.pos.distanceTo(mapCenter) - b.pos.distanceTo(mapCenter))
    return bestCells[0]
  }
}

export function getClosestCluster(clusters: Array<Cluster>, pos: Position) {
  let closest: Cluster = null
  let closestDist = 99999

  clusters.forEach(cluster => {
    cluster.cells.forEach(cell => {
      const dist = cell.pos.distanceTo(pos)
      if (dist < closestDist) {
        closest = cluster
        closestDist = dist
      }
    })
  })

  return closest
}

export function getClusters(map: GameMap) {
  const clusters: Cluster[] = []
  const resources = getResources(map)
  for (let i = 0; i < resources.length; i++) {
    const cell = resources[i]
    let cluster = clusters.find(cluster => cluster.type === cell.resource.type && cluster.cells.some(clusterCell => clusterCell.pos.isAdjacent(cell.pos)))
    if (!cluster) {
      cluster = new Cluster(cell.resource.type)
      clusters.push(cluster)
    }
    cluster.cells.push(cell)
  }

  outer: while (true) {
    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i]
      const connected = clusters.find(cluster2 => cluster !== cluster2 && cluster.type === cluster2.type && cluster.cells.some(cell => cluster2.cells.some(cell2 => cell2.pos.isAdjacent(cell.pos))))
      if (connected) {
        cluster.cells.push(...connected.cells)
        clusters.splice(clusters.indexOf(connected), 1)
        continue outer
      }
    }

    break
  }

  return clusters
}
