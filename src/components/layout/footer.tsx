import * as React from 'react';
import Link from 'next/link';
import type { Dictionary } from '@/lib/i18n/dictionaries';

export function Footer({ dictionary }: { dictionary: Dictionary }) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-border-subtle bg-bg-secondary/70 mt-auto w-full border-t">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-8 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="border-border-subtle bg-bg-primary text-accent-primary flex h-10 w-10 items-center justify-center rounded-full border text-sm font-black tracking-[0.2em] uppercase">
                QV
              </div>
              <span className="font-display text-text-primary text-lg font-semibold">
                QuizVerse
              </span>
            </Link>
            <p className="text-text-muted max-w-sm text-sm">{dictionary.footer.tagline}</p>
          </div>

          <div>
            <h4 className="text-text-primary mb-3 text-xs font-semibold tracking-[0.2em] uppercase">
              Explore
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/quiz"
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  All Quizzes
                </Link>
              </li>
              <li>
                <Link
                  href="/category/personality"
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  Personality
                </Link>
              </li>
              <li>
                <Link
                  href="/category/trivia"
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  Trivia
                </Link>
              </li>
              <li>
                <Link
                  href="/leaderboard"
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  Leaderboard
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-text-primary mb-3 text-xs font-semibold tracking-[0.2em] uppercase">
              Studio
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/create"
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  Manual Quiz
                </Link>
              </li>
              <li>
                <Link
                  href="/create/ai"
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  AI Generator
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-text-primary mb-3 text-xs font-semibold tracking-[0.2em] uppercase">
              Info
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/privacy"
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-border-subtle mt-8 flex flex-col items-center justify-between gap-4 border-t pt-6 sm:flex-row">
          <p className="text-text-muted text-sm">© {currentYear} QuizVerse. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a
              href="https://twitter.com/quizverse"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-text-primary transition-colors"
              aria-label="Twitter"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
              </svg>
            </a>
            <a
              href="https://github.com/quizverse"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-text-primary transition-colors"
              aria-label="GitHub"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
