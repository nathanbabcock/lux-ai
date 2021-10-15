import { randomActions } from '../agents/random'
import { tryAsync } from '../helpers/logging'
import Sim from '../helpers/Sim'

async function main() {
  const sim = await Sim.create({
    width: 32,
    height: 32,
  })

  console.time('benchmark')
  const start = new Date().getTime()
  let turns = 0
  const startState = sim.getGame().toStateObject()
  while (new Date().getTime() - start < 3000) {
    turns++
    await tryAsync(async () => {
      const turn = sim.getGame().state.turn
      if (turn >= 360)
        sim.reset(startState)
      const gameState = sim.getGameState()
      const actions = randomActions(gameState)
      await sim.action(actions)
    })
  }
  console.timeEnd('benchmark')
  console.log(`${turns} turns`)
}

main()
