import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getQuizBySlug } from '@/lib/data/public';
import { getEquivalentQuizSlug } from '@/lib/data/quiz-locale-map';

const querySchema = z.object({
  slug: z.string().min(1).max(200),
  from: z.enum(['en', 'es']),
  to: z.enum(['en', 'es']),
});

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  const { slug, from, to } = parsed.data;
  const source = await getQuizBySlug(slug, from);
  if (!source) return NextResponse.json({ href: `/${to}` });
  const equivalentSlug = getEquivalentQuizSlug(slug, to);
  const counterpart = equivalentSlug ? await getQuizBySlug(equivalentSlug, to) : null;
  if (counterpart) return NextResponse.json({ href: `/${to}/quiz/${counterpart.slug}` });
  const categorySlug = source.category?.slug;
  return NextResponse.json({ href: categorySlug ? `/${to}/category/${categorySlug}` : `/${to}` });
}
