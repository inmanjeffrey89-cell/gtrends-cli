// Runs this repo's CLI as a child process; `preload` names a fetch stub in ./stubs/.
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const BIN = fileURLToPath(new URL('../trends.mjs', import.meta.url));
export const stubUrl = (name) => pathToFileURL(fileURLToPath(new URL(`./stubs/${name}.mjs`, import.meta.url))).href;

export function cli(args, { preload } = {}) {
  const pre = preload ? ['--import', stubUrl(preload)] : [];
  return spawnSync(process.execPath, [...pre, BIN, ...args], { encoding: 'utf8', timeout: 120_000 });
}
