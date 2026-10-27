import { useCallback, useRef } from 'react';
import { useApp } from '../../context/AppContext';

/** showNotification de AppContext con identidad estable (se puede usar en dependencias de efectos). */
export default function useNotify() {
  const { showNotification } = useApp() || {};
  const ref = useRef(showNotification);
  ref.current = showNotification;
  return useCallback((msg, type) => ref.current?.(msg, type), []);
}
