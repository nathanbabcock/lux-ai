import { Cell } from '../lux/Cell'
import { GameMap } from '../lux/GameMap'
import GAME_CONSTANTS from '../lux/game_constants.json'
import { Player } from '../lux/Player'
import { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'
import Cluster, { getClosestCluster } from './Cluster'
import { getCityTiles } from './helpers'

export default class Director {
  public assignments: Map<Cluster, Array<Unit>> = new Map()
  public cityPlans: Array<Position> = new Array<Position>()
  public resourcePlans: Array<Position> = new Array<Position>()

  getClusters(): Array<Cluster> {
    return Array.from(this.assignments.keys())
  }

  /** Called each turn to update the array of clusters */
  setClusters(clusters: Array<Cluster>) {
    this.assignments.clear()
    clusters.forEach(cluster => this.assignments.set(cluster, []))
  }

  assignToCluster(unit: Unit, cluster: Cluster) {
    this.assignments.get(cluster).push(unit)
  }

  getUnitAssignment(unit: Unit, player: Player): Cluster | null {
    const clusters = this.getClusters()
    // log(`${clusters.length} total clusters`)

    const emptyClusters = clusters.filter(cluster => {
      // No city tiles
      if (cluster.getCityTiles(clusters, getCityTiles(player)).length > 0) return false

      // No assigned workers
      if (this.assignments.get(cluster).length > 0) return false

      return true
    })
    // log(`${emptyClusters.length} empty clusters`)

    if (emptyClusters.length === 0) return null

    const closest = getClosestCluster(emptyClusters, unit.pos)
    // log(`Closest cluster is ${closest}`)
    return closest
  }

  getClosestCityPos(map: GameMap, pos: Position): Cell | null {
    const emptyTiles: Array<Cell> = []
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const cell = map.getCell(x, y)
        if (cell.hasResource()) continue
        if (cell.citytile) continue 
        if (this.cityPlans.find(plan => plan.equals(cell.pos))) continue
        emptyTiles.push(cell)
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

  getClosestResourceTile(resourceTiles: Array<Cell>, player: Player, unit: Unit): Cell | null {
    // if the unit is a worker and we have space in cargo, lets find the nearest resource tile and try to mine it
    let closestResourceTile: Cell = null
    let closestDist = 9999999
    resourceTiles.forEach((cell) => {
      if (cell.resource.type === GAME_CONSTANTS.RESOURCE_TYPES.COAL && !player.researchedCoal()) return
      if (cell.resource.type === GAME_CONSTANTS.RESOURCE_TYPES.URANIUM && !player.researchedUranium()) return
      if (this.resourcePlans.find(plan => plan.equals(cell.pos))) return
      const dist = cell.pos.distanceTo(unit.pos)
      if (dist < closestDist) {
        closestDist = dist
        closestResourceTile = cell
      }
    })
  
    return closestResourceTile
  }
}
