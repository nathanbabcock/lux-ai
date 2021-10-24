import Abstraction, { AbstractGameNode } from '../helpers/Abstraction'
import { initSeed } from '../helpers/test-util'

async function main() {
  console.log('==================')
  console.log('Abstract Game Tree')
  console.log('==================')

  const sim = await initSeed()
  const game = sim.getGame()
  const team = 0 // orange team
  const root = AbstractGameNode.fromGame(game, team)

  const playouts = 10000
  const start = new Date().getTime()
  for (let i = 0; i < playouts; i++) {
    console.log(`Running playout ${i}/${playouts}`)
    const { depth } = Abstraction.expandLightPlayout(game, root)
    console.log(` > depth: ${depth}`)
  }
  const end = new Date().getTime() - start


  console.log()
  console.log('Root')
  console.log(root.toString())

  let i = 0
  for (const child of root.children) {
    console.log()
    console.log(`Depth 1 Child ${i++}`)
    console.log(child.toString())
  }

  console.log(`${playouts} playouts took ${end}ms`)
}

main()