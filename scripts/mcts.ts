import { writeFileSync } from 'fs'
import MonteCarlo, { TreeNode } from '../helpers/MonteCarlo'
import Sim from '../helpers/Sim'
import { chooseRandom, deepClone } from '../helpers/util'
import { GameState } from '../lux/Agent'

async function main() {
  console.log('Hello world: Monte Carlo Tree Search')

  const sim = await Sim.create({
    storeReplay: false,
    statefulReplay: false,
    out: 'replays/mcts.json',
    debugAnnotations: true,
    seed: 302641329,
  })
  const gameState = deepClone(GameState, sim.getGameState())
  const mcts = new MonteCarlo()
  mcts.root = new TreeNode(gameState)
  MonteCarlo.expansion(mcts.root)

  const dot = mcts.renderGraphViz()
  writeFileSync('graphviz/before.dot', dot)

  const N_PLAYOUTS = 10000
  const timerLabel = `Playout x ${N_PLAYOUTS}`
  console.time(timerLabel)
  for (let i = 0; i < N_PLAYOUTS; i++) {
    const child = chooseRandom(mcts.root.children)
    console.log(`Playout #${i} (selection = child ${mcts.root.children.indexOf(child)})`)
    await MonteCarlo.simAndBackProp(sim, child)
    // sim.saveReplay()
  }
  console.timeEnd(timerLabel)

  const dot2 = mcts.renderGraphViz()
  writeFileSync('graphviz/after.dot', dot2)
}

main()
