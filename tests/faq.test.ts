import React from 'react';
import { describe, expect, it } from 'vitest';

import FaqPage from '@/app/[locale]/faq/page';
import { JsonLd } from '@/components/seo/json-ld';
import { getFaq } from '@/lib/i18n/faq';
import { locales } from '@/lib/i18n/dictionaries';

function findJsonLdGraphs(node: unknown): Array<Record<string, unknown>> {
  const graphs: Array<Record<string, unknown>> = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!React.isValidElement(value)) return;
    const props = value.props as { data?: Record<string, unknown>; children?: unknown };
    if (value.type === JsonLd && props.data) graphs.push(props.data);
    visit(props.children);
  };
  visit(node);
  return graphs;
}

describe('getFaq', () => {
  it.each(locales)('returns between 8 and 10 items for %s', (locale) => {
    const items = getFaq(locale);
    expect(items.length).toBeGreaterThanOrEqual(8);
    expect(items.length).toBeLessThanOrEqual(10);
  });

  it.each(locales)('has non-empty questions and answers for %s', (locale) => {
    for (const item of getFaq(locale)) {
      expect(item.question.trim().length).toBeGreaterThan(0);
      expect(item.answer.trim().length).toBeGreaterThan(0);
    }
  });

  it.each(locales)('has no duplicate questions or answers for %s', (locale) => {
    const items = getFaq(locale);
    expect(new Set(items.map((item) => item.question)).size).toBe(items.length);
    expect(new Set(items.map((item) => item.answer)).size).toBe(items.length);
  });

  it.each(locales)('keeps answers between 60 and 220 characters for %s', (locale) => {
    for (const item of getFaq(locale)) {
      expect(item.answer.length).toBeGreaterThanOrEqual(60);
      expect(item.answer.length).toBeLessThanOrEqual(220);
    }
  });

  it('does not share any question or answer text between es and en', () => {
    const esTexts = new Set(getFaq('es').flatMap((item) => [item.question, item.answer]));
    for (const text of getFaq('en').flatMap((item) => [item.question, item.answer])) {
      expect(esTexts.has(text)).toBe(false);
    }
  });
});

describe('FAQ page JSON-LD', () => {
  it.each(locales)('emits a single graph with FAQPage and WebPage for %s', async (locale) => {
    const tree = await FaqPage({ params: Promise.resolve({ locale }) });
    const graphs = findJsonLdGraphs(tree);

    expect(graphs).toHaveLength(1);
    const nodes = graphs[0]?.['@graph'] as Array<Record<string, unknown>>;
    expect(nodes.some((node) => node['@type'] === 'WebPage')).toBe(true);

    const faqNode = nodes.find((node) => node['@type'] === 'FAQPage');
    expect(faqNode).toBeDefined();

    const items = getFaq(locale);
    const mainEntity = faqNode?.mainEntity as Array<Record<string, unknown>>;
    expect(mainEntity).toHaveLength(items.length);
    items.forEach((item, index) => {
      expect(mainEntity[index]).toMatchObject({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      });
    });
  });
});
