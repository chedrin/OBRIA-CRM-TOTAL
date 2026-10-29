# Correo con Resend: configuración y plantillas

Todos los correos de la app salen por el servidor con [Resend](https://resend.com):

| Correo | Dónde se envía | Plantilla (Ajustes > Correos y plantillas) |
|---|---|---|
| Presupuesto al cliente (PDF adjunto) | Presupuestos > Enviar | Presupuesto al cliente |
| Factura al cliente (PDF adjunto) | Facturas > Enviar | Factura al cliente |
| Pedido de material | Avisos y Pedidos > borrador > Aprobar y enviar | Pedido de material a proveedor |
| Petición de precio | Igual, eligiendo "solicitud de presupuesto" | Petición de precio a proveedor |
| Encargo a subcontrata (enlace directo) | Avisos y Pedidos > Enlaces, y Avance > Asignar a subcontrata | Encargo a subcontrata |

Las respuestas de clientes y proveedores llegan al **correo de la empresa** (Ajustes > Perfil, campo email), por ejemplo `reformasmarchelo@gmail.com`.

## Por qué hace falta un dominio propio

Con `RESEND_FROM_EMAIL=... <onboarding@resend.dev>` Resend está en **modo pruebas**: solo entrega al correo con el que te registraste en Resend. A clientes y proveedores no les llega (la app muestra "Resend está en modo pruebas").

Tampoco se puede enviar "desde" `@gmail.com`: Gmail no deja que otro servicio firme en su nombre y los correos acabarían en spam o rechazados. Por eso se envía desde tu dominio y se responde a tu Gmail.

## Paso a paso

### 1. Comprar el dominio (unos 10-15 € al año)

1. Elige el nombre, por ejemplo `reformasmarchelo.es` o `.com`.
2. Cómpralo en un registrador que te deje editar los DNS: DonDominio, IONOS, Hostinger, Namecheap o Cloudflare (este último no vende `.es`).
3. No hace falta contratar hosting ni correo: solo el dominio.

### 2. Añadir el dominio en Resend

1. Entra en <https://resend.com/domains> > **Add Domain**.
2. Escribe el dominio (`reformasmarchelo.es`) y elige la región **Ireland (eu-west-1)**, que deja los datos en la UE.
3. Resend te enseña 3 o 4 registros DNS: un **MX** y un **TXT (SPF)** para `send`, y un **TXT (DKIM)** para `resend._domainkey`. Déjalos a la vista.

### 3. Copiar los registros DNS en el registrador

1. En el panel del registrador, abre la zona DNS del dominio ("Gestionar DNS", "Zona DNS"...).
2. Crea cada registro **exactamente** como lo muestra Resend: tipo, nombre (host) y valor. Algunos paneles añaden el dominio solos: si Resend dice `send`, escribe `send`, no `send.reformasmarchelo.es`.
3. Recomendado, para que no vaya a spam: añade un TXT con nombre `_dmarc` y valor `v=DMARC1; p=none;`
4. En Resend pulsa **Verify DNS Records**. Suele tardar minutos; como mucho unas horas. El dominio tiene que quedar en **Verified**.

Estos registros no tocan el correo normal del dominio: si algún día contratas buzones (Google Workspace, Zoho...), sus registros MX van en la raíz y conviven con estos.

### 4. Crear la clave de API

1. <https://resend.com/api-keys> > **Create API Key**.
2. Permiso **Sending access** y, en Domain, solo tu dominio.
3. Copia la clave (`re_...`). Solo se ve una vez. No la pegues en chats ni en el repo.

### 5. Variables en tu `.env` (PC)

En `C:\Users\chedrin\OBRIA-CRM-TOTAL\.env`, cada línea sin espacios delante:

```
RESEND_API_KEY=re_la_clave_nueva
RESEND_FROM_EMAIL=Reformas Marchelo <presupuestos@reformasmarchelo.es>
PUBLIC_APP_URL=https://obria-crm.onrender.com
```

- La parte de antes de `@` puede ser cualquiera (`presupuestos`, `pedidos`, `avisos`): no hace falta crear el buzón.
- Si quedan `VITE_RESEND_API_KEY` o `VITE_RESEND_FROM_EMAIL`, bórralas.
- Reinicia el servidor (`npm start`).

### 6. Variables en Render

1. Render > servicio **obria-crm** (Web Service) > **Environment**.
2. Añade o cambia `RESEND_API_KEY`, `RESEND_FROM_EMAIL` y `PUBLIC_APP_URL` con los mismos valores.
3. **Save Changes**. Render reinicia el servicio solo. No hace falta recompilar: estas variables son del servidor.

### 7. Probar desde la app

1. Ajustes > **Correos y plantillas**. Arriba debe salir en verde "Listo · remitente presupuestos@...".
   - Rojo "Falta RESEND_API_KEY": la variable no llegó al servidor (revisa el paso 5 o 6).
   - Ámbar "Modo pruebas": `RESEND_FROM_EMAIL` sigue con `resend.dev` o vacío.
2. Escribe un correo que no sea el de Resend (por ejemplo el de un familiar) y pulsa **Probar envío**. Mira también la carpeta de spam.
3. Opcional: pon el **nombre que verá el destinatario** y marca **copia oculta** para recibir en el correo de la empresa una copia de todo lo que se envía (Resend no guarda una carpeta de "Enviados" en tu Gmail).

## Plantillas

En Ajustes > Correos y plantillas eliges el tipo de correo y editas el **asunto** y el **cuerpo**. A la derecha se ve la vista previa con datos de ejemplo. **Guardar** guarda todas; **Restaurar original** vuelve al texto de serie de la plantilla elegida.

- Las variables se escriben entre llaves dobles, por ejemplo `{{cliente}}`. Pulsa una variable para insertarla donde está el cursor.
- Si en una línea todas las variables están vacías, esa línea no se envía. Así `Tajo / zona: {{tajo}}` desaparece cuando el pedido no lleva tajo.
- `{{enlace}}` solo en su línea se ve como botón.
- `{{lineas_material}}` pinta la tabla del material del pedido.
- Una variable mal escrita (`{{clinete}}`) se queda tal cual en la vista previa, para que se vea el error.

Al enviar un presupuesto o una factura, el modal ya trae el asunto y el texto rellenos desde la plantilla. Se pueden retocar para ese envío sin cambiar la plantilla.

## Límites y costes

- Plan gratuito de Resend: unos 3.000 correos al mes y 100 al día, un dominio. Compruébalo en <https://resend.com/pricing>.
- La app limita a 60 correos por hora y usuario para que una sesión robada no sirva para mandar spam.
- Adjuntos de hasta 8 MB por correo.

## Para desarrolladores

- `backend/emailService.js`: única llamada a Resend (`sendEmail`), remitente, `reply_to`, copia oculta, adjuntos y mensajes de error en castellano.
- `src/utils/emailTemplates.js`: tipos, plantillas de serie y `renderEmail` (lo usan la web y el servidor).
- `backend/emailRoutes.js`: `GET /api/email/status`, `POST /api/email/test`, `POST /api/email/send` (`{ tipo, to, variables, asunto?, cuerpo?, attachments? }`).
- `backend/supplierEmail.js`: borradores de pedido con las plantillas de proveedor.
- `src/utils/documentPdf.js`: PDF de presupuestos y facturas (descarga y adjunto).
- Las plantillas se guardan en `empresaConfig.plantillasCorreo` (solo las cambiadas) y los ajustes en `empresaConfig.correoAjustes`.
