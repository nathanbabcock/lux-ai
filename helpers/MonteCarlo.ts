import { GameState } from '../lux/Agent'
import { Cell } from '../lux/Cell'
import { Position } from '../lux/Position'
import { getClusters } from './Cluster'
import uuid from './uuid'

export type SimpleAssignment = {unit: string, cluster: number}
export type SimpleAssignments = SimpleAssignment[]

export default class MonteCarlo {
  root: TreeNode

  static renderGraphViz(node: TreeNode) {
    let result = 'graph "" {\n'
    result += node.render()
    result += '}\n'
    return result
  }

  static generateAssignmentsSimple(units: string[], clusters: number[]) {
    const assignments: SimpleAssignments[] = []
    for (const cluster of clusters) {
      const newAssignment = {unit: units[0], cluster}

      if (units.length === 1) {
        assignments.push([newAssignment])
        continue
      }

      const remainingAssignments = MonteCarlo.generateAssignmentsSimple(
        units.slice(1),
        clusters,
      )

      remainingAssignments.forEach(otherUnitAssignments =>
        assignments.push([newAssignment, ...otherUnitAssignments])
      )
    }
    return assignments
  }
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

  /**
   * Expansion phase of MCTS.
   * 
   * Generates and initializes all children of this node.
   */
  expand() {
    const map = this.gameState.map
    const units = this.gameState.players[this.player].units
    const unassigned = units.filter(unit => !this.assignments.has(unit.id))
    const clusters = getClusters(map)
    const assignments = MonteCarlo.generateAssignmentsSimple(
      unassigned.map(unit => unit.id),
      clusters.map((_, index) => index)
    )
    assignments.forEach(assignment => {
      const assignmentMap = new Map<string, Mission>()
      const child = new TreeNode(this.gameState, assignmentMap)

      assignment.forEach(unitAssignment => {
        const unit_id = unitAssignment.unit
        const cluster = clusters[unitAssignment.cluster]
        const unit = units.find(unit => unit.id === unit_id)

        let closestDist = Infinity
        let closest: Cell = undefined
        const perimeter = cluster.getPerimeter(map)
        for (const cell of perimeter) {
          const dist = cell.pos.distanceTo(unit.pos)
          if (dist < closestDist) {
            closestDist = dist
            closest = cell
          }
        }
        if (!closest) return

        const mission = {
          unit_id,
          city_pos: closest.pos,
        }

        assignmentMap.set(unit_id, mission)
      })
      this.addChild(child)
    })
  }

  printAssignments(): string {
    let result = ''
    for (const val of this.assignments.values())
      result += `${val.unit_id}: (${val.city_pos.x}, ${val.city_pos.y})<br/>`
    return result    
  }

  /** Recursively renders this node and all its children to a partial DOT graphviz representation */
  render(parent_uuid?: string) {
    let result = ''
    if (!parent_uuid) parent_uuid = uuid()

    let label = ''
    if (this.gameState)
      label += `Turn ${this.gameState.turn}<br/>`
    if (!this.parent)
      label += 'root\<br/>'
    if (this.assignments)
      label += this.printAssignments()
    label += `<b>${this.wins}/${this.plays}</b>`

    result += `  ${parent_uuid} [label=<${label}> fontname="helvetica"]\n`

    this.children.forEach(child => {
      const child_uuid = uuid()
      result += `  ${parent_uuid} -- ${child_uuid}\n`
      result += child.render(child_uuid)
    })

    return result
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
