import { Game, GameMap, Resource, Unit } from '@lux-ai/2021-challenge'

/** @source Lux-Design-2021/src/logic.ts:570 */
export default function cloneGame(game: Game): Game {
  const serializedState = game.toStateObject()
  game = new Game()
  
  // update map first
  const height = serializedState.map.length;
  const width = serializedState.map[0].length;

  const configs = {
    ...game.configs,
  };
  configs.width = width;
  configs.height = height;
  game.map = new GameMap(configs);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cellinfo = serializedState.map[y][x];
      if (cellinfo.resource) {
        game.map.addResource(
          x,
          y,
          cellinfo.resource.type as Resource.Types,
          cellinfo.resource.amount
        );
      }
      const cell = game.map.getCell(x, y);
      cell.road = cellinfo.road;
    }
  }

  // spawn in cities
  game.cities = new Map();
  for (const cityid of Object.keys(serializedState.cities)) {
    const cityinfo = serializedState.cities[cityid];
    cityinfo.cityCells.forEach((ct) => {
      const tile = game.spawnCityTile(cityinfo.team, ct.x, ct.y, cityinfo.id);
      tile.cooldown = ct.cooldown;
    });
    const city = game.cities.get(cityinfo.id);
    city.fuel = cityinfo.fuel;
  }

  const teams = [Unit.TEAM.A, Unit.TEAM.B];
  for (const team of teams) {
    game.state.teamStates[team].researchPoints =
      serializedState.teamStates[team].researchPoints;
    game.state.teamStates[team].researched = deepCopy(
      serializedState.teamStates[team].researched
    );
    game.state.teamStates[team].units.clear();
    for (const unitid of Object.keys(
      serializedState.teamStates[team].units
    )) {
      const unitinfo = serializedState.teamStates[team].units[unitid];
      let unit: Unit;
      if (unitinfo.type === Unit.Type.WORKER) {
        unit = game.spawnWorker(team, unitinfo.x, unitinfo.y, unitid);
      } else {
        unit = game.spawnCart(team, unitinfo.x, unitinfo.y, unitid);
      }
      unit.cargo = deepCopy(unitinfo.cargo);
      unit.cooldown = deepCopy(unitinfo.cooldown);
    }
  }

  // update globals
  game.state.turn = serializedState.turn;
  game.globalCityIDCount = serializedState.globalCityIDCount;
  game.globalUnitIDCount = serializedState.globalUnitIDCount;
  // game.stats = deepCopy(serializedState.stats);

  // without this, causes some bugs
  game.map.sortResourcesDeterministically();

  return game;
}


/** @source Lux-Design-2021/src/utils/index.ts */
function deepCopy<T>(obj: T): T {
  let copy;
  // Handle the 3 simple types, and null or undefined
  if (null == obj || 'object' != typeof obj) return obj;

  // Handle Date
  if (obj instanceof Date) {
    copy = new Date();
    copy.setTime(obj.getTime());
    return copy;
  }

  // Handle Array
  if (obj instanceof Array) {
    copy = [];
    for (let i = 0, len = obj.length; i < len; i++) {
      copy[i] = deepCopy(obj[i]);
    }
    return copy;
  }

  // Handle Object
  if (obj instanceof Object) {
    copy = {};
    for (const attr in obj) {
      //eslint-disable-next-line no-prototype-builtins
      if (obj.hasOwnProperty(attr)) copy[attr] = deepCopy(obj[attr]);
    }
    return copy;
  }

  throw new Error("Unable to copy obj! Its type isn't supported.");
}
