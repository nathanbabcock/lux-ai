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
import { chooseRandom, deepClone } from './util'
import uuid from './uuid'
import { log } from './logging'

export type SimpleAssignment = {unit: string, cluster: number}
export type SimpleAssignments = SimpleAssignment[]

export default class MonteCarlo {
  root: TreeNode

  renderGraphViz() {
    let result = 'graph {\n'
    result += `  node [shape=circle fontname="CMU Serif"]\n`
    result += this.root.render()
    result += '}\n'
    return result
  }

  /**
   * Runs a single full four-phase iteration of MCTS:
   * - Selection
   * - Expansion
   * - Simulation
   * - Backpropagation
   */
  iteration() {
    // TODO
  }

 /**
   * Expansion phase of MCTS.
   * 
   * Generates and initializes all children of this node.
   */
  static expansion(node: TreeNode) {
    const map = node.gameState.map
    const units = node.gameState.players[node.player].units
    const unassigned = units.filter(unit => !node.assignments.has(unit.id))
    const clusters = getClusters(map)
    const assignments = MonteCarlo.generateAssignmentsSimple(
      unassigned.map(unit => unit.id),
      clusters.map((_, index) => index)
    )
    assignments.forEach(assignment => {
      const assignmentMap = new Map<string, Mission>()
      const child = new TreeNode(node.gameState, assignmentMap)

      assignment.forEach(unitAssignment => {
        const unit_id = unitAssignment.unit
        const cluster = clusters[unitAssignment.cluster]
        const unit = units.find(unit => unit.id === unit_id)
        if (!unit) return
        const mission = MonteCarlo.generateSpecificSettlerMissionForUnit(unit, cluster, map)
        assignmentMap.set(unit_id, mission)
      })
      node.addChild(child)
    })
  }

  /**
   * Simulation phase of MCTS.
   * 
   * Full playout starting from current node through the end of the game,
   * with the given assignments and gamestate as a starting point,
   * choosing randomly for all subsequent decisions.
   */
  static async simulation(sim: Sim, node: TreeNode): Promise<0 | 0.5 | 1> {
    if (!node.gameState)
      console.warn('Simulate called without a starting gameState')

    const serializedState = Convert.toSerializedState(node.gameState)
    sim.reset(serializedState)

    const curAssignments = MonteCarlo.cloneAssignments(node.assignments)
    node.assignmentsToString()

    const curGameState = deepClone(GameState, node.gameState)
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

      const player_id = curGameState.id
      const player = curGameState.players[player_id]
      const player_actions = SettlerAgent.turn(curGameState, player, curAssignments)
      
      const opponent_id = (player_id + 1) % 2
      const opponent = curGameState.players[opponent_id]
      const opponent_actions = SettlerAgent.turn(curGameState, opponent, curAssignments)
      
      const commands = [
        ...Sim.actionsToCommands(player_actions, player_id),
        ...Sim.actionsToCommands(opponent_actions, opponent_id)
      ]
      await sim.command(commands)

      Convert.updateGameState(curGameState, sim.getGame())
    }

    const results = LuxDesignLogic.getResults(sim.match)
    const tie = results.ranks[0].rank === results.ranks[1].rank
    if (tie)
      return 0.5
    if (results.ranks[0].agentID === node.gameState.id)
      return 1
    else
      return 0
  }

  static backPropagation(node: TreeNode, value: 0 | 0.5 | 1) {
    node.plays++
    node.wins += value
    if (!node.parent) return
    MonteCarlo.backPropagation(node.parent, value)
  }

  static async simAndBackProp(sim: Sim, node: TreeNode) {
    try {
      const value = await MonteCarlo.simulation(sim, node)
      MonteCarlo.backPropagation(node, value)
    } catch (e) {
      log(e.stack)
    }
  }

  static generateAssignmentsSimple(units: string[], clusters: number[]) {
    const assignments: SimpleAssignments[] = []
    if (units.length === 0) return assignments
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
  static cloneAssignments(assignments: Map<string, Mission>): Map<string, Mission> {
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

  assignmentsToString(): string {
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
      label += this.assignmentsToString()
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
