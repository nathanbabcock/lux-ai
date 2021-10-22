import { Position } from '@lux-ai/2021-challenge'
import Abstraction from './Abstraction'
import { initSeed } from './test-util'

describe('Abstraction', () => {
  test('Simulate building city', async () => {
    const sim = await initSeed()
    const game = sim.getGame()
    const team = 0
    const newCityPos = new Position(7, 5)

    const getNewCity = () => {
      const cities = Array.from(game.cities.values())
      return cities.find(c => c.team === team && c.citycells.find(cc => cc.pos.equals(newCityPos)))
    }

    expect(game.state.turn).toBe(0)
    expect(getNewCity()).toBeUndefined()

    Abstraction.simulateBuildingCity(newCityPos, team, game)

    expect(game.state.turn).toBeGreaterThan(0)
    expect(getNewCity()).toBeDefined()

    console.log(game.state.turn)
  })
})