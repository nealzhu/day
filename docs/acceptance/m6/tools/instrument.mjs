// Registered before a document's first script in the isolated Chrome context.
export function installObservers() {
  if (window !== window.top) return;
  performance.setResourceTimingBufferSize(500);
  const observations = window.__m6 = { paints: [], lcp: [], shifts: [], tasks: [], events: [], fonts: [], inputs: [] };
  const name = (el) => el ? [el.localName, el.id, typeof el.className === 'string' ? el.className : ''] : null;
  const record = (type, key, map, extra = {}) => {
    if (!PerformanceObserver.supportedEntryTypes.includes(type)) return;
    new PerformanceObserver(list => observations[key].push(...list.getEntries().map(map)))
      .observe({ type, buffered: true, ...extra });
  };
  record('paint', 'paints', e => ({ name: e.name, ms: e.startTime }));
  record('largest-contentful-paint', 'lcp', e => ({
    ms: e.startTime, render: e.renderTime, load: e.loadTime, size: e.size, url: e.url,
    node: name(e.element), text: e.element?.textContent?.trim().slice(0, 100),
  }));
  record('layout-shift', 'shifts', e => ({
    ms: e.startTime, value: e.value, input: e.hadRecentInput,
    sources: e.sources.map(s => ({ node: name(s.node), before: s.previousRect.toJSON(), after: s.currentRect.toJSON() })),
  }));
  record('longtask', 'tasks', e => ({ ms: e.startTime, duration: e.duration, name: e.name }));
  record('event', 'events', e => ({
    name: e.name, ms: e.startTime, duration: e.duration, id: e.interactionId,
    processingStart: e.processingStart, processingEnd: e.processingEnd, target: name(e.target),
  }), { durationThreshold: 16 });
  for (const type of ['loading', 'loadingdone', 'loadingerror']) {
    document.fonts.addEventListener(type, e => observations.fonts.push({
      type, ms: performance.now(), faces: e.fontfaces.map(f => ({ family: f.family, status: f.status, ranges: f.unicodeRange })),
    }));
  }
  for (const type of ['pointerdown', 'keydown', 'input', 'click', 'scroll']) {
    window.addEventListener(type, e => {
      if (e.isTrusted && observations.inputs.length < 100) observations.inputs.push({ type, ms: e.timeStamp, target: name(e.target) });
    }, { capture: true, passive: true });
  }
}

export function snapshotTiming() {
  const nav = performance.getEntriesByType('navigation')[0]?.toJSON();
  const fonts = performance.getEntriesByType('resource')
    .filter(e => /faces\.css|\.woff2$/.test(new URL(e.name).pathname))
    .map(e => ({
      url: e.name, start: e.startTime, end: e.responseEnd, ttfb: e.responseStart,
      transfer: e.transferSize, encoded: e.encodedBodySize, protocol: e.nextHopProtocol,
      renderBlocking: e.renderBlockingStatus, delivery: e.deliveryType,
    }));
  return { nav, fontResources: fonts, timeOrigin: performance.timeOrigin, observedEnd: performance.now(), ...window.__m6 };
}

function sanitized(url) {
  if (!url || url.startsWith('data:')) return url ? 'data:' : url;
  try {
    const value = new URL(url);
    for (const key of value.searchParams.keys()) {
      if (/token|session|key|state/i.test(key)) value.searchParams.set(key, '[redacted]');
    }
    return value.href;
  } catch { return url; }
}

export const headerNames = [
  'age', 'access-control-allow-origin', 'cache-control', 'cf-cache-status', 'cf-ray',
  'content-encoding', 'content-length', 'content-type', 'etag', 'last-modified', 'timing-allow-origin', 'vary',
];

export function pickedHeaders(headers) {
  return Object.fromEntries(Object.entries(headers ?? {})
    .map(([name, value]) => [name.toLowerCase(), value])
    .filter(([name]) => headerNames.includes(name)));
}

export async function collectNetwork(page, cdp, context) {
  const rows = [];
  const active = new Map();
  const forRequest = new Map();
  const subframe = [];
  const topFallback = [];
  let phase = 'setup';
  cdp.on('Network.requestWillBeSent', e => {
    const prev = active.get(e.requestId);
    if (prev && e.redirectResponse) {
      prev.status = e.redirectResponse.status;
      prev.encoded = e.redirectResponse.encodedDataLength;
    }
    const row = { phase, url: sanitized(e.request.url), method: e.request.method, type: e.type,
      start: e.timestamp, priority: e.request.initialPriority, initiator: e.initiator.type,
      parent: sanitized(e.initiator.url ?? e.initiator.stack?.callFrames[0]?.url),
    };
    active.set(e.requestId, row);
    rows.push(row);
  });
  cdp.on('Network.resourceChangedPriority', e => {
    const row = active.get(e.requestId);
    if (row) (row.priorityChanges ??= []).push([e.timestamp, e.newPriority]);
  });
  cdp.on('Network.requestServedFromCache', e => {
    const row = active.get(e.requestId);
    if (row) row.cacheEvent = true;
  });
  cdp.on('Network.responseReceived', e => {
    const row = active.get(e.requestId);
    if (!row) return;
    const { status, protocol, fromDiskCache, fromServiceWorker, connectionReused, timing, headers } = e.response;
    Object.assign(row, { status, type: e.type, protocol, fromDiskCache, fromServiceWorker, connectionReused,
      timing, headers: pickedHeaders(headers), response: e.timestamp });
  });
  cdp.on('Network.responseReceivedExtraInfo', e => {
    const row = active.get(e.requestId);
    if (row) {
      row.wireStatus = e.statusCode;
      row.wireHeaders = pickedHeaders(e.headers);
    }
  });
  cdp.on('Network.loadingFinished', e => {
    const row = active.get(e.requestId);
    if (row) Object.assign(row, { encoded: e.encodedDataLength, end: e.timestamp });
  });
  cdp.on('Network.loadingFailed', e => {
    const row = active.get(e.requestId);
    if (row) Object.assign(row, { error: e.errorText, canceled: e.canceled, cors: e.corsErrorStatus, end: e.timestamp });
  });

  // The main CDP target may omit dedicated worker and OOPIF requests.
  context?.on('request', request => {
    let frame;
    try { frame = request.frame(); } catch { return; }
    const row = { phase, url: sanitized(request.url()), method: request.method(), type: request.resourceType() };
    (frame === page.mainFrame() ? topFallback : subframe).push(row);
    forRequest.set(request, row);
  });
  context?.on('response', response => {
    const row = forRequest.get(response.request());
    if (row) Object.assign(row, { status: response.status(), headers: pickedHeaders(response.headers()) });
  });
  const pending = new Set();
  context?.on('requestfinished', request => {
    const row = forRequest.get(request);
    if (!row) return;
    const sizes = request.sizes().then(value => Object.assign(row, value, { timing: request.timing() })).catch(() => {});
    pending.add(sizes);
    sizes.finally(() => pending.delete(sizes));
  });
  context?.on('requestfailed', request => {
    const row = forRequest.get(request);
    if (row) row.error = request.failure()?.errorText;
  });
  await cdp.send('Network.enable');
  const key = r => [r.phase, r.method, r.url].join(' ');
  const auxiliary = () => {
    const matches = new Map();
    for (const row of rows) {
      const id = key(row);
      if (!matches.has(id)) matches.set(id, []);
      matches.get(id).push(row);
    }
    return topFallback.filter(row => {
      const match = matches.get(key(row))?.shift();
      if (!match) return true;
      if (match.encoded === undefined && row.responseBodySize !== undefined) {
        match.fallbackBodyBytes = row.responseBodySize;
        match.status ??= row.status;
      }
      return false;
    });
  };
  return { rows, subframe, auxiliary, phase: name => { phase = name; },
    flush: () => Promise.all([...pending]) };
}

export async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

export async function renderedFonts(cdp) {
  const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
  const out = {};
  for (const selector of ['header a[href="/"]', 'h1', '.prose p', 'article pre code']) {
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    if (nodeId) out[selector] = (await cdp.send('CSS.getPlatformFontsForNode', { nodeId })).fonts;
  }
  return out;
}

export function cls(shifts) {
  let previous = -Infinity, first = -Infinity, value = 0, max = 0;
  for (const shift of shifts.filter(s => !s.input)) {
    if (shift.ms - previous >= 1000 || shift.ms - first >= 5000) {
      first = shift.ms;
      value = 0;
    }
    previous = shift.ms;
    value += shift.value;
    max = Math.max(max, value);
  }
  return max;
}
