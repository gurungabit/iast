// esbuild configuration for Lambda bundling
import * as esbuild from 'esbuild';
import { rmSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, '../dist');

// Clean dist directory
if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true });
}
mkdirSync(distDir, { recursive: true });

// Build the Lambda
await esbuild.build({
    entryPoints: [resolve(__dirname, '../src/index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: resolve(distDir, 'index.mjs'),
    format: 'esm',
    external: ['@aws-sdk/*'], // AWS SDK v3 is included in Lambda runtime
    minify: true,
    sourcemap: false,
    treeShaking: true,
});

console.log('Build complete: dist/index.mjs');
