import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['api/sync-lawn.source.js'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'api/sync-lawn.js',
  logLevel: 'info',
});

console.log('Bundled api/sync-lawn.js for Vercel');
