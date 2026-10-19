# Reglas de Experiencia de Usuario y UI para React

## 1. Modales Claros y Accesibles
- **Enfoque de Atención:** Todo modal debe estar centrado en la pantalla y contar con un overlay oscuro (`rgba(0, 0, 0, 0.5)` o equivalente en tu framework de estilos) que desenfoque ligeramente el fondo si es posible.
- **Botones de Acción:** Los botones principales de confirmación en el modal deben ser muy claros, visibles y estar posicionados abajo a la derecha. Siempre debe haber un botón "Cerrar" o "Cancelar" fácil de identificar.
- **Cierre Intuitivo:** Asegúrate de que el modal se pueda cerrar haciendo clic en el overlay exterior o presionando la tecla 'Escape'.

## 2. Efectos Visuales y Animaciones
- **Transiciones:** Prohibido que los elementos visuales aparezcan de golpe. Usa transiciones suaves de CSS o librerías del proyecto (como Framer Motion o Tailwind transitions) para cambios de estado, hovers y aperturas de menús/modales.
- **Duración:** Las animaciones visuales deben ser rápidas y fluidas (entre 150ms y 300ms) para que la aplicación se sienta veloz pero agradable al ojo.
- **Feedback Visual:** Cualquier elemento interactivo (botones, tarjetas clicleables, inputs) debe cambiar sutilmente de color o elevarse (sombra) al pasar el cursor encima (`:hover`) y al recibir foco (`:focus`).
