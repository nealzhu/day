import { cp } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from 'astro';
import { fontDirectory, fontPrefix } from './font-assets.mjs';

await build({ mode: 'preview', force: true });
await cp(fontDirectory, join('dist', fontPrefix), { recursive: true });
