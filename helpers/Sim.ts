import { Game, GameMap, LuxDesign, LuxDesignLogic, LuxMatchConfigs, LuxMatchState, SerializedState } from '@lux-ai/2021-challenge'
import { create, Logger, Match, MatchEngine } from 'dimensions-ai'
import { DeepPartial } from 'dimensions-ai/lib/main/utils/DeepPartial'
import { turn } from '../agents/tree-search'
import { annotate, GameState } from '../lux/Agent'
import { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'
import Convert from './Convert'
import { log } from './logging'
import { clone } from './util'
import GAME_CONSTANTS from '../lux/game_constants.json'

export type MissionSimulation = {
  gameState: GameState
  plan: string[]
  annotations: string[]
  outcome: boolean
}

export async function initMatch(config: DeepPartial<LuxMatchConfigs & Match.Configs> = {}): Promise<Match> {
  const lux2021 = new LuxDesign('lux_ai_2021')

  //typescript will complain if dimensions is one version but lux ai is built using another one
  const myDimension = create(lux2021, {
    name: 'Lux AI 2021',
    loggingLevel: Logger.LEVEL.ERROR,
    activateStation: false,
    observe: false,
    createBotDirectories: false,
  })

  const configs: DeepPartial<LuxMatchConfigs & Match.Configs> = {
    detached: true,
    agentOptions: { detached: true },
    storeReplay: config.storeReplay,
    out: config.out,
    statefulReplay: config.statefulReplay === false ? false : true,
    storeErrorLogs: false,
    loggingLevel: Logger.LEVEL.ERROR,
    width: config.width,
    height: config.height,
    seed: config.seed,
    debugAnnotations: config.debugAnnotations || false,
    mapType: config.mapType || GameMap.Types.RANDOM,
    parameters: {
      MAX_DAYS: GAME_CONSTANTS.PARAMETERS.MAX_DAYS //json.config.episodeSteps,
    },
  }

  const match = await myDimension.createMatch(
    [
      {
        file: 'blank',
        name: 'team-0',
      },
      {
        file: 'blank',
        name: 'team-1',
      },
    ],
    configs
  )

  return match
}

export function reset(match: Match, state: GameState | SerializedState): Game {
  if (state instanceof GameState)
    state = Convert.toSerializedState(state)
  LuxDesignLogic.reset(match, state)
  let game = (match.state as LuxMatchState).game
  game.replay.data.stateful = [game.toStateObject()]
  return game
}

export async function simulate(match: Match, playerID: number, actions: string | string[]): Promise<Game> {
  if (!(actions instanceof Array))
    actions = [actions]
  const commands: MatchEngine.Command[] = actions.map(action => ({
    command: action,
    agentID: playerID,
  }))
  await LuxDesignLogic.update(match, commands)
  return (match.state as LuxMatchState).game
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
    const serializedState = Convert.toSerializedState(gameState)
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
      Convert.updateGameState(gameState, (match.state as LuxMatchState).game)
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
      outcome: cityBuilt,
    }
  } catch (e) {
    log(e.stack || e.message)
    const game = (match.state as LuxMatchState).game
    const units = Array.from(game.getTeamsUnits(unit.team).values())
    log(`Units = ${units.map(unit => unit.cargo.wood)}`)
  }
}