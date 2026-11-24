import { visit } from 'unist-util-visit';

// A standalone Markdown image can use its optional title as a visible caption.
export function rehypeFigureCaptions() {
  return tree => visit(tree, 'element', node => {
    if (node.tagName !== 'p' || node.children.length !== 1) return;
    const [image] = node.children;
    if (image.tagName !== 'img' || !image.properties.title) return;
    const caption = String(image.properties.title);
    delete image.properties.title;
    node.tagName = 'figure';
    node.children.push({
      type: 'element', tagName: 'figcaption', properties: {},
      children: [{ type: 'text', value: caption }],
    });
  });
}
