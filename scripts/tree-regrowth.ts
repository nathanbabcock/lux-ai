console.log('Tree Regrowth Analysis')
const max_wood = 500
const wood_regrowth_rate = 1.025
const turns = 360

function simulate_wood_collection_every_turn(collection_per_turn: number) {
  const wood_start = max_wood

  console.log('-----')
  console.log(`The tree starts with ${wood_start} wood`)
  console.log(`If you collect ${collection_per_turn} wood per turn...`)

  let cur_wood = wood_start
  let i
  for (i = 0; i <= turns; i++) {
    cur_wood -= collection_per_turn
    cur_wood = Math.max(cur_wood, 0)
    cur_wood *= wood_regrowth_rate
    cur_wood = Math.min(cur_wood, max_wood)
    if (cur_wood < 1) {
      console.log(`Wood ran out on turn ${i}`)
      break
    }
  }

  console.log(`There will be ${cur_wood} left on turn ${i}`)
}

function simulate_wood_collection_periodic(collection_per_turn: number, on_turns: number, off_turns: number) {
  const wood_start = max_wood

  console.log('-----')
  console.log(`The tree starts with ${wood_start} wood`)
  console.log(`You collect ${collection_per_turn} wood per turn for ${on_turns} turns, and then wait ${off_turns} turns before repeating...`)

  const cycle_length = on_turns + off_turns
  let cur_wood = wood_start
  let i
  for (i = 0; i <= turns; i++) {
    const cycle_turn = i % cycle_length
    let collection_this_turn
    if (cycle_turn < on_turns)
      collection_this_turn = collection_per_turn
    else
      collection_this_turn = 0
    cur_wood -= collection_this_turn
    cur_wood = Math.max(cur_wood, 0)
    cur_wood *= wood_regrowth_rate
    cur_wood = Math.min(cur_wood, max_wood)
    if (cur_wood < 1) {
      console.log(`Wood ran out on turn ${i}`)
      break
    }
  }

  console.log(`There will be ${cur_wood} left on turn ${i}`)
  return {
    turn: i,
    wood: cur_wood,
  }
}

// for (let i = 0; i < 20; i++)
//   simulate_wood_collection_every_turn(i)

// simulate_wood_collection_periodic(20, 20, 10)

// let min_ending_wood = max_wood
// for (let on_turns = 1; on_turns <= 40; on_turns++) {
//   for (let off_turns = 1; off_turns <= 40; off_turns++) {
//     const result = simulate_wood_collection_periodic(20, on_turns, off_turns)
//     if (result.turn < 330) continue
//     if (result.wood < min_ending_wood) {
//       min_ending_wood = result.wood
//       console.log(`New best: ${on_turns} on/${off_turns} off => ${Math.round(result.wood)} remaining on turn ${result.turn}`)
//     }
//   }
// }

simulate_wood_collection_periodic(20, 1, 1)

/**
 * Notes:
 * - 12 wood every turn is sustainable (13 isn't)
 * - 2 turns collecting 20 wood + 4 turns regrowing is 100% sustainable through turn 360
 *   - Same with 1 x 40, 4 x 0
 *   - Same with 4 x 20, 8 x 0
 *   - Same with 5 x 20, 10 x 0
 *   - Same with 10 x 20 (all night), 30 x 0 (all day)
 * - 24 on/32 off => 247 remaining on turn 361
 * - 25 on/32 off => 0 remaining on turn 342
 */