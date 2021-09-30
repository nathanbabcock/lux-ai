import { create, Logger, Match } from 'dimensions-ai'
import { Game, LuxDesign, LuxDesignLogic, LuxMatchConfigs, LuxMatchState, SerializedState, Unit as LuxUnit } from '@lux-ai/2021-challenge'
import GAME_CONSTANTS from '../lux/game_constants.json'
import { Unit } from '../lux/Unit'
import { log } from './logging'
import { DeepPartial } from 'dimensions-ai/lib/main/utils/DeepPartial'

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

export async function treeSearch(match: Match, unit: Unit, serializedState: SerializedState, depth: number = 1, pastActions: string[] = []) {
  try {
    const start = new Date().getTime()
    log('treeSearch')
  
    const state = match.state as LuxMatchState
    const matchUnit = state.game.getUnit(unit.team, unit.id)
    if (!matchUnit) {
      log('treeSearch: unit died in this branch')
      return
    }

    // Base case
    if (depth === 0) {
      log('=== Hit the base case ===')

      const Δx = matchUnit.pos.x - unit.pos.x
      const Δy = matchUnit.pos.y - unit.pos.y
      const Δwood = matchUnit.cargo.wood - unit.cargo.wood
      const num_cities = countCities(state.game.cities, unit.team)

      log(`The unit moved by delta_x=${Δx} and delta_y=${Δy}`)
      log(`The unit collected ${Δwood} wood`)
      log(`Team has ${num_cities} cities`)
      return
    }

    const actions = []
    if (matchUnit.canAct()) {
      actions.push(...Object.entries(GAME_CONSTANTS.DIRECTIONS).map(entry => unit.move(entry[1])))
      actions.push(unit.buildCity()) // TODO unit.canBuild() requires an updated gameMap
    } else {
      actions.push(unit.move(GAME_CONSTANTS.DIRECTIONS.CENTER))
    }

    log(`Actions (${actions.length}): [${actions.map(action => `"${action}"`).join(', ')}]`)

    if (actions.length === 1)
      log('On cooldown this turn')

    for (const action of actions) {
      LuxDesignLogic.reset(match, serializedState)
      await LuxDesignLogic.update(match, [{
        agentID: unit.team,
        command: action,
      }])
      const newState = state.game.toStateObject()
      await treeSearch(match, unit, newState, depth - 1, [...pastActions, action])
    }

    // Try all possible actions each turn
    log(`treeSearch done in ${new Date().getTime() - start}ms`)
  } catch (e) {
    log(e.stack || e.message)
  }
}
