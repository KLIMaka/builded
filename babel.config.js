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
        ['@babel/preset-env', { modules: false, targets: { esmodules: true }, loose: true }],
        '@babel/preset-typescript',
        'solid',
      ],
      plugins: [
        ['@babel/plugin-transform-typescript', { allowDeclareFields: true }],
        ['@babel/plugin-proposal-class-properties', { loose: true }],
        ["@babel/plugin-syntax-jsx"],
      ]
    }
};