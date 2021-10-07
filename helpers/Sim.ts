import { Game, GameMap, LuxDesign, LuxDesignLogic, LuxMatchConfigs, LuxMatchState, SerializedState } from '@lux-ai/2021-challenge'
import { create, Logger, Match, MatchEngine } from 'dimensions-ai'
import { Dimension } from 'dimensions-ai/lib/main/Dimension'
import { DeepPartial } from 'dimensions-ai/lib/main/utils/DeepPartial'
import { GameState } from '../lux/Agent'
import GAME_CONSTANTS from '../lux/game_constants.json'
import { Position } from '../lux/Position'
import Convert from './Convert'
import { log } from './logging'
import Turn from './Turn'
import { clone } from './util'

export type SimState = {
  game: Game
  gameState: GameState
  turn: Turn
}

export default class Sim {
  public match?: Match
  public playerID?: number

  public stats = {
    turns: 0,
    resets: 0,
  }

  private design?: LuxDesign
  private dimension?: Dimension
  private configs: DeepPartial<LuxMatchConfigs & Match.Configs>

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

  reset(state: SerializedState): SimState {
    LuxDesignLogic.reset(this.match, state)
    let game = this.getGame()
    game.replay.data.stateful = [game.toStateObject()]
    this.stats.resets++
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
    this.stats.turns++
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

  getGameStateValue(gamestate: GameState | null = null) {
    if (!gamestate) gamestate = this.getGameState()

    const player = gamestate.players[gamestate.id]

    const cityTiles =
      Array.from(player.cities.values())
      .map(city => city.citytiles).flat().length

    const units = player.units.length

    return Math.max(cityTiles, units)
  }

  async assignments(
    assignments: Assignments,
    sim: Sim,
    gameState: GameState,
    endTurn: number,
    depth: number,
  ): Promise<MissionSimulationV2> {
    const simAssignments = clone(assignments)
    
    this.reset(Convert.toSerializedState(gameState))

    const turns = endTurn - gameState.turn

    if (turns <= 0) {
      log(`Simulation bottomed out / base case reached`)
      return {
        assignments: simAssignments,
        gameState,
        gameStateValue: this.getGameStateValue(gameState),
      }
    }

    log(`Starting simulation at depth ${depth} with ${turns} turns remaining`)
    log(`Starting simAssignments:`)
    for(const ass in simAssignments) log(ass, simAssignments[ass].x, simAssignments[ass].y)
    for (let i = 0; i < turns; i++) {
      const turn = this.getTurn()
      const action = await turn.settlerTreeSearch(sim, simAssignments, endTurn, depth)
      await this.action(action)
    }

    const newGameState = this.getGameState()
    const gameStateValue = this.getGameStateValue(newGameState)

    log(`Completed sim with gamestate value ${gameStateValue}`)

    return {
      assignments,
      gameState: newGameState,
      gameStateValue,
    }
  }

  resetStats() {
    this.stats = {
      turns: 0,
      resets: 0,
    }
  }
}

export type MissionSimulation = {
  gameState: GameState
  plan: string[]
  annotations: string[]
  outcome: boolean
}

export type Assignments = Record<string, Position>

export type MissionSimulationV2 = {
  assignments: Assignments
  gameState: GameState,
  gameStateValue?: number,
}