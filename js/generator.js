/*
 * Campaign copy generator.
 *
 * Pure functions only (no DOM, no network) so the same code runs in the
 * browser and under `node --test`. Output is template-based: it is
 * deterministic for a given input and `seed`, and it always needs review
 * before publishing.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CampaignGenerator = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const OBJECTIVES = {
    awareness: {
      label: 'Build awareness',
      noun: 'awareness',
      cta: 'Learn more',
      metric: 'Reach, profile visits and new followers',
      channels: ['Instagram', 'TikTok', 'Local Facebook groups', 'Google Business Profile'],
      hooks: ['Meet {P}.', 'Have you heard of {P} yet?', 'Here is what {B} is about.'],
      themes: ['Meet the Team', 'Know Us Better', 'Open for Everyone'],
    },
    leads: {
      label: 'Generate leads',
      noun: 'lead-generation',
      cta: 'Get your free quote',
      metric: 'Form submissions, sign-ups and booked calls',
      channels: ['Google Ads', 'Meta lead ads', 'Email', 'Website landing page'],
      hooks: ['Tired of the usual hassle?', 'Want a simpler way to get this done?', 'Ask us anything before you commit.'],
      themes: ['The Easy Yes', 'Quote Week', 'Get It Sorted'],
    },
    sales: {
      label: 'Drive sales',
      noun: 'sales',
      cta: 'Shop now',
      metric: 'Orders, revenue per visitor and average order value',
      channels: ['Instagram', 'Email', 'Google Shopping', 'Website banner'],
      hooks: ['Your next favorite thing just landed.', '{P} is ready when you are.', 'Good excuse to treat yourself.'],
      themes: ['Limited Run', 'Stock Up', 'Treat Yourself Week'],
    },
    loyalty: {
      label: 'Retain customers',
      noun: 'customer-retention',
      cta: 'Book your next visit',
      metric: 'Repeat purchase rate and email reply rate',
      channels: ['Email', 'SMS', 'In-store signage', 'Instagram stories'],
      hooks: ['Thank you for being with {B}.', 'Here is something just for our regulars.', 'We noticed it has been a while.'],
      themes: ['Regulars Only', 'Thanks for Coming Back', 'Your Next On Us'],
    },
    launch: {
      label: 'Launch something new',
      noun: 'launch',
      cta: 'See what is new',
      metric: 'Launch-week orders and email sign-ups',
      channels: ['Email', 'Instagram', 'TikTok', 'Local press and community newsletters'],
      hooks: ['It is here: {P}.', 'We built this for you. Say hello to {P}.', 'Big news from {B}.'],
      themes: ['Big Reveal', 'Now Live', 'Day One'],
    },
  };

  const TONES = {
    friendly: { greeting: 'Hi there,', signoff: 'Talk soon,', emoji: ['😊', '🙌', '✨'], exclaim: '!' },
    professional: { greeting: 'Hello,', signoff: 'Kind regards,', emoji: [], exclaim: '.' },
    bold: { greeting: 'Hi,', signoff: 'Let us get to it,', emoji: ['🔥', '💥'], exclaim: '!' },
    playful: { greeting: 'Hey there!', signoff: 'See you soon,', emoji: ['🎉', '👋', '😄'], exclaim: '!' },
  };

  const INDUSTRY_TAGS = {
    retail: ['#shopsmall', '#supportlocal'],
    food: ['#foodie', '#eatlocal'],
    services: ['#smallbusiness', '#localservices'],
    beauty: ['#beauty', '#selfcare'],
    fitness: ['#fitness', '#healthyhabits'],
    tech: ['#startup', '#saas'],
    other: [],
  };

  const LIMITS = { headline: 30, description: 90, subject: 60, preview: 90, caption: 2200 };

  const clean = (value) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');
  const lowerFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
  const upperFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const sentence = (s) => {
    if (!s) return '';
    const cased = upperFirst(s);
    return /[.!?]$/.test(cased) ? cased : cased + '.';
  };
  const slug = (s) => clean(s).toLowerCase().replace(/[^a-z0-9]/g, '');

  // Joins ["a"] -> "a", ["a","b"] -> "a and b", ["a","b","c"] -> "a, b and c".
  function listJoin(items) {
    if (items.length <= 1) return items.join('');
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }

  // Picks from a list by seed so "Regenerate" rotates through options.
  function pick(list, seed, offset = 0) {
    return list[(seed + offset) % list.length];
  }

  // Cuts at a word boundary so ad copy stays inside platform limits.
  function fit(text, max) {
    if (text.length <= max) return text;
    const cut = text.slice(0, max + 1);
    const idx = cut.lastIndexOf(' ');
    return (idx > 0 ? cut.slice(0, idx) : cut.slice(0, max)).replace(/[,;:\-–]+$/, '').trim();
  }

  // Drops the trailing sentence mark, e.g. for headlines and subject lines.
  const strip = (s) => s.replace(/[.!?]+$/, '');

  // Keeps only candidates that fit whole. Cutting a phrase mid-way reads as broken copy,
  // so we fall back to truncation only when nothing fits.
  function fitting(list, max) {
    const ok = list.filter((s) => s && s.length <= max);
    return ok.length ? ok : [fit(list[0], max)];
  }

  function normalize(raw) {
    // Split before collapsing whitespace, or the newline separator is lost.
    const benefits = String(raw.benefits || '')
      .split(/\n|,/)
      .map(clean)
      .filter(Boolean)
      .slice(0, 5);

    const input = {
      businessName: clean(raw.businessName),
      productName: clean(raw.productName),
      description: clean(raw.description),
      industry: INDUSTRY_TAGS[raw.industry] ? raw.industry : 'other',
      audience: clean(raw.audience),
      problem: clean(raw.problem),
      benefits,
      objective: OBJECTIVES[raw.objective] ? raw.objective : 'awareness',
      offer: clean(raw.offer),
      cta: clean(raw.cta),
      tone: TONES[raw.tone] ? raw.tone : 'friendly',
      seed: Number.isInteger(raw.seed) && raw.seed >= 0 ? raw.seed : 0,
    };

    const errors = [];
    if (!input.productName) errors.push('Product or service name is required.');
    if (!input.audience) errors.push('Target audience is required.');
    return { input, errors };
  }

  function validate(raw) {
    return normalize(raw).errors;
  }

  function benefitLine(input) {
    const { productName: P, benefits } = input;
    if (benefits.length === 0) return `${P} is made to make your day easier.`;
    const items = benefits.slice(0, 3).map(lowerFirst);
    return `It gives you ${listJoin(items)}.`;
  }

  function painLine(input) {
    return input.problem ? sentence(input.problem) : '';
  }

  function hashtags(input) {
    const tags = [
      ...INDUSTRY_TAGS[input.industry],
      input.businessName && `#${slug(input.businessName)}`,
      `#${slug(input.productName)}`,
    ].filter(Boolean);
    return [...new Set(tags)].slice(0, 5).join(' ');
  }

  function fill(template, input) {
    return template
      .replace(/\{P\}/g, input.productName)
      .replace(/\{B\}/g, input.businessName || input.productName);
  }

  function ctaText(input) {
    return input.cta || OBJECTIVES[input.objective].cta;
  }

  function emoji(input, index) {
    const list = TONES[input.tone].emoji;
    return list.length ? ' ' + list[(input.seed + index) % list.length] : '';
  }

  function captions(input) {
    const { seed } = input;
    const B = input.businessName || input.productName;
    const hook = (i) => fill(pick(OBJECTIVES[input.objective].hooks, seed, i), input);
    const offerPart = input.offer ? `Right now: ${sentence(input.offer)} ` : '';
    const cta = ctaText(input);
    const tags = hashtags(input);

    const instagram = [
      hook(0) + emoji(input, 0),
      '',
      `${sentence(input.description || `${input.productName} is built for ${input.audience}`)} ${benefitLine(input)}`,
      '',
      `${offerPart}${cta}, link in bio.`,
      '',
      tags,
    ].join('\n');

    const facebook = [
      `${hook(1)}${emoji(input, 1)}`,
      '',
      `${painLine(input) ? painLine(input) + ' ' : ''}${input.productName} from ${B} is for ${input.audience}. ${benefitLine(input)}`,
      input.offer ? `\n${sentence(input.offer)}` : '',
      `\n${cta}: [insert link]`,
    ].join('\n');

    const short = [
      `${fit(hook(2), 90)} ${fit(benefitLine(input), 120)} ${cta} → [link]`,
      tags.split(' ').slice(0, 2).join(' '),
    ].join(' ');

    return [
      { platform: 'Instagram', text: instagram },
      { platform: 'Facebook / LinkedIn', text: facebook },
      { platform: 'X / short post', text: short, chars: short.length, limit: 280 },
    ];
  }

  function adCopy(input) {
    const { seed } = input;
    const cta = ctaText(input);
    const offer = input.offer ? strip(sentence(input.offer)) : '';
    const benefits = input.benefits.map((b) => strip(upperFirst(b)));

    const headlines = fitting(
      [
        input.productName,
        `${input.productName} for you`,
        ...benefits,
        offer,
        `${input.businessName || input.productName}: ${cta}`,
      ].filter(Boolean),
      LIMITS.headline,
    );

    const descriptions = fitting(
      [
        strip(sentence(input.description || `${input.productName} for ${input.audience}`)),
        benefitLine(input),
        offer ? `${offer}. ${cta} today.` : '',
        `Built for ${input.audience}. ${cta}.`,
      ].filter(Boolean),
      LIMITS.description,
    );

    const sets = [0, 1, 2].map((i) => {
      // With only one headline available, don't repeat it in the same variant.
      const h = [
        pick(headlines, seed, i),
        headlines.length > 1 ? pick(headlines, seed, i + 1) : null,
      ].filter(Boolean);
      const d = pick(descriptions, seed, i);
      return {
        headlines: h,
        description: d,
        cta,
        lengths: { headlines: h.map((x) => x.length), description: d.length },
      };
    });
    return { limits: LIMITS, sets };
  }

  function emailCopy(input) {
    const B = input.businessName || input.productName;
    const offer = input.offer ? strip(sentence(input.offer)) : '';
    const subjects = fitting(
      [
        `${input.productName} is here`,
        offer || `A note from ${B}`,
        input.problem ? `${upperFirst(input.problem)}? We can help` : `Something new from ${B}`,
      ],
      LIMITS.subject,
    );

    const preview = pick(
      fitting(
        [strip(sentence(input.description || input.productName)), benefitLine(input)],
        LIMITS.preview,
      ),
      input.seed,
    );

    const greeting = TONES[input.tone].greeting;
    const signoff = TONES[input.tone].signoff;
    const bullets = input.benefits.slice(0, 3).map((b) => `- ${upperFirst(b)}`).join('\n');
    const painPara = input.problem
      ? `Sound familiar? ${sentence(input.problem)} ${input.productName} was made to fix exactly that.`
      : `${input.productName} was made for ${input.audience}.`;

    const body = [
      greeting,
      '',
      painPara,
      '',
      benefitLine(input),
      bullets ? `\n${bullets}` : '',
      offer ? `\n${offer}` : '',
      '',
      `${ctaText(input)}: [insert link]`,
      '',
      signoff,
      B,
    ].join('\n').replace(/\n{3,}/g, '\n\n');

    return { subjects, preview, body, limits: LIMITS };
  }

  function campaignIdea(input) {
    const obj = OBJECTIVES[input.objective];
    const B = input.businessName || input.productName;
    const theme = pick(obj.themes, input.seed);
    const benefit = input.benefits[0] ? lowerFirst(input.benefits[0]) : 'what makes it different';
    const weeks = [
      `Tease: post one question that ${input.audience} are already asking, with no product mention yet.`,
      `Explain: show ${input.productName} solving it, centered on ${benefit}.`,
      `Prove: share a customer story or demo${input.offer ? `, then reveal the offer (${input.offer})` : ''}.`,
      `Close: a direct call to action ("${ctaText(input)}") with a deadline or reason to act now.`,
    ];
    return {
      name: `${theme}: ${input.productName}`,
      concept: `A four-week ${obj.noun} campaign from ${B} aimed at ${input.audience}.`,
      channels: obj.channels,
      weeks,
      metric: obj.metric,
    };
  }

  function contentIdeas(input) {
    const P = input.productName;
    const A = input.audience;
    const pool = [
      { format: 'Short video', idea: `Behind the scenes: how ${P} is made or delivered` },
      { format: 'Carousel', idea: `The three questions ${A} ask before they buy` },
      { format: 'Customer story', idea: `Before and after: a real result with ${P}` },
      { format: 'How-to', idea: `Quick tip: the fastest way to get value from ${P}` },
      { format: 'Story poll', idea: `Ask ${A} what they want to see from us next` },
      { format: 'Myth vs fact', idea: `Myth vs fact: the common mistake ${A} make` },
      { format: 'Checklist', idea: `A simple checklist for ${A}, with ${P} as the last step` },
    ];
    const out = [];
    for (let i = 0; out.length < 5; i++) {
      out.push(pool[(input.seed + i) % pool.length]);
    }
    return out;
  }

  function warnings(input) {
    const notes = [];
    if (input.benefits.length === 0) {
      notes.push('No benefits entered: copy will be generic. Add 2–3 concrete benefits.');
    }
    if (input.productName.length > LIMITS.headline) {
      notes.push(`Product name is ${input.productName.length} characters. Ad headlines allow ${LIMITS.headline}, so use a shorter name for ads.`);
    }
    if (!input.problem) {
      notes.push('No customer problem entered: the email opener will be less specific.');
    }
    if (!input.offer && (input.objective === 'sales' || input.objective === 'leads')) {
      notes.push('No offer entered: sales and lead campaigns usually need a reason to act now.');
    }
    if (input.objective === 'awareness' && input.offer) {
      notes.push('You set an awareness goal with an offer. Offers tend to pull for sales, so check the goal.');
    }
    notes.push('All copy is template-generated. Check claims, prices and legal wording before publishing.');
    return notes;
  }

  function generate(raw) {
    const { input, errors } = normalize(raw);
    if (errors.length) return { errors, input };
    return {
      errors: [],
      input,
      objective: OBJECTIVES[input.objective].label,
      captions: captions(input),
      ads: adCopy(input),
      email: emailCopy(input),
      campaign: campaignIdea(input),
      contentIdeas: contentIdeas(input),
      warnings: warnings(input),
    };
  }

  function toMarkdown(result) {
    const out = [];
    const { input } = result;
    out.push(`# Campaign pack: ${input.productName}`, '');
    out.push(`**Goal:** ${result.objective}  `, `**Audience:** ${input.audience}`, '');

    out.push('## Social captions', '');
    result.captions.forEach((c) => out.push(`### ${c.platform}`, '', c.text, ''));

    out.push('## Ad copy', '');
    result.ads.sets.forEach((s, i) => {
      out.push(`### Variant ${i + 1}`, '');
      out.push(`- Headlines: ${s.headlines.join(' | ')}`);
      out.push(`- Description: ${s.description}`);
      out.push(`- CTA: ${s.cta}`, '');
    });

    out.push('## Email', '');
    out.push(`**Subject options:** ${result.email.subjects.map((s) => `"${s}"`).join(', ')}  `);
    out.push(`**Preview text:** ${result.email.preview}`, '', result.email.body, '');

    const c = result.campaign;
    out.push('## Campaign idea', '', `**${c.name}**`, '', c.concept, '');
    out.push(`**Channels:** ${c.channels.join(', ')}`, '');
    c.weeks.forEach((w, i) => out.push(`${i + 1}. ${w}`));
    out.push('', `**Measure:** ${c.metric}`, '');

    out.push('## Content ideas', '');
    result.contentIdeas.forEach((ci) => out.push(`- **${ci.format}:** ${ci.idea}`));
    out.push('', '## Before you publish', '');
    result.warnings.forEach((w) => out.push(`- ${w}`));
    return out.join('\n') + '\n';
  }

  return {
    OBJECTIVES,
    TONES,
    LIMITS,
    validate,
    generate,
    toMarkdown,
    // exposed for tests
    _internal: { fit, listJoin, sentence, hashtags, normalize },
  };
});
