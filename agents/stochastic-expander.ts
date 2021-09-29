import Cluster, { getClosestCluster, getClusters } from '../helpers/Cluster'
import Director from '../helpers/Director'
import { getCityTiles, getClosestEmptyTile, getClosestResourceTile, getResources, moveWithCollisionAvoidance } from '../helpers/helpers'
import { clearLog, log } from '../helpers/logging'
import { Agent, GameState } from '../lux/Agent'
import { Cell } from '../lux/Cell'
import { Player } from '../lux/Player'
import type { Position } from '../lux/Position'
import type { Unit } from '../lux/Unit'

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

function expandToNewCluster(gameState: GameState, unit: Unit, actions: Array<string>, otherUnitMoves: Array<Position>) {
  const player = gameState.players[gameState.id]
  const clusters = getClusters(gameState.map)
  let destCluster: Cluster

  const emptyClusters = clusters.filter(cluster => cluster.getCityTiles(clusters, getCityTiles(player)).length === 0)
  if (emptyClusters.length === 0)
    destCluster = getClosestCluster(clusters, unit.pos)
  else
    destCluster = getClosestCluster(emptyClusters, unit.pos)

  if (!destCluster) {
    log(`Couldn't find cluster to go to`)
    moveWithCollisionAvoidance(gameState, unit, 'center', otherUnitMoves, actions)
    return
  }

  const closestEmptyTile = getClosestEmptyTile(gameState.map, destCluster.cells[0].pos)
  if (!closestEmptyTile) return log('no empty tile found')

  if (unit.pos.distanceTo(closestEmptyTile.pos) === 0) {
    actions.push(unit.buildCity())
    settlers.delete(unit.id)
  } else {
    const dir = unit.pos.directionTo(closestEmptyTile.pos)
    moveWithCollisionAvoidance(gameState, unit, dir, otherUnitMoves, actions)
    settlers.add(unit.id)
  }
}

clearLog()
log('=========================')
log('Stochastic Expander Agent')
log('=========================')

const ratio = 0.05
const agent = new Agent()
const director = new Director()
const settlers: Set<string> = new Set()
agent.run((gameState: GameState): Array<string> => {
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
  
  // we iterate over all our units and do something with them
  for (let i = 0; i < player.units.length; i++) {
    const unit = player.units[i]
    if (unit.isWorker() && unit.canAct()) {
      if (unit.getCargoSpaceLeft() > 0) {
        gatherClosestResource(resourceTiles, player, unit, gameState, otherUnitMoves, actions)
      } else {
        if (settlers.has(unit.id) || player.units.length > 1 && Math.random() < ratio)
          expandToNewCluster(gameState, unit, actions, otherUnitMoves)
        else
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
