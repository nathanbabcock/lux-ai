export function chooseRandom<T>(array: Array<T>): T {
  return array[Math.floor(Math.random() * array.length)]
}

export function clone<T>(obj: T): T { 
  return Object.assign(Object.create(Object.getPrototypeOf(obj)), obj)
}
