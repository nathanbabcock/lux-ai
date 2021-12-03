from __future__ import print_function
import os
import neat
import visualize
import numpy as np
from lux.game import Game
from kaggle_environments import make
from functools import partial

# 2-input XOR inputs and expected outputs.
xor_inputs = [(0.0, 0.0), (0.0, 1.0), (1.0, 0.0), (1.0, 1.0)]
xor_outputs = [   (0.0,),     (1.0,),     (1.0,),     (0.0,)]


def make_input(obs, unit_id):
  width, height = obs.width, obs.height
  x_shift = (32 - width) // 2
  y_shift = (32 - height) // 2
  cities = {}
  
  b = np.zeros((20, 32, 32), dtype=np.float32)
  
  for update in obs['updates']:
    strs = update.split(' ')
    input_identifier = strs[0]
    
    if input_identifier == 'u':
      x = int(strs[4]) + x_shift
      y = int(strs[5]) + y_shift
      wood = int(strs[7])
      coal = int(strs[8])
      uranium = int(strs[9])
      if unit_id == strs[3]:
        # Position and Cargo
        b[:2, x, y] = (
          1,
          (wood + coal + uranium) / 100
        )
      else:
        # Units
        team = int(strs[2])
        cooldown = float(strs[6])
        idx = 2 + (team - obs['player']) % 2 * 3
        b[idx:idx + 3, x, y] = (
          1,
          cooldown / 6,
          (wood + coal + uranium) / 100
        )
    elif input_identifier == 'ct':
      # CityTiles
      team = int(strs[1])
      city_id = strs[2]
      x = int(strs[3]) + x_shift
      y = int(strs[4]) + y_shift
      idx = 8 + (team - obs['player']) % 2 * 2
      b[idx:idx + 2, x, y] = (
        1,
        cities[city_id]
      )
    elif input_identifier == 'r':
      # Resources
      r_type = strs[1]
      x = int(strs[2]) + x_shift
      y = int(strs[3]) + y_shift
      amt = int(float(strs[4]))
      b[{'wood': 12, 'coal': 13, 'uranium': 14}[r_type], x, y] = amt / 800
    elif input_identifier == 'rp':
      # Research Points
      team = int(strs[1])
      rp = int(strs[2])
      b[15 + (team - obs['player']) % 2, :] = min(rp, 200) / 200
    elif input_identifier == 'c':
      # Cities
      city_id = strs[2]
      fuel = float(strs[3])
      lightupkeep = float(strs[4])
      cities[city_id] = min(fuel / lightupkeep, 10) / 10
  
  # Day/Night Cycle
  b[17, :] = obs['step'] % 40 / 40
  # Turns
  b[18, :] = obs['step'] / 360
  # Map Size
  b[19, x_shift:32 - x_shift, y_shift:32 - y_shift] = 1

  return b

game_state = None
def get_game_state(observation):
  global game_state
  
  if observation["step"] == 0:
    game_state = Game()
    game_state._initialize(observation["updates"])
    game_state._update(observation["updates"][2:])
    game_state.id = observation.player
  else:
    game_state._update(observation["updates"])
  return game_state

def in_city(pos):  
  try:
    city = game_state.map.get_cell_by_pos(pos).citytile
    return city is not None and city.team == game_state.id
  except:
    return False

def call_func(obj, method, args=[]):
  return getattr(obj, method)(*args)


unit_actions = [('move', 'n'), ('move', 's'), ('move', 'w'), ('move', 'e'), ('build_city',)]
def get_action(policy, unit, dest):
  for label in np.argsort(policy)[::-1]:
    act = unit_actions[label]
    pos = unit.pos.translate(act[-1], 1) or unit.pos
    if pos not in dest or in_city(pos):
      return call_func(unit, *act), pos 
      
  return unit.move('c'), unit.pos

def neatAgent(nn: neat.nn, observation, configuration):
  global game_state
  
  game_state = get_game_state(observation)  
  player = game_state.players[observation.player]
  actions = []
  
  # City Actions
  unit_count = len(player.units)
  for city in player.cities.values():
    for city_tile in city.citytiles:
      if city_tile.can_act():
        if unit_count < player.city_tile_count: 
          actions.append(city_tile.build_worker())
          unit_count += 1
        elif not player.researched_uranium():
          actions.append(city_tile.research())
          player.research_points += 1
  
  # Worker Actions
  dest = []
  for unit in player.units:
    if unit.can_act() and (game_state.turn % 40 < 30 or not in_city(unit.pos)) and hasattr(observation, 'width'):
      state = make_input(observation, unit.id)
      p = nn.activate(state)

      action, pos = get_action(p, unit, dest)
      actions.append(action)
      dest.append(pos)

  return actions

def luxMatch(agent0, agent1):
  env = make("lux_ai_2021", configuration={"loglevel": 2, "annotations": True}, debug=True)
  
  while not env.done:
    agent0_actions = agent0(env.state[-1].observation)
    agent1_actions = agent1(env.state[-1].observation)
    actions = agent0_actions + agent1_actions
    env.step(actions)

  return env.rewards

def eval_genomes(genomes, config):
  for genome_id, genome in genomes:
    genome.fitness = 0

  for genome0_id, genome0 in genomes:
    for genome1_id, genome1 in genomes:
      net0 = neat.nn.FeedForwardNetwork.create(genome0, config)
      net1 = neat.nn.FeedForwardNetwork.create(genome1, config)
      agent0 = partial(neatAgent, net0)
      agent1 = partial(neatAgent, net1)
      
      print(f"Evaluating {genome0_id} vs {genome1_id}")
      rewards = luxMatch(agent0, agent1)
      print(f"{genome0_id} reward = {rewards[0]}")
      print(f"{genome1_id} reward = {rewards[1]}")
      if rewards[0] > rewards[1]:
        genome0.fitness += 1
      else:
        genome1.fitness += 1

def eval_genomes_xor(genomes, config):
  for genome_id, genome in genomes:
    genome.fitness = 4.0
    net = neat.nn.FeedForwardNetwork.create(genome, config)
    for xi, xo in zip(xor_inputs, xor_outputs):
      output = net.activate(xi)
      genome.fitness -= (output[0] - xo[0]) ** 2


def run(config_file):
  # Load configuration.
  config = neat.Config(neat.DefaultGenome, neat.DefaultReproduction,
            neat.DefaultSpeciesSet, neat.DefaultStagnation,
            config_file)

  # Create the population, which is the top-level object for a NEAT run.
  p = neat.Population(config)

  # Add a stdout reporter to show progress in the terminal.
  p.add_reporter(neat.StdOutReporter(True))
  stats = neat.StatisticsReporter()
  p.add_reporter(stats)
  # p.add_reporter(neat.Checkpointer(5))

  # Run for up to 300 generations.
  winner = p.run(eval_genomes, 1)

  # Display the winning genome.
  print('\nBest genome:\n{!s}'.format(winner))

  # Show output of the most fit genome against training data.
  print('\nOutput:')
  winner_net = neat.nn.FeedForwardNetwork.create(winner, config)
  
  print(f'\nBest genome:\n{winner.fitness}')

  visualize.draw_net(config, winner, True)
  visualize.plot_stats(stats, ylog=False, view=True)
  visualize.plot_species(stats, view=True)

  #p = neat.Checkpointer.restore_checkpoint('neat-checkpoint-4')
  #p.run(eval_genomes, 10)

if __name__ == '__main__':
  # Determine path to configuration file. This path manipulation is
  # here so that the script will run successfully regardless of the
  # current working directory.
  local_dir = os.path.dirname(__file__)
  config_path = os.path.join(local_dir, 'neat-lux.cfg')
  run(config_path)