import { Player } from '../lux/Player'
import { Unit } from '../lux/Unit'
import Cluster, { getClosestCluster } from './Cluster'
import { getCityTiles } from './helpers'
import { log } from './logging'

export default class Director {
  public assignments: Map<Cluster, Array<Unit>> = new Map()

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
}
