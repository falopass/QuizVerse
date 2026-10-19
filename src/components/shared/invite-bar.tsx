'use client';

/**
 * Invitation bar.
 *
 * The cheapest growth loop in a quiz product: hand someone a link that already
 * dares the recipient. Used on every quiz detail page, so it reads the URL from
 * the shared `url` prop and never assumes a locale prefix.
 */

import * as React from 'react';
import type { Locale } from '@/lib/i18n/dictionaries';
import { copyText } from '@/lib/utils/clipboard';
import { buildEmbedSnippet } from '@/lib/seo/embed';

export interface InviteBarProps {
  url: string;
  quizTitle: string;
  locale: Locale;
  labels: {
    invite: string;
    inviteBody: string;
    copyInvite: string;
    copied: string;
  };
}

export function InviteBar({ url, quizTitle, locale, labels }: InviteBarProps) {
  const [copied, setCopied] = React.useState(false);
  const [embedCopied, setEmbedCopied] = React.useState(false);
  const [copyError, setCopyError] = React.useState<string | null>(null);
  const es = locale === 'es';
  const embed = buildEmbedSnippet(url, locale, quizTitle);

  const challengeText = es
    ? `Reto: ¿puedes superar "${quizTitle}" en QuizVerse?`
    : `Challenge: can you beat "${quizTitle}" on QuizVerse?`;

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${challengeText} ${url}`)}`;
  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    challengeText
  )}&url=${encodeURIComponent(url)}`;

  const handleCopy = async () => {
    if (await copyText(url)) {
      setCopied(true);
      setCopyError(null);
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      setCopied(false);
      setCopyError(url);
    }
  };

  const handleCopyEmbed = async () => {
    if (!embed) return;
    if (await copyText(embed.snippet)) {
      setEmbedCopied(true);
      setCopyError(null);
      window.setTimeout(() => setEmbedCopied(false), 2000);
    } else {
      setEmbedCopied(false);
      setCopyError(embed.snippet);
    }
  };

  return (
    <div className="mt-6 border-t border-[#474558] pt-5">
      <p className="text-[11px] font-bold tracking-[0.16em] text-[var(--accent-primary)] uppercase">
        {labels.invite}
      </p>
      <p className="mt-2 max-w-sm text-sm text-[var(--text-secondary)]">{labels.inviteBody}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-[#25D366] px-4 py-2 text-xs font-bold tracking-[0.08em] text-[#101019] uppercase transition-opacity hover:opacity-90"
        >
          WhatsApp
        </a>
        <a
          href={xHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-[#474558] px-4 py-2 text-xs font-bold tracking-[0.08em] text-[var(--text-primary)] uppercase transition-colors hover:border-[var(--accent-primary)]"
        >
          X
        </a>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-full border border-[#474558] px-4 py-2 text-xs font-bold tracking-[0.08em] text-[var(--text-primary)] uppercase transition-colors hover:border-[var(--accent-primary)]"
        >
          {copied ? labels.copied : labels.copyInvite}
        </button>
        {embed ? (
          <button
            type="button"
            onClick={handleCopyEmbed}
            className="rounded-full border border-[#474558] px-4 py-2 text-xs font-bold tracking-[0.08em] text-[var(--text-primary)] uppercase transition-colors hover:border-[var(--accent-primary)]"
          >
            {embedCopied ? labels.copied : es ? 'Insertar' : 'Embed'}
          </button>
        ) : null}
      </div>
      {copyError !== null && (
        <div role="status" aria-live="polite" className="mt-3">
          <p className="text-xs text-[var(--text-secondary)]">
            {es ? 'No pudimos copiar: selecciona el enlace' : "Couldn't copy: select the link"}
          </p>
          <input
            readOnly
            value={copyError}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-1 w-full rounded-lg border border-[#474558] bg-transparent px-3 py-2 text-xs text-[var(--text-primary)]"
          />
        </div>
      )}
    </div>
  );
}

export default InviteBar;
