import { Match } from 'dimensions-ai'
import { getClosestResourceTile, getResourceAdjacency, moveWithCollisionAvoidance } from '../helpers/helpers'
import { clearLog, log } from '../helpers/logging'
import { initMatch, simulateSettlerMission } from '../helpers/Sim'
import Turn from '../helpers/Turn'
import { chooseRandom } from '../helpers/util'
import { Agent, annotate, GameState } from '../lux/Agent'
import GAME_CONSTANTS from '../lux/game_constants.json'
import type { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'

const agent = new Agent()
let match: Match
let plan: string[] = []
let permanentAnnotations: string[] = []

export async function turn(
  gameState: GameState,
  settlerMissionGoal?: Position,
): Promise<Array<string>> {
  const { actions, otherUnitMoves, player, gameMap, resourceTiles, clusters, director } = new Turn(gameState)

  const sidetext = (...messages: any[]) => 
    actions.push(annotate.sidetext(`${messages.join(' ')}\n`))

  function buildCityAtPosition(unit: Unit, pos: Position) {
    if (unit.pos.distanceTo(pos) === 0)
      actions.push(unit.buildCity())
    else {
      const dir = unit.pos.directionTo(pos)
      moveWithCollisionAvoidance(gameState, unit, dir, otherUnitMoves, actions)
    }
  }

  function buildClosestCity(unit: Unit) {
    const closestEmptyTile = director.getClosestCityPos(gameState.map, unit.pos)
    if (!closestEmptyTile) {
      sidetext('warning: buildClosestCity: no empty tile found')
      return
    }
    director.cityPlans.push(closestEmptyTile.pos)
  
    buildCityAtPosition(unit, closestEmptyTile.pos)
  }

  function gatherClosestResource(unit: Unit) {
    let closestResourceTile = director.getClosestResourceTile(resourceTiles, player, unit)
    if (closestResourceTile === null) closestResourceTile = getClosestResourceTile(resourceTiles, player, unit)
    if (closestResourceTile === null) return
    director.resourcePlans.push(closestResourceTile.pos)
    const dir = unit.pos.directionTo(closestResourceTile.pos)
    moveWithCollisionAvoidance(gameState, unit, dir, otherUnitMoves, actions)
  }

  /** As opposed to {@link simulateSettlerMission}. */
  async function simulateSettler(unit: Unit) {
    const destination = chooseRandom(clusters).getCitySite(gameMap).pos
    const simResult = await simulateSettlerMission(unit, destination, gameState, match, turn)
    if (simResult) {
      sidetext(`Simulated mission to x=${destination.x} y=${destination.y}`)
      sidetext(`The sim lasted ${simResult.gameState.turn - gameState.turn} turns`)
    } else {
      sidetext(`Simulated mission failed`)
    }
    permanentAnnotations = simResult.annotations
    return simResult.plan
  }

  function annotateClusters() {
    const unit = player.units[0]
    if (unit && gameState.turn === 1) {
      clusters.forEach(cluster => {
        // actions.push(annotate.line(unit.pos.x, unit.pos.y, cluster.getCenter().x, cluster.getCenter().y))

        cluster.cells.forEach(cell => {
          actions.push(annotate.text(cell.pos.x, cell.pos.y, `${getResourceAdjacency(cell, gameMap)}`))
        })

        const perimeter = cluster.getPerimeter(gameMap)
        perimeter.forEach(cell => {
          actions.push(annotate.circle(cell.pos.x, cell.pos.y))
          actions.push(annotate.text(cell.pos.x, cell.pos.y, `${getResourceAdjacency(cell, gameMap)}`))
        })

        const citySite = cluster.getCitySite(gameMap)
        if (citySite) actions.push(annotate.line(unit.pos.x, unit.pos.y, citySite.pos.x, citySite.pos.y))
      })
    }
  }

    /** Try simulating *every* settler mission */
    async function simulateAllSettlerMissions(unit: Unit) {
      let missionsSimulated = 0
      for (const cluster of clusters) {
        const citySite = cluster.getCitySite(gameMap)
        if (!citySite) return
        const simResult = await simulateSettlerMission(unit, citySite.pos, gameState, match, turn)
        if (!simResult) continue
        missionsSimulated++
  
        actions.push(annotate.line(unit.pos.x, unit.pos.y, citySite.pos.x, citySite.pos.y))
        actions.push(annotate.circle(citySite.pos.x, citySite.pos.y))
        actions.push(annotate.text(citySite.pos.x, citySite.pos.y, `${simResult.outcome}`))
      }
  
      sidetext(`Simulated ${missionsSimulated} missions`)
    }
  
  // Units
  for (let i = 0; i < player.units.length; i++) {
    const unit = player.units[i]
    if (unit.isWorker() && unit.canAct()) {
      if (unit.getCargoSpaceLeft() > 0) {
        gatherClosestResource(unit)
      } else {
        if (unit.id === 'u_1' && !settlerMissionGoal) await simulateAllSettlerMissions(unit)

        // if (unit.id === 'u_1' && gameState.turn > 5 && (!plan || plan.length === 0) && !settlerMissionGoal)
        //   plan = await simulateSettler(unit)
        // else if (unit.id === 'u_1' && settlerMissionGoal)
        //   buildCityAtPosition(unit, settlerMissionGoal)
        // else if (unit.id === 'u_1' && plan && plan.length > 0) {
        //   sidetext(`${unit.id} executing step 1 of ${plan.length}`)
        //   sidetext(`This step: ${plan[0].replace(/,'"/, '')}`)
        //   continue
        // } else

        buildClosestCity(unit)
      }
    } else if (!unit.canAct()) {
      // explicitly push a 'move center' action, which will be consumed by plan runners
      actions.push(unit.move(GAME_CONSTANTS.DIRECTIONS.CENTER))
    }
  }

  // Cities
  player.cities.forEach((city) => {
    city.citytiles.forEach((citytile) => {
      if (citytile.cooldown >= 1) return
      if (player.units.length < player.cityTileCount)
        actions.push(citytile.buildWorker())
      else
        actions.push(citytile.research())
    })
  })

  // Return actions
  actions.push(...permanentAnnotations)
  if (plan && plan.length > 0)
    actions.push(plan.shift())
  return actions
}

//// MAIN
async function main() {
  clearLog()
  log('=========')
  log('Sim Agent')
  log('=========')

  match = await initMatch()
  log('Match initialized')

  agent.run(turn)
}

main()
