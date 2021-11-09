module.exports = {
  mode: 'development',
  entry: {
    'tree-search': './agents/tree-search.ts',
    'assignment-solver': './agents/assignment-solver.ts',
    'sim': './agents/sim.ts',
    'parse-kaggle-replay': './scripts/parse-kaggle-replay.ts',
  },
  target: 'node',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [{
          loader: 'ts-loader',
        }],
        exclude: [/node_modules/],
      },
      {
        test: /\.node$/,
        loader: "node-loader",
      },
    ]
  },
  output: {
    path: __dirname + '/dist/agents',
    filename: '[name].js'
  },
  resolve: {
    extensions: ['.ts', '.js', '.json']
  },
}
