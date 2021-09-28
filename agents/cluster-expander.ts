import Cluster, { getClusters } from '../helpers/Cluster'
import { getCityTiles, getClosestEmptyTile, getClosestResourceTile, getResources, moveWithCollisionAvoidance } from '../helpers/helpers'
import { clearLog, log } from '../helpers/logging'
import { chooseRandom } from '../helpers/util'
import { Agent, GameState } from '../lux/Agent'
import type { Position } from '../lux/Position'
import type { Unit } from '../lux/Unit'

function expandToNewCluster(gameState: GameState, unit: Unit, actions: Array<string>, otherUnitMoves: Array<Position>) {
  const player = gameState.players[gameState.id]
  const clusters = getClusters(gameState.map)
  log('clusters:', clusters.length)
  let destCluster: Cluster

  const emptyClusters = clusters.filter(cluster => cluster.getCityTiles(clusters, getCityTiles(player)).length === 0)
  if (emptyClusters.length === 0)
    destCluster = chooseRandom(clusters)
  else
    destCluster = chooseRandom(emptyClusters)

  if (!destCluster) {
    console.warn(`Couldn't find cluster to go to`)
    moveWithCollisionAvoidance(gameState, unit, 'center', otherUnitMoves, actions)
    return
  }

  const closestEmptyTile = getClosestEmptyTile(gameState.map, destCluster.cells[0].pos)
  if (!closestEmptyTile) return console.warn('no empty tile found')

  if (unit.pos.distanceTo(closestEmptyTile.pos) === 0) {
    actions.push(unit.buildCity())
  } else {
    const dir = unit.pos.directionTo(closestEmptyTile.pos)
    moveWithCollisionAvoidance(gameState, unit, dir, otherUnitMoves, actions)
  }
}

clearLog()
log('Cluster Expander Agent')

const agent = new Agent()
agent.run((gameState: GameState): Array<string> => {
  const actions = new Array<string>()
  const otherUnitMoves = new Array<Position>()

  const player = gameState.players[gameState.id]
  const opponent = gameState.players[(gameState.id + 1) % 2]
  const gameMap = gameState.map
  const resourceTiles = getResources(gameState.map)
  
  // we iterate over all our units and do something with them
  for (let i = 0; i < player.units.length; i++) {
    const unit = player.units[i]
    if (unit.isWorker() && unit.canAct()) {
      if (unit.getCargoSpaceLeft() > 0) {
        const closestResourceTile = getClosestResourceTile(resourceTiles, player, unit)
        if (closestResourceTile != null) {
          const dir = unit.pos.directionTo(closestResourceTile.pos)
          // move the unit in the direction towards the closest resource tile's position.
          // actions.push(unit.move(dir))
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
