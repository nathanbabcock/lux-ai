import Assignment from '../assignments/Assignment'
import Builder from '../assignments/Builder'
import Guard from '../assignments/Guard'
import Miner from '../assignments/Miner'
import Settler from '../assignments/Settler'
import hungarianMethod from '../helpers/hungarianMethod'
import { clearLog, log } from '../helpers/logging'
import Turn from '../helpers/Turn'
import { Agent, annotate } from '../lux/Agent'
import { Unit } from '../lux/Unit'

const agent = new Agent()

function getAssignments(turn: Turn): Assignment[] {
  const assignments: Assignment[] = [
    ...Settler.getAssignments(turn),
    ...Guard.getAssignments(turn),
    ...Miner.getAssignments(turn),
    ...Builder.getAssignments(turn),
  ]
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

function annotateAssignments(
  solvedAssignments: number[][],
  units: Unit[],
  assignments: Assignment[],
): string[] {
  const actions: string[] = []
  for (const [unitIndex, assignmentIndex] of solvedAssignments) {
    const unit = units[unitIndex]
    const assignment = assignments[assignmentIndex]
    actions.push(annotate.text(unit.pos.x, unit.pos.y, `${assignment.type}`))
    actions.push(annotate.line(unit.pos.x, unit.pos.y, assignment.target.x, assignment.target.y))
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
    const allAssignments = getAssignments(turn)
    const units = turn.player.units
    const costMatrix = createCostMatrix(units, allAssignments, turn)
    const solvedAssignments = hungarianMethod(costMatrix)
    const assignmentActions = getAssignmentActions(solvedAssignments, units, allAssignments, turn)
    const actions = turn.actions = [
      ...annotateAssignments(solvedAssignments, units, allAssignments),
      ...assignmentActions,
      ...turn.autoCities(),
    ]
    return actions
  })
}

main()
