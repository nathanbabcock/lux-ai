import { readFileSync } from 'fs'
import CreditAssignment, { AttributionGraph } from '../helpers/CreditAssignment'
import { KaggleReplay } from '../helpers/KaggleReplay'
import LightLevels, { AugMap, AugReplay } from '../helpers/LightLevels'
import { parseKaggleObs } from '../helpers/parseKaggleObs'

/**
 * Take a Kaggle replay file and convert it to a full Lux game map,
 * augmented with several "light-map" feature layers for use in training.
 */
export function parseKaggleReplay(replay: KaggleReplay): AugReplay {
  const graph = new AttributionGraph()

  const augReplay = {
    turns: [],
    attributionGraph: graph,
  }

  let i = 0
  for (const step of replay.steps) {
    i++
    const obs = step[0].observation
    const width = obs.width
    const serializedState = parseKaggleObs(obs)
    const augMap = initAugMap(width)
    LightLevels.computeAll(serializedState, augMap)
    CreditAssignment.computeStep(step, serializedState, augReplay.attributionGraph)

    augReplay.turns.push(augMap)

    if (step === replay.steps[replay.steps.length - 1])
      CreditAssignment.backPropagation(serializedState, graph)
  }

  return augReplay
}

function initAugMap(width: number): AugMap {
  const augMap: AugMap = []
  for (let y = 0; y < width; y++) {
    augMap.push([])
    for (let x = 0; x < width; x++) {
      augMap[y].push({
        woodLevel: 0,
        coalLevel: 0,
        uraniumLevel: 0,
        resourceLevel: 0,
        enemyCityLevel: 0,
        enemyUnitLevel: 0,
        friendlyCityLevel: 0,
        friendlyUnitLevel: 0,
      })
    }
  }
  return augMap
}

function main() {
  const path = process.argv[2] || 'replays/30267977.json'
  const replay = JSON.parse(readFileSync(path, 'utf8')) as KaggleReplay
  const augReplay = parseKaggleReplay(replay)
  console.log('Constructed augmented replay with turns:', augReplay.turns.length)
  let i = 0;
  for (const turn of augReplay.turns) {
    console.log(`Turn ${i++}`)

    console.log('ALL:')
    LightLevels.printLightMap(turn, 'resourceLevel')

    console.log('WOOD:')
    LightLevels.printLightMap(turn, 'woodLevel')

    console.log('COAL:')
    LightLevels.printLightMap(turn, 'coalLevel')

    console.log('URANIUM:')
    LightLevels.printLightMap(turn, 'uraniumLevel')

    console.log()
    if (i > 0) break
  }

  console.log('Final attribution graph with rewards:')
  augReplay.attributionGraph.print()
}

main()
