import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from glob import glob
import json

# Make NumPy printouts easier to read.
np.set_printoptions(precision=3, suppress=True)

folder = '..\lux-ai-top-episodes'
files = glob(f'{folder}\*-aug.json')
print(f'Reading {len(files)} files...')

# Get the data
temp = [] # an empty list to store the data frames
for file in files:
  # print(f'Reading {file}')
  with open(file) as f:
    data = json.load(f)
    df = pd.DataFrame(data)
    temp.append(df) # append the data frame to the list   

dataset = pd.concat(temp, ignore_index=True) # concatenate all the data frames in the list.

print('Initial dataset sample:')
print(dataset.tail())
print()

train_dataset = dataset.sample(frac=0.8, random_state=0)
test_dataset = dataset.drop(train_dataset.index)

def pairplot():
  sns.pairplot(train_dataset[['turn', 'woodLevel', 'coalLevel', 'uraniumLevel', 'resourceLevel', 'reward']], diag_kind='kde')
  plt.show()

# pairplot()

print('Training data stats')
print(train_dataset.describe().transpose())
print()

train_features = train_dataset.copy()
test_features = test_dataset.copy()
train_features.pop('resourceLevel') # redundant with individual resource type channels
test_features.pop('resourceLevel')
train_labels = train_features.pop('reward')
test_labels = test_features.pop('reward')

print('Mean and STD before normalization')
print(train_dataset.describe().transpose()[['mean', 'std']])
print()

normalizer = tf.keras.layers.Normalization(axis=-1)
normalizer.adapt(np.array(train_features))

turn = np.array(train_features['turn'])

turn_normalizer = layers.Normalization(input_shape=[1,], axis=None)
turn_normalizer.adapt(turn)

turn_model = tf.keras.Sequential([
  turn_normalizer,
  layers.Dense(units=1)
])

print('Turn model summary')
print(turn_model.summary())
print()

turn_model.compile(
  optimizer=tf.optimizers.Adam(learning_rate=0.1),
  loss='mean_absolute_error'
)

history = turn_model.fit(
  train_features['turn'],
  train_labels,
  epochs=10,
  # Suppress logging.
  verbose=1,
  # Calculate validation results on 20% of the training data.
  validation_split = 0.2
)

hist = pd.DataFrame(history.history)
hist['epoch'] = history.epoch
print('Training loss stats')
print(hist.tail())
print()

def plot_loss(history):
  plt.plot(history.history['loss'], label='loss')
  plt.plot(history.history['val_loss'], label='val_loss')
  plt.ylim([0, 10])
  plt.xlabel('Epoch')
  plt.ylabel('Error [reward]')
  plt.legend()
  plt.grid(True)
  plt.show()

plot_loss(history)

test_results = {}

test_results['turn_model'] = turn_model.evaluate(
  test_features['turn'], test_labels, verbose=0
)

x = tf.linspace(0.0, 36, 361)
y = turn_model.predict(x)

def plot_turns(x, y):
  plt.scatter(train_features['turn'], train_labels, label='Data')
  plt.plot(x, y, color='k', label='Predictions')
  plt.xlabel('turn')
  plt.ylabel('reward')
  plt.legend()
  plt.show()

plot_turns(x,y)
