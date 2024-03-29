module.exports = api => {
  const isTest = api.env('test');
  return isTest
    ? {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        '@babel/preset-typescript',
      ],
      plugins: [
        ['@babel/plugin-transform-typescript', { allowDeclareFields: true }],
        ['@babel/plugin-proposal-class-properties', { loose: true }],
      ]
    }
    : {
      presets: [
        ['@babel/preset-env', { modules: false, targets: { chrome: 100 }, loose: true }],
        '@babel/preset-typescript'
      ],
      plugins: [
        ['@babel/plugin-transform-typescript', { allowDeclareFields: true }],
        ['@babel/plugin-proposal-class-properties', { loose: true }],
      ]
    }
};