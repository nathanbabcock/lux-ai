import { Position } from '@lux-ai/2021-challenge'
import Abstraction, { UnitLocalState } from './Abstraction'
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

    const unit = Array.from(game.state.teamStates[team].units.values())[0]

    const unitState: UnitLocalState = {
      id: unit.id,
      team: team,
      pos: unit.pos,
      turn: game.state.turn,
    }
    
    const newUnitState = Abstraction.simulateBuildingCity(newCityPos, unitState, game)

    expect(game.state.turn).toBeGreaterThan(0)
    expect(getNewCity()).toBeDefined()
    expect(newUnitState.turn).toBeGreaterThan(unitState.turn)
  })
})