'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { copyText } from '@/lib/utils/clipboard';
import { incrementShares, markSessionShared } from '@/actions/quiz.actions';
import { trackEvent } from '@/lib/telemetry/client';
import { shareText, urlWithVia, type ShareChannel, type ShareContext } from '@/lib/share/messages';

import type { Locale } from '@/lib/i18n/dictionaries';

interface ShareButtonsProps {
  title: string;
  url: string;
  /**
   * Texto de respaldo cuando no se pasa `context` (p. ej. perfiles). Si hay
   * `context`, el mensaje lo arma `shareText` según tipo de quiz e idioma.
   */
  text: string;
  locale?: Locale;
  /** Contexto del quiz para construir el mensaje con gancho. */
  context?: ShareContext;
  /** When set, each real share bumps the quiz `shares_count` counter. */
  quizId?: string;
  /** Token de la sesión propia: cada share marca la partida como compartida. */
  shareToken?: string;
}

export function ShareButtons({
  title,
  url,
  text,
  locale = 'en',
  context,
  quizId,
  shareToken,
}: ShareButtonsProps) {
  const [copied, setCopied] = React.useState(false);
  const [copyFailed, setCopyFailed] = React.useState(false);
  const [supportsWebShare, setSupportsWebShare] = React.useState(false);
  const isEs = locale === 'es';

  React.useEffect(() => {
    queueMicrotask(() => setSupportsWebShare('share' in navigator));
  }, []);

  // Best effort: sharing must never break the UI.
  const trackShare = (channel: ShareChannel) => {
    if (quizId) void incrementShares(quizId).catch(() => undefined);
    if (shareToken) void markSessionShared(shareToken).catch(() => undefined);
    // Solo el path: los tokens de sesión (`s`, `challenge`) no van a los logs.
    void trackEvent({
      name: 'share_click',
      locale,
      path: url.split(/[?#]/, 1)[0],
      source: channel,
    });
  };

  const message = (channel: ShareChannel) => (context ? shareText(context, locale, channel) : text);
  const urlFor = (channel: ShareChannel) => urlWithVia(url, channel);

  const handleCopy = async () => {
    const copyUrl = urlFor('copy');
    if (await copyText(copyUrl)) {
      setCopied(true);
      setCopyFailed(false);
      trackShare('copy');
      setTimeout(() => setCopied(false), 2000);
    } else {
      setCopied(false);
      setCopyFailed(true);
    }
  };

  const handleWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: message('native'),
          url: urlFor('native'),
        });
        trackShare('native');
      } catch (err) {
        console.error('Share failed:', err);
      }
    }
  };

  const shareLinks = {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${message('whatsapp')} ${urlFor('whatsapp')}`)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(message('x'))}&url=${encodeURIComponent(urlFor('x'))}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(urlFor('telegram'))}&text=${encodeURIComponent(message('telegram'))}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(urlFor('facebook'))}`,
  };

  return (
    <div className="space-y-3">
      {/* Web Share API (mobile) */}
      {supportsWebShare && (
        <Button
          variant="primary"
          size="lg"
          className="w-full font-semibold"
          onClick={handleWebShare}
          leftIcon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
          }
        >
          {isEs ? 'Compartir' : 'Share'}
        </Button>
      )}

      {/* Platform buttons: WhatsApp primero (canal principal en español) */}
      <div className="grid grid-cols-4 gap-3">
        {/* WhatsApp */}
        <a
          href={shareLinks.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackShare('whatsapp')}
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg py-3 font-semibold',
            'bg-[#0B7A4F] text-white transition-colors hover:bg-[#096a44]'
          )}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
          </svg>
          <span className="sr-only sm:not-sr-only sm:text-sm">WhatsApp</span>
        </a>

        {/* X (Twitter) */}
        <a
          href={shareLinks.x}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackShare('x')}
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg py-3 font-semibold',
            'bg-black text-white transition-colors hover:bg-gray-800'
          )}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          <span className="sr-only sm:not-sr-only sm:text-sm">X</span>
        </a>

        {/* Telegram */}
        <a
          href={shareLinks.telegram}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackShare('telegram')}
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg py-3 font-semibold',
            'bg-[#229ED9] text-white transition-colors hover:bg-[#1e8fc4]'
          )}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
          </svg>
          <span className="sr-only sm:not-sr-only sm:text-sm">Telegram</span>
        </a>

        {/* Facebook */}
        <a
          href={shareLinks.facebook}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackShare('facebook')}
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg py-3 font-semibold',
            'bg-[#0C5AC7] text-white transition-colors hover:bg-[#0a50b2]'
          )}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          <span className="sr-only sm:not-sr-only sm:text-sm">Facebook</span>
        </a>
      </div>

      {/* Copy link */}
      <Button
        variant="secondary"
        size="lg"
        className="w-full font-semibold"
        onClick={handleCopy}
        leftIcon={
          copied ? (
            <svg
              className="text-success h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          )
        }
      >
        {copied ? (isEs ? '¡Copiado!' : 'Copied!') : isEs ? 'Copiar enlace' : 'Copy link'}
      </Button>

      {copyFailed && (
        <div role="status" aria-live="polite" className="space-y-1">
          <p className="text-sm text-[var(--text-secondary)]">
            {isEs ? 'No pudimos copiar: selecciona el enlace' : "Couldn't copy: select the link"}
          </p>
          <input
            readOnly
            value={urlFor('copy')}
            onFocus={(event) => event.currentTarget.select()}
            className="w-full rounded-lg border border-[#474558] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)]"
          />
        </div>
      )}
    </div>
  );
}
