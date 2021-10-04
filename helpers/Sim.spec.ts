import { LuxDesignLogic, LuxMatchState, SerializedState } from '@lux-ai/2021-challenge'
import { plainToClass } from 'class-transformer'
import { GameState } from '../lux/Agent'
import Convert from './Convert'
import DUMMY_GAMESTATE from './dummy-gamestate.json'
import { simulateSettlerMission } from './Sim'
import { initMatch } from './TreeSearch'

describe('Sim', () => {
  test('Simulates a settler mission', async () => {
    // const match = await initMatch()
    // const gameState = plainToClass(GameState, DUMMY_GAMESTATE)
    // const serializedState: SerializedState = Convert.toSerializedState(gameState)
    // LuxDesignLogic.reset(match, serializedState)
    // const game = (match.state as LuxMatchState).game

    // // await simulateSettlerMission(game.getUnit(0, 'u_1'))

    // Implement when needed.
  })
})
