'use client';

/**
 * Embed code generator for /[locale]/widget.
 *
 * Search the published catalog (debounced against the public /api/quizzes
 * contract), preview the frameable player and copy a ready-to-paste snippet:
 * the iframe plus a plain attribution link back to the quiz page.
 */

import * as React from 'react';
import type { Locale } from '@/lib/i18n/dictionaries';
import { formatMessage } from '@/lib/i18n/format';
import { copyText } from '@/lib/utils/clipboard';
import { buildEmbedSnippet } from '@/lib/seo/embed';
import { SITE_URL } from '@/lib/seo/site';
import { quizPath } from '@/lib/seo/structured-data';

export interface EmbedBuilderLabels {
  searchLabel: string;
  searchPlaceholder: string;
  searching: string;
  noResults: string;
  searchError: string;
  pickQuiz: string;
  changeQuiz: string;
  previewLabel: string;
  /** Plantilla con `{title}` para el `title` accesible del iframe de vista previa. */
  previewIframeTitle: string;
  heightLabel: string;
  codeLabel: string;
  copyCode: string;
  copied: string;
  copyFailed: string;
}

interface QuizOption {
  slug: string;
  title: string;
  questionCount: number;
  quizType: string;
}

const HEIGHTS = [560, 720, 900] as const;
// El máximo del contrato público: sin paginación en la UI, pedir la primera
// página completa evita que un match por título quede enterrado tras cinco
// matches por descripción con más partidas.
const RESULT_LIMIT = 50;
const DEBOUNCE_MS = 300;
// `/api/quizzes` acota `q` a 60 caracteres: un título más largo se recorta
// aquí para que siga coincidiendo por prefijo en vez de responder 400.
const QUERY_MAX = 60;

export function EmbedBuilder({ locale, labels }: { locale: Locale; labels: EmbedBuilderLabels }) {
  // En SSR cae a SITE_URL; en el navegador usa el origen real para que las
  // previews de Workers Builds generen snippets contra su propio dominio.
  // El valor solo se pinta tras elegir un quiz, así que no hay mismatch de hidratación.
  const [origin] = React.useState(() =>
    typeof window === 'undefined' ? SITE_URL : window.location.origin
  );
  const [query, setQuery] = React.useState('');
  const [items, setItems] = React.useState<QuizOption[]>([]);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [selected, setSelected] = React.useState<QuizOption | null>(null);
  const [height, setHeight] = React.useState<number>(720);
  const [copied, setCopied] = React.useState(false);
  const [copyFailed, setCopyFailed] = React.useState(false);

  const inputId = React.useId();
  const listboxId = React.useId();
  const abortRef = React.useRef<AbortController | null>(null);

  const runSearch = React.useCallback(
    async (term: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const params = new URLSearchParams({
          locale,
          limit: String(RESULT_LIMIT),
          page: '1',
        });
        if (term) params.set('q', term.slice(0, QUERY_MAX));
        const res = await fetch(`/api/quizzes?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`quizzes ${res.status}`);
        const data = (await res.json()) as { items?: QuizOption[] };
        setItems(Array.isArray(data.items) ? data.items : []);
        setFailed(false);
        setOpen(true);
        setActive(-1);
      } catch {
        if (!controller.signal.aborted) {
          setItems([]);
          setFailed(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [locale]
  );

  // Carga inicial (sugerencias sin término) + debounce sobre lo que se escribe.
  React.useEffect(() => {
    const term = query.trim();
    const timer = window.setTimeout(
      () => void runSearch(term.length >= 2 ? term : ''),
      query === '' ? 0 : DEBOUNCE_MS
    );
    return () => window.clearTimeout(timer);
  }, [query, runSearch]);

  const pick = (item: QuizOption) => {
    setSelected(item);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActive((index) =>
        event.key === 'ArrowDown' ? Math.min(index + 1, items.length - 1) : Math.max(index - 1, -1)
      );
    } else if (event.key === 'Enter' && open && active >= 0 && items[active]) {
      event.preventDefault();
      pick(items[active]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  };

  const embed = React.useMemo(() => {
    if (!selected) return null;
    const canonicalUrl = `${origin}${quizPath(locale, selected.slug)}`;
    return buildEmbedSnippet(canonicalUrl, locale, selected.title, height);
  }, [origin, locale, selected, height]);

  const handleCopy = async () => {
    if (!embed) return;
    if (await copyText(embed.snippet)) {
      setCopied(true);
      setCopyFailed(false);
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      setCopied(false);
      setCopyFailed(true);
    }
  };

  const status = loading
    ? labels.searching
    : failed
      ? labels.searchError
      : open && items.length === 0
        ? labels.noResults
        : null;

  return (
    <div className="space-y-6">
      <div className="relative">
        <label htmlFor={inputId} className="text-sm font-semibold text-[var(--text-primary)]">
          {labels.searchLabel}
        </label>
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={active >= 0 ? `${listboxId}-option-${active}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          value={query}
          placeholder={labels.searchPlaceholder}
          onChange={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={onKeyDown}
          onFocus={() => items.length > 0 && setOpen(true)}
          onBlur={() => setOpen(false)}
          className="mt-2 w-full rounded-lg border border-[#474558] bg-transparent px-4 py-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent-primary)] focus:outline-none"
        />
        <p
          role="status"
          aria-live="polite"
          className="mt-2 min-h-5 text-sm text-[var(--text-secondary)]"
        >
          {status}
        </p>
        {open && items.length > 0 && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label={labels.searchLabel}
            className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-[#474558] bg-[var(--bg-secondary)] shadow-lg"
          >
            {items.map((item, index) => (
              <li
                key={item.slug}
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(item);
                }}
                onMouseEnter={() => setActive(index)}
                className={`cursor-pointer px-4 py-3 text-sm ${
                  index === active
                    ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                {item.title}
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && embed ? (
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {labels.previewLabel}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setCopied(false);
                  setCopyFailed(false);
                }}
                className="text-xs font-semibold text-[var(--accent-primary)] hover:underline"
              >
                {labels.changeQuiz}
              </button>
            </div>
            <iframe
              src={embed.embedUrl}
              title={formatMessage(labels.previewIframeTitle, { title: selected.title })}
              loading="lazy"
              className="mt-2 w-full rounded-xl border border-[#474558]"
              style={{ height: `${height}px` }}
            />
          </div>

          <div>
            <label
              htmlFor={`${inputId}-height`}
              className="text-sm font-semibold text-[var(--text-primary)]"
            >
              {labels.heightLabel}
            </label>
            <select
              id={`${inputId}-height`}
              value={height}
              onChange={(event) => setHeight(Number(event.currentTarget.value))}
              className="mt-2 w-full rounded-lg border border-[#474558] bg-[var(--bg-secondary)] px-4 py-3 text-base text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none sm:w-40"
            >
              {HEIGHTS.map((value) => (
                <option key={value} value={value}>
                  {value} px
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor={`${inputId}-code`}
              className="text-sm font-semibold text-[var(--text-primary)]"
            >
              {labels.codeLabel}
            </label>
            <textarea
              id={`${inputId}-code`}
              readOnly
              value={embed.snippet}
              rows={5}
              onFocus={(event) => event.currentTarget.select()}
              className="mt-2 w-full rounded-lg border border-[#474558] bg-transparent px-4 py-3 font-mono text-xs leading-5 text-[var(--text-primary)]"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="arcade-button mt-3 inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold"
            >
              {copied ? labels.copied : labels.copyCode}
            </button>
            {copyFailed && (
              <p role="alert" className="mt-2 text-sm text-[var(--text-secondary)]">
                {labels.copyFailed}
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--text-secondary)]">{labels.pickQuiz}</p>
      )}
    </div>
  );
}

export default EmbedBuilder;
