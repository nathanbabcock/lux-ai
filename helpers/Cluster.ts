import { Cell } from '../lux/Cell'
import { CityTile } from '../lux/CityTile'
import { GameMap } from '../lux/GameMap'
import { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'
import { getNeighbors, getResources } from './helpers'
import { log } from './logging'

export default class Cluster {
  public cells: Cell[] = []

  getUnits(clusters: Array<Cluster>, units: Array<Unit>): Array<Unit> {
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

  /** Get all cells adjacent to a cell in this cluster, but not a part of the cluster itself */
  getPerimeter(gameMap: GameMap): Array<Cell> {
    const perimeter: Array<Cell> = []
    this.cells.forEach(cell => {
      const neighbors = getNeighbors(cell, gameMap)
      neighbors.forEach(neighbor => {
        if (this.cells.find(cell => cell.pos.equals(neighbor.pos))) return
        if (perimeter.find(cell => cell.pos.equals(neighbor.pos))) return
        if (neighbor.citytile) return
        if (neighbor.resource) return
        perimeter.push(neighbor)
      })
    })
    return perimeter
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
  const clusters: Array<Cluster> = []
  const resources = getResources(map)
  for (let i = 0; i < resources.length; i++) {
    const cell = resources[i]
    let cluster = clusters.find(cluster => cluster.cells.some(clusterCell => clusterCell.pos.isAdjacent(cell.pos)))
    if (!cluster) {
      cluster = new Cluster()
      clusters.push(cluster)
    }
    cluster.cells.push(cell)
  }

  // TODO: merge clusters
  outer: while (true) {
    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i]
      const connected = clusters.find(cluster2 => cluster !== cluster2 && cluster.cells.some(cell => cluster2.cells.some(cell2 => cell2.pos.isAdjacent(cell.pos))))
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
