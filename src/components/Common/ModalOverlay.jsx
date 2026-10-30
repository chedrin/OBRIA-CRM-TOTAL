import React, { forwardRef, useLayoutEffect } from 'react';
import { useAnimate, usePresence, useReducedMotion } from 'motion/react';

// Capa de fondo de un modal con animación de entrada y salida (motion).
// Fundido del fondo y, en el primer hijo (el panel), escala + desplazamiento.
// La salida solo se anima si el modal está dentro de <AnimatePresence>.
const ModalOverlay = forwardRef(function ModalOverlay({ children, ...props }, ref) {
  const [scope, animate] = useAnimate();
  const [isPresent, safeToRemove] = usePresence();
  const reduceMotion = useReducedMotion();

  const setRefs = (node) => {
    scope.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  useLayoutEffect(() => {
    const backdrop = scope.current;
    if (!backdrop) return;
    const panel = backdrop.firstElementChild;

    if (reduceMotion) {
      if (!isPresent) safeToRemove?.();
      return;
    }

    if (isPresent) {
      animate(backdrop, { opacity: [0, 1] }, { duration: 0.18, ease: 'easeOut' });
      if (panel) animate(panel, { opacity: [0, 1], y: [10, 0], scale: [0.97, 1] }, { duration: 0.24, ease: [0.16, 1, 0.3, 1] });
    } else {
      backdrop.style.pointerEvents = 'none';
      const salida = [animate(backdrop, { opacity: 0 }, { duration: 0.15, ease: 'easeIn' })];
      if (panel) salida.push(animate(panel, { opacity: 0, y: 6, scale: 0.98 }, { duration: 0.15, ease: 'easeIn' }));
      Promise.all(salida).then(() => safeToRemove?.());
    }
  }, [isPresent]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={setRefs} data-motion-modal="" {...props}>
      {children}
    </div>
  );
});

export default ModalOverlay;
