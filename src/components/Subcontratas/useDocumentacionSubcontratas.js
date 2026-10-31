import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/avisosApi';

// Carga los documentos de todas las subcontratas y los requisitos de cada obra
// (backend/subcontratasDocsRoutes.js). ready=false si falta ejecutar la migración.
export default function useDocumentacionSubcontratas() {
  const [state, setState] = useState({ loading: true, ready: true, error: '', docs: [], requirements: [], assignments: [] });

  const reload = useCallback(async () => {
    try {
      const [d, c] = await Promise.all([api('/api/subcontratas/docs'), api('/api/subcontratas/cae')]);
      setState({
        loading: false,
        ready: d.ready !== false && c.ready !== false,
        error: '',
        docs: d.docs || [],
        requirements: c.requirements || [],
        assignments: c.assignments || []
      });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { ...state, reload };
}

export const TONE_CLS = {
  ok: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  warn: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  bad: 'bg-rose-500/10 text-rose-400 border-rose-500/30'
};

export const ESTADO_INFO = {
  apto: { label: 'Apto para entrar', tone: 'ok' },
  aviso: { label: 'Apto · algo caduca pronto', tone: 'warn' },
  no_apto: { label: 'No apto · falta documentación', tone: 'bad' }
};
