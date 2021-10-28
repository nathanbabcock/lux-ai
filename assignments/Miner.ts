import { Position } from '../lux/Position'
import Guard from './Guard'

/** Stay in one spot and constantly mine materials */
export default class Miner extends Guard {
  constructor(target: Position) {
    super(target)
    this.type = 'miner'
  }
}