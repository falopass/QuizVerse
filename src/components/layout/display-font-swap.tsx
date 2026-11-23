import { Archivo_Black } from 'next/font/google';

// Las rutas que Next sirve sin el preload de next/font (la partida y el 404
// global) pintaban con `display: optional` el fallback durante toda la visita
// fría. Ahí Archivo Black entra con `swap`, sin preload, solo en ese árbol.
const archivoSwap = Archivo_Black({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-archivo',
  display: 'swap',
  preload: false,
});

export const displayFontSwapClass = `${archivoSwap.variable} qv-display-swap`;

export function DisplayFontSwap({ children }: { children: React.ReactNode }) {
  return <div className={displayFontSwapClass}>{children}</div>;
}
