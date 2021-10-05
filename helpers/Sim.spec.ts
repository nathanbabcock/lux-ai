import { Game, LuxDesignLogic, LuxMatchState, SerializedState } from '@lux-ai/2021-challenge'
import { plainToClass } from 'class-transformer'
import { GameState } from '../lux/Agent'
import { Cell } from '../lux/Cell'
import Convert from './Convert'
import GAME_CONSTANTS from '../lux/game_constants.json'
import DUMMY_GAMESTATE from './dummy-gamestate.json'
import { initMatch } from './TreeSearch'
import Turn from './Turn'
import { simulate } from './Sim'

describe('Sim', () => {
  const init = async () => {
    const match = await initMatch('replays/test-gather-closest-resource.json')
    const gameState = plainToClass(GameState, DUMMY_GAMESTATE)
    const serializedState: SerializedState = Convert.toSerializedState(gameState)
    LuxDesignLogic.reset(match, serializedState)
    const turn = new Turn(gameState)
    const game = (match.state as LuxMatchState).game

    return { match, gameState, serializedState, turn, game }
  }

  test('Initializes a Turn object', async () => {
    const { turn } = await init()

    expect(turn.resourceTiles.length).toBeGreaterThan(0)
    expect(turn.resourceTiles[0]).toBeInstanceOf(Cell)
  })

  test('Move a unit in a direction', async () => {
    const { match, turn } = await init()

    const unit = turn.player.units[0]
    const oldPos = unit.pos
    const action = turn.moveUnit(unit, GAME_CONSTANTS.DIRECTIONS.NORTH)
    const game = await simulate(match, turn.gameState.id, action)
    const newPos = game.getUnit(unit.team, unit.id).pos

    expect(newPos.y).toBe(oldPos.y - 1) // North is negative y (?)
  })

  test('Gather closest resources', async () => {
    const { match, turn } = await init()

    const unit = turn.player.units[0]
    const oldPos = unit.pos
    const action = turn.gatherClosestResource(unit)
    const game = await simulate(match, turn.gameState.id, action)
    const newPos = game.getUnit(unit.team, unit.id).pos
    
    expect(newPos.equals(oldPos)).toBe(false)

    game.replay.writeOut(match.results)
  })
})
