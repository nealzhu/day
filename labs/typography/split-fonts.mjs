// Usage: node split-fonts.mjs <pinned inputs directory> <new output directory>
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [inputs, destination] = process.argv.slice(2).map(arg => resolve(arg));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const runtime = join(inputs, 'node_modules/cn-font-split');
const pkg = JSON.parse(await readFile(join(runtime, 'package.json'), 'utf8'));
if (pkg.version !== '7.4.3') throw Error('Expected cn-font-split 7.4.3');
const { fontSplit, StaticWasm } = await import(pathToFileURL(join(runtime, 'dist/wasm/index.mjs')));
const font = await readFile(join(inputs, 'upstream.ttf'));
const wasm = await readFile(join(runtime, 'dist/libffi-wasm32-wasip1.wasm'));
if (hash(font) !== '2d73eea94ad808999d90c0000c239a84a33b09d4bc6ab6c5b8bbf1eda8a7fc8b' ||
    hash(wasm) !== '05a88dcb9a0b0d1e14daf0f429d9af6e2ac8d94d9e574523a76d3e9f440dccc9') {
  throw Error('Input differs from LXGW WenKai Regular v1.530 or split core 7.6.8');
}
const license = await readFile(new URL('./fonts/v1.530/OFL.txt', import.meta.url));
const files = await fontSplit({
  input: font, outDir: './out', testHtml: false, reporter: false,
  renameOutputFont: '[hash:12].[ext]',
  css: { fontFamily: 'Day Reading', fontWeight: '400', fontDisplay: 'swap', compress: true, fileName: 'faces.css' },
}, new StaticWasm(wasm).WasiHandle);
let css = new TextDecoder().decode(files.find(f => f.name === 'faces.css').data);
css = css.replace(/\/\*[\s\S]*?\*\//g, '').replaceAll('local("Day Reading"),', '');
const subsets = files.filter(f => f.name.endsWith('.woff2'));
// Drop the splitter's NUL sentinel. The original cmap has no U+0000 glyph.
css = css.replace('unicode-range:U+0,', 'unicode-range:');
await mkdir(destination);
for (const { name, data } of subsets) {
  const key = hash(data).slice(0, 20) + '.woff2';
  if (css.split(name).length !== 2) throw Error('Missing or duplicated face: ' + name);
  css = css.replace(name, key);
  await writeFile(join(destination, key), data);
}
if (css.includes('local(') || css.match(/unicode-range:/g)?.length !== subsets.length) throw Error('Invalid font faces');
await writeFile(join(destination, 'faces.css'), css.trim().replaceAll('}@font-face', '}\n@font-face') + '\n');
await writeFile(join(destination, 'OFL.txt'), license);
console.log(subsets.length + ' WOFF2 subsets');
