import { Cell } from '../lux/Cell'
import GAME_CONSTANTS from '../lux/game_constants.json'
import { Position } from '../lux/Position'
import Convert from './Convert'
import { initDebug, initSeed } from './test-util'

describe('Turn', () => {
  test('Initializes a Turn object', async () => {
    const sim = await initDebug()
    const turn = sim.getTurn()

    expect(turn.resourceTiles.length).toBeGreaterThan(0)
    expect(turn.resourceTiles[0]).toBeInstanceOf(Cell)
  })

  test('Resets gamestate with manual state setting', async () => {
    const sim = await initDebug()
    const turn = sim.getTurn()

    const unit = turn.gameState.players[turn.gameState.id].units[0]
    unit.pos = new Position(5, 10)
    const serializedState = Convert.toSerializedState(turn.gameState)

    expect(serializedState.teamStates[0].units['u_1'].x).toBe(5)
    expect(serializedState.teamStates[0].units['u_1'].y).toBe(10)

    const { game } = sim.reset(serializedState)

    expect(game.getUnit(0, 'u_1').pos.equals(new Position(5, 10))).toBe(true)

    // NOTE: replays are purely deterministic and will NOT reflect this state-setting
    // Current theory is that they start from scratch, creating a map (incl. unit spawns)
    // from the map seed (with manual override in mapgen for MapType.DEBUG),
    // and then use dead reckoning to iteratively reconstruct the state from the replay.
    // The "stateful" replay option, added later as a debug convenience only,
    // will not be able to reproduce this state-setting behavior inside the Lux AI Viewer.
  })

  test('Move a unit in a direction', async () => {
    const sim = await initDebug('replays/test-move-in-direction.json')
    const turn = sim.getTurn()

    const unit = turn.player.units[0]
    const oldPos = unit.pos
    const action = turn.moveUnit(unit, GAME_CONSTANTS.DIRECTIONS.NORTH)
    const { game } = await sim.action(action)
    const newPos = game.getUnit(unit.team, unit.id).pos

    expect(newPos.y).toBe(oldPos.y - 1) // North is negative y (?)

    sim.saveReplay()
  })

  test('Move a unit to position', async () => {
    const sim = await initDebug('replays/test-move-to-position.json')
    const dest = new Position(4, 1)

    const update = async (steps: number) => {
      for (let i = 0; i < steps; i++)
        await sim.turn(turn => turn.moveTo(turn.player.units[0], dest))
    }

    await update(5)

    let unit = sim.getTurn().player.units[0]
    expect(unit.pos.equals(dest)).toBe(true)

    await update(5)

    unit = sim.getTurn().player.units[0]
    expect(unit.pos.equals(dest)).toBe(true)

    sim.saveReplay()
  })

  test('Move to cell', async () => {
    const sim = await initDebug('replays/test-move-to-cell.json')
    const turn = sim.getTurn()

    const dest = new Position(4, 1)

    const update = async (steps: number) => {
      for (let i = 0; i < steps; i++) {
        let unit = turn.player.units[0]
        let action = turn.moveTo(unit, dest)
        let { game } = await sim.action(action)
        turn.update(game)
      }
    }

    await update(5)

    let unit = sim.getTurn().player.units[0]
    expect(unit.pos.equals(dest)).toBe(true)

    await update(5)

    unit = sim.getTurn().player.units[0]
    expect(unit.pos.equals(dest)).toBe(true)

    sim.saveReplay()
  })

  test('Gather closest resource', async () => {
    const sim = await initSeed('replays/test-gather-closest-resource.json')

    for (let i = 0; i < 10; i++)
      await sim.turn(turn => turn.gatherClosestResource(turn.player.units[0]))

    let unit = sim.getTurn().player.units[0]
    expect(unit.cargo.wood).toBe(100)
    expect(unit.getCargoSpaceLeft()).toBe(0)

    sim.saveReplay()
  })

  test('Build city at position', async () => {
    const sim = await initSeed('replays/test-build-city-at-position.json')
    for (let i = 0; i < 16; i++)
      await sim.turn(turn => turn.buildCity(turn.player.units[0], new Position(8, 5)))

    const cities = Array.from(sim.getTurn().player.cities.values())
    expect(cities.length).toBe(2)

    sim.saveReplay()
  })
})
