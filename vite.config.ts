import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

/** Injects the list of built files into dist/sw.js so the app shell works offline
 *  under any repository sub-path (all URLs are resolved relative to the SW scope). */
function precache(): Plugin {
  let outDir = 'dist';
  return {
    name: 'sw-precache',
    apply: 'build',
    configResolved(c) { outDir = c.build.outDir; },
    closeBundle() {
      const files: string[] = [];
      const walk = (d: string) => {
        for (const f of readdirSync(d)) {
          const p = join(d, f);
          if (statSync(p).isDirectory()) walk(p);
          else if (f !== 'sw.js') files.push('./' + relative(outDir, p).split('\\').join('/'));
        }
      };
      walk(outDir);
      files.push('./');
      const version = createHash('sha1').update(files.sort().join('|')).digest('hex').slice(0, 10);
      const swPath = join(outDir, 'sw.js');
      let sw = readFileSync(swPath, 'utf8');
      sw = sw.replace('__PRECACHE__', JSON.stringify(files)).replace('__VERSION__', version);
      writeFileSync(swPath, sw);
    },
  };
}

// Relative base ('./') works for any GitHub Pages sub-path. CI overrides it with /<repo>/.
export default defineConfig({
  base: process.env.VITE_BASE || './',
  plugins: [react(), precache()],
  build: { target: 'es2020', sourcemap: false },
});
