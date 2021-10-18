import MonteCarlo, { TreeNode } from '../helpers/MonteCarlo'
import DUMMY_GAMESTATE from '../helpers/dummy-gamestate.json'
import { plainToClass } from 'class-transformer'
import { GameState } from '../lux/Agent'

async function main() {
  console.log('Hello world: Monte Carlo Tree Search')
  const gameState = plainToClass(GameState, DUMMY_GAMESTATE)
  const mcts = new MonteCarlo()
  mcts.root = new TreeNode(gameState)

  const allPossibleAssignments = mcts.root.getAllPossibleAssignments()
  console.log(`All possible assignments: ${allPossibleAssignments.length}`)
}

main()
