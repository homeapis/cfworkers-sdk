module.exports = {
    name: '@homeapis/internal-cfworkers-sdk',
    out: './docs/',
    exclude: [
    //   './src/session/cache.ts',
    //   './src/client/use-config.tsx',
    //   './src/utils/!(errors.ts)'
    ],
    entryPointStrategy: 'expand',
    excludeExternals: true,
    excludePrivate: true,
    hideGenerator: true,
    readme: 'none'
  };