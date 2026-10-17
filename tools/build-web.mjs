// Copy the plain-JavaScript game into Capacitor's web directory.
// sw.js is generated separately by tools/make_sw.py for the browser release.
import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
if (dirname(dist) !== resolve(root)) throw new Error('Invalid dist path');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const dir of ['src', 'vendor', 'assets']) await cp(join(root, dir), join(dist, dir), { recursive: true, force: true });
for (const file of ['index.html', 'icon.svg', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest', 'sw.js']) {
  await cp(join(root, file), join(dist, file), { force: true });
}
console.log('Copied game files to dist for Android.');
