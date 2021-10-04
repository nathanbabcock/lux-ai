import { Game, LuxDesign, LuxDesignLogic, LuxMatchConfigs, LuxMatchState, SerializedState, Unit as LuxUnit } from '@lux-ai/2021-challenge'
import { create, Logger, Match } from 'dimensions-ai'
import { DeepPartial } from 'dimensions-ai/lib/main/utils/DeepPartial'
import type { turn } from '../agents/tree-search'
import { annotate, GameState } from '../lux/Agent'
import GAME_CONSTANTS from '../lux/game_constants.json'
import { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'
import getSerializedState, { updateGameState } from './getSerializedState'
import { log } from './logging'
import { clone } from './util'

export async function initMatch(): Promise<Match> {
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
    loggingLevel: Logger.LEVEL.ERROR,
    // width: gameState.map.width,
    // height: gameState.map.height,
    //seed: parseInt(json.config.seed),
    //mapType: json.config.mapType,
    parameters: {
      MAX_DAYS: GAME_CONSTANTS.PARAMETERS.MAX_DAYS //json.config.episodeSteps,
    },
  }

  const match = await myDimension.createMatch(
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

function countCities(cities: Game['cities'], team: LuxUnit.TEAM) {
  let count = 0

  cities.forEach((city) => {
    if (city.team === team) count++
  })

  return count
}

/**
 * Depth-first tree search for the fastest plan to build the first city
 * @todo this should definitely be a BREADTH-first search (duh)
 * @returns an array of actions (one per turn) to be executed
 */
export async function firstCityTreeSearch(
  match: Match,
  unit: Unit,
  serializedState: SerializedState,
  depth: number = 1,
  pastActions: string[] = [],
): Promise<string[] | false> {
  try {
    const start = new Date().getTime()
    // log('treeSearch')
  
    const state = match.state as LuxMatchState
    const matchUnit = state.game.getUnit(unit.team, unit.id)
    if (!matchUnit) {
      log('treeSearch: unit died in this branch')
      return null
    }

    // Base case
    const num_cities = countCities(state.game.cities, unit.team)
    if (depth === 0) {
      // log('=== Hit the base case ===')

      const Δx = matchUnit.pos.x - unit.pos.x
      const Δy = matchUnit.pos.y - unit.pos.y
      const Δwood = matchUnit.cargo.wood - unit.cargo.wood

      // log(`The unit moved by delta_x=${Δx} and delta_y=${Δy}`)
      // log(`The unit collected ${Δwood} wood`)
      // log(`Team has ${num_cities} cities`)

      if (num_cities === 2) return pastActions
      else return false
    }

    const actions = []
    if (matchUnit.canAct()) {
      actions.push(...Object.entries(GAME_CONSTANTS.DIRECTIONS).map(entry => unit.move(entry[1])))
      actions.push(unit.buildCity()) // TODO unit.canBuild() requires an updated gameMap
    } else {
      actions.push(unit.move(GAME_CONSTANTS.DIRECTIONS.CENTER))
    }

    // log(`Actions (${actions.length}): [${actions.map(action => `"${action}"`).join(', ')}]`)

    // if (actions.length === 1)
    //   log('On cooldown this turn')

    const possiblePlans: Array<Array<string>> = []

    // Try all possible actions each turn
    for (const action of actions) {
      LuxDesignLogic.reset(match, serializedState)
      await LuxDesignLogic.update(match, [{
        agentID: unit.team,
        command: action,
      }])
      const newState = state.game.toStateObject()
      const plan = await firstCityTreeSearch(match, unit, newState, depth - 1, [...pastActions, action])
      if (plan) possiblePlans.push(plan)
    }

    if (possiblePlans.length > 0) {
      log(`treeSearch found ${possiblePlans.length} solutions in ${new Date().getTime() - start}ms`)
      possiblePlans.sort((a, b) => a.length - b.length)
      return possiblePlans[0]
    }

    // log(`treeSearch done in ${new Date().getTime() - start}ms`)
    return false
  } catch (e) {
    log(e.stack || e.message)
    return false
  }
}

export type MissionSimulation = {
  gameState: GameState
  plan: string[]
  annotations: string[]
}

export async function simulateSettlerMission(
  unit: Unit,
  destination: Position,
  gameState: GameState,
  match: Match,
  getActions: typeof turn
): Promise<MissionSimulation> {
  try {
    const MAX_SIM_TURNS = 40

    gameState = clone(gameState)
    const plan: string[] = []
    const annotations: string[] = [
      annotate.line(unit.pos.x, unit.pos.y, destination.x, destination.y)
    ]
    const serializedState = getSerializedState(gameState)
    LuxDesignLogic.reset(match, serializedState)
    let cityBuilt = false
    let unitDied = false
    let simTurns = 0

    const getMatchUnit = () =>
      (match.state as LuxMatchState).game.getUnit(unit.team, unit.id)

    while (!cityBuilt && !unitDied && simTurns < MAX_SIM_TURNS) {
      const actions = await getActions(gameState, destination)
      actions.forEach(action => {
        if (action.includes(unit.id))
          plan.push(action)
      })
      const commands = actions.map(action => ({
        agentID: unit.team,
        command: action,
      }))

      await LuxDesignLogic.update(match, commands)
      updateGameState(gameState, (match.state as LuxMatchState).game)
      simTurns++

      if (!getMatchUnit()) {
        unitDied = true
        break
      }

      annotations.push(annotate.circle(getMatchUnit().pos.x, getMatchUnit().pos.y))
      annotations.push(annotate.text(getMatchUnit().pos.x, getMatchUnit().pos.y, `#${simTurns}`))

      const cityTile = gameState.map.getCellByPos(destination).citytile
      if (cityTile && cityTile.team === unit.team) {
        cityBuilt = true
        break
      } else if (cityTile && cityTile.team !== unit.team) {
        log('simulateSettlerMission: enemy built city on destination tile')
        break
      }
    }

    if (cityBuilt) log('simulateSettlerMission: city built on this mission')
    if (unitDied) log('simulateSettlerMission: unit died on this mission')
    if (!cityBuilt && !unitDied) log('simulateSettlerMission: nothing happened')
    
    return {
      gameState,
      plan,
      annotations,
    }
  } catch (e) {
    log(e.stack || e.message)
  }
}