import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const sourceCode = readFileSync(resolve(__dirname, '../agents/stochastic-expander.js'), 'utf8')

const ratios = [
  0,
  0.01,
  0.02,
  0.03,
  0.04,
  0.05,
]

ratios.forEach(ratio => {
  const modified = sourceCode.replace(`var ratio = 0.05;`, `var ratio = ${ratio};`)
  writeFileSync(resolve(__dirname, `../agents/stochastic-${ratio}.js`), modified)
})

console.log(`Generated ${ratios.length} stochastic agents`)
console.log('Run the following command to evaluate them:')
console.log(`lux-ai-2021 --storeLogs=false --storeReplay=false --rankSystem="elo" --tournament ${ratios.map(ratio => `dist/agents/stochastic-${ratio}.js`).join(' ')}`)

// Sample output:
// lux-ai-2021 --storeLogs=false --storeReplay=false --rankSystem="elo" --tournament dist/agents/stochastic-0.js dist/agents/stochastic-0.01.js dist/agents/stochastic-0.05.js dist/agents/stochastic-0.1.js dist/agents/stochastic-0.2.js dist/agents/stochastic-0.3.js dist/agents/stochastic-0.4.js dist/agents/stochastic-0.5.js dist/agents/stochastic-0.6.js dist/agents/stochastic-0.7.js dist/agents/stochastic-0.8.js dist/agents/stochastic-0.9.js dist/agents/stochastic-0.95.js dist/agents/stochastic-0.99.js dist/agents/stochastic-1.js