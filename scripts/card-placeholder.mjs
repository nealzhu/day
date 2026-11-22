import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const cardPlaceholderFile = 'media/site/card-placeholder.webp';
const digest = createHash('sha256').update(readFileSync(cardPlaceholderFile)).digest('hex').slice(0, 12);
export const cardPlaceholderKey = `site/card-placeholder-${digest}.webp`;
