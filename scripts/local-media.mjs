// Vite serves pending uploads from disk when the developer opts into same-origin media.
export function serveLocalMedia(server) {
  server.middlewares.use((request, _response, next) => {
    const path = (request.url ?? '').split('?')[0];
    const match = path.match(/^\/posts\/([A-Za-z0-9_-]+)\/([^/]+-[a-f0-9]{12}\.webp)$/);
    if (match && !/%(?:2f|5c)|\\/i.test(match[2])) {
      request.url = `/src/content/posts/${match[1]}/assets/${match[2]}`;
    }
    next();
  });
}
