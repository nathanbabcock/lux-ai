import { LuxDesign, LuxDesignLogic, LuxMatchConfigs } from '@lux-ai/2021-challenge'
import { create, Logger, Match } from 'dimensions-ai'
import { DeepPartial } from 'dimensions-ai/lib/main/utils/DeepPartial'
import { getClusters } from '../helpers/Cluster'
import Director from '../helpers/Director'
import getSerializedState from '../helpers/getSerializedState'
import { getClosestResourceTile, getResources, moveWithCollisionAvoidance } from '../helpers/helpers'
import { clearLog, log } from '../helpers/logging'
import { Agent, GameState } from '../lux/Agent'
import { Cell } from '../lux/Cell'
import GAME_CONSTANTS from '../lux/game_constants.json'
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

async function initMatch() {
  if (match) return match

  const lux2021 = new LuxDesign('lux_ai_2021')

  //typescript will complain if dimensions is one version but lux ai is built using another one
  const myDimension = create(lux2021, {
    name: 'Lux AI 2021',
    loggingLevel: Logger.LEVEL.NONE,
    activateStation: false,
    observe: false,
    createBotDirectories: false,
  })

  const configs: DeepPartial<LuxMatchConfigs & Match.Configs> = {
    detached: true,
    agentOptions: { detached: true },
    storeReplay: false,
    storeErrorLogs: false,
    loggingLevel: Logger.LEVEL.ALL,
    // width: gameState.map.width,
    // height: gameState.map.height,
    //seed: parseInt(json.config.seed),
    //mapType: json.config.mapType,
    parameters: {
      MAX_DAYS: GAME_CONSTANTS.PARAMETERS.MAX_DAYS //json.config.episodeSteps,
    },
  }

  match = await myDimension.createMatch(
    [
      {
        file: "blank",
        name: "team-0",
      },
      {
        file: "blank",
        name: "team-1",
      },
    ],
    configs
  )

  return match
}

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

  await initMatch()
  log('Match initialized')

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
    
    if (gameState.turn === 0) {
      try {
        log('First turn')
        const matchObj: Match = match
        const serializedState = getSerializedState(gameState)
        log('Reverse-engineered Lux state:', serializedState)
        LuxDesignLogic.reset(match, serializedState)
        log('Updated internal Match')
      } catch (e) {
        log(e.stack || e.message)
      }
    }
  
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