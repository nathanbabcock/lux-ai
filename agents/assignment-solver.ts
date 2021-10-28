import Assignment from '../assignments/Assignment'
import Settler from '../assignments/Settler'
import { clearLog, log } from '../helpers/logging'
import Turn from '../helpers/Turn'
import { Agent } from '../lux/Agent'
import hungarianMethod from '../helpers/hungarianMethod'

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

    const assignments = getAssignments(turn)
    const units = turn.player.units

    // if (gameState.turn === 0) {
    //   for (const assignment of assignments) {
    //     log(`${assignment.type} ${assignment.target.x} ${assignment.target.y}`)
    //     for (const unit of units) {
    //       log(`> cost(${unit.id}) = ${assignment.getCost(unit, turn)}`)
    //     }
    //   }
    // }

    const costMatrix: number[][] = []

    for (const unit of units) {
      const row = []
      for (const assignment of assignments) {
        const cost = assignment.getCost(unit, turn)
        row.push(cost)
      }
      costMatrix.push(row)
    }

    const start = new Date().getTime()
    const solvedAssignments = hungarianMethod(costMatrix)
    const time = new Date().getTime() - start

    if (gameState.turn === 0) {
      log(`${solvedAssignments.length} optimal assignments found in ${time}ms`)
      for (const [unitIndex, assignmentIndex] of solvedAssignments) {
        const unit = units[unitIndex]
        const assignment = assignments[assignmentIndex]
        log(`> ${unit.id} -> ${assignment.type} ${assignment.target.x} ${assignment.target.y} (cost=${costMatrix[unitIndex][assignmentIndex]})`)
      }
    }

    return actions
  })
}

main()
