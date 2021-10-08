import DirectorV2 from '../helpers/DirectorV2'
import { clearLog, log } from '../helpers/logging'
import { Agent } from '../lux/Agent'

const agent = new Agent()
const director = new DirectorV2()

async function main() {
  clearLog()
  log('=================')
  log('Director Agent V2')
  log('=================')
  log(new Date().toLocaleString())

  agent.run(async gameState => {
    const actions: string[] = []
    return actions
  })
}

main()

