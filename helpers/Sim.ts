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
import { Dimension } from 'dimensions-ai/lib/main/Dimension'
import Turn from './Turn'

export type SimState = {
  game: Game
  gameState: GameState
  turn: Turn
}

export default class Sim {
  public match?: Match
  public playerID?: number

  private design?: LuxDesign
  private dimension?: Dimension
  private configs: DeepPartial<LuxMatchConfigs & Match.Configs>

  /** @deprecated Prefer the static async Sim.create() to instantiate and initialize in one statement */
  constructor() {}

  static async create(
    config: DeepPartial<LuxMatchConfigs & Match.Configs> = {},
    playerID: number = 0,
  ): Promise<Sim> {
    const sim = new Sim()
    await sim.init(config, playerID)
    return sim
  }

  async init(
    config: DeepPartial<LuxMatchConfigs & Match.Configs> = {},
    playerID: number = 0,
  ) {
    this.playerID = playerID
    this.design = new LuxDesign('lux_ai_2021')
  
    //typescript will complain if dimensions is one version but lux ai is built using another one
    this.dimension = create(this.design, {
      name: 'Lux AI 2021',
      loggingLevel: Logger.LEVEL.ERROR,
      activateStation: false,
      observe: false,
      createBotDirectories: false,
    })
  
    this.configs = {
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
        MAX_DAYS: GAME_CONSTANTS.PARAMETERS.MAX_DAYS //config.episodeSteps,
      },
    }

    this.match = await this.dimension.createMatch([
      {
        file: 'blank',
        name: 'team-0',
      },
      {
        file: 'blank',
        name: 'team-1',
      },
    ], this.configs)
  }

  reset(state: GameState | SerializedState): SimState {
    if (state instanceof GameState)
      state = Convert.toSerializedState(state)
    LuxDesignLogic.reset(this.match, state)
    let game = this.getGame()
    game.replay.data.stateful = [game.toStateObject()]
    return this.getSimState()
  }

  async action(actions: string | string[]): Promise<SimState> {
    if (!(actions instanceof Array))
      actions = [actions]
    const commands: MatchEngine.Command[] = actions.map(action => ({
      command: action,
      agentID: this.playerID,
    }))
    await LuxDesignLogic.update(this.match, commands)
    return this.getSimState()
  }

  async turn(
    turnCallback: (turn: Turn) => string | string[]
  ): Promise<SimState> {
    const game = this.getGame()
    const gameState = Convert.toGameState(game, this.playerID)
    const turn = new Turn(gameState)
    return await this.action(turnCallback(turn))
  }

  saveReplay() {
    const game = this.getGame()
    game.replay.writeOut(this.match.results)
  }

  getGame(): Game {
    return (this.match.state as LuxMatchState).game
  }

  getGameState(): GameState {
    const game = this.getGame()
    return Convert.toGameState(game, this.playerID)
  }

  getTurn(): Turn {
    return new Turn(this.getGameState())
  }

  getSimState(): SimState {
    const game = this.getGame()
    const gameState = Convert.toGameState(game, this.playerID)
    const turn = new Turn(gameState)
    return { game, gameState, turn }
  }
}

export type MissionSimulation = {
  gameState: GameState
  plan: string[]
  annotations: string[]
  outcome: boolean
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