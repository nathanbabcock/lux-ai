import { GameMap } from '@lux-ai/2021-challenge'
import { annotate } from '../lux/Agent'
import GAME_CONSTANTS from '../lux/game_constants.json'
import Sim from './Sim'

describe('Clusters', () => {
  const initSeed = async (replay?: string) =>
    await Sim.create({
      storeReplay: !!replay,
      out: replay,
      mapType: GameMap.Types.RANDOM,
      debugAnnotations: true,
      width: 12,
      height: 12,
      seed: 123456789,
    })

  test('Get clusters', async () => {
    const sim = await initSeed('replays/test-get-clusters.json')
    const turn = sim.getTurn()

    const unit = turn.player.units[0]
    const annotations = turn.annotateClusters(unit)
    annotations.push(unit.move(GAME_CONSTANTS.DIRECTIONS.CENTER))
    annotations.push(annotate.sidetext('hello world'))
    await sim.action(annotations)

    expect(turn.clusters.length).toBe(4) // non-homogenous clusters

    // Annotations not currently shown in replay
    sim.saveReplay()
  })
})