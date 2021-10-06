import { SerializedState } from '@lux-ai/2021-challenge'
import { plainToClass } from 'class-transformer'
import { GameState } from '../lux/Agent'
import { City } from '../lux/City'
import { GameMap } from '../lux/GameMap'
import Convert from './Convert'
import DUMMY_GAMESTATE from './dummy-gamestate.json'
import Sim from './Sim'
import { clone } from './util'

describe('JSON => GameState (class-transformer)', () => {
  test('Creates GameMap instance', () => {
    const gameState = plainToClass(GameState, DUMMY_GAMESTATE)
    expect(gameState.map).toBeInstanceOf(GameMap)
  })

  test('Creates Map of city IDs to cities', () => {
    const gameState = plainToClass(GameState, DUMMY_GAMESTATE)
    const cities = gameState.players[0].cities

    expect(cities).toBeInstanceOf(Map)
    expect(cities.get('c_1')).toBeInstanceOf(City)
  })
})

describe('GameState => SerializedState', () => {
  const initialize = () => {
    const gameState = plainToClass(GameState, DUMMY_GAMESTATE)
    const serializedState: SerializedState = Convert.toSerializedState(gameState)
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
    const sim = new Sim()
    await sim.init()
    const gameState = plainToClass(GameState, DUMMY_GAMESTATE)
    const serializedState: SerializedState = Convert.toSerializedState(gameState)
    sim.reset(serializedState)
    const game = sim.getGame()
    return { gameState, serializedState, game }
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

  test('getCityById', async () => {
    const { game, gameState } = await initialize()

    const cities = Array.from(gameState.players[0].cities.entries())
    const city = cities[0][1]
    const cityTile = city.citytiles[0]

    const cell = game.map.getCellByPos(cityTile.pos)
    const newCity = game.cities.get(cell.citytile.cityid)

    expect(newCity).toBeDefined()
  })

  // If needed: add more tests for Resources, Units, Cities, Players
})

describe('Game => GameState (round trip)', () => {
  const initialize = async () => {
    const sim = new Sim()
    await sim.init()
    const originalGameState = plainToClass(GameState, DUMMY_GAMESTATE)
    const serializedState: SerializedState = Convert.toSerializedState(originalGameState)
    sim.reset(serializedState)
    const game = sim.getGame()
    const finalGameState = clone(originalGameState)
    Convert.updateGameState(finalGameState, game)
    return { originalGameState, serializedState, game, finalGameState }
  }

  test('Turn', async () => {
    const { originalGameState, finalGameState } = await initialize()
    expect(originalGameState.turn).toBe(finalGameState.turn)
  })

  test('Map dimensions', async () => {
    const { originalGameState, finalGameState } = await initialize()
    expect(originalGameState.map.width).toBe(finalGameState.map.width)
    expect(originalGameState.map.height).toBe(finalGameState.map.height)
  })

  test('Resources', async () => {
    const { originalGameState, finalGameState } = await initialize()
    for (let y = 0; y < originalGameState.map.height; y++) {
      for (let x = 0; x < originalGameState.map.width; x++) {
        const originalResource = originalGameState.map.getCell(x, y).resource
        const finalResource = finalGameState.map.getCell(x, y).resource
        if (!originalResource) expect(finalResource).toBe(null)
        else {
          expect(finalResource.type).toBe(originalResource.type)
          expect(finalResource.amount).toBe(originalResource.amount)
        }
      }
    }
  })

  test('Units', async () => {
    const { originalGameState, finalGameState } = await initialize()
    for (let i = 0; i < finalGameState.players.length; i++) {
      const finalPlayer = finalGameState.players[i]
      const originalPlayer = originalGameState.players[i]

      for (let j = 0; j < finalPlayer.units.length; j++) {
        const finalUnit = finalPlayer.units[j]
        const originalUnit = originalPlayer.units[j]

        expect(finalUnit).toEqual(originalUnit)
      }
    }
  })

  test('Cities', async () => {
    const { originalGameState, finalGameState } = await initialize()
    for (let i = 0; i < finalGameState.players.length; i++) {
      const finalPlayer = finalGameState.players[i]
      const originalPlayer = originalGameState.players[i]
      const finalCities = Array.from(finalPlayer.cities.entries())
      const originalCities = Array.from(originalPlayer.cities.entries())

      for (let j = 0; j < finalCities.length; j++) {
        const finalCity = finalCities[j]
        const originalCity = originalCities[j]

        expect(finalCity).toEqual(originalCity)
      }
    }
  })
})
