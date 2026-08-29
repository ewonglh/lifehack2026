import { escapeHtml } from '../lib/dom.js';

export const resultPage = ({ params }) => ({
  title: 'Sorting result',
  content: `<section class="page-intro"><h1 class="display-6 fw-bold">Result</h1><p class="text-secondary">Results will appear here${params.submissionId ? ` for ${escapeHtml(params.submissionId)}` : ''}.</p></section>`,
});
