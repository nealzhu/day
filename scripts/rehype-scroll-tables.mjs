import { visit, SKIP } from 'unist-util-visit';

// Keep the semantic table at full column width and scroll only its wrapper.
export function rehypeScrollTables() {
  return tree => visit(tree, 'element', (node, index, parent) => {
    if (node.tagName !== 'table' || !parent) return;
    parent.children[index] = {
      type: 'element', tagName: 'div',
      properties: { className: ['table-scroll'], tabIndex: 0, role: 'region', ariaLabel: '文章表格' },
      children: [node],
    };
    return SKIP;
  });
}
