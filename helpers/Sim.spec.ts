import { GameMap, LuxDesignLogic, LuxMatchState } from '@lux-ai/2021-challenge'
import { Cell } from '../lux/Cell'
import GAME_CONSTANTS from '../lux/game_constants.json'
import { Position } from '../lux/Position'
import Convert from './Convert'
import { simulate } from './Sim'
import { initMatch } from './TreeSearch'
import Turn from './Turn'

describe('Sim', () => {
  const init = async (replay?: string) => {
    const match = await initMatch({
      storeReplay: !!replay,
      out: replay,
      mapType: GameMap.Types.DEBUG,
      width: 16,
      height: 16,
    })
    const game = (match.state as LuxMatchState).game
    const gameState = Convert.toGameState(game, 0)
    const turn = new Turn(gameState)

    return { match, gameState, turn, game }
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
    const { match, turn } = await init('replays/test-gather-closest-resource.json')

    const unit = turn.player.units[0]
    unit.pos = new Position(5, 10)
    const serializedState = Convert.toSerializedState(turn.gameState)
    LuxDesignLogic.reset(match, serializedState)
    const action = turn.gatherClosestResource(unit)
    let game = await simulate(match, turn.gameState.id, action)
    turn.update(game)

    for (let i = 0; i < 39; i++) {
      game = await simulate(match, turn.gameState.id, turn.gatherClosestResource(unit))
      turn.update(game)
    }

    game.replay.writeOut(match.results)
  })
})
