import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Card } from './card';

describe('Card', () => {
  it('renders its heading, content and footer', () => {
    const markup = renderToStaticMarkup(
      <Card title="Overview" subtitle="Summary" footer="Updated today">
        <span>Card content</span>
      </Card>,
    );

    expect(markup).toContain('<h3>Overview</h3>');
    expect(markup).toContain('<p>Summary</p>');
    expect(markup).toContain('<span>Card content</span>');
    expect(markup).toContain('>Updated today</p>');
  });

  it('adds table styling and renders its header element when no icon is set', () => {
    const markup = renderToStaticMarkup(
      <Card title="Departments" type="table" element={<button>Add</button>} />,
    );

    expect(markup).toContain('border-top:1px solid #5a6b8530');
    expect(markup).toContain('margin-top:0.75rem');
    expect(markup).toContain('<button>Add</button>');
  });
});
