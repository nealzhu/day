import type { APIRoute } from 'astro';
import { fontCdn, fontPrefix } from '../../../scripts/font-assets.mjs';
import theme from '../../styles/comments.css?raw';

export const GET: APIRoute = () => new Response(
  `@import url("${fontCdn}/${fontPrefix}/faces.css");\n${theme}`,
  { headers: { 'Content-Type': 'text/css; charset=utf-8' } },
);
