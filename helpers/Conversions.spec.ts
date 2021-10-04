import type { GameState } from '../lux/Agent'
import DUMMY_GAMESTATE from './dummy-gamestate.json'

test('Convert gamestate', () => {
  
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