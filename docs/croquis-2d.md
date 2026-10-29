# Croquis 2D con IA (presupuestos y obras)

## Flujo
1. Presupuesto > consola de revisión > **📐 Generar Croquis 2D con IA**.
2. Pestaña «Medidas y fotos»: las mediciones salen de las notas de la visita (`- Salón: 5 x 4 x 2,30 m`) y se pueden corregir. Opcional: indicaciones (orientación, contigüidades) y hasta 8 fotos (se reducen a 1600 px en el navegador).
3. `POST /api/ai/croquis` (solo administradores) envía mediciones, notas, títulos de partidas y fotos a la IA activa (Gemini; si falla, Claude u OpenAI, también con las fotos). Prompt en `backend/croquisPrompt.js`: las mediciones mandan en las cotas; las fotos solo sitúan huecos y fachada.
4. La respuesta se limpia con `normalizarCroquis` (`src/utils/croquisPlano.js`, compartido con el servidor) y se abre en el editor.
5. **Guardar** lo deja en `presupuesto.croquis`. Al aceptar el presupuesto se copia a `obra.croquis` (y si se guarda con el presupuesto ya aceptado, se actualiza también la obra). En la obra: Documentación de Obra > Croquis 2D.

## Contrato JSON
`{ canvas, rooms[{id,name,x,y,width,height,area,color}], openings[{id,type: door|window|sliding_door,roomId,wall,positionRatio,widthMeters,swing,hinge}], labels[{id,text,x,y,rotation,size}], dimensions[{id,x1,y1,x2,y2,offset}], notes[] }` en metros, origen arriba a la izquierda, norte arriba. `positionRatio` es el centro del hueco a lo largo del muro.

## Editor (`src/components/Croquis/`)
SVG nativo con eventos de puntero (sin librerías nuevas): arrastrar estancias (imán a la rejilla y a los bordes de otras estancias), asas para redimensionar con cotas en vivo, paleta con arrastrar y soltar (o pulsar, en el móvil), girar (R), borrar (Supr), flechas, deshacer/rehacer.

## PDF (`src/utils/croquisPdf.js`)
jsPDF vectorial (A4 apaisado): membrete de la empresa (mismo emisor que el PDF del presupuesto), datos del cliente, plano a escala normalizada (1:50, 1:75, 1:100…), escala gráfica, norte, leyenda, tabla de superficies útiles y construida aproximada, y observaciones de la IA.

## Limitaciones
- Estancias rectangulares (una L se dibuja con dos estancias).
- Las fotos de la visita no se guardan en el presupuesto: hay que añadirlas de nuevo en el croquis.
