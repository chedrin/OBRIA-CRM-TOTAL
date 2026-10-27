import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useApp } from './AppContext';

// Preferencias de interfaz por usuario: tema y modo de vista de los listados.
// Se guardan en el navegador con una clave por usuario (cada persona que entra en el mismo equipo tiene las suyas).

export const THEMES = ['claro', 'oscuro'];
export const VIEW_MODES = ['tarjetas', 'compacta', 'clasica'];

const DEFAULT_PREFS = { theme: 'claro', viewMode: 'tarjetas' };
const STORAGE_PREFIX = 'obramaster_ui_prefs';

const LAST_THEME_KEY = 'obramaster_ui_last_theme';

const storageKey = (userId) => `${STORAGE_PREFIX}_${userId || 'anon'}`;

// Antes del primer render se aplica el último tema usado para no ver un destello del otro tema.
try {
  const last = localStorage.getItem(LAST_THEME_KEY);
  document.documentElement.dataset.theme = THEMES.includes(last) ? last : DEFAULT_PREFS.theme;
} catch (e) {
  document.documentElement.dataset.theme = DEFAULT_PREFS.theme;
}

function loadPrefs(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw);
    return {
      theme: THEMES.includes(parsed.theme) ? parsed.theme : DEFAULT_PREFS.theme,
      viewMode: VIEW_MODES.includes(parsed.viewMode) ? parsed.viewMode : DEFAULT_PREFS.viewMode
    };
  } catch (e) {
    return { ...DEFAULT_PREFS };
  }
}

const UiPreferencesContext = createContext(null);

export function UiPreferencesProvider({ children }) {
  const { currentUser } = useApp() || {};
  const userId = currentUser?.id || null;
  // Las preferencias llevan el usuario al que pertenecen para no guardar las de uno con la clave de otro.
  const [state, setState] = useState(() => ({ userId, ...loadPrefs(userId) }));
  const prefs = state.userId === userId ? state : { userId, ...loadPrefs(userId) };
  const setPrefs = (update) => setState(prev => {
    const base = prev.userId === userId ? prev : { userId, ...loadPrefs(userId) };
    const next = { ...update(base), userId };
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify({ theme: next.theme, viewMode: next.viewMode }));
    } catch (e) {}
    return next;
  });

  // Al cambiar de usuario se cargan sus preferencias.
  useEffect(() => {
    if (state.userId !== userId) setState({ userId, ...loadPrefs(userId) });
  }, [userId, state.userId]);

  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
    try { localStorage.setItem(LAST_THEME_KEY, prefs.theme); } catch (e) {}
  }, [prefs.theme]);

  const value = useMemo(() => ({
    theme: prefs.theme,
    viewMode: prefs.viewMode,
    setTheme: (theme) => THEMES.includes(theme) && setPrefs(p => ({ ...p, theme })),
    setViewMode: (viewMode) => VIEW_MODES.includes(viewMode) && setPrefs(p => ({ ...p, viewMode }))
  }), [prefs.theme, prefs.viewMode, userId]);

  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>;
}

export function useUiPreferences() {
  return useContext(UiPreferencesContext) || { ...DEFAULT_PREFS, setTheme: () => {}, setViewMode: () => {} };
}
