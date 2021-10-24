import { writeFileSync } from 'fs'
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

  const playouts = 500
  const start = new Date().getTime()
  for (let i = 0; i < playouts; i++) {
    console.log(`Running playout ${i}/${playouts}`)
    const { depth } = Abstraction.expandLightPlayout(root)
    console.log(` > depth: ${depth}`)
  }
  const end = new Date().getTime() - start

  let i = 0
  let cur = root
  while (cur && i < 10) {
    i++
    console.log()
    console.log(`Depth ${i}`)
    console.log(cur.toString())
    // console.log(cur.game.map.getMapString())
    cur = cur.children.find(c => c.children.length > 0 || c.game.state.turn >= 360)
  }

  console.log(`${playouts} playouts took ${end}ms`)
}

main()