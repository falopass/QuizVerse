import type { MotionProps } from 'framer-motion';

type EntranceTarget = MotionProps['initial'] | MotionProps['animate'] | MotionProps['exit'];

// Un target no objeto (variant label, boolean) no se puede reducir: queda
// como `{}`, es decir, sin animación de entrada. Es el resultado correcto
// con reduced motion.
function opacityOnly<T extends EntranceTarget>(target: T): T {
  if (!target || typeof target !== 'object') return target;
  const { opacity } = target as { opacity?: unknown };
  return (opacity === undefined ? {} : { opacity }) as T;
}

/**
 * Props de entrada para `motion.*` que respetan prefers-reduced-motion.
 * Con `reduced` solo queda el fundido de opacidad en initial/animate/exit:
 * nada de desplazamiento, escala, ni transition (spring o delay). Devuelve
 * un objeto nuevo; nunca muta `props`.
 */
export function entrance(reduced: boolean, props: MotionProps): MotionProps {
  if (!reduced) return { ...props };
  const result: MotionProps = {
    initial: opacityOnly(props.initial),
    animate: opacityOnly(props.animate),
  };
  if (props.exit !== undefined) result.exit = opacityOnly(props.exit);
  return result;
}
