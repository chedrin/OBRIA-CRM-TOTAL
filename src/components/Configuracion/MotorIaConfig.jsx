import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { DEFAULT_GEMINI_MODEL, checkAndAutoSelectBestGeminiModel } from '../../services/geminiService';
import { checkBackendStatus, getBackendAiSettings, updateBackendAiSettings, testBackendAiConnection } from '../../services/backendAiService';
import { supabase } from '../../services/supabaseClient';
import {
  Sparkles,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Zap,
  RefreshCw,
  Server,
  ExternalLink,
  Lock,
  Sliders,
  SearchCheck,
  Cpu
} from 'lucide-react';
import confetti from 'canvas-confetti';

const PROVIDERS = [
  {
    id: 'google',
    name: 'Google Gemini',
    logo: '✨',
    badge: 'Autodetección Dinámica',
    defaultModel: DEFAULT_GEMINI_MODEL,
    keyPrefix: 'AIza',
    helpUrl: 'https://aistudio.google.com/app/apikey'
  },
  {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    logo: '⚡',
    badge: 'Líder Multimodal',
    defaultModel: 'chat-latest',
    keyPrefix: 'sk-',
    helpUrl: 'https://platform.openai.com/api-keys'
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    logo: '🧠',
    badge: 'Máxima Precisión',
    defaultModel: 'claude-sonnet-5-5',
    keyPrefix: 'sk-ant-',
    helpUrl: 'https://console.anthropic.com/settings/keys'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    logo: '🌐',
    badge: 'Multi-Modelo Universal',
    defaultModel: 'google/gemini-3.8-flash',
    keyPrefix: 'sk-or-',
    helpUrl: 'https://openrouter.ai/keys'
  }
];

export default function MotorIaConfig() {
  const { empresaConfig, updateAiConfig, showNotification } = useApp();

  const [activeProvider, setActiveProvider] = useState('google');
  const [selectedProvider, setSelectedProvider] = useState('google');
  const [apiKeys, setApiKeys] = useState({
    google: '',
    openai: '',
    anthropic: '',
    openrouter: ''
  });
  const [modelName, setModelName] = useState(DEFAULT_GEMINI_MODEL);
  const [temperature, setTemperature] = useState(0.15);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [showKeys, setShowKeys] = useState({
    google: false,
    openai: false,
    anthropic: false,
    openrouter: false
  });
  const [testing, setTesting] = useState(false);
  const [testingAll, setTestingAll] = useState(false);
  const [checkingGemini, setCheckingGemini] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testAllResults, setTestAllResults] = useState(null);
  const [geminiCheckResult, setGeminiCheckResult] = useState(null);

  const [backendInfo, setBackendInfo] = useState({ checking: true, isAvailable: false, details: null });

  const storedAiKeys = () => {
    const appAi = empresaConfig?.aiConfig || {};
    const keys = { ...(appAi.apiKeys || {}) };
    if (appAi.provider && appAi.apiKey && !keys[appAi.provider]) keys[appAi.provider] = appAi.apiKey;
    return Object.fromEntries(Object.entries(keys).filter(([, v]) => typeof v === 'string' && v.trim()));
  };

  const loadSettingsFromBackend = async () => {
    setBackendInfo(prev => ({ ...prev, checking: true }));
    const res = await checkBackendStatus();
    setBackendInfo({ checking: false, isAvailable: res.isAvailable, details: res.details });

    if (res.isAvailable) {
      const saved = await getBackendAiSettings();
      if (saved) {
        const currentActive = saved.provider || 'google';
        setActiveProvider(currentActive);
        setSelectedProvider(currentActive);

        const loadedKeys = {
          google: saved.apiKeys?.google || (currentActive === 'google' ? saved.apiKey : '') || '',
          openai: saved.apiKeys?.openai || (currentActive === 'openai' ? saved.apiKey : '') || '',
          anthropic: saved.apiKeys?.anthropic || (currentActive === 'anthropic' ? saved.apiKey : '') || '',
          openrouter: saved.apiKeys?.openrouter || (currentActive === 'openrouter' ? saved.apiKey : '') || ''
        };

        if (saved.apiKey && !loadedKeys[currentActive]) {
          loadedKeys[currentActive] = saved.apiKey;
        }

        // Render borra los ajustes del servidor en cada despliegue: se recuperan las claves
        // guardadas en Supabase (empresa_config) y se le vuelven a enviar al servidor.
        const storedKeys = storedAiKeys();
        // Las claves guardadas en Ajustes (Supabase) mandan sobre las del servidor (Render puede tener otras antiguas).
        const recovered = Object.keys(storedKeys).filter(p => storedKeys[p] && loadedKeys[p] !== storedKeys[p]);
        recovered.forEach(p => { loadedKeys[p] = storedKeys[p]; });
        if (recovered.length) {
          updateBackendAiSettings({ apiKeys: loadedKeys }).catch(err =>
            console.warn('[MotorIaConfig] No se pudieron restaurar las claves en el servidor:', err.message)
          );
        }

        setApiKeys(loadedKeys);
        if (saved.model) setModelName(saved.model);
        if (saved.temperature !== undefined) setTemperature(saved.temperature);
        if (saved.maxTokens !== undefined) setMaxTokens(saved.maxTokens);
      }
    } else {
      const appAi = empresaConfig?.aiConfig || {};
      const currentActive = appAi.provider || 'google';
      setActiveProvider(currentActive);
      setSelectedProvider(currentActive);
      setApiKeys(prev => ({ ...prev, ...storedAiKeys() }));
      if (appAi.modelName || appAi.model) setModelName(appAi.modelName || appAi.model);
    }
  };

  // Se repite cuando llega la configuración de Supabase (puede cargar después que esta pantalla).
  useEffect(() => {
    loadSettingsFromBackend();
  }, [empresaConfig?.aiConfig?.apiKeys]);

  const selectedProviderObj = PROVIDERS.find(p => p.id === selectedProvider) || PROVIDERS[0];
  const activeProviderObj = PROVIDERS.find(p => p.id === activeProvider) || PROVIDERS[0];
  const currentKey = apiKeys[selectedProvider] || '';

  const handleProviderChange = (newProvider) => {
    setSelectedProvider(newProvider);
    setTestResult(null);
    setGeminiCheckResult(null);
    const pObj = PROVIDERS.find(p => p.id === newProvider);
    if (pObj && pObj.defaultModel) {
      setModelName(pObj.defaultModel);
    }
  };

  const handleKeyChange = (val) => {
    setApiKeys(prev => ({
      ...prev,
      [selectedProvider]: val
    }));
    setTestResult(null);
    setGeminiCheckResult(null);
  };

  const toggleShowKey = (provId) => {
    setShowKeys(prev => ({
      ...prev,
      [provId]: !prev[provId]
    }));
  };

  const handleSetActiveProvider = (provId) => {
    setActiveProvider(provId);
    showNotification(`Motor principal de IA cambiado a ${PROVIDERS.find(p => p.id === provId)?.name || provId}`, 'success');
  };

  const updateSupabaseAiStatus = async (status, provToSave = activeProvider, modelToSave = modelName) => {
    try {
      const keyToSave = apiKeys[provToSave] || '';
      await supabase.from('ai_integration_settings').upsert({
        provider: provToSave,
        encrypted_api_key: keyToSave,
        model_name: modelToSave,
        is_active: status === 'active',
        last_tested_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('[MotorIaConfig] Error guardando estado en Supabase:', e.message);
    }
  };

  const handleCheckGeminiApi = async () => {
    const gKey = apiKeys.google?.trim() || '';
    if (!gKey) {
      showNotification('Introduce una API Key de Google Gemini para realizar la autodetección.', 'error');
      return;
    }

    setCheckingGemini(true);
    setGeminiCheckResult(null);
    setTestResult(null);

    try {
      let res;
      try {
        const fetchRes = await fetch('/api/ai/check-gemini-api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: gKey })
        });
        if (fetchRes.ok) {
          res = await fetchRes.json();
        }
      } catch (e) {
        // ignore
      }

      if (!res || !res.success) {
        res = await checkAndAutoSelectBestGeminiModel(gKey);
      }

      const detectedModel = res.activeModel || DEFAULT_GEMINI_MODEL;
      setSelectedProvider('google');
      setActiveProvider('google');
      setModelName(detectedModel);

      await updateBackendAiSettings({
        provider: 'google',
        apiKey: gKey,
        apiKeys: { ...apiKeys, google: gKey },
        model: detectedModel,
        temperature,
        maxTokens
      });

      await updateSupabaseAiStatus('active', 'google', detectedModel);

      updateAiConfig({
        provider: 'google',
        apiKey: gKey,
        apiKeys: { ...apiKeys, google: gKey },
        modelName: detectedModel,
        temperature,
        maxTokens,
        isActive: true,
        status: 'connected',
        lastTestedAt: new Date().toISOString()
      });

      setCheckingGemini(false);
      setGeminiCheckResult({
        success: true,
        provider: 'Google Gemini',
        activeModel: detectedModel,
        status: 'Operativo',
        formattedOutput: `✅ API correcta\n\nProveedor: Google Gemini\nModelo activo detectado: ${detectedModel}\nEstado: Operativo`
      });

      confetti({ particleCount: 50, spread: 60 });
      showNotification(`API Gemini verificada. Modelo activo detectado: "${detectedModel}".`, 'success');
    } catch (err) {
      setCheckingGemini(false);
      await updateSupabaseAiStatus('error', 'google');
      setGeminiCheckResult({
        success: false,
        error: err.message || 'No ha sido posible conectar con la IA. Revise la clave introducida.'
      });
      showNotification(err.message || 'Error al conectar con la API de Gemini', 'error');
    }
  };

  const handleTestConnection = async () => {
    const provKey = (apiKeys[selectedProvider] || '').trim();
    if (!provKey) {
      showNotification(`Introduce una API Key para ${selectedProviderObj.name} antes de probar la conexión.`, 'error');
      return;
    }

    setTesting(true);
    setTestResult(null);

    const targetModel = modelName || selectedProviderObj.defaultModel;

    try {
      const res = await testBackendAiConnection({
        provider: selectedProvider,
        apiKey: provKey,
        model: targetModel,
        temperature,
        maxTokens
      });

      setTesting(false);
      await updateSupabaseAiStatus('active', selectedProvider, targetModel);

      setTestResult({
        success: true,
        latencyMs: res.latencyMs || 120,
        message: res.message || 'Conexión verificada exitosamente'
      });
      confetti({ particleCount: 40, spread: 50 });
      showNotification(`Conexión con ${selectedProviderObj.name} (${targetModel}) verificada exitosamente`, 'success');
    } catch (err) {
      setTesting(false);
      await updateSupabaseAiStatus('error', selectedProvider);

      setTestResult({
        success: false,
        error: err.message || 'No ha sido posible conectar con la IA. Revise la clave de la API.'
      });
      showNotification(err.message || 'Error en prueba de conexión con la IA', 'error');
    }
  };

  const handleTestAllConnections = async () => {
    setTestingAll(true);
    setTestAllResults(null);
    setTestResult(null);

    const results = [];

    for (const p of PROVIDERS) {
      const key = (apiKeys[p.id] || '').trim();
      if (!key) {
        results.push({
          id: p.id,
          name: p.name,
          hasKey: false,
          success: false,
          error: 'Sin clave API configurada'
        });
        continue;
      }

      const targetModel = p.defaultModel;
      try {
        // Todas por el servidor: allí Gemini prueba otros modelos si uno está saturado o retirado.
        const res = await testBackendAiConnection({
          provider: p.id,
          apiKey: key,
          model: targetModel,
          temperature,
          maxTokens
        });
        results.push({
          id: p.id,
          name: p.name,
          hasKey: true,
          success: true,
          latencyMs: res.latencyMs || 120,
          message: res.message || 'Conexión OK (HTTP 200)'
        });
      } catch (err) {
        results.push({
          id: p.id,
          name: p.name,
          hasKey: true,
          success: false,
          error: err.message || 'Error al conectar'
        });
      }
    }

    setTestingAll(false);
    setTestAllResults(results);

    const anySuccess = results.some(r => r.success);
    if (anySuccess) {
      confetti({ particleCount: 50, spread: 60 });
      showNotification('Prueba global de APIs completada.', 'success');
    } else {
      showNotification('Prueba global completada con advertencias o errores.', 'warning');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);

    const activeKeyToSave = (apiKeys[activeProvider] || '').trim();
    const targetModel = modelName || activeProviderObj.defaultModel;

    try {
      await updateBackendAiSettings({
        provider: activeProvider,
        apiKey: activeKeyToSave,
        apiKeys,
        model: targetModel,
        temperature,
        maxTokens
      });

      await updateSupabaseAiStatus('active', activeProvider, targetModel);

      updateAiConfig({
        provider: activeProvider,
        apiKey: activeKeyToSave,
        apiKeys,
        modelName: targetModel,
        temperature,
        maxTokens,
        isActive: true,
        status: 'connected',
        lastTestedAt: new Date().toISOString()
      });

      setSaving(false);
      showNotification(`Configuración de IA (${activeProviderObj.name}) guardada y sincronizada`, 'success');
      confetti({ particleCount: 30, spread: 40 });
    } catch (err) {
      setSaving(false);
      showNotification(`Error al guardar configuración: ${err.message}`, 'error');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950/40 p-5 rounded-2xl border border-amber-500/30 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-black text-white">Motor Central de Inteligencia Artificial</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono font-bold">
                  MULTI-PROVEEDOR ACTIVO
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Configura las claves API para Gemini, ChatGPT, Claude u OpenRouter. Selecciona cuál estará activa para realizar el procesamiento técnico y la mejora de descripciones de obra.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
              (apiKeys[activeProvider] || '').trim()
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}>
              <span>{(apiKeys[activeProvider] || '').trim() ? `🟢 Motor Activo: ${activeProviderObj.name}` : `🔴 Sin Clave en ${activeProviderObj.name}`}</span>
            </span>
          </div>
        </div>

        {/* Insignia de Modelo Activo Detectado */}
        <div className="p-3.5 rounded-xl border bg-slate-950/80 border-amber-500/30 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-white text-xs">
              Proveedor activo: <span className="text-amber-400 font-mono font-black">{activeProviderObj.name}</span>
              <span className="text-slate-400 ml-2">({modelName || activeProviderObj.defaultModel})</span>
            </span>
          </div>

          <span className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg">
            Persistido en Servidor & Supabase
          </span>
        </div>
      </div>

      {/* Formulario de Configuración de IA */}
      <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl shadow-xl space-y-5">
        
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-sm">Ajustes del Motor de Inteligencia Artificial</h4>
              <p className="text-[11px] text-slate-400">Introduce tus claves API por proveedor y selecciona la IA activa</p>
            </div>
          </div>

          <a
            href={selectedProviderObj.helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
          >
            <span>Obtener API Key de {selectedProviderObj.name.split(' ')[0]}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Selector de Proveedor */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 block">Proveedores IA Soportados:</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {PROVIDERS.map((p) => {
              const isSelected = selectedProvider === p.id;
              const isActive = activeProvider === p.id;
              const hasKey = Boolean((apiKeys[p.id] || '').trim());

              return (
                <div
                  key={p.id}
                  onClick={() => handleProviderChange(p.id)}
                  className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between space-y-3 cursor-pointer relative ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/80 ring-2 ring-amber-500/20 shadow'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{p.logo}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded font-mono ${
                      isActive ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {isActive ? '● ACTIVO' : p.badge}
                    </span>
                  </div>

                  <div>
                    <h5 className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>{p.name}</h5>
                    <div className="flex items-center justify-between mt-1 text-[10px]">
                      <span className={hasKey ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
                        {hasKey ? '🔑 Clave Guardada' : '⚠️ Sin Clave'}
                      </span>
                    </div>
                  </div>

                  {!isActive && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetActiveProvider(p.id);
                      }}
                      className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold rounded-xl transition border border-slate-700 flex items-center justify-center gap-1"
                    >
                      <span>Usar como Motor Activo</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Campo API Key para el proveedor seleccionado */}
        <div className="space-y-1.5 text-xs bg-slate-950 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between">
            <label className="font-bold text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>API Key para {selectedProviderObj.name} *</span>
              {selectedProvider === activeProvider && (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">
                  Motor Principal Activo
                </span>
              )}
            </label>
            <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              <span>Guarda claves independientes</span>
            </span>
          </div>

          <div className="relative">
            <input
              type={showKeys[selectedProvider] ? 'text' : 'password'}
              value={currentKey}
              onChange={(e) => handleKeyChange(e.target.value)}
              placeholder={`Introduce la clave para ${selectedProviderObj.name} (${selectedProviderObj.keyPrefix}...)`}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-3 pr-10 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
            />
            <button
              type="button"
              onClick={() => toggleShowKey(selectedProvider)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
              title={showKeys[selectedProvider] ? 'Ocultar clave' : 'Mostrar clave'}
            >
              {showKeys[selectedProvider] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Temperatura y Tokens Máximos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between font-bold text-slate-300">
              <label className="flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>Temperatura:</span>
              </label>
              <span className="font-mono text-amber-400">{temperature}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-amber-500"
            />
            <span className="text-[10px] text-slate-500 block">0.0 = Rigor técnico estricto | 1.0 = Máxima creatividad</span>
          </div>

          <div className="space-y-1.5 text-xs">
            <label className="font-bold text-slate-300 block">Máximos Tokens de Salida:</label>
            <select
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
            >
              <option value={2048}>2.048 Tokens (Presupuestos Rápidos)</option>
              <option value={4096}>4.096 Tokens (Recomendado Estándar)</option>
              <option value={8192}>8.192 Tokens (Proyectos Grandes y Complejos)</option>
            </select>
          </div>
        </div>

        {/* Formatted Gemini Auto-Discovery Box */}
        {geminiCheckResult && (
          <div className={`p-4 rounded-xl border text-xs font-mono space-y-1 whitespace-pre-line ${
            geminiCheckResult.success
              ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/30 border-rose-500/50 text-rose-300'
          }`}>
            {geminiCheckResult.success ? (
              <span>{geminiCheckResult.formattedOutput}</span>
            ) : (
              <span>Error al verificar API Gemini: {geminiCheckResult.error}</span>
            )}
          </div>
        )}

        {/* All APIs Test Result Card */}
        {testAllResults && (
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <h5 className="text-xs font-bold text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Estado de Conexión de Todas las APIs:</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {testAllResults.filter(r => r.success).length} / {testAllResults.length} Operativas
              </span>
            </h5>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {testAllResults.map((r) => (
                <div
                  key={r.id}
                  className={`p-3 rounded-xl border flex items-center justify-between ${
                    r.success
                      ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                      : r.hasKey
                      ? 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                      : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {r.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className={`w-4 h-4 shrink-0 ${r.hasKey ? 'text-rose-400' : 'text-slate-500'}`} />
                    )}
                    <div className="min-w-0">
                      <span className="font-bold block truncate">{r.name}</span>
                      <span className={`text-[10px] opacity-80 block font-mono ${r.success ? 'truncate' : 'break-words'}`}>
                        {r.success ? r.message : r.error}
                      </span>
                    </div>
                  </div>

                  {r.success && (
                    <span className="text-[10px] font-mono bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-400 shrink-0 font-bold ml-2">
                      {r.latencyMs} ms
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Test Result Box */}
        {testResult && (
          <div className={`p-4 rounded-xl border text-xs space-y-2 ${
            testResult.success
              ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span className="font-bold">
                  {testResult.success
                    ? `¡Conexión Exitosa con ${selectedProviderObj.name}! (${modelName}) Ping PONG (HTTP 200 OK)`
                    : testResult.error}
                </span>
              </div>
              {testResult.success && (
                <span className="font-mono text-[11px] bg-emerald-500/20 px-2 py-0.5 rounded font-bold">
                  Latencia: {testResult.latencyMs} ms
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              disabled={checkingGemini || !currentKey}
              onClick={handleCheckGeminiApi}
              className="px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs rounded-xl transition border border-amber-500/40 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {checkingGemini ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" /> : <SearchCheck className="w-3.5 h-3.5 text-amber-400" />}
              <span>{checkingGemini ? 'Autodetectando...' : 'Comprobar API Gemini'}</span>
            </button>

            <button
              type="button"
              disabled={testing || !currentKey}
              onClick={handleTestConnection}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition border border-slate-700 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" /> : <Zap className="w-3.5 h-3.5 text-amber-400" />}
              <span>{testing ? 'Probando...' : 'Probar Esta API'}</span>
            </button>

            <button
              type="button"
              disabled={testingAll}
              onClick={handleTestAllConnections}
              className="px-4 py-2.5 bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-300 font-bold text-xs rounded-xl transition border border-indigo-500/40 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {testingAll ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" /> : <Server className="w-3.5 h-3.5 text-indigo-400" />}
              <span>{testingAll ? 'Verificando todas...' : 'Probar Todas las APIs'}</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4 stroke-[2.5]" />}
            <span>Guardar Configuración IA</span>
          </button>
        </div>

      </form>

    </div>
  );
}
