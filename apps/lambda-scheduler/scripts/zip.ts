// Cross-platform zip script using archiver
import { createWriteStream, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, '../dist');
const outputPath = resolve(__dirname, '../lambda-scheduler.zip');

// Ensure dist exists
if (!existsSync(distDir)) {
    console.error('Error: dist directory does not exist. Run build first.');
    process.exit(1);
}

const output = createWriteStream(outputPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
    console.log(`Created ${outputPath} (${String(archive.pointer())} bytes)`);
});

archive.on('error', (err: Error) => {
    throw err;
});

archive.pipe(output);
archive.directory(distDir, false);
void archive.finalize();
