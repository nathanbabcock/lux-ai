import { Position } from '../lux/Position'
import Settler from './Settler'

/** Exactly the same as a Settler, but appends tiles to existing cities */
export default class Builder extends Settler {
  constructor(target: Position) {
    super(target)
    this.type = 'builder'
  }
}
