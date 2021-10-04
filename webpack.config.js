module.exports = {
  mode: 'development',
  entry: {
    'tree-search': './agents/tree-search.ts',
    'sim': './agents/sim.ts',
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
