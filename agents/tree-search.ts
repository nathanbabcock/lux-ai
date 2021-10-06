import { Match } from 'dimensions-ai'
import { getClusters } from '../helpers/Cluster'
import Convert from '../helpers/Convert'
import Director from '../helpers/Director'
import { getClosestResourceTile, getResources, moveWithCollisionAvoidance } from '../helpers/helpers'
import { clearLog, log } from '../helpers/logging'
import { initMatch } from '../helpers/Sim'
import { firstCityTreeSearch } from '../helpers/TreeSearch'
import { Agent, annotate, GameState } from '../lux/Agent'
import GAME_CONSTANTS from '../lux/game_constants.json'
import type { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'

const agent = new Agent()
const director = new Director()
let match: Match
let plan: string[] = []
let permanentAnnotations: string[] = []

export async function turn(
  gameState: GameState,
  settlerMissionGoal?: Position,
): Promise<Array<string>> {
  const actions = new Array<string>()
  const otherUnitMoves = new Array<Position>()
  const player = gameState.players[gameState.id]
  const opponent = gameState.players[(gameState.id + 1) % 2]
  const gameMap = gameState.map
  const resourceTiles = getResources(gameState.map)
  const clusters = getClusters(gameMap)
  director.setClusters(clusters)
  director.cityPlans = []
  director.resourcePlans = []

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

  // Opening tree search (depth-first, 5-ply)
  if (gameState.turn === 0) {
    try {
      const DEPTH = 5 // how many moves ahead (plies) to simulate
      plan = await firstCityTreeSearch(match, player.units[0], Convert.toSerializedState(gameState), DEPTH) || []
      if (!plan || plan.length === 0) sidetext(`Couldn't find plan for first city with DFS`)
      else sidetext(`Planning first city on turn ${plan.length}`)
      // TODO: add plan to permanentAnnotations?
    } catch (e) {
      log(e.stack || e.message)
    }
  }
  
  // Units
  for (let i = 0; i < player.units.length; i++) {
    const unit = player.units[i]
    if (unit.isWorker() && unit.canAct()) {
      if (unit.getCargoSpaceLeft() > 0) {
        if (unit.id === 'u_1' && gameState.turn > 5) {
          sidetext(`${unit.id} cancelling plan`)
          plan = []
          permanentAnnotations = []
        }
        gatherClosestResource(unit)
      } else {
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
  log('=================')
  log('Tree Search Agent')
  log('=================')

  match = await initMatch()
  log('Match initialized')

  agent.run(turn)
}

main()
