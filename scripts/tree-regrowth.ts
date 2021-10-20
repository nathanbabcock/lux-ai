console.log('Tree Regrowth Analysis')


function simulate_wood_collection(collection_per_turn: number) {
  const max_wood = 500
  const wood_start = max_wood
  const wood_regrowth_rate = 1.025
  const turns = 360

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

for (let i = 0; i < 20; i++)
  simulate_wood_collection(i)

// ~12 wood per turn is sustainable