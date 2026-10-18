# Guía de Despliegue en Render - Obria CRM

Este documento explica las causas por las que la previsualización en Render fallaba anteriormente y cómo se ha solucionado la configuración para garantizar un despliegue correcto.

---

## 🔍 Diagnóstico: ¿Por qué no se previsualizaba en Render?

1. **Causa principal**: Render estaba sirviendo directamente el directorio raíz del código fuente sin compilar. Al acceder a la URL principal, Render devolvía el archivo `index.html` original de desarrollo, que contiene:
   ```html
   <script type="module" src="/src/main.jsx"></script>
   ```
2. **Error de MIME Type y Sintaxis JSX**:
   Al solicitar `/src/main.jsx`, el servidor de Render lo entregaba como un archivo estático genérico (`Content-Type: binary/octet-stream`) con sintaxis JSX (`<App />`). Los navegadores web no pueden ejecutar código JSX no compilado ni aceptan módulos JavaScript entregados con `binary/octet-stream`.

3. **Falta de Servidor Unificado y Carpeta de Salida (`dist`)**:
   - En un despliegue **Static Site**, faltaba definir `dist` como **Publish Directory** y ejecutar `npm run build`.
   - En un despliegue **Web Service**, el backend (`backend/server.js`) no entregaba los archivos de la carpeta `dist/` ni existía un script `"start"` en el `package.json` raíz.

---

## ✅ Soluciones Aplicadas en el Código

1. **Servidor Fullstack en `backend/server.js`**:
   - `backend/server.js` ahora detecta si existe la carpeta `dist/` (generada por `npm run build`).
   - Sirve automáticamente los archivos estáticos (`.js`, `.css`, `.png`, etc.) con sus tipos MIME correctos.
   - Incluye soporte **SPA Fallback** (Single Page Application): cualquier ruta que no sea de la API (`/api/*`) redirige a `dist/index.html`.

2. **Configuración en `package.json`**:
   - Se añadió el script `"start": "node backend/server.js"` en la raíz.
   - `main` apunta a `backend/server.js`.

3. **Blueprint Automático (`render.yaml`)**:
   - Se incluyó el archivo `render.yaml` en la raíz para auto-configurar el servicio en Render con 1 clic.

---

## 🚀 Cómo Desplegar en Render

### Opción A: Web Service (Recomendado - Frontend + Backend de IA)

1. En el panel de Render, crea un nuevo **Web Service** conectado a tu repositorio Git (o usa el Blueprint `render.yaml`).
2. Configura los siguientes parámetros:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
3. Variables de Entorno (Opcional):
   - `GEMINI_API_KEY`: Tu clave de API de Google Gemini (si utilizas el proxy de IA).
   - `GEMINI_MODEL`: `gemini-1.5-flash` (por defecto).

---

### Opción B: Static Site (Solo Frontend)

Si prefieres desplegar solo la parte cliente como sitio estático en Render:

1. Crea un nuevo **Static Site** en Render.
2. Configura:
   - **Build Command**: `npm run build`
   - **Publish Directory**: `dist`
3. Configura la regla de reescritura de rutas (Rewrites):
   - **Source**: `/*`
   - **Destination**: `/index.html`
   - **Action**: `Rewrite`
