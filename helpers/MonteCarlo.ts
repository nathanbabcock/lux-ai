import { GameState } from '../lux/Agent'
import { Cell } from '../lux/Cell'
import { GameMap } from '../lux/GameMap'
import { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'
import Cluster, { getClusters } from './Cluster'

export default class MonteCarlo {
  root: TreeNode
}

export class TreeNode {
  plays: number = 0
  wins: number = 0

  /** mapping from unit ids to their Missions assigned at this node */
  assignments: Map<string, Mission> = new Map()
  gameState: GameState
  parent?: TreeNode
  children: TreeNode[] = []

  /** Although turns in Lux are simultaneous, the MCTS divides actions/assignments per-team */
  player: number

  constructor(gameState: GameState, assignments?: Map<string, Mission>) {
    this.gameState = gameState
    this.player = gameState.id
    if (assignments) this.assignments = assignments
  }

  /** Get all possible assignments for one unit */
  generateAssignments(units: Unit[], clusters: Cluster[]): SettlerMission[][] {
    const assignments: Mission[][] = []
    const map = this.gameState.map

    if (units.length === 0) return []

    for (const unit of units) {
      let cluster_id = 0
      for (const cluster of clusters) {
        cluster_id++
        const perimeter = cluster.getPerimeter(map)
        if (perimeter.length === 0) continue
        let closestDist = Infinity
        let closest: Cell = undefined
        for (const cell of perimeter) {
          const dist = cell.pos.distanceTo(unit.pos)
          if (dist < closestDist) {
            closestDist = dist
            closest = cell
          }
        }
        if (!closest) continue

        const thisAssignment: SettlerMission = {
          unit_id: unit.id,
          city_pos: closest.pos,
          cluster_id: cluster_id,
        }

        const remainingAssignments = this.generateAssignments(
          units.filter(u => u.id !== unit.id),
          clusters,
        )

        if (remainingAssignments.length === 0)
          assignments.push([thisAssignment])

        remainingAssignments.forEach(otherAssignments => {
          assignments.push([
            thisAssignment,
            ...otherAssignments,
          ])
        })
      }
    }

    return assignments
  }

  getAllPossibleAssignments(): Mission[][] {
    const map = this.gameState.map
    const units = this.gameState.players[this.player].units
    console.log(`Units: ${units.length}`)
    const unassigned = units.filter(unit => !this.assignments.has(unit.id))
    console.log(`Unassigned: ${unassigned.length}`)
    const clusters = getClusters(map)
    console.log(`Clusters: ${clusters.length}`)
    return this.generateAssignments(unassigned, clusters)
  }

  addChild(child: TreeNode) {
    child.parent = this
    this.children.push(child)
  }
}

export type SettlerMission = {
  unit_id: string
  city_pos: Position
  cluster_id?: number
}

export type RefuelMission = {
  unit_id: string
  city_pos: Position
}

export type Mission = SettlerMission | RefuelMission
