import { useEffect, useRef, useState } from 'react';

/**
 * Formulario que se rellena con datos guardados (p. ej. los datos de empresa que llegan de Supabase
 * unos segundos después de abrir la app). Mientras el usuario no haya tocado nada, el formulario se
 * actualiza solo cuando cambian los datos; así no se muestran ni se guardan valores de ejemplo.
 *
 * @returns {[object, Function, Function]} [form, setForm, marcarGuardado]
 */
export function useSyncedForm(source, build) {
  const [form, setFormState] = useState(() => build(source));
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!dirtyRef.current) setFormState(build(source));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const setForm = (updater) => {
    dirtyRef.current = true;
    setFormState(updater);
  };
  const marcarGuardado = () => { dirtyRef.current = false; };

  return [form, setForm, marcarGuardado];
}
