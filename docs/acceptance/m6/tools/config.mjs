import { parseArgs } from 'node:util';

export const origins = {
  production: 'https://qians.day',
  local: 'http://localhost:4632',
};
export const profiles = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844, hasTouch: true, isMobile: true },
};
export const networks = {
  native: { latency: 0, downloadThroughput: -1, uploadThroughput: -1, cpu: 1 },
  shaped: { latency: 150, downloadThroughput: 600_000, uploadThroughput: 200_000, cpu: 4 },
};
export const rolePaths = {
  cards: '/',
  list: '/',
  category: '/categories/engineering/',
  pictured: '/posts/m2-smoke-test/',
  unpictured: '/posts/m2-smoke-no-image-test/',
  tech: '/posts/lab-tech/',
  life: '/posts/lab-life/',
  essay: '/posts/lab-essay/',
};
export const routes = {
  production: ['cards', 'list', 'category', 'pictured', 'unpictured'],
  local: Object.keys(rolePaths),
};

export function args(extra = {}) {
  return parseArgs({ options: {
    out: { type: 'string', default: 'docs/acceptance/m6/metrics' },
    samples: { type: 'string', default: '5' },
    filter: { type: 'string', default: '' },
    ...extra,
  } }).values;
}
