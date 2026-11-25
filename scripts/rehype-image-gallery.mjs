// Only Markdown images prepared by remarkCdnMedia are part of the article gallery.
export function rehypeImageGallery() {
  return tree => {
    let index = 0;

    function addLinks(parent, linkedImages) {
      parent.children = parent.children.flatMap(node => {
        if (node.type !== 'element') return [node];

        if (node.tagName === 'img' && Object.hasOwn(node.properties, 'dataGalleryImage')) {
          const { src, alt } = node.properties;
          const number = index++;
          const link = {
            type: 'element',
            tagName: 'a',
            properties: {
              href: src,
              dataGalleryOpen: String(number),
              ariaLabel: alt ? `查看大图：${alt}` : `查看第 ${number + 1} 张图`,
            },
            children: [node],
          };
          if (!linkedImages) return [link];

          // Keep the author's link intact, including any surrounding linked text.
          link.properties.dataPagefindIgnore = '';
          link.children = [{ type: 'text', value: '查看大图' }];
          linkedImages.push(link);
          return [node];
        }

        if (node.tagName === 'a') {
          const controls = [];
          addLinks(node, controls);
          return [node, ...controls];
        }

        addLinks(node, linkedImages);
        return [node];
      });
    }
    addLinks(tree);
  };
}
