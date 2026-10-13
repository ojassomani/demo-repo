# Campaign Pack Generator

A small, dependency-free prototype that turns a product brief into marketing copy for a small business.

Enter your product, audience and goal. It produces:

- Social captions for Instagram, Facebook/LinkedIn and X
- Ad headline and description variants, within Google Ads length limits
- An email with subject options, preview text and body
- A four-week campaign plan with channels and a success metric
- Content ideas, plus a "before you publish" checklist
- A Markdown download of the whole pack

## Run it

Open `index.html` in a browser. There is no build step and no server or API key.

## Test it

```sh
node --test test/
```

## Files

- `index.html`: form and rendering. Uses `textContent` only, so user input is never parsed as HTML.
- `js/generator.js`: pure generation logic (no DOM), shared by the browser and tests.
- `test/generator.test.js`: unit tests for output, limits and edge cases.

## Limits

- Copy is template-based, not written by a language model. It is predictable and free to run, but reads more formulaic than model-written copy.
- Benefits should be short noun phrases (e.g. "no-waste fresh bread"), because they slot into "It gives you …".
- Always review claims, prices and legal wording before publishing.
