import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
# Make NumPy printouts easier to read.
np.set_printoptions(precision=3, suppress=True)

print('Here we go')
print(f'Tensorflow version {tf.__version__}')
print()

# Get the data
url = 'http://archive.ics.uci.edu/ml/machine-learning-databases/auto-mpg/auto-mpg.data'
column_names = ['MPG', 'Cylinders', 'Displacement', 'Horsepower', 'Weight',
  'Acceleration', 'Model Year', 'Origin']

raw_dataset = pd.read_csv(
  url, names=column_names, na_values='?', comment='\t', sep=' ', skipinitialspace=True
)

dataset = raw_dataset.copy()

print('Dataset tail preview')
print(dataset.tail())
print()


print('Dataset N/A values before dropping')
print(dataset.isna().sum())
print()

dataset = dataset.dropna()
dataset['Origin'] = dataset['Origin'].map({1: 'USA', 2: 'Europe', 3: 'Japan'})

dataset = pd.get_dummies(dataset, columns=['Origin'], prefix='', prefix_sep='')
print('One-hot categorical encoding')
print(dataset.tail())
print()

train_dataset = dataset.sample(frac=0.8, random_state=0)
test_dataset = dataset.drop(train_dataset.index)

sns.pairplot(train_dataset[['MPG', 'Cylinders', 'Displacement', 'Weight']], diag_kind='kde')
plt.show()

print('Training data stats')
print(train_dataset.describe().transpose())
print()

train_features = train_dataset.copy()
test_features = test_dataset.copy()

train_labels = train_features.pop('MPG')
test_labels = test_features.pop('MPG')

print('Mean and STD before normalization')
print(train_dataset.describe().transpose()[['mean', 'std']])
print()

normalizer = tf.keras.layers.Normalization(axis=-1)
normalizer.adapt(np.array(train_features))

horsepower = np.array(train_features['Horsepower'])

horsepower_normalizer = layers.Normalization(input_shape=[1,], axis=None)
horsepower_normalizer.adapt(horsepower)

horsepower_model = tf.keras.Sequential([
    horsepower_normalizer,
    layers.Dense(units=1)
])

print('Horsepower model summary')
print(horsepower_model.summary())
print()

horsepower_model.compile(
  optimizer=tf.optimizers.Adam(learning_rate=0.1),
  loss='mean_absolute_error'
)

history = horsepower_model.fit(
  train_features['Horsepower'],
  train_labels,
  epochs=100,
  # Suppress logging.
  verbose=0,
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
  plt.ylabel('Error [MPG]')
  plt.legend()
  plt.grid(True)
  plt.show()

plot_loss(history)

test_results = {}

test_results['horsepower_model'] = horsepower_model.evaluate(
  test_features['Horsepower'], test_labels, verbose=0
)

x = tf.linspace(0.0, 250, 251)
y = horsepower_model.predict(x)

def plot_horsepower(x, y):
  plt.scatter(train_features['Horsepower'], train_labels, label='Data')
  plt.plot(x, y, color='k', label='Predictions')
  plt.xlabel('Horsepower')
  plt.ylabel('MPG')
  plt.legend()
  plt.show()

plot_horsepower(x,y)
