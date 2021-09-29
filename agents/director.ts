import { getClusters } from '../helpers/Cluster'
import Director from '../helpers/Director'
import { getClosestEmptyTile, getClosestResourceTile, getResources, moveWithCollisionAvoidance } from '../helpers/helpers'
import { clearLog, log } from '../helpers/logging'
import { Agent, GameState } from '../lux/Agent'
import type { Position } from '../lux/Position'
import type { Unit } from '../lux/Unit'

function expandToNewCluster(gameState: GameState, unit: Unit, actions: Array<string>, otherUnitMoves: Array<Position>) {
  const player = gameState.players[gameState.id]
  const cluster = director.getUnitAssignment(unit, player)
  if (!cluster) {
    log('Could not find cluster assignment for unit')
    return
  }
  const closestEmptyTile = getClosestEmptyTile(gameState.map, cluster.cells[0].pos)
  if (!closestEmptyTile) {
    log('no empty tile found')
    return
  }
  director.assignToCluster(unit, cluster)

  if (unit.pos.distanceTo(closestEmptyTile.pos) === 0) {
    actions.push(unit.buildCity())
  } else {
    const dir = unit.pos.directionTo(closestEmptyTile.pos)
    moveWithCollisionAvoidance(gameState, unit, dir, otherUnitMoves, actions)
  }
}

clearLog()
log('==============')
log('Director Agent')
log('==============')

const agent = new Agent()
const director = new Director()
agent.run((gameState: GameState): Array<string> => {
  const actions = new Array<string>()
  const otherUnitMoves = new Array<Position>()
  const player = gameState.players[gameState.id]
  const opponent = gameState.players[(gameState.id + 1) % 2]
  const gameMap = gameState.map
  const resourceTiles = getResources(gameState.map)
  const clusters = getClusters(gameMap)
  director.setClusters(clusters)
  
  // we iterate over all our units and do something with them
  for (let i = 0; i < player.units.length; i++) {
    const unit = player.units[i]
    if (unit.isWorker() && unit.canAct()) {
      if (unit.getCargoSpaceLeft() > 0) {
        const closestResourceTile = getClosestResourceTile(resourceTiles, player, unit)
        if (closestResourceTile != null) {
          const dir = unit.pos.directionTo(closestResourceTile.pos)
          moveWithCollisionAvoidance(gameState, unit, dir, otherUnitMoves, actions)
        }
      } else {
        expandToNewCluster(gameState, unit, actions, otherUnitMoves)
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
