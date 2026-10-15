import { cp, mkdir, rm, writeFile, readdir, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, '_site');
// Only ship the browser runtime and its licensed assets.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const entry of ['index.html', 'style.css', 'src', 'vendor', 'assets']) {
  await cp(join(root, entry), join(output, entry), { recursive: true, dereference: false });
}
await writeFile(join(output, '.nojekyll'), '');
let count = 0, bytes = 0;
async function check(directory) {
  for (const name of await readdir(directory)) {
    const path = join(directory, name), stat = await lstat(path);
    if (stat.isSymbolicLink()) throw new Error('Pages artifact cannot contain symlinks: ' + path);
    if (stat.isDirectory()) await check(path);
    else { count++; bytes += stat.size; }
  }
}
await check(output);
console.log(`Built _site: ${count} files, ${(bytes / 1024 / 1024).toFixed(1)} MiB. All URLs remain relative for GitHub project Pages.`);
