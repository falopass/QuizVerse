import type { MotionProps } from 'framer-motion';

type EntranceTarget = MotionProps['initial'] | MotionProps['animate'] | MotionProps['exit'];

const isInlineTarget = (value: EntranceTarget): value is EntranceTarget & object =>
  typeof value === 'object' && value !== null;

function opacityOnly<T extends object>(target: T): T {
  const { opacity } = target as { opacity?: unknown };
  return (opacity === undefined ? {} : { opacity }) as T;
}

/**
 * Props de entrada para `motion.*` que respetan prefers-reduced-motion.
 * Con `reduced` solo queda el fundido de opacidad en initial/animate/exit:
 * nada de desplazamiento, escala ni transition (spring o delay). Un label
 * de variant ('hidden') no se puede recortar a opacidad sin resolver su
 * definición, que vive en `variants`, así que se neutraliza por completo.
 * Devuelve un objeto nuevo; nunca muta `props`.
 */
export function entrance(reduced: boolean, props: MotionProps): MotionProps {
  if (!reduced) return { ...props };
  const neutral = (target: EntranceTarget) => (isInlineTarget(target) ? opacityOnly(target) : {});
  const result: MotionProps = {
    initial: neutral(props.initial),
    animate: neutral(props.animate),
  };
  if (props.exit !== undefined) result.exit = neutral(props.exit);
  return result;
}
