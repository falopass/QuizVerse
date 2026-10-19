'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateProfileAction } from '@/actions/profile.actions';
import type { Locale } from '@/lib/i18n/dictionaries';

const DISPLAY_NAME_MAX = 60;
const BIO_MAX = 280;

const COPY = {
  es: {
    displayName: 'Nombre visible',
    username: 'Usuario',
    usernameHint: 'De 3 a 24 caracteres: minúsculas, números y _.',
    bio: 'Bio',
    submit: 'Guardar cambios',
    submitting: 'Guardando…',
    saved: 'Perfil actualizado.',
    empty: 'No hay cambios que guardar.',
    unauthorized: 'Tu sesión caducó; inicia sesión de nuevo.',
    unexpected: 'No se pudo guardar. Inténtalo de nuevo.',
    usernameTaken: 'Ese usuario ya está en uso.',
    displayNameError: 'Entre 1 y 60 caracteres.',
    usernameError: 'Solo minúsculas, números y _, de 3 a 24 caracteres.',
    bioError: 'Máximo 280 caracteres.',
  },
  en: {
    displayName: 'Display name',
    username: 'Username',
    usernameHint: '3 to 24 characters: lowercase letters, numbers and _.',
    bio: 'Bio',
    submit: 'Save changes',
    submitting: 'Saving…',
    saved: 'Profile updated.',
    empty: 'Nothing changed.',
    unauthorized: 'Your session expired; sign in again.',
    unexpected: 'Could not save. Try again.',
    usernameTaken: 'That username is taken.',
    displayNameError: 'Between 1 and 60 characters.',
    usernameError: 'Only lowercase letters, numbers and _, 3 to 24 characters.',
    bioError: '280 characters max.',
  },
} as const;

type Field = 'displayName' | 'username' | 'bio';
type FieldErrors = Partial<Record<Field, string>>;

const FIELD_CLASS =
  'border-border-subtle bg-bg-primary text-text-primary focus:border-accent-primary w-full border px-4 py-3 text-sm outline-none';

/**
 * Edición del perfil propio: nombre visible, usuario y bio.
 *
 * Solo manda a `updateProfileAction` los campos que cambiaron, para que el
 * servidor pueda responder `empty` cuando no hay nada que guardar. Los errores
 * de Zod llegan como códigos estables y se traducen aquí, nunca se muestran
 * crudos.
 */
export function SettingsForm({
  locale,
  initialDisplayName,
  initialUsername,
  initialBio,
}: {
  locale: Locale;
  initialDisplayName: string;
  initialUsername: string;
  initialBio: string;
}) {
  const copy = COPY[locale];
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [username, setUsername] = useState(initialUsername);
  const [bio, setBio] = useState(initialBio);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<{ tone: 'success' | 'info' | 'error'; text: string } | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setNotice(null);
    setLoading(true);

    const input: { displayName?: string; username?: string; bio?: string } = {};
    if (displayName !== initialDisplayName) input.displayName = displayName;
    if (username !== initialUsername) input.username = username;
    if (bio !== initialBio) input.bio = bio;

    let result;
    try {
      result = await updateProfileAction(input);
    } catch {
      result = { ok: false as const, code: 'unexpected' as const };
    }
    setLoading(false);

    if (result.ok) {
      setNotice({ tone: 'success', text: copy.saved });
      router.refresh();
      return;
    }

    if (result.code === 'invalid_input' || result.code === 'username_taken') {
      const errors = result.fieldErrors ?? {};
      const next: FieldErrors = {};
      if (result.code === 'username_taken') next.username = copy.usernameTaken;
      if (errors.displayName?.length) next.displayName = copy.displayNameError;
      if (errors.username?.length) next.username ??= copy.usernameError;
      if (errors.bio?.length) next.bio = copy.bioError;
      setFieldErrors(next);
      if (!Object.keys(next).length) setNotice({ tone: 'error', text: copy.unexpected });
      return;
    }

    setNotice({
      tone: result.code === 'empty' ? 'info' : 'error',
      text:
        result.code === 'empty'
          ? copy.empty
          : result.code === 'unauthorized'
            ? copy.unauthorized
            : copy.unexpected,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <span className="mb-1 flex items-baseline justify-between">
          <label
            htmlFor="settings-display-name"
            className="text-text-secondary text-xs font-semibold tracking-wide uppercase"
          >
            {copy.displayName}
          </label>
          <span className="text-text-muted text-xs">
            {displayName.length}/{DISPLAY_NAME_MAX}
          </span>
        </span>
        <input
          id="settings-display-name"
          type="text"
          name="displayName"
          autoComplete="nickname"
          required
          maxLength={DISPLAY_NAME_MAX}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          aria-invalid={Boolean(fieldErrors.displayName)}
          className={`${FIELD_CLASS} rounded-full`}
        />
        {fieldErrors.displayName ? (
          <p className="mt-1 text-xs font-semibold text-red-400">{fieldErrors.displayName}</p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="settings-username"
          className="text-text-secondary mb-1 block text-xs font-semibold tracking-wide uppercase"
        >
          {copy.username}
        </label>
        <input
          id="settings-username"
          type="text"
          name="username"
          autoComplete="username"
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          aria-invalid={Boolean(fieldErrors.username)}
          aria-describedby="settings-username-hint"
          className={`${FIELD_CLASS} rounded-full`}
        />
        <p id="settings-username-hint" className="text-text-muted mt-1 text-xs">
          {copy.usernameHint}
        </p>
        {fieldErrors.username ? (
          <p className="mt-1 text-xs font-semibold text-red-400">{fieldErrors.username}</p>
        ) : null}
      </div>

      <div>
        <span className="mb-1 flex items-baseline justify-between">
          <label
            htmlFor="settings-bio"
            className="text-text-secondary text-xs font-semibold tracking-wide uppercase"
          >
            {copy.bio}
          </label>
          <span className="text-text-muted text-xs">
            {bio.length}/{BIO_MAX}
          </span>
        </span>
        <textarea
          id="settings-bio"
          name="bio"
          rows={3}
          maxLength={BIO_MAX}
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          aria-invalid={Boolean(fieldErrors.bio)}
          className={`${FIELD_CLASS} resize-none rounded-3xl`}
        />
        {fieldErrors.bio ? (
          <p className="mt-1 text-xs font-semibold text-red-400">{fieldErrors.bio}</p>
        ) : null}
      </div>

      {notice ? (
        <p
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`text-sm font-semibold ${
            notice.tone === 'success'
              ? 'text-green-400'
              : notice.tone === 'info'
                ? 'text-text-secondary'
                : 'text-red-400'
          }`}
        >
          {notice.text}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="bg-accent-primary hover:bg-accent-hover w-full rounded-full px-4 py-3 text-sm font-semibold text-white transition-colors disabled:opacity-60"
      >
        {loading ? copy.submitting : copy.submit}
      </button>
    </form>
  );
}
