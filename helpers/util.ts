import { ClassConstructor, classToPlain, plainToClass } from 'class-transformer'

export function chooseRandom<T>(array: Array<T>): T {
  return array[Math.floor(Math.random() * array.length)]
}

/** Shallow clone */
export function clone<T>(obj: T): T { 
  return Object.assign(Object.create(Object.getPrototypeOf(obj)), obj)
}

export function deepClone<T>(cls: ClassConstructor<T>, obj: T): T {
  return plainToClass(cls, classToPlain(obj))
}