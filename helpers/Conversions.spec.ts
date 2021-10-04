import { LuxDesignLogic, LuxMatchState, SerializedState } from '@lux-ai/2021-challenge'
import { plainToClass } from 'class-transformer'
import 'reflect-metadata'
import { GameState } from '../lux/Agent'
import { GameMap } from '../lux/GameMap'
import getSerializedState from './Conversions'
import DUMMY_GAMESTATE from './dummy-gamestate.json'
import { initMatch } from './TreeSearch'

describe('JSON => GameState (class-transformer)', () => {
  test('Creates GameMap instance', () => {
    const gameState = plainToClass(GameState, DUMMY_GAMESTATE)
    expect(gameState.map).toBeInstanceOf(GameMap)
  })
})

describe('GameState => SerializedState', () => {
  const initialize = () => {
    const gameState = plainToClass(GameState, DUMMY_GAMESTATE)
    const serializedState: SerializedState = getSerializedState(gameState)
    return { gameState, serializedState }
  }

  test('Turn', () => {
    const { gameState, serializedState } = initialize()
    expect(serializedState.turn).toBe(gameState.turn)
  })

  test('Number of cities', () => {
    const { gameState, serializedState } = initialize()
    const gameStateCities = gameState.players.map(player => player.cities.values()).flat().length
    const serializedStateCities = Object.keys(serializedState.cities).length

    expect(serializedStateCities).toBe(gameStateCities)
  })

  test('Map dimensions', () => {
    const { gameState, serializedState } = initialize()
    expect(serializedState.map.length).toBe(gameState.map.height)
    expect(serializedState.map[0].length).toBe(gameState.map.width)
  })

  test('Resources', () => {
    const { gameState, serializedState } = initialize()
    for (let y = 0; y < gameState.map.height; y++) {
      for (let x = 0; x < gameState.map.width; x++) {
        const resource = gameState.map.getCell(x, y).resource
        const serializedResource = serializedState.map[y][x].resource // Note row-major order for SerializedState map
        if (!resource) expect(serializedResource).toBe(null)
        else {
          expect(serializedResource.type).toBe(resource.type)
          expect(serializedResource.amount).toBe(resource.amount)
        }
      }
    }
  })

  test('Roads', () => {
    const { gameState, serializedState } = initialize()
    for (let y = 0; y < gameState.map.height; y++) {
      for (let x = 0; x < gameState.map.width; x++) {
        const road = gameState.map.getCell(x, y).road
        const serializedRoad = serializedState.map[y][x].road
        expect(serializedRoad).toBe(road)
      }
    }
  })

  // If needed: add more tests for Units, Cities, Players
})

describe('SerializedState => Game (Lux AI internal)', () => {
  const initialize = async () => {
    const match = await initMatch()
    const gameState = plainToClass(GameState, DUMMY_GAMESTATE)
    const serializedState: SerializedState = getSerializedState(gameState)
    LuxDesignLogic.reset(match, serializedState)
    const game = (match.state as LuxMatchState).game
    return { match, gameState, serializedState, game }
  }

  test('Turn', async () => {
    const { game, serializedState, gameState } = await initialize()

    expect(game.state.turn).toBe(serializedState.turn)
    expect(game.state.turn).toBe(gameState.turn)
  })

  test('Map dimensions', async () => {
    const { game, serializedState, gameState } = await initialize()

    expect(game.map.height).toBe(serializedState.map.length)
    expect(game.map.width).toBe(serializedState.map[0].length)
    expect(game.map.height).toBe(gameState.map.height)
    expect(game.map.height).toBe(gameState.map.width)
  })

    // If needed: add more tests for Resources, Units, Cities, Players
})

// function debugConversions() {
//   // Debug gamestate conversions
//   log(`\n\nGAMESTATE:`)
//   log(JSON.stringify(gameState, null, 2))

//   log(`\n\nSERIALIZED STATE:`)
//   const serializedState = getSerializedState(gameState)
//   log(JSON.stringify(serializedState, null, 2))

//   log(`\n\nGAME:`)
//   LuxDesignLogic.reset(match, serializedState)
//   const game = (match.state as LuxMatchState).game
//   log(JSON.stringify(game, null, 2))

//   log(`\n\nGAMESTATE (full circle):`)
//   updateGameState(gameState, game)
//   log(JSON.stringify(gameState, null, 2))
// }