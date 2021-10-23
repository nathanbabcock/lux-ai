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

  console.log('Expanding playout thru end of game...')
  console.time('light playout')
  Abstraction.expandLightPlayout(root)
  console.timeEnd('light playout')
  
  let i = 0
  let cur = root
  while (cur) {
    i++
    console.log(`Depth ${i}`)
    console.log(cur.toString())
    console.log(cur.game.map.getMapString())
    cur = cur.children.find(c => c.children.length > 0 || c.game.state.turn >= 360)
  }
}

main()