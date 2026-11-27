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
  // The widget reports a GitHub URL only after a discussion exists.
  emitMetadata: '1',
  inputPosition: 'top',
  lang: 'zh-CN',
  loading: 'lazy',
} as const;

export function commentTerm(articleId: string) {
  return `article-${articleId}`;
}
