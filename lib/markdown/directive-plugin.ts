import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';

const DIRECTIVE_COMPONENTS: Record<string, string> = {
  'at-a-glance': 'AtAGlance',
  misconceptions: 'Misconceptions',
  example: 'Example',
};

type DirectiveNode = {
  type: string;
  name?: string;
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
  };
};

export function directivePlugin() {
  return (tree: Root) => {
    visit(tree, ['containerDirective'], (node) => {
      const directiveNode = node as DirectiveNode;

      if (!directiveNode.name) {
        return;
      }

      const componentName = DIRECTIVE_COMPONENTS[directiveNode.name];

      if (!componentName) {
        return;
      }

      directiveNode.data = {
        hName: componentName,
        hProperties: {},
      };
    });
  };
}
