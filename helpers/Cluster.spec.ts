import { GameMap, LuxMatchState } from '@lux-ai/2021-challenge'
import { annotate } from '../lux/Agent'
import GAME_CONSTANTS from '../lux/game_constants.json'
import Convert from './Convert'
import { simulate } from './Sim'
import { initMatch } from './TreeSearch'
import Turn from './Turn'

describe('Clusters', () => {
  const initSeed = async (replay?: string) => {
    const match = await initMatch({
      storeReplay: !!replay,
      out: replay,
      mapType: GameMap.Types.RANDOM,
      debugAnnotations: true,
      width: 12,
      height: 12,
      seed: 123456789,
    })
    const game = (match.state as LuxMatchState).game
    const gameState = Convert.toGameState(game, 0)
    const turn = new Turn(gameState)

    return { match, gameState, turn, game }
  }

  test('Get clusters', async () => {
    const { match, game, turn } = await initSeed('replays/test-get-clusters.json')

    const unit = turn.player.units[0]
    const annotations = turn.annotateClusters(unit)
    annotations.push(unit.move(GAME_CONSTANTS.DIRECTIONS.CENTER))
    annotations.push(annotate.sidetext('hello world'))
    await simulate(match, turn.gameState.id, annotations)

    expect(turn.clusters.length).toBe(4) // non-homogenous clusters

    // Annotations not currently shown in replay
    game.replay.writeOut(match.results)
  })
})