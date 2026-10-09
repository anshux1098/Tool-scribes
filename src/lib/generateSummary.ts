import { Tool, CATEGORY_LABELS } from './types';

export function generateSummary(tool: Tool): string {
  const category = CATEGORY_LABELS[tool.category];
  const name = tool.name || 'This tool';
  const desc = tool.description?.trim();

  const what = desc
    ? `${name} is ${desc.charAt(0).toLowerCase() + desc.slice(1)}${desc.endsWith('.') ? '' : '.'}`
    : `${name} is a ${category.toLowerCase().replace(' tools', '')} tool.`;

  const useCase = `It falls under the ${category} category, making it a go-to resource for professionals and enthusiasts in that space.`;

  const audience = tool.category === 'ai'
    ? 'Ideal for anyone looking to leverage AI in their workflow.'
    : tool.category === 'dev'
    ? 'Particularly useful for developers and engineers.'
    : tool.category === 'design'
    ? 'Great for designers, creatives, and visual thinkers.'
    : tool.category === 'prod'
    ? 'Perfect for teams and individuals looking to boost productivity.'
    : tool.category === 'learn'
    ? 'Well-suited for learners, students, and the curious-minded.'
    : 'A handy utility for everyday tasks.';

  return `${what} ${useCase} ${audience}`;
}
