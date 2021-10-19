import { plainToClass } from 'class-transformer'
import { writeFileSync } from 'fs'
import DUMMY_GAMESTATE from '../helpers/dummy-gamestate.json'
import MonteCarlo, { TreeNode } from '../helpers/MonteCarlo'
import { GameState } from '../lux/Agent'

async function main() {
  console.log('Hello world: Monte Carlo Tree Search')
  const gameState = plainToClass(GameState, DUMMY_GAMESTATE)

  // const newUnit = new Unit(gameState.id, 0, 'u_3', 0, 0, 0, 0, 0, 0)
  // gameState.players[gameState.id].units.push(newUnit)

  // const newUnit2 = new Unit(gameState.id, 0, 'u_5', 0, 0, 0, 0, 0, 0)
  // gameState.players[gameState.id].units.push(newUnit2)

  const mcts = new MonteCarlo()
  mcts.root = new TreeNode(gameState)

  mcts.root.expand()

  const dot = MonteCarlo.renderGraphViz(mcts.root)

  writeFileSync('graphviz/mcts.dot', dot)
}

main()
