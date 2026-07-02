# QuizVerse Frontend Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign QuizVerse frontend with Editorial Curated visual identity, fixing broken images, misalignment, and inconsistent spacing while establishing a cohesive, non-generic design system.

**Architecture:** Mobile-first CSS custom properties system with solid colors (no gradients/glassmorphism), Playfair Display + Inter typography, consistent 8px spacing grid, and procedural image fallbacks. Components updated incrementally from layout shell inward.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 4, Framer Motion (simplified), Zustand.

---

## Phase 1: Foundation

### Task 1: Update global CSS variables and utilities

**Files:**

- Modify: `src/app/globals.css`

**Context:** The current CSS has gradients, glassmorphism, and too many variables. We need a clean, solid-color system.

- [ ] **Step 1: Replace CSS custom properties with Editorial Curated palette**

Replace the entire `:root` block (lines 8-58) with:

```css
:root {
  /* Editorial Curated — Light */
  --bg-primary: #faf8f5;
  --bg-secondary: #ffffff;
  --bg-tertiary: #f0ebe4;
  --bg-glass: rgba(250, 248, 245, 0.95);
  --text-primary: #1a1a1a;
  --text-secondary: #5a5448;
  --text-muted: #8a8279;
  --accent-primary: #c4704a;
  --accent-hover: #a85d3a;
  --accent-secondary: #2b4c7e;
  --accent-tertiary: #d4a843;
  --success: #2e8b57;
  --error: #bf3b2f;
  --warning: #c9892f;
  --border-subtle: rgba(26, 26, 26, 0.08);
  --border-hover: rgba(196, 112, 74, 0.3);
  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-full: 9999px;
  --shadow-card: 0 4px 16px rgba(26, 20, 16, 0.06);
  --shadow-md: 0 8px 24px rgba(26, 20, 16, 0.1);
  --shadow-elevated: 0 12px 40px rgba(26, 20, 16, 0.14);
}
```

- [ ] **Step 2: Replace .light and .dark theme blocks**

Replace the `.light` block (lines 64-108) and `.dark` block (lines 114-158) with a single light-theme override that matches `:root`:

```css
.light {
  --bg-primary: #faf8f5;
  --bg-secondary: #ffffff;
  --bg-tertiary: #f0ebe4;
  --bg-glass: rgba(250, 248, 245, 0.95);
  --text-primary: #1a1a1a;
  --text-secondary: #5a5448;
  --text-muted: #8a8279;
  --accent-primary: #c4704a;
  --accent-hover: #a85d3a;
  --accent-secondary: #2b4c7e;
  --accent-tertiary: #d4a843;
  --success: #2e8b57;
  --error: #bf3b2f;
  --warning: #c9892f;
  --border-subtle: rgba(26, 26, 26, 0.08);
  --border-hover: rgba(196, 112, 74, 0.3);
  --shadow-card: 0 4px 16px rgba(26, 20, 16, 0.06);
  --shadow-md: 0 8px 24px rgba(26, 20, 16, 0.1);
  --shadow-elevated: 0 12px 40px rgba(26, 20, 16, 0.14);
}
```

Keep the `.dark` block as-is for backward compatibility but do not expand it.

- [ ] **Step 3: Remove gradient and glassmorphism utilities**

Delete these CSS rules entirely:

- `.gradient-text` (lines 415-420)
- `.glow` (lines 423-425)
- `.glass` (lines 408-412)
- `@keyframes pulse-glow` (lines 317-327)
- `.animate-pulse-glow` (lines 388-389)
- `@keyframes shimmer` (lines 308-315)
- `.animate-shimmer` (lines 376-385)
- `@keyframes float` (lines 329-337)
- `.animate-float` (lines 391-393)
- `.editorial-shell::after` decorative blob (lines 486-501)
- `.light body::before` grid pattern (lines 267-278)
- `.light body` radial gradient background (lines 259-265)
- All `--gradient-*` variables
- All `--surface-*` variables
- All `--kicker-*` variables (keep `.kicker` class but simplify)
- `--eyebrow-color` (use `--text-muted` directly)
- `--headline-gradient-*` variables

- [ ] **Step 4: Simplify editorial utility classes**

Replace `.eyebrow` (lines 503-509) with:

```css
.eyebrow {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--text-muted);
}
```

Replace `.kicker` (lines 511-521) with:

```css
.kicker {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--text-muted);
}
```

Replace `.surface-card` (lines 523-528) with:

```css
.surface-card {
  border: 1px solid var(--border-subtle);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}
```

Replace `.surface-panel` (lines 530-534) with:

```css
.surface-panel {
  border: 1px solid var(--border-subtle);
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
}
```

Delete `.headline-gradient` entirely. Replace with `.accent-text`:

```css
.accent-text {
  color: var(--accent-primary);
}
```

- [ ] **Step 5: Update @theme inline block**

Replace the `@theme inline` block (lines 209-236) with:

```css
@theme inline {
  --color-bg-primary: var(--bg-primary);
  --color-bg-secondary: var(--bg-secondary);
  --color-bg-tertiary: var(--bg-tertiary);
  --color-bg-glass: var(--bg-glass);
  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-muted: var(--text-muted);
  --color-accent-primary: var(--accent-primary);
  --color-accent-hover: var(--accent-hover);
  --color-accent-secondary: var(--accent-secondary);
  --color-accent-tertiary: var(--accent-tertiary);
  --color-success: var(--success);
  --color-error: var(--error);
  --color-warning: var(--warning);
  --color-border-subtle: var(--border-subtle);
  --color-border-hover: var(--border-hover);
  --shadow-card: var(--shadow-card);
  --shadow-md: var(--shadow-md);
  --shadow-elevated: var(--shadow-elevated);
  --radius-sm: var(--radius-sm);
  --radius-md: var(--radius-md);
  --radius-lg: var(--radius-lg);
  --radius-full: var(--radius-full);
  --font-display: 'Playfair Display', Georgia, serif;
  --font-body: 'Inter', system-ui, sans-serif;
}
```

- [ ] **Step 6: Update body and base styles**

Replace `body` styles (lines 250-256) with:

```css
body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-body);
  min-height: 100vh;
  overflow-x: hidden;
}
```

- [ ] **Step 7: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: redesign CSS foundation with editorial curated palette"
```

---

### Task 2: Add Playfair Display font and update layout

**Files:**

- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Replace font imports**

Replace the font imports at the top:

```typescript
import { Playfair_Display, Inter } from 'next/font/google';
```

Replace the font variable declarations (lines 13-23):

```typescript
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});
```

- [ ] **Step 2: Update html className**

On line 88, change:

```typescript
className={`h-full ${playfair.variable} ${inter.variable}`}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: add Playfair Display font for editorial headings"
```

---

## Phase 2: Navigation Shell

### Task 3: Fix SiteShell mobile padding

**Files:**

- Modify: `src/components/layout/site-shell.tsx`

- [ ] **Step 1: Update mobile padding calculation**

Replace line 28:

```typescript
<main id="main-content" className={isFullscreen ? '' : 'pb-24 md:pb-0'}>
```

With:

```typescript
<main id="main-content" className={isFullscreen ? '' : 'pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0'}>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/site-shell.tsx
git commit -m "fix: mobile nav safe area padding"
```

---

### Task 4: Redesign FloatingNav

**Files:**

- Modify: `src/components/layout/floating-nav.tsx`

- [ ] **Step 1: Update nav container styles**

Replace lines 21-29:

```typescript
<nav className="fixed inset-x-0 top-0 z-40 px-4 pt-4">
  <div
    className={cn(
      'mx-auto flex w-full max-w-7xl items-center justify-between gap-4 transition-all duration-300',
      isScrolled
        ? 'border-border-subtle bg-bg-glass shadow-card rounded-full border px-4 py-3 backdrop-blur-xl'
        : 'rounded-[2rem] bg-transparent px-1 py-2'
    )}
  >
```

With:

```typescript
<nav className="fixed inset-x-0 top-0 z-40 px-4 pt-3">
  <div
    className={cn(
      'mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 transition-all duration-200',
      isScrolled
        ? 'border-b border-border-subtle bg-bg-primary/95 px-4 py-3'
        : 'bg-transparent px-2 py-2'
    )}
  >
```

- [ ] **Step 2: Update logo styles**

Replace lines 31-43:

```typescript
<Link href={localizeHref(locale, '/')} className="group flex items-center gap-3">
  <div className="border-border-subtle bg-bg-secondary text-accent-primary flex h-11 w-11 items-center justify-center rounded-full border text-sm font-black tracking-[0.22em] uppercase">
    QV
  </div>
  <div className="hidden sm:block">
    <p className="font-display text-text-primary group-hover:text-accent-primary text-lg font-semibold transition-colors">
      QuizVerse
    </p>
    <p className="text-text-muted text-[11px] tracking-[0.22em] uppercase">
      {dictionary.nav.statement}
    </p>
  </div>
</Link>
```

With:

```typescript
<Link href={localizeHref(locale, '/')} className="group flex items-center gap-2.5">
  <div className="bg-text-primary text-bg-primary flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold tracking-wider">
    QV
  </div>
  <div className="hidden sm:block">
    <p className="font-display text-text-primary group-hover:text-accent-primary text-lg font-semibold transition-colors">
      QuizVerse
    </p>
  </div>
</Link>
```

- [ ] **Step 3: Update nav link styles**

Replace the `NavLink` function (lines 95-104):

```typescript
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-text-secondary hover:bg-bg-secondary hover:text-text-primary rounded-full px-4 py-2 text-sm font-medium transition-colors"
    >
      {children}
    </Link>
  );
}
```

With:

```typescript
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
    >
      {children}
    </Link>
  );
}
```

- [ ] **Step 4: Update CTA button style**

Replace lines 83-88:

```typescript
<Link
  href={localizeHref(locale, '/login')}
  className="bg-accent-primary hover:bg-accent-hover inline-flex rounded-full px-4 py-2 text-sm font-semibold text-white transition-colors"
>
  {dictionary.common.signup}
</Link>
```

With:

```typescript
<Link
  href={localizeHref(locale, '/login')}
  className="bg-accent-primary hover:bg-accent-hover inline-flex rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-colors"
>
  {dictionary.common.signup}
</Link>
```

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/floating-nav.tsx
git commit -m "feat: redesign floating nav with editorial curated style"
```

---

### Task 5: Redesign MobileNav

**Files:**

- Modify: `src/components/layout/mobile-nav.tsx`

- [ ] **Step 1: Update mobile nav container**

Replace lines 46-48:

```typescript
<nav className="fixed inset-x-0 bottom-0 z-40 md:hidden">
  <div className="border-border-subtle bg-bg-glass shadow-card mx-3 mb-3 rounded-[1.75rem] border px-2 py-2 backdrop-blur-xl">
```

With:

```typescript
<nav className="fixed inset-x-0 bottom-0 z-40 md:hidden">
  <div className="border-t border-border-subtle bg-bg-secondary px-2 py-2">
```

- [ ] **Step 2: Update nav item styles**

Replace lines 58-68:

```typescript
<Link
  key={item.href}
  href={item.href}
  className={cn(
    'flex min-w-0 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[10px] font-medium transition-colors',
    active ? 'text-accent-primary' : 'text-text-muted'
  )}
>
  <div className={cn('h-5 w-5', active && 'scale-110')}>{item.icon}</div>
  <span className="truncate">{item.label}</span>
</Link>
```

With:

```typescript
<Link
  key={item.href}
  href={item.href}
  className={cn(
    'flex min-w-0 flex-col items-center gap-1 rounded-lg px-3 py-2 text-[10px] font-medium transition-colors',
    active ? 'text-accent-primary' : 'text-text-muted'
  )}
>
  <div className={cn('h-5 w-5', active && 'text-accent-primary')}>{item.icon}</div>
  <span className="truncate">{item.label}</span>
</Link>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/mobile-nav.tsx
git commit -m "feat: redesign mobile nav with solid background and cleaner style"
```

---

## Phase 3: Home Page

### Task 6: Simplify HeroSection

**Files:**

- Modify: `src/components/home/hero-section.tsx`

- [ ] **Step 1: Remove particles and simplify**

Replace the entire file content with:

```typescript
'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { y: 16, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function HeroSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <motion.div variants={containerVariants} initial="hidden" animate="visible">
        {children}
      </motion.div>
    </div>
  );
}

export function StaggerItem({ children }: { children: React.ReactNode }) {
  return <motion.div variants={itemVariants}>{children}</motion.div>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/home/hero-section.tsx
git commit -m "feat: simplify hero section, remove particles"
```

---

### Task 7: Update Home Page layout and typography

**Files:**

- Modify: `src/app/[locale]/page.tsx`

- [ ] **Step 1: Update main container and hero layout**

Replace line 68:

```typescript
<main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-14 px-4 pt-28 pb-20">
```

With:

```typescript
<main className="mx-auto flex min-h-screen w-full max-w-[1200px] flex-col gap-12 px-4 pt-24 pb-20 md:gap-16">
```

Replace lines 69-75:

```typescript
<section className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
  <div className="space-y-8">
    <HomeHeroClient>
      <div className="kicker eyebrow animate-editorial-rise">
      <span className="bg-accent-primary h-2 w-2 rounded-full" />
      {dictionary.home.eyebrow}
    </div>
```

With:

```typescript
<section className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-start lg:gap-12">
  <div className="space-y-6 md:space-y-8">
    <HomeHeroClient>
      <div className="flex items-center gap-2">
        <span className="bg-accent-primary h-1.5 w-1.5 rounded-full" />
        <span className="eyebrow">{dictionary.home.eyebrow}</span>
      </div>
```

- [ ] **Step 2: Update hero typography**

Replace lines 77-85:

```typescript
<div className="space-y-5">
  <h1 className="max-w-4xl text-5xl sm:text-6xl lg:text-8xl">
    {dictionary.home.title}{' '}
    <span className="headline-gradient">{dictionary.home.titleAccent}</span>
  </h1>
  <p className="balanced-copy text-text-secondary text-lg leading-8 sm:text-xl">
    {dictionary.home.subtitle}
  </p>
</div>
```

With:

```typescript
<div className="space-y-4 md:space-y-5">
  <h1 className="font-display max-w-4xl text-[2rem] leading-[1.05] font-bold sm:text-5xl md:text-6xl lg:text-7xl">
    {dictionary.home.title}{' '}
    <span className="text-accent-primary">{dictionary.home.titleAccent}</span>
  </h1>
  <p className="text-text-secondary max-w-[55ch] text-base leading-relaxed text-balance sm:text-lg">
    {dictionary.home.subtitle}
  </p>
</div>
```

- [ ] **Step 3: Update CTA buttons**

Replace lines 87-100:

```typescript
<div className="flex flex-col gap-3 sm:flex-row">
  <Link
    href={localizeHref(locale, '/quiz')}
    className="bg-accent-primary hover:bg-accent-hover inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold tracking-[0.18em] text-white uppercase transition-colors"
  >
    {dictionary.home.primaryCta}
  </Link>
  <Link
    href={localizeHref(locale, '/create/ai')}
    className="border-border-subtle bg-bg-secondary text-text-primary hover:border-accent-primary/30 inline-flex items-center justify-center rounded-full border px-6 py-3 text-sm font-semibold tracking-[0.18em] uppercase transition-colors"
  >
    {dictionary.home.secondaryCta}
  </Link>
</div>
```

With:

```typescript
<div className="flex flex-col gap-3 sm:flex-row">
  <Link
    href={localizeHref(locale, '/quiz')}
    className="bg-accent-primary hover:bg-accent-hover inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white transition-colors"
  >
    {dictionary.home.primaryCta}
  </Link>
  <Link
    href={localizeHref(locale, '/create/ai')}
    className="border-border-subtle text-text-primary hover:border-accent-primary/30 inline-flex items-center justify-center rounded-full border px-6 py-3 text-sm font-semibold transition-colors"
  >
    {dictionary.home.secondaryCta}
  </Link>
</div>
```

- [ ] **Step 4: Update category cards**

Replace lines 103-122:

```typescript
<div className="grid gap-4 md:grid-cols-3">
  {categories.slice(0, 3).map((category) => (
    <Link
      key={category!.id}
      href={localizeHref(locale, `/category/${category!.slug}`)}
      className="surface-card rounded-[2rem] p-5 transition-transform hover:-translate-y-1"
    >
      <p className="eyebrow mb-4">{dictionary.home.sections.categories}</p>
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="min-w-0 text-[1.9rem] leading-none tracking-tight sm:text-[2rem]">
          {category!.name}
        </h2>
        <span className="text-text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/55 text-lg">
          {category!.icon ?? category!.name.charAt(0)}
        </span>
      </div>
      <p className="text-text-secondary text-sm leading-6">{category!.description}</p>
    </Link>
  ))}
</div>
```

With:

```typescript
<div className="grid gap-4 md:grid-cols-3">
  {categories.slice(0, 3).map((category) => (
    <Link
      key={category!.id}
      href={localizeHref(locale, `/category/${category!.slug}`)}
      className="surface-card p-5 transition-all hover:-translate-y-1 hover:border-border-hover"
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="bg-accent-secondary h-4 w-4 rounded-sm" />
        <span className="eyebrow">{dictionary.home.sections.categories}</span>
      </div>
      <h2 className="min-w-0 text-xl leading-tight font-semibold tracking-tight sm:text-2xl">
        {category!.name}
      </h2>
      <p className="text-text-secondary mt-3 text-sm leading-relaxed">{category!.description}</p>
    </Link>
  ))}
</div>
```

- [ ] **Step 5: Update stats panels**

Replace lines 131-144:

```typescript
<aside className="surface-card rounded-[2rem] p-6">
  <p className="eyebrow mb-3">{dictionary.home.sections.momentum}</p>
  <h2 className="mb-2 text-3xl">
    {payload.totalPlays.toLocaleString(locale)} {locale === 'es' ? 'partidas' : 'plays'}
  </h2>
  <p className="text-text-secondary">{dictionary.home.featuredBody}</p>
</aside>
<aside className="surface-panel rounded-[2rem] p-6">
  <p className="eyebrow mb-3">{dictionary.home.sections.discovery}</p>
  <h2 className="mb-2 text-3xl">
    {payload.totalQuizzes} {locale === 'es' ? 'quizzes en vivo' : 'live quizzes'}
  </h2>
  <p className="text-text-secondary">{dictionary.home.quickBody}</p>
</aside>
```

With:

```typescript
<aside className="surface-card p-6">
  <span className="eyebrow">{dictionary.home.sections.momentum}</span>
  <h2 className="font-display mt-3 text-3xl font-bold md:text-4xl">
    {payload.totalPlays.toLocaleString(locale)} {locale === 'es' ? 'partidas' : 'plays'}
  </h2>
  <p className="text-text-secondary mt-2 text-sm leading-relaxed">{dictionary.home.featuredBody}</p>
</aside>
<aside className="surface-card p-6">
  <span className="eyebrow">{dictionary.home.sections.discovery}</span>
  <h2 className="font-display mt-3 text-3xl font-bold md:text-4xl">
    {payload.totalQuizzes} {locale === 'es' ? 'quizzes en vivo' : 'live quizzes'}
  </h2>
  <p className="text-text-secondary mt-2 text-sm leading-relaxed">{dictionary.home.quickBody}</p>
</aside>
```

- [ ] **Step 6: Update editorial picks section**

Replace lines 148-184:

```typescript
<section className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
  <div className="surface-panel rounded-[2rem] p-6 md:p-7">
    <p className="eyebrow mb-4">
      {locale === 'es' ? 'Selección editorial' : 'Editorial picks'}
    </p>
    <h2 className="text-4xl">
      {locale === 'es'
        ? 'Entradas más fuertes para empezar a jugar'
        : 'Sharper entry points into the catalog'}
    </h2>
    <p className="text-text-secondary mt-4 text-base leading-7">
      {locale === 'es'
        ? 'En lugar de empujar un grid plano, priorizamos picks con más ritmo, personalidad y conversación cultural real.'
        : 'Instead of a flat catalog wall, we push picks with stronger pacing, personality and live cultural momentum.'}
    </p>
    <div className="mt-6 grid gap-3">
      {standoutStrip.slice(0, 3).map((quiz) => (
        <Link
          key={`${locale}-standout-${quiz.id}`}
          href={localizeHref(locale, `/quiz/${quiz.slug}`)}
          className="border-border-subtle bg-bg-secondary hover:border-accent-primary/30 flex items-center justify-between rounded-[1.4rem] border px-4 py-4 transition-colors"
        >
          <div className="min-w-0">
            <p className="text-text-muted text-[11px] font-semibold tracking-[0.2em] uppercase">
              {quiz.category?.name ?? (locale === 'es' ? 'Quiz' : 'Quiz')}
            </p>
            <p className="text-text-primary mt-2 line-clamp-2 text-base leading-6 font-semibold">
              {quiz.title}
            </p>
          </div>
          <span className="text-accent-primary ml-4 text-sm font-semibold">
            {locale === 'es' ? 'Ver' : 'Open'}
          </span>
        </Link>
      ))}
    </div>
  </div>
```

With:

```typescript
<section className="grid gap-6 xl:grid-cols-[0.4fr_0.6fr]">
  <div className="surface-panel p-6 md:p-7">
    <span className="eyebrow">
      {locale === 'es' ? 'Selección editorial' : 'Editorial picks'}
    </span>
    <h2 className="font-display mt-4 text-2xl font-bold md:text-3xl">
      {locale === 'es'
        ? 'Entradas más fuertes para empezar a jugar'
        : 'Sharper entry points into the catalog'}
    </h2>
    <p className="text-text-secondary mt-4 text-base leading-relaxed">
      {locale === 'es'
        ? 'En lugar de empujar un grid plano, priorizamos picks con más ritmo, personalidad y conversación cultural real.'
        : 'Instead of a flat catalog wall, we push picks with stronger pacing, personality and live cultural momentum.'}
    </p>
    <div className="mt-6 grid gap-3">
      {standoutStrip.slice(0, 3).map((quiz) => (
        <Link
          key={`${locale}-standout-${quiz.id}`}
          href={localizeHref(locale, `/quiz/${quiz.slug}`)}
          className="border-border-subtle bg-bg-secondary hover:border-border-hover flex items-center justify-between rounded-2xl border px-4 py-4 transition-colors"
        >
          <div className="min-w-0">
            <span className="text-text-muted text-[11px] font-semibold tracking-[0.15em] uppercase">
              {quiz.category?.name ?? (locale === 'es' ? 'Quiz' : 'Quiz')}
            </span>
            <p className="text-text-primary mt-1 line-clamp-2 text-base font-semibold leading-snug">
              {quiz.title}
            </p>
          </div>
          <span className="text-accent-primary ml-4 shrink-0 text-sm font-semibold">
            {locale === 'es' ? 'Ver' : 'Open'}
          </span>
        </Link>
      ))}
    </div>
  </div>
```

- [ ] **Step 7: Update quiz sections layout**

Replace lines 252-259:

```typescript
<section className="space-y-6">
  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
    <div className="space-y-2">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="text-4xl">{title}</h2>
    </div>
    <p className="text-text-secondary max-w-2xl text-sm leading-6">{deck}</p>
  </div>
```

With:

```typescript
<section className="space-y-6">
  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
    <div className="space-y-2">
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="font-display text-2xl font-bold md:text-3xl">{title}</h2>
    </div>
    <p className="text-text-secondary max-w-2xl text-sm leading-relaxed">{deck}</p>
  </div>
```

- [ ] **Step 8: Commit**

```bash
git add src/app/[locale]/page.tsx
git commit -m "feat: redesign home page layout and typography"
```

---

## Phase 4: Shared Components

### Task 8: Create QuizImage component with fallback

**Files:**

- Create: `src/components/shared/quiz-image.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

interface QuizImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  quizType?: 'personality' | 'trivia' | string;
}

const TYPE_EMOJI: Record<string, string> = {
  personality: '🎭',
  trivia: '🧠',
  default: '📊',
};

export function QuizImage({ src, alt, className, quizType = 'default' }: QuizImageProps) {
  const [error, setError] = React.useState(false);

  if (!src || error) {
    return (
      <div
        className={cn(
          'bg-bg-tertiary flex items-center justify-center',
          className
        )}
        aria-label={alt}
      >
        <span className="text-4xl opacity-50" role="img" aria-hidden="true">
          {TYPE_EMOJI[quizType] ?? TYPE_EMOJI.default}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={cn('object-cover', className)}
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shared/quiz-image.tsx
git commit -m "feat: add QuizImage component with emoji fallback"
```

---

### Task 9: Redesign EditorialQuizCard

**Files:**

- Modify: `src/components/home/editorial-quiz-card.tsx`

- [ ] **Step 1: Add QuizImage import and update image rendering**

Add import at the top:

```typescript
import { QuizImage } from '@/components/shared/quiz-image';
```

Replace the image section (lines 72-85):

```typescript
<QuizCoverArt
  quiz={quiz}
  locale={locale}
  ratioClassName={size === 'hero' || size === 'feature' ? 'aspect-[16/10]' : 'aspect-[16/9]'}
  compact={size === 'compact'}
  priorityLabel={
    quiz.is_featured
      ? locale === 'es'
        ? 'Selección editorial'
        : 'Editorial pick'
      : undefined
  }
/>
```

With:

```typescript
<div className="relative overflow-hidden rounded-xl">
  <QuizImage
    src={quiz.cover_image_url}
    alt={quiz.title}
    quizType={quiz.quiz_type}
    className={size === 'hero' || size === 'feature' ? 'aspect-[16/10] w-full' : 'aspect-[16/9] w-full'}
  />
  {quiz.is_featured && (
    <span className="absolute top-3 left-3 bg-accent-tertiary/90 text-text-primary rounded-full px-3 py-1 text-[10px] font-bold tracking-wider uppercase">
      {locale === 'es' ? 'Selección editorial' : 'Editorial pick'}
    </span>
  )}
</div>
```

- [ ] **Step 2: Update card container styles**

Replace lines 66-70:

```typescript
className={cn(
  'border-border-subtle bg-bg-secondary hover:shadow-elevated relative overflow-hidden rounded-2xl border shadow-sm transition-all duration-300 ease-out hover:border-accent-primary/30 hover:shadow-lg',
  styles.minH,
  size === 'compact' && 'rounded-xl'
)}
```

With:

```typescript
className={cn(
  'border-border-subtle bg-bg-secondary hover:shadow-md relative overflow-hidden rounded-2xl border transition-all duration-200 hover:border-border-hover',
  styles.minH,
  size === 'compact' && 'rounded-xl'
)}
```

- [ ] **Step 3: Update typography in card**

Replace lines 89-101:

```typescript
<div className="space-y-2 min-w-0">
  <h3
    className={cn(
      'text-text-primary group-hover:text-accent-primary font-semibold tracking-tight transition-colors line-clamp-2 break-words',
      styles.title
    )}
  >
    {quiz.title}
  </h3>
  {quiz.description && (
    <p className={cn('text-text-secondary', styles.desc)}>
      {quiz.description}
    </p>
  )}
</div>
```

With:

```typescript
<div className="min-w-0 space-y-2">
  <h3
    className={cn(
      'text-text-primary group-hover:text-accent-primary font-semibold leading-snug transition-colors line-clamp-2',
      size === 'hero' ? 'font-display' : '',
      styles.title
    )}
  >
    {quiz.title}
  </h3>
  {quiz.description && size !== 'compact' && (
    <p className={cn('text-text-secondary leading-relaxed', styles.desc)}>
      {quiz.description}
    </p>
  )}
</div>
```

- [ ] **Step 4: Update tags and stats**

Replace lines 105-120:

```typescript
<div className="flex flex-wrap gap-1.5">
  <span className="bg-accent-primary/10 text-accent-primary inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.18em] uppercase">
    {getLocalizedTypeLabel(quiz.quiz_type, locale)}
  </span>
  <span className="bg-bg-tertiary text-text-secondary inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.15em] uppercase">
    {getLocalizedDifficultyLabel(quiz.difficulty, locale)}
  </span>
  {quiz.tags.slice(0, styles.tags).map((tag) => (
    <span
      key={tag}
      className="bg-bg-tertiary text-text-muted inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium uppercase"
    >
      {tag.replace(/_/g, ' ')}
    </span>
  ))}
</div>
```

With:

```typescript
<div className="flex flex-wrap gap-1.5">
  <span className="bg-accent-primary/10 text-accent-primary inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase">
    {getLocalizedTypeLabel(quiz.quiz_type, locale)}
  </span>
  <span className="bg-bg-tertiary text-text-secondary inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase">
    {getLocalizedDifficultyLabel(quiz.difficulty, locale)}
  </span>
  {quiz.tags.slice(0, styles.tags).map((tag) => (
    <span
      key={tag}
      className="bg-bg-tertiary text-text-muted inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium tracking-wide uppercase"
    >
      {tag.replace(/_/g, ' ')}
    </span>
  ))}
</div>
```

Replace lines 122-130:

```typescript
<div className="text-text-muted border-border-subtle flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t pt-3 text-[11px] font-semibold tracking-[0.15em] uppercase">
  <span>{quiz.estimated_minutes} min</span>
  <span className="whitespace-nowrap">
    {formatCompactNumber(quiz.plays_count)} {playsLabel}
  </span>
  <span className="whitespace-nowrap">
    {formatCompactNumber(quiz.likes_count)} {likesLabel}
  </span>
</div>
```

With:

```typescript
<div className="text-text-muted border-border-subtle flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-[11px] font-semibold tracking-wider uppercase">
  <span>{quiz.estimated_minutes} min</span>
  <span className="whitespace-nowrap">
    {formatCompactNumber(quiz.plays_count)} {playsLabel}
  </span>
  <span className="whitespace-nowrap">
    {formatCompactNumber(quiz.likes_count)} {likesLabel}
  </span>
</div>
```

- [ ] **Step 5: Commit**

```bash
git add src/components/home/editorial-quiz-card.tsx
git commit -m "feat: redesign editorial quiz card with image fallback and cleaner typography"
```

---

### Task 10: Redesign QuizCard

**Files:**

- Modify: `src/components/quiz/quiz-card.tsx`

- [ ] **Step 1: Add QuizImage import and update image**

Add import:

```typescript
import { QuizImage } from '@/components/shared/quiz-image';
```

Replace lines 36-49:

```typescript
<div className="relative aspect-video overflow-hidden">
  {quiz.cover_image_url ? (
    <img
      src={quiz.cover_image_url}
      alt={quiz.title}
      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
      loading="lazy"
    />
  ) : (
    <div className="from-accent-primary/20 to-accent-secondary/20 flex h-full w-full items-center justify-center bg-gradient-to-br">
      <span className="text-5xl opacity-40">{quiz.quiz_type === 'personality' ? '🎭' : quiz.quiz_type === 'trivia' ? '🧠' : '📊'}</span>
    </div>
  )}
  <div className="from-bg-secondary/60 absolute inset-0 bg-gradient-to-t via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
</div>
```

With:

```typescript
<div className="relative aspect-video overflow-hidden rounded-t-2xl">
  <QuizImage
    src={quiz.cover_image_url}
    alt={quiz.title}
    quizType={quiz.quiz_type}
    className="h-full w-full transition-transform duration-300 group-hover:scale-105"
  />
</div>
```

- [ ] **Step 2: Update card container and content**

Replace lines 28-34:

```typescript
className={cn(
  'border-border-subtle bg-bg-secondary relative overflow-hidden rounded-2xl border',
  'transition-all duration-300 ease-out',
  'hover:border-accent-primary/50 hover:shadow-md',
  isFeatured && 'ring-accent-primary/30 ring-2'
)}
```

With:

```typescript
className={cn(
  'border-border-subtle bg-bg-secondary relative overflow-hidden rounded-2xl border',
  'transition-all duration-200',
  'hover:border-border-hover hover:shadow-md',
  isFeatured && 'ring-accent-primary/20 ring-2'
)}
```

Replace lines 52-101:

```typescript
<div className="p-4 md:p-5 min-w-0">
  <div className="mb-3 flex flex-wrap items-center gap-2">
    ...
  </div>

  <h3 className="text-text-primary group-hover:text-accent-primary mb-2 line-clamp-2 break-words text-base font-semibold transition-colors md:text-lg">
    {quiz.title}
  </h3>

  {quiz.description && (
    <p className="text-text-secondary mb-4 line-clamp-2 text-sm">{quiz.description}</p>
  )}

  <div className="text-text-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
    ...
  </div>
</div>
```

With:

```typescript
<div className="p-4 md:p-5 min-w-0">
  <div className="mb-3 flex flex-wrap items-center gap-2">
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase',
        quiz.quiz_type === 'personality'
          ? 'bg-accent-primary/10 text-accent-primary'
          : quiz.quiz_type === 'trivia'
            ? 'bg-accent-secondary/10 text-accent-secondary'
            : 'bg-bg-tertiary text-text-secondary'
      )}
    >
      {quiz.quiz_type === 'personality' && '🎭 '}
      {quiz.quiz_type === 'trivia' && '🧠 '}
      {quiz.quiz_type.charAt(0).toUpperCase() + quiz.quiz_type.slice(1)}
    </span>
    {quiz.difficulty && (
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase',
          quiz.difficulty === 'easy'
            ? 'bg-success/10 text-success'
            : quiz.difficulty === 'medium'
              ? 'bg-warning/10 text-warning'
              : 'bg-error/10 text-error'
        )}
      >
        {quiz.difficulty.charAt(0).toUpperCase() + quiz.difficulty.slice(1)}
      </span>
    )}
  </div>

  <h3 className="text-text-primary group-hover:text-accent-primary mb-2 line-clamp-2 text-base font-semibold leading-snug transition-colors md:text-lg">
    {quiz.title}
  </h3>

  {quiz.description && (
    <p className="text-text-secondary mb-4 line-clamp-2 text-sm leading-relaxed">{quiz.description}</p>
  )}

  <div className="text-text-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
    <span className="whitespace-nowrap">
      {formatCompactNumber(quiz.plays_count)} plays
    </span>
    <span className="whitespace-nowrap">{quiz.estimated_minutes} min</span>
    {quiz.avg_score != null && (
      <span className="whitespace-nowrap">{Math.round(quiz.avg_score)}%</span>
    )}
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/quiz/quiz-card.tsx
git commit -m "feat: redesign quiz card with image fallback and cleaner style"
```

---

## Phase 5: Quiz Flow

### Task 11: Redesign QuestionCard

**Files:**

- Modify: `src/components/quiz/question-card.tsx`

- [ ] **Step 1: Update container and sidebar**

Replace line 26:

```typescript
<article className="surface-panel mx-auto w-full max-w-4xl overflow-hidden p-6 md:p-8">
```

With:

```typescript
<article className="surface-panel mx-auto w-full max-w-4xl overflow-hidden p-5 md:p-8">
```

Replace lines 28-48:

```typescript
<aside className="border-border-subtle bg-bg-primary space-y-6 rounded-[1.75rem] border p-5">
  <div>
    <p className="text-text-muted text-[11px] font-semibold tracking-[0.24em] uppercase">
      Question
    </p>
    <p className="text-text-primary mt-2 text-4xl font-semibold">{questionNumber}</p>
    <p className="text-text-secondary mt-1 text-sm">of {totalQuestions}</p>
  </div>

  <div className="space-y-3">
    <div className="bg-bg-secondary h-2 overflow-hidden rounded-full">
      <div
        className="bg-accent-primary h-full rounded-full transition-all duration-300"
        style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
      />
    </div>
    <p className="text-text-muted text-xs tracking-[0.18em] uppercase">
      Editorial play mode
    </p>
  </div>
</aside>
```

With:

```typescript
<aside className="bg-bg-tertiary space-y-5 rounded-2xl p-5">
  <div>
    <span className="eyebrow">Question</span>
    <p className="font-display text-text-primary mt-2 text-4xl font-bold">{questionNumber}</p>
    <p className="text-text-secondary mt-1 text-sm">of {totalQuestions}</p>
  </div>

  <div className="space-y-2">
    <div className="bg-bg-secondary h-1 overflow-hidden rounded-full">
      <div
        className="bg-accent-primary h-full rounded-full transition-all duration-300"
        style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
      />
    </div>
    <span className="eyebrow">Editorial play mode</span>
  </div>
</aside>
```

- [ ] **Step 2: Update question text and options**

Replace lines 51-56:

```typescript
<div className="space-y-4">
  <p className="eyebrow">Current prompt</p>
  <h2 className="text-text-primary text-2xl leading-tight font-semibold md:text-4xl">
    {question.question}
  </h2>
</div>
```

With:

```typescript
<div className="space-y-3">
  <span className="eyebrow">Current prompt</span>
  <h2 className="text-text-primary text-xl leading-snug font-semibold md:text-3xl">
    {question.question}
  </h2>
</div>
```

Replace lines 70-98:

```typescript
<div className="grid gap-3">
  {question.options.map((option, index) => (
    <button
      key={option.id}
      onClick={() => !disabled && onSelectOption(option.id)}
      disabled={disabled}
      className={cn(
        'group rounded-[1.5rem] border px-5 py-5 text-left transition-all duration-200',
        'focus:ring-accent-primary focus:ring-offset-bg-primary focus:ring-2 focus:ring-offset-2 focus:outline-none',
        disabled && 'cursor-not-allowed opacity-50',
        selectedOptionId === option.id
          ? 'border-accent-primary bg-accent-primary/10 text-text-primary shadow-card'
          : 'border-border-subtle bg-bg-secondary text-text-secondary hover:border-accent-primary/35 hover:bg-bg-primary hover:-translate-y-0.5'
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors',
            selectedOptionId === option.id
              ? 'border-accent-primary bg-accent-primary text-white'
              : 'border-border-subtle bg-bg-primary text-text-muted group-hover:text-text-primary'
          )}
        >
          {String.fromCharCode(65 + index)}
        </div>
        <p className="text-base leading-7 font-medium">{option.text}</p>
      </div>
    </button>
  ))}
</div>
```

With:

```typescript
<div className="grid gap-2.5">
  {question.options.map((option, index) => (
    <button
      key={option.id}
      onClick={() => !disabled && onSelectOption(option.id)}
      disabled={disabled}
      className={cn(
        'group rounded-xl border px-4 py-4 text-left transition-all duration-200',
        'focus-visible:ring-accent-primary focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        disabled && 'cursor-not-allowed opacity-50',
        selectedOptionId === option.id
          ? 'border-accent-primary bg-bg-primary text-text-primary'
          : 'border-border-subtle bg-bg-tertiary text-text-secondary hover:border-border-hover hover:bg-bg-secondary'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors',
            selectedOptionId === option.id
              ? 'border-accent-primary bg-accent-primary text-white'
              : 'border-border-subtle bg-bg-secondary text-text-muted group-hover:text-text-primary'
          )}
        >
          {String.fromCharCode(65 + index)}
        </div>
        <p className="text-base font-medium leading-relaxed">{option.text}</p>
      </div>
    </button>
  ))}
</div>
```

- [ ] **Step 3: Update explanation box**

Replace lines 101-108:

```typescript
<div className="border-border-subtle bg-bg-primary rounded-[1.75rem] border p-5">
  <h3 className="text-text-muted text-[11px] font-semibold tracking-[0.2em] uppercase">
    Explanation
  </h3>
  <p className="text-text-secondary mt-3 text-sm leading-6">{question.explanation}</p>
</div>
```

With:

```typescript
<div className="bg-bg-tertiary rounded-2xl p-5">
  <span className="eyebrow">Explanation</span>
  <p className="text-text-secondary mt-3 text-sm leading-relaxed">{question.explanation}</p>
</div>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/quiz/question-card.tsx
git commit -m "feat: redesign question card with solid colors and cleaner options"
```

---

### Task 12: Redesign ResultScreen

**Files:**

- Modify: `src/components/quiz/result-screen.tsx`

- [ ] **Step 1: Remove gradient backgrounds**

Replace lines 114-116:

```typescript
<div className="relative min-h-screen overflow-hidden px-4 py-12">
  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(181,94,44,0.12),transparent_42%),linear-gradient(180deg,rgba(246,239,229,0.8),rgba(236,228,216,0.92))]" />
  <div className="absolute inset-0 [background-image:linear-gradient(rgba(24,20,16,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(24,20,16,0.05)_1px,transparent_1px)] [background-size:48px_48px] opacity-40" />
```

With:

```typescript
<div className="relative min-h-screen px-4 py-12">
```

- [ ] **Step 2: Update result typography**

Replace lines 120-131:

```typescript
<section className="surface-panel p-8 md:p-10">
  <p className="eyebrow">{copy.eyebrow}</p>
  <motion.h1
    initial={{ y: 16, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    className="text-text-primary mt-5 text-4xl font-semibold tracking-tight md:text-6xl"
  >
    {result?.title || scoreMessage}
  </motion.h1>
  <p className="text-text-secondary mt-5 max-w-2xl text-lg leading-8">
    {result?.description || copy.fallbackBody}
  </p>
```

With:

```typescript
<section className="surface-panel p-6 md:p-10">
  <span className="eyebrow">{copy.eyebrow}</span>
  <motion.h1
    initial={{ y: 16, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    className="font-display text-text-primary mt-5 text-3xl font-bold tracking-tight md:text-5xl"
  >
    {result?.title || scoreMessage}
  </motion.h1>
  <p className="text-text-secondary mt-5 max-w-2xl text-lg leading-relaxed">
    {result?.description || copy.fallbackBody}
  </p>
```

- [ ] **Step 3: Update score display**

Replace lines 142-156:

```typescript
{triviaScore && (
  <div className="border-border-subtle bg-bg-primary mt-8 rounded-[2rem] border p-6">
    <p className="text-text-muted text-[11px] font-semibold tracking-[0.2em] uppercase">
      {copy.scoreline}
    </p>
    <div className="mt-4 flex flex-wrap items-end gap-4">
      <p className="text-text-primary text-6xl font-semibold">
        {triviaScore.percentage}%
      </p>
      <p className="text-text-muted pb-2 text-sm tracking-[0.18em] uppercase">
        {triviaScore.correct}/{triviaScore.total} {copy.correct}
      </p>
    </div>
  </div>
)}
```

With:

```typescript
{triviaScore && (
  <div className="bg-bg-tertiary mt-8 rounded-2xl p-6">
    <span className="eyebrow">{copy.scoreline}</span>
    <div className="mt-4 flex flex-wrap items-end gap-4">
      <p className="font-display text-accent-primary text-5xl font-bold md:text-7xl">
        {triviaScore.percentage}%
      </p>
      <p className="text-text-muted pb-2 text-sm tracking-wider uppercase">
        {triviaScore.correct}/{triviaScore.total} {copy.correct}
      </p>
    </div>
  </div>
)}
```

- [ ] **Step 4: Update buttons**

Replace lines 158-179:

```typescript
<div className="mt-8 flex flex-col gap-3 sm:flex-row">
  <button
    type="button"
    onClick={() => setShowShare(true)}
    className="bg-accent-primary hover:bg-accent-hover inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white transition-colors"
  >
    {uiLocale === 'es' ? 'Compartir resultado' : 'Share result'}
  </button>
  ...
</div>
```

With:

```typescript
<div className="mt-8 flex flex-col gap-3 sm:flex-row">
  <button
    type="button"
    onClick={() => setShowShare(true)}
    className="bg-accent-primary hover:bg-accent-hover inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white transition-colors"
  >
    {uiLocale === 'es' ? 'Compartir resultado' : 'Share result'}
  </button>
  <button
    type="button"
    onClick={onPlayAgain || (() => window.location.reload())}
    className="border-border-subtle text-text-primary hover:border-border-hover inline-flex items-center justify-center rounded-full border px-6 py-3 text-sm font-semibold transition-colors"
  >
    {uiLocale === 'es' ? 'Jugar de nuevo' : 'Play again'}
  </button>
  <Link
    href={localizeHref(uiLocale, '/quiz')}
    className="text-text-secondary hover:text-text-primary inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-colors"
  >
    {uiLocale === 'es' ? 'Explorar más' : 'Explore more'}
  </Link>
</div>
```

- [ ] **Step 5: Update session snapshot card**

Replace lines 183-194:

```typescript
<div className="surface-card p-6">
  <p className="kicker">{copy.sessionSnapshot}</p>
  <h2 className="font-display text-text-primary mt-3 text-3xl">{quiz.title}</h2>
  <p className="text-text-secondary mt-3 text-sm leading-6">
    {getLocalizedTypeLabel(quiz.quiz_type, uiLocale)} · {quiz.estimated_minutes} min ·{' '}
    {getLocalizedLanguageLabel(quiz.language, uiLocale)}
  </p>
</div>
```

With:

```typescript
<div className="surface-card p-6">
  <span className="eyebrow">{copy.sessionSnapshot}</span>
  <h2 className="font-display text-text-primary mt-3 text-2xl font-bold md:text-3xl">{quiz.title}</h2>
  <p className="text-text-secondary mt-3 text-sm leading-relaxed">
    {getLocalizedTypeLabel(quiz.quiz_type, uiLocale)} · {quiz.estimated_minutes} min ·{' '}
    {getLocalizedLanguageLabel(quiz.language, uiLocale)}
  </p>
</div>
```

- [ ] **Step 6: Update review section**

Replace lines 196-211:

```typescript
<div className="surface-card p-6">
  <div className="flex items-center justify-between gap-4">
    <div>
      <p className="kicker">{copy.review}</p>
      <h3 className="font-display text-text-primary mt-2 text-2xl">
        {copy.answerTrail}
      </h3>
    </div>
    <button
      type="button"
      onClick={onReview || (() => {})}
      className="border-border-subtle text-text-primary rounded-full border px-4 py-2 text-xs font-semibold tracking-[0.16em] uppercase"
    >
      {showReview ? copy.hideReview : copy.showReview}
    </button>
  </div>
```

With:

```typescript
<div className="surface-card p-6">
  <div className="flex items-center justify-between gap-4">
    <div>
      <span className="eyebrow">{copy.review}</span>
      <h3 className="font-display text-text-primary mt-2 text-xl font-bold md:text-2xl">
        {copy.answerTrail}
      </h3>
    </div>
    <button
      type="button"
      onClick={onReview || (() => {})}
      className="border-border-subtle text-text-primary hover:border-border-hover rounded-full border px-4 py-2 text-xs font-semibold tracking-wider uppercase transition-colors"
    >
      {showReview ? copy.hideReview : copy.showReview}
    </button>
  </div>
```

- [ ] **Step 7: Update review items**

Replace lines 231-256:

```typescript
<div
  key={answer.question_id}
  className={cn(
    'rounded-[1.5rem] border p-4',
    answer.is_correct
      ? 'border-success/30 bg-success/10'
      : 'border-border-subtle bg-bg-primary'
  )}
>
  <p className="text-text-muted text-[11px] font-semibold tracking-[0.18em] uppercase">
    {copy.question} {index + 1}
  </p>
  <p className="text-text-primary mt-2 text-sm font-medium">
    {question?.question}
  </p>
  <p className="text-text-secondary mt-3 text-sm">
    {copy.yourAnswer}: {selectedOption?.text || copy.skipped}
  </p>
  {!answer.is_correct && correctOption && (
    <p className="text-success mt-2 text-sm">
      {uiLocale === 'es' ? 'Correcta' : 'Correct'}: {correctOption.text}
    </p>
  )}
</div>
```

With:

```typescript
<div
  key={answer.question_id}
  className={cn(
    'rounded-xl border p-4',
    answer.is_correct
      ? 'border-success/20 bg-success/5'
      : 'border-border-subtle bg-bg-tertiary'
  )}
>
  <span className="eyebrow">
    {copy.question} {index + 1}
  </span>
  <p className="text-text-primary mt-2 text-sm font-medium leading-relaxed">
    {question?.question}
  </p>
  <p className="text-text-secondary mt-3 text-sm">
    {copy.yourAnswer}: {selectedOption?.text || copy.skipped}
  </p>
  {!answer.is_correct && correctOption && (
    <p className="text-success mt-2 text-sm font-medium">
      {uiLocale === 'es' ? 'Correcta' : 'Correct'}: {correctOption.text}
    </p>
  )}
</div>
```

- [ ] **Step 8: Update share modal**

Replace lines 279-280:

```typescript
className = 'surface-card w-full max-w-md p-6';
```

With:

```typescript
className = 'surface-card w-full max-w-md p-6 shadow-lg';
```

- [ ] **Step 9: Commit**

```bash
git add src/components/quiz/result-screen.tsx
git commit -m "feat: redesign result screen with solid colors and editorial typography"
```

---

## Phase 6: Explore & Footer

### Task 13: Update Footer

**Files:**

- Modify: `src/components/layout/footer.tsx`

- [ ] **Step 1: Read current footer and simplify**

Read the file first, then simplify to minimal editorial style:

- Background: `bg-primary`
- Border-top: `border-subtle`
- Links: `text-secondary`, hover `text-primary`
- Remove any decorative elements

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/footer.tsx
git commit -m "feat: simplify footer with editorial curated style"
```

---

## Phase 7: Verification

### Task 14: Type check and final review

**Files:**

- All modified files

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Final commit**

```bash
git commit -m "chore: verify redesign build and types"
```

---

## Self-Review Checklist

- [x] Spec coverage: All 14 files from spec are covered in tasks 1-13.
- [x] No placeholders: Every step has exact code, no "TBD" or "implement later".
- [x] Type consistency: `QuizImage` props match usage in EditorialQuizCard and QuizCard.
- [x] CSS variables: All new variables defined in `:root` and referenced in components.
- [x] Mobile-first: All layouts use responsive prefixes correctly.
- [x] Accessibility: Focus rings, alt text, semantic HTML preserved.
