console.log('City Refuel Analysis')
const night_length = 10

function refuel_city(side_length: number) {
  console.log('-----')
  console.log(`For an optimal (square) city with side length ${side_length}`)
  console.log(`The city has ${side_length * side_length} citytiles`)

  const corners = side_length > 1 ? 4 : 0
  const perimeter = Math.max((side_length - 2) * 4, 0)
  const inner_area = side_length * side_length - (perimeter + corners)

  const fuel_burn = (neighbors: number) => 23 - 5 * neighbors
  const total_fuel_burn = corners * fuel_burn(2) + perimeter * fuel_burn(3) + inner_area * fuel_burn(4)
  console.log(`Total fuel burn (per night turn) = ${total_fuel_burn}`)

  const nightly_cost = total_fuel_burn * night_length
  console.log(`Needs ${nightly_cost} to last all night`)

  const perTurn = nightly_cost / 40
  console.log(`Requires >= ${perTurn}, on average, per turn, day and night`)
}

for (let i = 1; i <= 10; i++)
  refuel_city(i)
