import { Cell } from '../lux/Cell'
import { CityTile } from '../lux/CityTile'
import { GameMap } from '../lux/GameMap'
import { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'
import { getResources } from './helpers'

export default class Cluster {
  public cells: Cell[] = []

  getUnits(clusters: Array<Cluster>, units: Array<Unit>): Array<Unit> {
    return units.filter(unit => getClosestCluster(clusters, unit.pos) === this)
  }

  getCityTiles(clusters: Array<Cluster>, cityTiles: Array<CityTile>): Array<CityTile> {
    return cityTiles.filter(cityTile => getClosestCluster(clusters, cityTile.pos) === this)
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
  return clusters
}