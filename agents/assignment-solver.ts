import Assignment from '../assignments/Assignment'
import Settler from '../assignments/Settler'
import { clearLog, log } from '../helpers/logging'
import Turn from '../helpers/Turn'
import { Agent } from '../lux/Agent'

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

    if (gameState.turn === 0) {
      for (const assignment of assignments) {
        log(`${assignment.type} ${assignment.target.x} ${assignment.target.y}`)
        for (const unit of units) {
          log(`> cost(${unit.id}) = ${assignment.getCost(unit, turn)}`)
        }
      }
    }

    return actions
  })
}

main()
