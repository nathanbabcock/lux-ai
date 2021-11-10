import { readdirSync, readFileSync, writeFileSync } from 'fs'
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
    const team = 0 // arbitrary
    LightLevels.computeAll(serializedState, augMap, team)
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

function printAugMap(augReplay: AugReplay) {
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

    console.log('FRIENDLY UNITS:')
    LightLevels.printLightMap(turn, 'friendlyUnitLevel')

    console.log('ENEMY UNITS:')
    LightLevels.printLightMap(turn, 'enemyUnitLevel')

    console.log('FRIENDLY CITIES:')
    LightLevels.printLightMap(turn, 'friendlyCityLevel')

    console.log('ENEMY CITIES:')
    LightLevels.printLightMap(turn, 'enemyCityLevel')

    console.log()
    if (i > 0) break
  }
}

/**
 * Identifies a single city tile,
 * the feature description of the world at the time of its creation,
 * and accumulated (direct and indirect) rewards by end of game
 */
export type TrainingData = {
  turn: number
  // team?: 0 | 1
  woodLevel: number
  coalLevel: number
  uraniumLevel: number
  resourceLevel: number
  // enemyCityLevel: number
  // enemyUnitLevel: number
  // friendlyCityLevel: number
  // friendlyUnitLevel: number
  reward: number
}

function createTrainingData(augReplay: AugReplay): TrainingData[] {
  const graph = augReplay.attributionGraph
  const trainingData: TrainingData[] = []

  for (const cityTile of Object.values(graph.cityTiles)) {
    const turn = cityTile.createdTurn
    const map = augReplay.turns[turn]
    if (!map) throw new Error(`Could not find lightmaps on turn ${turn}`)
    const cell = map[cityTile.pos.y][cityTile.pos.x]
    if (!map) throw new Error(`Could not find cell map[${cityTile.pos.y}][${cityTile.pos.x}] on turn ${turn}`)

    trainingData.push({
      turn: turn,
      woodLevel: cell.woodLevel,
      coalLevel: cell.coalLevel,
      uraniumLevel: cell.uraniumLevel,
      resourceLevel: cell.resourceLevel,
      // enemyCityLevel: cell.enemyCityLevel,
      // enemyUnitLevel: cell.enemyUnitLevel,
      // friendlyCityLevel: cell.friendlyCityLevel,
      // friendlyUnitLevel: cell.friendlyUnitLevel,
      reward: cityTile.reward,
    })
  }

  return trainingData
}

function parseFile(path: string) {
  const replay = JSON.parse(readFileSync(path, 'utf8')) as KaggleReplay
  console.log(`Read Kaggle replay from ${path}`)
  const augReplay = parseKaggleReplay(replay)
  
  const parts = path.split('.')
  if (parts.length < 2) throw new Error(`Could not create valid path from input file`)
  parts[parts.length - 2] += '-aug'
  const augPath = parts.join('.')
  const trainingData = createTrainingData(augReplay)

  // console.log('Final attribution graph with rewards:')
  // augReplay.attributionGraph.print()

  writeFileSync(augPath, JSON.stringify(trainingData, null, 2))
  console.log(`Wrote augmented replay to ${augPath}`)
}

function main() {
  //const path = process.argv[2] || 'replays/30267977.json'

  const folderPath = '../lux-ai-top-episodes'
  const files = readdirSync(folderPath)
  for (const file of files) {
    if (file.includes('-aug')) continue
    const filePath = `${folderPath}/${file}`
    console.log(`Parsing ${filePath}`)
    parseFile(filePath)
  }
}

main()
