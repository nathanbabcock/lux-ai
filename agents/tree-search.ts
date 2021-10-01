import { Match } from 'dimensions-ai'
import Cluster, { getClusters } from '../helpers/Cluster'
import Director from '../helpers/Director'
import getSerializedState from '../helpers/getSerializedState'
import { getClosestResourceTile, getResources, moveWithCollisionAvoidance } from '../helpers/helpers'
import { clearLog, log } from '../helpers/logging'
import { firstCityTreeSearch, initMatch } from '../helpers/TreeSearch'
import { Agent, annotate, GameState } from '../lux/Agent'
import { Cell } from '../lux/Cell'
import { Player } from '../lux/Player'
import type { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'

//// HELPERS
function gatherClosestResource(resourceTiles: Cell[], player: Player, unit: Unit, gameState: GameState, otherUnitMoves: Position[], actions: string[]) {
  let closestResourceTile = director.getClosestResourceTile(resourceTiles, player, unit)
  if (closestResourceTile === null) closestResourceTile = getClosestResourceTile(resourceTiles, player, unit)
  if (closestResourceTile === null) return
  director.resourcePlans.push(closestResourceTile.pos)
  const dir = unit.pos.directionTo(closestResourceTile.pos)
  moveWithCollisionAvoidance(gameState, unit, dir, otherUnitMoves, actions)
}

function buildClosestCity(gameState: GameState, unit: Unit, otherUnitMoves: Position[], actions: string[]) {
  const closestEmptyTile = director.getClosestCityPos(gameState.map, unit.pos)
  if (!closestEmptyTile) {
    log('no empty tile found')
    return
  }
  director.cityPlans.push(closestEmptyTile.pos)

  if (unit.pos.distanceTo(closestEmptyTile.pos) === 0) {
    actions.push(unit.buildCity())
  } else {
    const dir = unit.pos.directionTo(closestEmptyTile.pos)
    moveWithCollisionAvoidance(gameState, unit, dir, otherUnitMoves, actions)
  }
}

//// GLOBALS
const agent = new Agent()
const director = new Director()
let match: Match
let plan: string[] = []

//// MAIN
async function main() {
  clearLog()
  log('=================')
  log('Tree Search Agent')
  log('=================')

  match = await initMatch()
  log('Match initialized')

  agent.run(async (gameState: GameState): Promise<Array<string>> => {
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
    
    // Annotate clusters
    const unit = player.units[0]
    clusters.forEach(cluster => {
      actions.push(annotate.line(unit.pos.x, unit.pos.y, cluster.getCenter().x, cluster.getCenter().y))

      const perimeter = cluster.getPerimeter(gameMap)
      perimeter.forEach(cell => {
        actions.push(annotate.circle(cell.pos.x, cell.pos.y))
      })
    })

    if (gameState.turn === 0) {
      try {
        const DEPTH = 5 // how many moves ahead (plies) to simulate
        plan = await firstCityTreeSearch(match, player.units[0], getSerializedState(gameState), DEPTH) || []
        if (!plan || plan.length === 0) log(`Couldn't find plan for first city with DFS`)
        else log(`Planning first city on turn ${plan.length}`)
      } catch (e) {
        log(e.stack || e.message)
      }
    }
  
    if (plan && plan.length > 0)
      return [...actions, plan.shift()]

    // we iterate over all our units and do something with them
    for (let i = 0; i < player.units.length; i++) {
      const unit = player.units[i]
      if (unit.isWorker() && unit.canAct()) {
        if (unit.getCargoSpaceLeft() > 0) {
          gatherClosestResource(resourceTiles, player, unit, gameState, otherUnitMoves, actions)
        } else {
          buildClosestCity(gameState, unit, otherUnitMoves, actions)
        }
      }
    }
  
    player.cities.forEach((city) => {
      city.citytiles.forEach((citytile) => {
        if (citytile.cooldown >= 1) return
        if (player.units.length < player.cityTileCount)
          actions.push(citytile.buildWorker())
        else
          actions.push(citytile.research())
      })
    })
  
    // return the array of actions
    return actions
  })
}

main()