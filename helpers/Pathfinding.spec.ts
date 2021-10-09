import { initSeed } from './test-util'

describe('Pathfinding', () => {
  test('Find the shortest path, avoiding obstacles', async () => {
    const sim = await initSeed('replays/test-shortest-path.json')
    

    sim.saveReplay()
  })
})
