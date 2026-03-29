// Generates icon16/32/48/128.png from icon.svg using @resvg/resvg-js (pure Wasm, no native build).
// Run: bun gen-icons.mjs

import { readFileSync, writeFileSync } from 'fs';
import { Resvg } from '@resvg/resvg-js';

const svg = readFileSync(new URL('./icon.svg', import.meta.url), 'utf8');

for (const size of [16, 32, 48, 128]) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  writeFileSync(new URL(`./icon${size}.png`, import.meta.url), pngBuffer);
  console.log(`icon${size}.png  ✓`);
}
