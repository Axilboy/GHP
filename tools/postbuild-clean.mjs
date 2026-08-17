// Post-build: выкидываем из dist то, что не должно попадать в прод.
// public/demo — 43 МБ dev-скриншотов документации; Vite копирует их в dist,
// они раздували деплой-архив и кэш Safari. В dev /demo работает (vite отдаёт из public/).
import { rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const demo = join(root, 'dist', 'demo');

if (existsSync(demo)) {
  rmSync(demo, { recursive: true, force: true });
  console.log('postbuild: removed dist/demo (dev-only documentation screenshots)');
} else {
  console.log('postbuild: dist/demo not present, nothing to strip');
}
