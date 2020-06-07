module.exports = api => {
  const isTest = api.env('test');
  return isTest
    ? {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        '@babel/preset-typescript',
      ]
    }
    : {
      presets: [
        ['@babel/preset-env', { modules: false, targets: { chrome: 80 }, loose: true }],
        '@babel/preset-typescript'
      ],
      plugins: [
        ['@babel/plugin-transform-typescript', { allowDeclareFields: true }],
        ['@babel/plugin-proposal-class-properties', { loose: true }],
      ]
    }
};