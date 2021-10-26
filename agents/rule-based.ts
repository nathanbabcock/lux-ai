import { getClusters } from '../helpers/Cluster'
import { getClosestCell, moveWithCollisionAvoidance } from '../helpers/helpers'
import { clearLog, log } from '../helpers/logging'
import Turn from '../helpers/Turn'
import { Agent, GameState } from '../lux/Agent'
import { Cell } from '../lux/Cell'
import { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'
const agent = new Agent()

class Job {
  done(turn: Turn): boolean {
    throw new Error('Method not implemented.')
  }

  action(unit: Unit, turn: Turn): string | undefined {
    throw new Error('Method not implemented.')
  }
}
class BuildCity extends Job {
  cityPos: Position

  done(turn: Turn): boolean {
    return !!turn.gameMap.getCellByPos(this.cityPos).citytile
  }

  action(unit: Unit, turn: Turn): string | undefined {
    if (unit.pos.distanceTo(this.cityPos) === 0) {
      if (unit.getCargoSpaceLeft() === 0)
        return unit.buildCity()
      else
        return undefined
    } else {
      const dir = unit.pos.directionTo(this.cityPos)
      return turn.moveWithCollisionAvoidance(unit, dir)
    }
  }
}

async function main() {
  clearLog()
  log('================')
  log('Rule-Based Agent')
  log('================')
  log(new Date().toLocaleString())

  const jobs = new Map<string, Job>()

  agent.run(async gameState => {
    log(`=== TURN ${gameState.turn} ===`)
    const turn = new Turn(gameState)
    const actions = turn.actions
    const clusters = turn.clusters
    const map = turn.gameMap

    function getExploreJob(unit: Unit): BuildCity | null {
      const curCluster = clusters.find(cluster => cluster.units.includes(unit))
      if (!curCluster) {
        log(`Unit ${unit.id} is not in any cluster; unable to assign job`)
        return null
      }
      const sameTeamUnits = curCluster.units.filter(unit => unit.team === unit.team)
      if (sameTeamUnits.length <= 1) return null
      const clustersToExplore = clusters.filter(
        cluster => cluster !== curCluster
        && cluster.type === 'wood'
        && cluster.units.length === 0
      )
      if (clustersToExplore.length === 0) return null
      let closestDist = Infinity
      let closestCell: Cell = undefined
      for (const cluster of clustersToExplore) {
        const perimeter = cluster.getPerimeter(map)
        for (const cell of perimeter) {
          const dist = cell.pos.distanceTo(unit.pos)
          if (dist < closestDist) {
            closestDist = dist
            closestCell = cell
          }
        }
      }
      if (!closestCell) {
        log(`No cells for ${unit.id} to explore`)
        return null
      }

      log (`Created explore job for ${unit.id}`)
      const job = new BuildCity()
      job.cityPos = closestCell.pos
      return job
    }

    function getFortifyJob(unit: Unit): BuildCity | null {
      const curCluster = clusters.find(cluster => cluster.units.includes(unit))
      if (!curCluster) {
        log(`Unit ${unit.id} not in any cluster`)
        return null
      }
      const emptyPerimeterCells = curCluster.getPerimeter(map)
      if (emptyPerimeterCells.length === 0) return null
      const closestCell = getClosestCell(map.getCellByPos(unit.pos), emptyPerimeterCells)

      log(`Created fortify job for ${unit.id} at ${closestCell.pos.x} ${closestCell.pos.y}`)
      const job = new BuildCity()
      job.cityPos = closestCell.pos
      return job
    }

    function getJob(unit: Unit): Job | null {
      const explore = getExploreJob(unit)
      if (explore) return explore

      const fortify = getFortifyJob(unit)
      if (fortify) return fortify

      return null
    }

    for (const unit of turn.player.units) {
      const job = jobs.get(unit.id)
      if (job) {
        if (job.done(turn)) {
          jobs.delete(unit.id)
        } else {
          const action = job.action(unit, turn)
          if (action) actions.push(action)
          continue
        }
      }
      const newJob = getJob(unit)
      if (newJob) jobs.set(unit.id, newJob)
    }

    actions.push(...turn.autoCities())

    return actions
  })
}

main()

