export const comments = {
  siteOrigin: 'https://qians.day',
  providerOrigin: 'https://giscus.app',
  themePath: '/comments/theme.css',
  repo: 'nealzhu/day',
  repoId: 'R_kgDOV2z4ZA',
  category: 'Article Comments',
  categoryId: 'DIC_kwDOV2z4ZM4DMC8T',
  mapping: 'specific',
  strict: '1',
  reactionsEnabled: '1',
  // Giscus reports metadata when an existing discussion is ready.
  emitMetadata: '1',
  inputPosition: 'top',
  lang: 'zh-CN',
  loading: 'lazy',
} as const;

export function commentTerm(articleId: string) {
  return `article-${articleId}`;
}
