import { GameMap, LuxMatchState } from '@lux-ai/2021-challenge'
import { Cell } from '../lux/Cell'
import GAME_CONSTANTS from '../lux/game_constants.json'
import { Position } from '../lux/Position'
import Convert from './Convert'
import { reset, simulate } from './Sim'
import { initMatch } from './TreeSearch'
import Turn from './Turn'

describe('Sim', () => {
  const initDebug = async (replay?: string) => {
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

  const initSeed = async (replay?: string) => {
    const match = await initMatch({
      storeReplay: !!replay,
      out: replay,
      mapType: GameMap.Types.RANDOM,
      width: 12,
      height: 12,
      seed: 123456789,
    })
    const game = (match.state as LuxMatchState).game
    const gameState = Convert.toGameState(game, 0)
    const turn = new Turn(gameState)

    return { match, gameState, turn, game }
  }

  test('Initializes a Turn object', async () => {
    const { turn } = await initDebug()

    expect(turn.resourceTiles.length).toBeGreaterThan(0)
    expect(turn.resourceTiles[0]).toBeInstanceOf(Cell)
  })

  test('Resets gamestate with manual state setting', async () => {
    const { match, turn } = await initDebug()

    const unit = turn.gameState.players[turn.gameState.id].units[0]
    unit.pos = new Position(5, 10)
    const serializedState = Convert.toSerializedState(turn.gameState)

    expect(serializedState.teamStates[0].units['u_1'].x).toBe(5)
    expect(serializedState.teamStates[0].units['u_1'].y).toBe(10)

    let game = reset(match, turn.gameState)

    expect(game.getUnit(0, 'u_1').pos.equals(new Position(5, 10))).toBe(true)

    // NOTE: replays are purely deterministic and will NOT reflect this state-setting
    // Current theory is that they start from scratch, creating a map (incl. unit spawns)
    // from the map seed (with manual override in mapgen for MapType.DEBUG),
    // and then use dead reckoning to reconstruct the state from the replay.
    // The "stateful" replay option, added later as a debug convenience only,
    // will not be able to reproduce this state-setting inside the Lux AI Viewer.
  })

  test('Move a unit in a direction', async () => {
    const { match, turn } = await initDebug('replays/test-move-in-direction.json')

    const unit = turn.player.units[0]
    const oldPos = unit.pos
    const action = turn.moveUnit(unit, GAME_CONSTANTS.DIRECTIONS.NORTH)
    const game = await simulate(match, turn.gameState.id, action)
    const newPos = game.getUnit(unit.team, unit.id).pos

    expect(newPos.y).toBe(oldPos.y - 1) // North is negative y (?)

    game.replay.writeOut(match.results)
  })

  test('Move to cell', async () => {
    const { match, turn, game } = await initDebug('replays/test-move-to-cell.json')

    const dest = new Position(4, 1)

    const update = async (steps: number) => {
      for (let i = 0; i < steps; i++) {
        let unit = turn.player.units[0]
        let action = turn.moveTo(unit, dest)
        let game = await simulate(match, turn.gameState.id, action)
        turn.update(game)
      }
    }

    await update(5)

    let unit = turn.player.units[0]
    expect(unit.pos.equals(dest)).toBe(true)

    await update(5)

    expect(unit.pos.equals(dest)).toBe(true)

    game.replay.writeOut(match.results)
  })

  test('Move to cell', async () => {
    const { match, turn, game } = await initDebug('replays/test-move-to-cell.json')

    const dest = new Position(4, 1)

    const update = async (steps: number) => {
      for (let i = 0; i < steps; i++) {
        let unit = turn.player.units[0]
        let action = turn.moveTo(unit, dest)
        let game = await simulate(match, turn.gameState.id, action)
        turn.update(game)
      }
    }

    await update(5)

    let unit = turn.player.units[0]
    expect(unit.pos.equals(dest)).toBe(true)

    await update(5)

    expect(unit.pos.equals(dest)).toBe(true)

    game.replay.writeOut(match.results)
  })

  test('Gather closest resource', async () => {
    const { match, turn, game } = await initSeed('replays/test-gather-closest-resource.json')

    for (let i = 0; i < 10; i++) {
      let unit = turn.player.units[0]
      let action = turn.gatherClosestResource(unit)
      let game = await simulate(match, turn.gameState.id, action)
      turn.update(game)
    }

    let unit = turn.player.units[0]
    expect(unit.cargo.wood).toBe(100)
    expect(unit.getCargoSpaceLeft()).toBe(0)

    game.replay.writeOut(match.results)
  })
})
