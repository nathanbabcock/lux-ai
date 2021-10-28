import Assignment from '../assignments/Assignment'
import Settler from '../assignments/Settler'
import hungarianMethod from '../helpers/hungarianMethod'
import { clearLog, log } from '../helpers/logging'
import Turn from '../helpers/Turn'
import { Agent } from '../lux/Agent'
import { Unit } from '../lux/Unit'

const agent = new Agent()

function getAssignments(turn: Turn): Assignment[] {
  const assignments: Assignment[] = []

  // Cluster perimeter assignments
  for (const cluster of turn.clusters) {
    const perimeter = cluster.getPerimeter(turn.gameMap, false)
    for (const cell of perimeter) {
      const settler = new Settler(cell.pos)
      assignments.push(settler)
    }
  }

  return assignments
}

function createCostMatrix(
  units: Unit[],
  assignments: Assignment[],
  turn: Turn,
): number[][] {
  const costMatrix: number[][] = []

  for (const unit of units) {
    const row = []
    for (const assignment of assignments) {
      const cost = assignment.getCost(unit, turn)
      row.push(cost)
    }
    costMatrix.push(row)
  }

  return costMatrix
}

/** If an array is more convenient, switch to that instead */
function getAssignmentsMap(
  solvedAssignments: number[][],
  units: Unit[],
  allAssignments: Assignment[],
): Map<Unit, Assignment> {
  const assignments = new Map<Unit, Assignment>()
  for (const [unitIndex, assignmentIndex] of solvedAssignments) {
    const unit = units[unitIndex]
    const assignment = allAssignments[assignmentIndex]
    assignments.set(unit, assignment)
  }
  return assignments
}

function getAssignmentActions(
  solvedAssignments: number[][],
  units: Unit[],
  assignments: Assignment[],
  turn: Turn
): string[] {
  const actions: string[] = []
  for (const [unitIndex, assignmentIndex] of solvedAssignments) {
    const unit = units[unitIndex]
    const assignment = assignments[assignmentIndex]
    const action = assignment.getAction(unit, turn)
    if (action) actions.push(action)
  }
  return actions
}

async function main() {
  clearLog()
  log('=======================')
  log('Assignment Solver Agent')
  log('=======================')
  log(new Date().toLocaleString())

  agent.run(async gameState => {
    log(`=== TURN ${gameState.turn} ===`)
    const turn = new Turn(gameState)
    const actions = turn.actions
    const allAssignments = getAssignments(turn)
    const units = turn.player.units
    const costMatrix = createCostMatrix(units, allAssignments, turn)
    const start = new Date().getTime()
    const solvedAssignments = hungarianMethod(costMatrix)
    const time = new Date().getTime() - start
    // log(`${solvedAssignments.length} optimal assignments found in ${time}`)
    const assignmentActions = getAssignmentActions(solvedAssignments, units, allAssignments, turn) 
    actions.push(...assignmentActions)
    actions.push(...turn.autoCities())
    return actions
  })
}

main()
