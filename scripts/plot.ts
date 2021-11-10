import { plot } from 'nodeplotlib'
import type { Plot } from 'nodeplotlib'
import { readdirSync, readFileSync } from 'fs'
import { TrainingData } from './parse-kaggle-replay'

const x = []
const y = []

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
    x.push(item.woodLevel)
    y.push(item.reward)
  }
}

const series: Plot = { x, y, type: 'scatter'}

const data: Plot[] = [series]
plot(data)

console.log(`Plotted ${y.length} points`)