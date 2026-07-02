# QuizVerse Frontend Redesign — Spec

**Date:** 2026-05-26
**Status:** Approved by user
**Direction:** Editorial Curated (Editorial Premium + Pop Culture Curated)

---

## 1. Objective

Redesign the QuizVerse frontend to fix visual errors (broken images, misalignment, inconsistent spacing, typography hierarchy issues) and establish a cohesive, distinctive visual identity that feels editorial and curated — not generic AI slop.

**Target:** Mobile-first (390px), then tablet (768px), then desktop (1024px+).

---

## 2. Design Principles

1. **Typography-first:** Let type create hierarchy, not decoration.
2. **Color with purpose:** Solid color blocks, not gradients. Every color has a job.
3. **Generous whitespace:** Editorial breathing room. No cramped layouts.
4. **Consistent rhythm:** 8px base grid. 3 border-radius values only.
5. **No glassmorphism:** Solid or subtly opaque backgrounds only.
6. **No gradient text:** Solid colors for readability.

---

## 3. Visual Identity

### 3.1 Color Palette

| Token              | Hex                       | Usage                                   |
| ------------------ | ------------------------- | --------------------------------------- |
| `bg-primary`       | `#faf8f5`                 | Page background (warm cream)            |
| `bg-secondary`     | `#ffffff`                 | Cards, panels                           |
| `bg-tertiary`      | `#f0ebe4`                 | Subtle backgrounds, tags, hover states  |
| `text-primary`     | `#1a1a1a`                 | Headings, primary text                  |
| `text-secondary`   | `#5a5448`                 | Body text, descriptions                 |
| `text-muted`       | `#8a8279`                 | Metadata, captions, eyebrows            |
| `accent-primary`   | `#c4704a`                 | CTAs, links, active states (terracotta) |
| `accent-hover`     | `#a85d3a`                 | Hover state for accent                  |
| `accent-secondary` | `#2b4c7e`                 | Cobalt blocks, category indicators      |
| `accent-tertiary`  | `#d4a843`                 | Mustard highlights, featured badges     |
| `border-subtle`    | `rgba(26, 26, 26, 0.08)`  | Card borders, dividers                  |
| `border-hover`     | `rgba(196, 112, 74, 0.3)` | Hover borders                           |

**Dark theme (optional future):** Not in scope for this redesign. Keep existing dark theme CSS but do not prioritize it.

### 3.2 Typography

| Role            | Font             | Weight | Size (mobile → desktop) | Line Height |
| --------------- | ---------------- | ------ | ----------------------- | ----------- |
| H1 (Hero)       | Playfair Display | 700    | 32px → 48px → 64px      | 1.05        |
| H2 (Section)    | Playfair Display | 700    | 28px → 36px → 40px      | 1.1         |
| H3 (Card title) | Inter            | 600    | 16px → 18px → 20px      | 1.25        |
| Body            | Inter            | 400    | 15px → 16px             | 1.6         |
| Eyebrow         | Inter            | 700    | 10px → 11px             | 1.2         |
| Caption/Stats   | Inter            | 500    | 10px → 11px             | 1.2         |
| Button          | Inter            | 600    | 13px → 14px             | 1           |

**Tracking:** Eyebrows and stats use `letter-spacing: 0.15em` uppercase.

### 3.3 Spacing System

Base unit: 8px

| Token     | Value | Usage                                |
| --------- | ----- | ------------------------------------ |
| `space-1` | 4px   | Tight gaps (icon + text)             |
| `space-2` | 8px   | Inline spacing                       |
| `space-3` | 16px  | Card padding (mobile)                |
| `space-4` | 24px  | Card padding (desktop), section gaps |
| `space-5` | 32px  | Section margins                      |
| `space-6` | 48px  | Large section margins                |
| `space-7` | 64px  | Hero spacing                         |

### 3.4 Border Radius

| Token         | Value  | Usage                         |
| ------------- | ------ | ----------------------------- |
| `radius-sm`   | 8px    | Buttons, tags, small elements |
| `radius-md`   | 16px   | Cards                         |
| `radius-lg`   | 24px   | Panels, hero containers       |
| `radius-full` | 9999px | Pills, avatars                |

---

## 4. Component Specifications

### 4.1 Navigation (`FloatingNav`)

- **Desktop:** Transparent background. Logo left, links center, actions right. On scroll: add `border-bottom: 1px solid border-subtle` and `background: rgba(250, 248, 245, 0.95)` with `backdrop-filter: blur(8px)` (subtle, not glassmorphism).
- **Mobile:** Hidden. Replaced by `MobileNav`.
- **Links:** Inter 500, 14px, `text-secondary`. Hover: `text-primary` + `bg-tertiary` background.
- **CTA Button:** `accent-primary` background, white text, `radius-full`, padding 12px 24px.

### 4.2 Mobile Navigation (`MobileNav`)

- Fixed bottom, z-50.
- Background: `bg-secondary` with `border-top: 1px solid border-subtle`.
- 5 items: Home, Explore, Create, Leaderboard, Profile.
- Icon + label stacked. Active: `accent-primary` color. Inactive: `text-muted`.
- Height: 64px + safe area inset.
- **Fix:** Ensure `main` has `padding-bottom: 80px` on mobile so content isn't hidden.

### 4.3 Hero Section

- **Layout:** Single column on mobile. Two columns on desktop (text left 55%, lead card right 45%).
- **Kicker:** Eyebrow style. Small dot (`accent-primary`, 6px circle) + uppercase text.
- **H1:** Playfair Display, bold. The word "editorial" or accent word in `accent-primary` color (solid, not gradient).
- **Subtitle:** Inter, `text-secondary`, max-width 55ch, `text-wrap: balance`.
- **CTAs:** Primary (filled, `accent-primary`) + Secondary (outlined, `border-subtle`). Both `radius-full`.
- **No particles:** Remove floating particles animation. Clean, static background.

### 4.4 Editorial Quiz Card

**Hero size (lead card):**

- Aspect ratio: 16/10 for image.
- Image fallback: `bg-tertiary` background with centered emoji (48px) or quiz type icon.
- Title: Playfair Display, 24px → 32px, `text-primary`.
- Description: Inter, 14px, `text-secondary`, max 3 lines (`line-clamp-3`).
- Tags: Pills with `bg-tertiary`, `text-secondary`, `radius-full`, 10px uppercase.
- Stats row: Border-top `border-subtle`, flex row, `text-muted`, 11px uppercase.
- Hover: `translateY(-4px)`, `shadow-md`, border `border-hover`.

**Compact size:**

- Aspect ratio: 16/9 for image.
- Title: Inter, 16px → 18px, weight 600.
- No description (saves space, prevents overflow).
- Max 2 tags.
- Stats: Simplified (time + plays only).

**Feature size (medium):**

- Aspect ratio: 16/10.
- Title: Inter, 20px → 24px.
- Description: 14px, max 2 lines.
- Max 3 tags.

### 4.5 Category Cards

- Background: `bg-secondary`.
- Border: `1px solid border-subtle`, `radius-md`.
- Small color block (16x16px, `radius-sm`) in `accent-secondary` or category-specific color.
- Title: Inter, 20px → 24px, weight 600.
- Description: Inter, 14px, `text-secondary`.
- Hover: `translateY(-2px)`, border `border-hover`.

### 4.6 Stats Panels (Momentum / Discovery)

- Background: `bg-secondary`.
- Border: `1px solid border-subtle`, `radius-lg`.
- Eyebrow: 11px uppercase, `text-muted`.
- Number: Playfair Display, 32px → 40px, `text-primary`.
- Description: Inter, 14px, `text-secondary`.

### 4.7 Question Card (Play Flow)

- Background: `bg-secondary`, `radius-lg`.
- Border: `1px solid border-subtle`.
- Question number panel: `bg-tertiary`, `radius-md`.
- Progress bar: `bg-tertiary` track, `accent-primary` fill, height 4px, `radius-full`.
- Question text: Inter, 20px → 28px, weight 600, `text-primary`.
- Options: `bg-tertiary` background, `radius-md`, border `border-subtle`.
  - Hover: `bg-secondary`, border `border-hover`.
  - Selected: `accent-primary` border, `bg-primary` background, option circle filled with `accent-primary`.
- Option circle: 40x40px, border `border-subtle`, `radius-full`. Letter centered.

### 4.8 Result Screen

- Background: `bg-primary` (no gradient overlay).
- Result title: Playfair Display, 36px → 48px, `text-primary`.
- Score: Playfair Display, 64px → 80px, `accent-primary`.
- Metric cards: `bg-secondary`, `radius-md`, border `border-subtle`.
- Share modal: `bg-secondary`, `radius-lg`, shadow `0 8px 32px rgba(0,0,0,0.12)`.

### 4.9 Footer

- Background: `bg-primary`.
- Border-top: `1px solid border-subtle`.
- Minimal: Logo, links, copyright.
- Links: Inter, 14px, `text-secondary`. Hover: `text-primary`.

---

## 5. Layout Specifications

### 5.1 Home Page Grid

**Mobile (390px - 767px):**

- Single column.
- Hero: full width, padding 16px.
- Lead card: full width.
- Category cards: stacked, full width.
- Stats panels: stacked, full width.
- Editorial picks: stacked. List items full width.
- Quiz sections: stacked. Lead card full width, rest 2-column grid.

**Tablet (768px - 1023px):**

- Hero: single column still, but max-width 720px centered.
- Category cards: 3-column grid.
- Stats panels: 2-column grid.
- Editorial picks: 2-column grid (text left, cards right).
- Quiz sections: lead card full width, rest 3-column grid.

**Desktop (1024px+):**

- Hero: 2-column grid (55% text, 45% lead card).
- Category cards: 3-column grid.
- Stats panels: 2-column grid, aligned with lead card.
- Editorial picks: 2-column grid (0.4fr text, 0.6fr cards).
- Quiz sections: lead card 50%, rest 4-column grid.
- Max container width: 1200px, centered.

### 5.2 Explore Page

- Search bar: full width, `bg-secondary`, `radius-full`, border `border-subtle`.
- Category filters: horizontal scroll on mobile, flex wrap on desktop.
- Quiz grid: 1 column (mobile), 2 columns (tablet), 3 columns (desktop), 4 columns (1280px+).
- Gap: 16px (mobile), 24px (desktop).

### 5.3 Quiz Detail Page

- Cover image: full width, aspect 16/9, `radius-lg`.
- Title: Playfair Display, 32px → 48px.
- Meta row: tags + stats, flex wrap.
- Start button: full width on mobile, auto on desktop. `accent-primary`, `radius-full`.

---

## 6. Technical Fixes

### 6.1 Image Fallback System

**Problem:** Images return 404 or broken URLs.
**Solution:**

- All `<img>` tags must have `onError` handler that replaces the image with a fallback div.
- Fallback: `bg-tertiary` background, centered emoji based on quiz type:
  - Personality: `🎭`
  - Trivia: `🧠`
  - Default: `📊`
- Or use a procedural SVG placeholder with quiz title initials.

**Implementation:** Create a `QuizImage` component that wraps `<img>` with error handling.

### 6.2 CSS Custom Properties Cleanup

**Problem:** Too many CSS variables, some unused, some conflicting.
**Solution:**

- Reduce to the palette defined in section 3.1.
- Remove: `gradient-hero`, `gradient-card-hover`, `gradient-result-*`, `shadow-glow`, `surface-*` (replace with direct values).
- Keep only functional variables: colors, spacing, radius, shadows.

### 6.3 Alignment Fixes

**Problem:** Mixed use of `space-y`, `gap`, margins causing inconsistent spacing.
**Solution:**

- Use CSS Grid `gap` for all layouts. No `space-y` on grid containers.
- Cards must have consistent internal padding (16px mobile, 24px desktop).
- Text containers must have `min-w-0` to prevent overflow.
- Use `line-clamp` with explicit max-height fallback.

### 6.4 Typography Hierarchy

**Problem:** All text looks similar, no clear hierarchy.
**Solution:**

- Strictly enforce the type scale in section 3.2.
- Only Playfair Display for H1, H2. Inter for everything else.
- No font-size overrides in components outside the scale.

### 6.5 Mobile Nav Safe Area

**Problem:** Content hidden behind mobile nav.
**Solution:**

- `SiteShell` must add `padding-bottom: calc(64px + env(safe-area-inset-bottom))` to `<main>` on mobile.
- Mobile nav height: 64px fixed.

---

## 7. Animation & Motion

- **Reduced motion:** Respect `prefers-reduced-motion`.
- **Card hover:** `translateY(-4px)`, `box-shadow` increase, `border-color` change. Duration 200ms, ease `cubic-bezier(0.4, 0, 0.2, 1)`.
- **Page transitions:** Fade in, 300ms. No slide animations (can cause layout shift).
- **Stagger:** Max 50ms delay between cards. No more than 0.3s total stagger.
- **No floating particles.** No pulse glow. No shimmer on static content.

---

## 8. Accessibility

- All interactive elements must have visible focus ring (`2px solid accent-primary`, `2px offset`).
- Color contrast: minimum 4.5:1 for body text, 3:1 for large text.
- Images: meaningful `alt` text. Decorative images: `alt=""`.
- Buttons: never rely solely on color. Icons + text for nav.
- Form labels: explicit `<label>` associations.

---

## 9. Files to Modify

| File                                             | Changes                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `src/app/globals.css`                            | Complete rewrite of CSS variables, remove gradients/glassmorphism, add new utilities |
| `src/app/layout.tsx`                             | Update font imports (add Playfair Display), update metadata colors                   |
| `src/components/home/hero-section.tsx`           | Remove particles, simplify animation, adjust spacing                                 |
| `src/app/[locale]/page.tsx`                      | Update layout grids, spacing, typography classes                                     |
| `src/components/home/editorial-quiz-card.tsx`    | Update card styles, image fallback, typography                                       |
| `src/components/quiz/quiz-card.tsx`              | Update styles, image fallback                                                        |
| `src/components/layout/floating-nav.tsx`         | Simplify scroll behavior, update colors                                              |
| `src/components/layout/mobile-nav.tsx`           | Fix safe area, update colors                                                         |
| `src/components/layout/site-shell.tsx`           | Fix mobile padding                                                                   |
| `src/components/quiz/question-card.tsx`          | Update colors, spacing, option styles                                                |
| `src/components/quiz/result-screen.tsx`          | Update colors, remove gradient backgrounds                                           |
| `src/components/shared/quiz-cover-art.tsx`       | Add image error handling                                                             |
| `src/components/home/explore-editorial-page.tsx` | Update grid, search bar, filters                                                     |
| `src/components/layout/footer.tsx`               | Update colors, simplify                                                              |

---

## 10. Success Criteria

- [ ] No broken image icons visible anywhere. All images have solid-color fallback.
- [ ] Consistent 8px grid spacing throughout. No random margins.
- [ ] Typography hierarchy is immediately obvious: H1 > H2 > H3 > body > caption.
- [ ] Mobile (390px) shows hero, CTA, and first card without scrolling.
- [ ] All cards align perfectly in their grids. No uneven heights.
- [ ] No gradient text or backgrounds. Solid colors only.
- [ ] Mobile nav never covers content.
- [ ] Dark theme still functional (CSS variables preserved but not prioritized).
- [ ] `npx tsc --noEmit` passes.
- [ ] Lighthouse accessibility score ≥ 90.

---

## 11. Out of Scope

- Dark theme redesign (keep existing, functional).
- New pages or features.
- Backend changes.
- Animation system overhaul (keep Framer Motion, simplify).
- Ad component redesign (keep as-is).
