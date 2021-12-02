from kaggle_environments import make
import json

env = make("lux_ai_2021", configuration={"width": 24, "height": 24, "loglevel": 2, "annotations": True, "out": "replays/python-replay.json"}, debug=True)
steps = env.run(['agent.py', 'agent.py'])
replay = env.toJSON()
with open("replays/python.json", "w") as f:
  json.dump(replay, f)
#env.render(mode="ipython", width=1200, height=800)