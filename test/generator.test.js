'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const CG = require('../js/generator.js');

const full = {
  businessName: 'Maple & Oak Bakery',
  productName: 'Sourdough subscription',
  description: 'A weekly loaf baked the morning before delivery, from a local mill.',
  industry: 'food',
  audience: 'busy professionals in the city',
  problem: 'running out of bread before the weekend',
  benefits: 'no-waste fresh bread\na delivery slot you choose',
  objective: 'sales',
  offer: '20% off your first month',
  cta: '',
  tone: 'friendly',
  seed: 0,
};

test('validate requires product name and audience', () => {
  assert.deepEqual(CG.validate({ productName: '', audience: '' }).length, 2);
  assert.equal(CG.validate({ productName: 'Widget', audience: 'Everyone' }).length, 0);
});

test('generate returns errors and no outputs for invalid input', () => {
  const r = CG.generate({ productName: '  ', audience: 'x' });
  assert.ok(r.errors.length > 0);
  assert.equal(r.captions, undefined);
});

test('generate produces every requested output section', () => {
  const r = CG.generate(full);
  assert.deepEqual(r.errors, []);
  assert.equal(r.captions.length, 3);
  assert.equal(r.ads.sets.length, 3);
  assert.ok(r.email.subjects.length >= 2);
  assert.ok(r.email.body.length > 0);
  assert.ok(r.campaign.weeks.length === 4);
  assert.equal(r.contentIdeas.length, 5);
});

test('ad headlines and descriptions respect platform limits', () => {
  const long = { ...full, productName: 'An extraordinarily long product name for the enterprise segment', businessName: '' };
  for (const seed of [0, 1, 2, 3, 7]) {
    const r = CG.generate({ ...long, seed });
    for (const set of r.ads.sets) {
      set.headlines.forEach((h) => assert.ok(h.length <= CG.LIMITS.headline, `headline too long: "${h}"`));
      assert.ok(set.description.length <= CG.LIMITS.description, `description too long: "${set.description}"`);
    }
  }
});

test('email subjects respect the subject limit', () => {
  const r = CG.generate({ ...full, offer: 'Buy one get one free on every single item in the entire store this weekend only' });
  r.email.subjects.forEach((s) => assert.ok(s.length <= CG.LIMITS.subject));
});

test('X post stays within 280 characters for typical input', () => {
  for (const seed of [0, 1, 2]) {
    const r = CG.generate({ ...full, seed });
    const x = r.captions.find((c) => c.platform.startsWith('X'));
    assert.ok(x.chars <= 280, `X post is ${x.chars} chars`);
  }
});

test('seed rotates variants so Regenerate changes the copy', () => {
  const a = CG.generate({ ...full, seed: 0 });
  const b = CG.generate({ ...full, seed: 1 });
  assert.notDeepEqual(a.captions.map((c) => c.text), b.captions.map((c) => c.text));
  assert.notEqual(a.campaign.name, b.campaign.name);
});

test('same input and seed give identical output', () => {
  assert.deepEqual(CG.generate(full), CG.generate(full));
});

test('business name is used when present and product name otherwise', () => {
  const withBiz = CG.generate(full);
  assert.ok(withBiz.email.body.includes('Maple & Oak Bakery'));
  const noBiz = CG.generate({ ...full, businessName: '' });
  assert.ok(noBiz.email.body.endsWith('Sourdough subscription'));
});

test('offer appears in captions and email when provided', () => {
  const r = CG.generate(full);
  assert.ok(r.captions[1].text.includes('20% off your first month'));
  assert.ok(r.email.body.includes('20% off your first month'));
});

test('custom CTA overrides the objective default', () => {
  const r = CG.generate({ ...full, cta: 'Start my subscription' });
  assert.ok(r.email.body.includes('Start my subscription'));
  assert.equal(r.ads.sets[0].cta, 'Start my subscription');
});

test('objective default CTA is used when none is given', () => {
  const r = CG.generate({ ...full, objective: 'leads', cta: '' });
  assert.equal(r.ads.sets[0].cta, 'Get your free quote');
});

test('benefits are split by line and comma, capped at five', () => {
  const r = CG.generate({ ...full, benefits: 'a, b, c, d, e, f, g' });
  assert.equal(r.input.benefits.length, 5);
});

test('missing benefits generate a warning, not a broken sentence', () => {
  const r = CG.generate({ ...full, benefits: '' });
  assert.ok(r.warnings.some((w) => w.startsWith('No benefits')));
  assert.ok(!r.email.body.includes('It gives you .'));
});

test('unknown objective, tone and industry fall back to safe defaults', () => {
  const r = CG.generate({ ...full, objective: 'world-domination', tone: 'angry', industry: 'space' });
  assert.equal(r.input.objective, 'awareness');
  assert.equal(r.input.tone, 'friendly');
  assert.equal(r.input.industry, 'other');
});

test('hashtags are deduplicated and capped at five', () => {
  const tags = CG.generate(full).captions[0].text.split('\n').pop().split(' ');
  assert.ok(tags.length <= 5);
  assert.equal(new Set(tags).size, tags.length);
});

test('listJoin formats lists in English', () => {
  const { listJoin } = CG._internal;
  assert.equal(listJoin(['a']), 'a');
  assert.equal(listJoin(['a', 'b']), 'a and b');
  assert.equal(listJoin(['a', 'b', 'c']), 'a, b and c');
});

test('fit cuts on a word boundary and never exceeds the limit', () => {
  const { fit } = CG._internal;
  const out = fit('the quick brown fox jumps over the lazy dog', 20);
  assert.ok(out.length <= 20);
  assert.equal(out, 'the quick brown fox');
});

test('toMarkdown includes every section', () => {
  const md = CG.toMarkdown(CG.generate(full));
  for (const heading of ['## Social captions', '## Ad copy', '## Email', '## Campaign idea', '## Content ideas', '## Before you publish']) {
    assert.ok(md.includes(heading), `missing ${heading}`);
  }
});

test('newline-separated benefits stay separate items', () => {
  const r = CG.generate({ ...full, benefits: 'no-waste fresh bread\na delivery slot you choose' });
  assert.deepEqual(r.input.benefits, ['no-waste fresh bread', 'a delivery slot you choose']);
  assert.ok(r.email.body.includes('- No-waste fresh bread\n- A delivery slot you choose'));
});

test('ad copy never cuts a phrase mid-way when a whole option fits', () => {
  const r = CG.generate({ ...full, benefits: 'no-waste fresh bread\na delivery slot you choose', seed: 1 });
  for (const set of r.ads.sets) {
    assert.ok(!/\b(a|no-waste fresh bread a)$/.test(set.description), `cut description: "${set.description}"`);
  }
});

test('a long product name adds a warning and headlines stay within limit', () => {
  const r = CG.generate({ ...full, productName: 'Acme Industrial Pneumatic Calibration Services Pro Max' });
  assert.ok(r.warnings.some((w) => w.startsWith('Product name is')));
  r.ads.sets.forEach((s) => s.headlines.forEach((h) => assert.ok(h.length <= CG.LIMITS.headline)));
});

test('a single headline is not duplicated within a variant', () => {
  const r = CG.generate({ productName: 'Acme', audience: 'everyone', objective: 'awareness', seed: 0 });
  r.ads.sets.forEach((s) => assert.equal(new Set(s.headlines).size, s.headlines.length));
});

test('headlines and subject lines carry no trailing sentence punctuation', () => {
  const r = CG.generate({ ...full, offer: '20% off your first month.' });
  r.ads.sets.forEach((s) => s.headlines.forEach((h) => assert.ok(!/[.!?]$/.test(h), h)));
  r.email.subjects.forEach((s) => assert.ok(!/[.!?]$/.test(s), s));
});
