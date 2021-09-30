import { Match } from 'dimensions-ai'
import { getClusters } from '../helpers/Cluster'
import Director from '../helpers/Director'
import getSerializedState from '../helpers/getSerializedState'
import { getResources } from '../helpers/helpers'
import { clearLog, log } from '../helpers/logging'
import { initMatch, treeSearch } from '../helpers/TreeSearch'
import { Agent, GameState } from '../lux/Agent'
import type { Position } from '../lux/Position'

//// GLOBALS
const agent = new Agent()
const director = new Director()
let match: Match

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
    
    if (gameState.turn === 0) {
      try {
        const DEPTH = 5 // how many moves ahead (plies) to simulate
        await treeSearch(match, player.units[0], getSerializedState(gameState), DEPTH)
      } catch (e) {
        log(e.stack || e.message)
      }
    }
  
    // we iterate over all our units and do something with them
    for (let i = 0; i < player.units.length; i++) {
      const unit = player.units[i]
      if (unit.isWorker() && unit.canAct()) {
        if (unit.getCargoSpaceLeft() > 0) {
          // gatherClosestResource(resourceTiles, player, unit, gameState, otherUnitMoves, actions)
        } else {
          // buildClosestCity(gameState, unit, otherUnitMoves, actions)
        }
      }
    }
  
    player.cities.forEach((city) => {
      city.citytiles.forEach((citytile) => {
        if (citytile.cooldown >= 1) return
        // if (player.units.length < player.cityTileCount)
        //   actions.push(citytile.buildWorker())
        // else
        //   actions.push(citytile.research())
      })
    })
  
    // return the array of actions
    return actions
  })
}

main()