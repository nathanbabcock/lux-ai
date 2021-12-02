import numpy as np
import matplotlib.pyplot as plt
import random


balance = 0
betsize = 1
numbets = 1000
balances = []

for i in range(numbets):
  roll = random.random()
  if roll < 0.5:
    balance -= betsize
  else:
    balance += betsize
  balances.append(balance)

print("Max gain", max(balances))
print("Max loss", min(balances))
print("Average balance", sum(balances) / len(balances))
print("End balance", balances[-1])


fig, (ax1, ax2) = plt.subplots(1, 2)
x = range(len(balances))
ax1.scatter(x, balances)
ax1.set_title("Balance")

# Plot Histogram on x
ax2.hist(balances, bins=50)
ax2.set_title("Balance Distribution")
#ax2.gca().set(title='Frequency Histogram', ylabel='Frequency')

plt.show()