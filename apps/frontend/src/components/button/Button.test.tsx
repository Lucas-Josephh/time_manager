import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Button from './Button';

describe('Button', () => {
  it('renders the primary variant and defaults to a non-submit button', () => {
    const markup = renderToStaticMarkup(<Button>Save</Button>);

    expect(markup).toContain('type="button"');
    expect(markup).toContain('class="button primary"');
    expect(markup).toContain('>Save</button>');
  });

  it('preserves the selected variant, custom class and native attributes', () => {
    const markup = renderToStaticMarkup(
      <Button variant="secondary" className="wide" disabled>
        Cancel
      </Button>,
    );

    expect(markup).toContain('class="button secondary wide"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('>Cancel</button>');
  });
});
