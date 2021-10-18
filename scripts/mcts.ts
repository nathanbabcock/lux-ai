import MonteCarlo, { TreeNode } from '../helpers/MonteCarlo'
import DUMMY_GAMESTATE from '../helpers/dummy-gamestate.json'
import { plainToClass } from 'class-transformer'
import { GameState } from '../lux/Agent'
import { Unit } from '../lux/Unit'

async function main() {
  console.log('Hello world: Monte Carlo Tree Search')
  const gameState = plainToClass(GameState, DUMMY_GAMESTATE)

  const newUnit = new Unit(gameState.id, 0, 'u_3', 0, 0, 0, 0, 0, 0)
  gameState.players[gameState.id].units.push(newUnit)

  const newUnit2 = new Unit(gameState.id, 0, 'u_5', 0, 0, 0, 0, 0, 0)
  gameState.players[gameState.id].units.push(newUnit2)

  const mcts = new MonteCarlo()
  mcts.root = new TreeNode(gameState)

  // const allPossibleAssignments = mcts.root.getAllPossibleAssignments()
  // console.log(`All possible assignments: ${allPossibleAssignments.length}`)

  const units = ['u_1', 'u_2', 'u_3']
  const clusters = [1, 2, 3, 4]

  const assignments = MonteCarlo.generateAssignmentsSimple(units, clusters)
  console.log(assignments.length)

  assignments.forEach((assignment, i) => {
    console.log(`Assignment #${i}`)
    assignment.forEach(mission => {
      console.log(`(${mission.unit}, cluster_${mission.cluster})`)
    })
  })

  console.log(assignments.length)
}

main()
