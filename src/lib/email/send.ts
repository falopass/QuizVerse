/**
 * Envío por el binding `send_email` de Cloudflare Email Service
 * (`EMAIL` en wrangler.jsonc, restringido a noreply@quizverse.org).
 * Fuera de Workers (tests, next dev) no hay contexto CF: `getEmailBinding`
 * devuelve null y la ruta responde 503, como el resto de integraciones del
 * proyecto cuando falta su binding.
 */
import 'server-only';
import type { OutboundEmail } from './plan';

/** Subconjunto de la Workers API de Email Service que usamos. */
interface SendEmailBinding {
  send(message: {
    to: string;
    from: string | { email: string; name?: string };
    subject: string;
    html?: string;
    text?: string;
  }): Promise<{ messageId: string }>;
}

const SENDER = { email: 'noreply@quizverse.org', name: 'QuizVerse' };

export async function getEmailBinding(): Promise<SendEmailBinding | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const env = getCloudflareContext().env as unknown as { EMAIL?: SendEmailBinding };
    return env.EMAIL ?? null;
  } catch {
    return null;
  }
}

export async function sendAuthEmails(messages: OutboundEmail[]): Promise<void> {
  const binding = await getEmailBinding();
  if (!binding) throw new Error('email binding EMAIL not available');
  for (const message of messages) {
    await binding.send({
      to: message.to,
      from: SENDER,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  }
}
