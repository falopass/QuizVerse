/**
 * Aviso de reto en la pantalla de juego.
 *
 * Server component: el marcador del retador llega resuelto por la página y aquí
 * solo se pinta. No necesita estado ni JavaScript de cliente.
 */
export function ChallengeBanner({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-24">
      <div className="border-accent-primary/40 bg-bg-primary rounded-2xl border px-5 py-4">
        <p className="eyebrow text-accent-primary text-[11px] font-bold tracking-[0.18em] uppercase">
          {eyebrow}
        </p>
        <p className="text-text-primary mt-1 text-lg font-semibold">{title}</p>
        <p className="text-text-secondary mt-1 text-sm">{body}</p>
      </div>
    </div>
  );
}

export default ChallengeBanner;
