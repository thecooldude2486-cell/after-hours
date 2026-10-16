import { cp, mkdir, rm, writeFile, readFile, readdir, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, '_site');
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
// Only ship the browser runtime and its licensed assets.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const entry of ['index.html', 'style.css', 'src', 'vendor', 'assets']) {
  await cp(join(root, entry), join(output, entry), { recursive: true, dereference: false });
}
// Pages caches individual modules for ten minutes. Version the entire import
// graph so a new entry script cannot reuse an older hand rig or gameplay module.
async function versionModules(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await versionModules(path);
    else if (entry.name.endsWith('.js')) {
      const source = await readFile(path, 'utf8');
      const versioned = source.replace(
        /(\b(?:from|import)\s*(?:\(\s*)?)(["'])(\.{1,2}\/[^"'?#\s]+\.js)\2/g,
        (_, prefix, quote, module) => `${prefix}${quote}${module}?v=${encodeURIComponent(version)}${quote}`,
      );
      await writeFile(path, versioned);
    }
  }
}
for (const directory of ['src', 'vendor']) await versionModules(join(output, directory));
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
console.log(`Built _site v${version}: ${count} files, ${(bytes / 1024 / 1024).toFixed(1)} MiB. Versioned module URLs remain relative for GitHub project Pages.`);
