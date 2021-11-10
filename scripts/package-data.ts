import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { TrainingData } from './parse-kaggle-replay'

const allData: TrainingData[] = []

const folderPath = '../lux-ai-top-episodes'
const files = readdirSync(folderPath)
for (const file of files) {
  if (!file.includes('-aug')) continue
  const filePath = `${folderPath}/${file}`
  console.log(`Parsing ${filePath}`)
  // parseFile(filePath)
  const contents = readFileSync(filePath, 'utf8')
  const data = JSON.parse(contents) as TrainingData[]
  for (const item of data) {
    allData.push(item)
  }
}

const contents = 'const allData = ' + JSON.stringify(allData)
writeFileSync('replays/browser-data.js', contents)