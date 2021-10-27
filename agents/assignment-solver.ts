import { clearLog, log } from '../helpers/logging'
import Turn from '../helpers/Turn'
import { Agent } from '../lux/Agent'
import { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'

const agent = new Agent()

export class Assignment {
  type: string
  target: Position

  constructor(type: string, target: Position) {
    this.type = type
    this.target = target
  }

  /**
   * Heuristic for estimated cost for a unit to do this assignment,
   * typically just the manhattan distance, but could have additional penalties
   * or rewards to (dis)incentive certain assignments.
   */
  getCost(unit: Unit, turn: Turn): number {
    return unit.pos.distanceTo(this.target)
  }
}

/** Builds a citytile at a given location */
export class Settler extends Assignment {
  constructor(target: Position) {
    super('settler', target)
  }

  getCost(unit: Unit, turn: Turn): number {
    // Must gather resources first
    if (unit.getCargoSpaceLeft() > 0) {
      const closestResource = turn.getClosestResourceTile(unit, 'wood') // only use wood for building, for now
      const resourceDist = unit.pos.distanceTo(closestResource.pos)
      const cityDist = closestResource.pos.distanceTo(this.target)
      return resourceDist + cityDist
    }

    return unit.pos.distanceTo(this.target)
  }
}

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
        for (const unit of units)
          log(`> cost(${unit.id}) = ${assignment.getCost(unit, turn)}`)
      }
    }

    return actions
  })
}

main()
