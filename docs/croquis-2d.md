# Croquis 2D/3D con IA (presupuestos y obras)

## Flujo
1. Presupuesto > consola de revisión > **📐 Generar Croquis 2D con IA**.
2. Pestaña «Medidas y fotos»: las mediciones salen de las notas de la visita (`- Salón: 5 x 4 x 2,30 m`) y se pueden corregir. Opcional: indicaciones (orientación, contigüidades) y hasta 8 fotos (se reducen a 1600 px en el navegador).
3. `POST /api/ai/croquis` (solo administradores) envía mediciones, notas, títulos de partidas y fotos a la IA activa (Gemini; si falla, Claude u OpenAI, también con las fotos). Prompt en `backend/croquisPrompt.js`: las mediciones mandan en las cotas; las fotos solo sitúan huecos y fachada.
4. La respuesta se limpia con `normalizarCroquis` (`src/utils/croquisPlano.js`, compartido con el servidor) y se abre en el editor.
5. **Guardar** lo deja en `presupuesto.croquis`. Al aceptar el presupuesto se copia a `obra.croquis` (y si se guarda con el presupuesto ya aceptado, se actualiza también la obra). En la obra: Documentación de Obra > Croquis 2D.

## Contrato JSON
`{ canvas, rooms[{id,name,x,y,width,height,points?,alto?,color}], openings[{id,type: door|window|sliding_door,roomId,wall|edge,positionRatio,widthMeters,swing,hinge}], labels[{id,text,x,y,rotation,size}], dimensions[{id,x1,y1,x2,y2,offset}], notes[] }` en metros, origen arriba a la izquierda, norte arriba. `positionRatio` es el centro del hueco a lo largo del lado.

Internamente cada estancia es un polígono `points` (lado i = del punto i al i+1) con su caja (`x, y, width, height`), `area` y `fijas` (lados con la medida bloqueada). Los huecos usan `edge`. Los croquis antiguos (rectángulos con `wall`) se convierten solos al abrirlos (`normalizarCroquis`).

## Editor (`src/components/Croquis/`)
SVG nativo con eventos de puntero: arrastrar estancias (imán a la rejilla y a los bordes de otras estancias), asas para redimensionar rectángulos, paleta con arrastrar y soltar (o pulsar, en el móvil), girar (R), borrar (Supr), flechas, deshacer/rehacer.

Cualquier forma: con la estancia seleccionada se arrastran sus puntos (imán a la rejilla y a los puntos de otras estancias), los círculos pequeños del centro de cada lado añaden un punto y doble clic o Supr sobre un punto lo quita. En polígonos se ven los ángulos interiores.

Medidas: pulsando una cota del plano se escribe su medida y se marca como fija (🔒). En el panel, cada lado tiene su medida y su candado («Fijar todas» / «Liberar todas»). Con un lado fijo, su punto gira alrededor del vecino al arrastrarlo; con los dos lados fijos no se mueve. Las estancias medidas (no «estimadas») nacen con las medidas fijas.

## Vista 3D (`Croquis3D.jsx`)
three.js (se descarga solo al abrir la vista). Suelos con el color de cada estancia, muros de 12 cm a la altura libre de cada estancia (2,60 m por defecto), puertas a 2,10 m, ventanas con antepecho de 0,90 m y vidrio. Girar, acercar y desplazar con el ratón o los dedos; «Descargar imagen» guarda un PNG.

## PDF (`src/utils/croquisPdf.js`)
jsPDF vectorial (A4 apaisado): membrete de la empresa (mismo emisor que el PDF del presupuesto), datos del cliente, plano a escala normalizada (1:50, 1:75, 1:100…), escala gráfica, norte, leyenda, tabla de superficies útiles y construida aproximada, y observaciones de la IA.

## Limitaciones
- Las fotos de la visita no se guardan en el presupuesto: hay que añadirlas de nuevo en el croquis.
