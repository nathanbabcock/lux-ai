import { LuxDesignLogic } from '@lux-ai/2021-challenge'
import SettlerAgent from './Settler'
import { GameState } from '../lux/Agent'
import { Cell } from '../lux/Cell'
import { GameMap } from '../lux/GameMap'
import { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'
import Cluster, { getClusters } from './Cluster'
import Convert from './Convert'
import Sim from './Sim'
import { chooseRandom } from './util'
import uuid from './uuid'

export type SimpleAssignment = {unit: string, cluster: number}
export type SimpleAssignments = SimpleAssignment[]

export default class MonteCarlo {
  root: TreeNode

  static renderGraphViz(node: TreeNode) {
    let result = 'graph {\n'
    result += `  node [shape=circle fontname="CMU Serif"]\n`
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

  static generateSpecificSettlerMissionForUnit(unit: Unit, cluster: Cluster, map: GameMap): SettlerMission {
    const unit_id = unit.id
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

    return mission
  }

  static generateAllUnitMissions(unit: Unit, map: GameMap): Mission[] {
    const clusters = getClusters(map)
    const missions = clusters.map(cluster => MonteCarlo.generateSpecificSettlerMissionForUnit(unit, cluster, map))
    return missions
  }

  /** Deep clone of an assignment map, with new internal Mission and Position objects */
  static copyAssignments(assignments: Map<string, Mission>): Map<string, Mission> {
    const newAssignments = new Map<string, Mission>()
    for (const assignment of assignments.values()) {
      newAssignments.set(assignment.unit_id, {
        unit_id: assignment.unit_id,
        city_pos: new Position(assignment.city_pos.x, assignment.city_pos.y),
      })
    }
    return newAssignments
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
        const mission = MonteCarlo.generateSpecificSettlerMissionForUnit(unit, cluster, map)
        assignmentMap.set(unit_id, mission)
      })
      this.addChild(child)
    })
  }

  /**
   * Simulation phase of MCTS.
   * 
   * Advances the current node through the end of the game,
   * with the given assignments and gamestate as a starting point,
   * choosing randomly for all subsequent decisions.
   */
  async simulate(sim: Sim): Promise<0 | 0.5 | 1> {
    if (!this.gameState)
      console.warn('Simulate called without a starting gameState')

    const serializedState = Convert.toSerializedState(this.gameState)
    sim.reset(serializedState)

    const curAssignments = MonteCarlo.copyAssignments(this.assignments)
    const curGameState = this.gameState
    while (!LuxDesignLogic.matchOver(sim.match)) {
      curGameState.players.forEach(player => {
        player.units.forEach(unit => {
          const mission = curAssignments.get(unit.id)
          if (mission && curGameState.map.getCellByPos(mission.city_pos).citytile)
            curAssignments.delete(unit.id)

          if (!curAssignments.has(unit.id)) {
            const possibleAssignments = MonteCarlo.generateAllUnitMissions(unit, curGameState.map)
            curAssignments.set(unit.id, chooseRandom(possibleAssignments))
          }
        })
      })

      const actions = SettlerAgent.turn(curGameState, curAssignments)
      await sim.action(actions)
      Convert.updateGameState(curGameState, sim.getGame())
    }

    const results = LuxDesignLogic.getResults(sim.match)
    const tie = results.ranks[0].score === results.ranks[1].score
    if (tie)
      return 0.5
    if (results.ranks[0].agentID === this.gameState.id)
      return 1
    else
      return 0
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

    result += `  ${parent_uuid} [label=<${label}>]\n`

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
