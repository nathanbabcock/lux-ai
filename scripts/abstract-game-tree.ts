import { AbstractGameNode, countCityTiles } from '../helpers/Abstraction'
import { initSeed } from '../helpers/test-util'
import { Position } from '../lux/Position'

async function main() {
  console.log('==================')
  console.log('Abstract Game Tree')
  console.log('==================')

  const sim = await initSeed()
  const game = sim.getGame()
  const team = 0 // orange team
  const root = AbstractGameNode.fromGame(game, team)

  /** Hardcoded for now */
  const potentialCities = [
    new Position(1, 5),
    new Position(8, 5),
  ]

  root.generateChildren(potentialCities)

  console.group('root')
  console.log(root.toString(team))

  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i]
    console.group(`child ${i}`)
    console.log(child.toString(team))
    console.log(child.game.map.getMapString())
    console.groupEnd()
  }

  console.log(root.game.map.getMapString())

  console.groupEnd()
}

main()