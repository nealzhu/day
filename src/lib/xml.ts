const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
export function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, char => entities[char]);
}

export function xmlResponse(document: string, type = 'application/xml') {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${document}`, {
    headers: { 'Content-Type': `${type}; charset=utf-8` },
  });
}
