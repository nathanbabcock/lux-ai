import { parseKaggleObs } from '@lux-ai/2021-challenge/lib/es5/Replay/parseKaggleObs'
import { readFileSync } from 'fs'
import { KaggleReplay } from '../helpers/KaggleReplay'


export type AugMapCell = {
  woodLevel: number
  coalLevel: number
  uraniumLevel: number
  enemyCityLevel: number
  enemyUnitLevel: number
  friendlyCityLevel: number
  friendlyUnitLevel: number
}

export type AugMap = AugMapCell[][]

export type AugReplay = {
  turns: AugMap[]
  // attributionGraph
}

/**
 * Take a Kaggle replay file and convert it to a full Lux game map,
 * augmented with several "light-map" feature layers for use in training.
 */
export function parseKaggleReplay(replay: KaggleReplay): AugReplay {
  const augReplay = { turns: [] }

  for (const step of replay.steps) {
    const obs = step[0].observation
    const width = obs.width
    const serializedState = parseKaggleObs(obs)
    const augMap = initAugMap(width)
    augReplay.turns.push(augMap)

    for (const player of step) {
      // asdf
    }
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
  const path = process.argv[2] || 'replays/toad-brigade-vs-rl-is-all-you-need-30267977.json'
  const replay = JSON.parse(readFileSync(path, 'utf8')) as KaggleReplay
  const augReplay = parseKaggleReplay(replay)
  console.log('Constructed augmented replay with turns:', augReplay.turns.length)
}

main()
