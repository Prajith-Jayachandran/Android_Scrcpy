'use strict';

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const bytenode = require('bytenode');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const bundleJsPath = path.join(distDir, 'server.js');
const bytecodePath = path.join(distDir, 'server.jsc');
const loaderPath = path.join(distDir, 'index.js');

async function build() {
  console.log('⚡ [Aether Shield]: Compiling and obfuscating backend to V8 bytecode...');

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // 1. Bundle server/index.ts with esbuild (stripping types, minifying AST)
  await esbuild.build({
    entryPoints: [path.join(rootDir, 'server', 'index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: bundleJsPath,
    minify: true,
    sourcemap: false,
    legalComments: 'none',
    external: ['next', 'ws', 'bytenode'],
  });

  console.log('✔ [1/3] Backend JavaScript bundled & minified.');

  // 2. Compile to native V8 bytecode via bytenode
  bytenode.compileFile(bundleJsPath, bytecodePath);
  console.log('✔ [2/3] Native V8 bytecode generated: dist/server.jsc');

  // 3. Create zero-source loader
  fs.writeFileSync(
    loaderPath,
    "'use strict';\nrequire('bytenode');\nrequire('./server.jsc');\n",
    'utf-8'
  );

  // 4. Delete the intermediate plaintext server.js file
  if (fs.existsSync(bundleJsPath)) {
    fs.unlinkSync(bundleJsPath);
  }

  console.log('✔ [3/3] Plaintext JS purged. Only bytecode remains.');
  console.log('🔒 Backend protected with Layer 1 (Bytecode Compilation).');
}

build().catch((err) => {
  console.error('[Error] Server build failed:', err);
  process.exit(1);
});
