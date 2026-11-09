import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['scripts/three-entry.js'],
  bundle: true,
  format: 'esm',
  minify: true,
  target: 'es2022',
  outfile: 'site/vendor/three-gltf.js',
  legalComments: 'none',
  banner: {
    js: '/* three.js (MIT) + GLTFLoader, bundled for Missão Astra. */',
  },
});
