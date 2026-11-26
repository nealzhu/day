interface Quote {
  index: number;
  offset: number;
  text: string;
  before: string;
  after: string;
}

const contextLength = 24;
const maxQuote = 96;
const beforeText = (text: string, offset: number) => Array.from(text.slice(Math.max(0, offset - contextLength * 2), offset)).slice(-contextLength).join('');
const afterText = (text: string, end: number) => Array.from(text.slice(end, end + contextLength * 2)).slice(0, contextLength).join('');
const normalize = (text: string) => text.replace(/\s+/gu, ' ').trim();
const paragraphs = (prose: HTMLElement) => [...prose.querySelectorAll<HTMLElement>('p')].filter(p => !p.closest('pre, [data-pagefind-ignore]'));
const validText = (text: string) => text.length <= maxQuote * 2 && Array.from(text).length <= maxQuote && /[\p{L}\p{N}]/u.test(text) && Array.from(text).length >= 4;

export function selectedQuote(prose: HTMLElement, selection: Selection | null): Quote | undefined {
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return;
  const range = selection.getRangeAt(0);
  const element = (node: Node) => node instanceof Element ? node : node.parentElement;
  const block = element(range.startContainer)?.closest('p');
  if (!block || block !== element(range.endContainer)?.closest('p') || !prose.contains(block)) return;
  const raw = range.toString();
  const text = normalize(raw);
  if (!validText(text)) return;
  const index = paragraphs(prose).indexOf(block);
  if (index < 0) return;

  const prefix = document.createRange();
  prefix.selectNodeContents(block);
  prefix.setEnd(range.startContainer, range.startOffset);
  const leading = prefix.toString() + raw.match(/^\s*/u)![0];
  const offset = leading.replace(/\s+/gu, ' ').trimStart().length;
  const paragraph = normalize(block.textContent);
  if (!paragraph.startsWith(text, offset)) return;
  return { index, offset, text, before: beforeText(paragraph, offset), after: afterText(paragraph, offset + text.length) };
}

export function writeQuote({ index, offset, text, before, after }: Quote): string {
  const url = new URL(location.pathname, location.origin);
  url.hash = new URLSearchParams({ quote: '1', p: String(index), o: String(offset), q: text, b: before, a: after }).toString();
  return url.href;
}

export function readQuote(hash: string): Quote | undefined {
  if (!hash.startsWith('#quote=1&') || hash.length > 2400) return;
  const params = new URLSearchParams(hash.slice(1));
  const p = params.get('p') ?? '';
  const o = params.get('o') ?? '';
  const text = params.get('q') ?? '';
  const before = params.get('b');
  const after = params.get('a');
  if (!/^\d{1,8}$/.test(p) || !/^\d{1,8}$/.test(o) || !validText(text) || normalize(text) !== text ||
      before === null || after === null || Array.from(before).length > contextLength || Array.from(after).length > contextLength) return;
  return { index: Number(p), offset: Number(o), text, before, after };
}

export function findQuote(prose: HTMLElement, quote: Quote): HTMLElement | undefined {
  const blocks = paragraphs(prose);
  const strong = new Set<HTMLElement>();
  const partial = new Set<HTMLElement>();
  function record(block: HTMLElement, text: string, offset: number) {
    const before = beforeText(text, offset) === quote.before;
    const after = afterText(text, offset + quote.text.length) === quote.after;
    if (before && after) strong.add(block);
    else if ((before && quote.before.length >= 8) || (after && quote.after.length >= 8)) partial.add(block);
  }

  for (const [index, block] of blocks.entries()) {
    const text = normalize(block.textContent);
    const hint = index === quote.index && text.startsWith(quote.text, quote.offset) ? quote.offset : -1;
    if (hint >= 0) record(block, text, hint);
    // Check every paragraph, including competing matches after edits.
    for (let offset = text.indexOf(quote.text); offset !== -1; offset = text.indexOf(quote.text, offset + 1)) {
      if (offset !== hint) record(block, text, offset);
    }
  }
  if (strong.size > 0) return strong.size === 1 ? [...strong][0] : undefined;
  return partial.size === 1 ? [...partial][0] : undefined;
}
