# MikuChat 🎤💬

Mensajería estilo WhatsApp, sin backend: solo HTML/CSS/JS. Se conecta usuario a
usuario en tiempo real usando WebRTC (PeerJS), y guarda todo localmente en el
navegador con IndexedDB.

## Cómo probarlo / publicarlo

- Ábrelo con un servidor local (doble clic al `index.html` puede fallar por
  restricciones del navegador con `file://`). Más fácil: súbelo a **GitHub
  Pages**, Netlify o Vercel — es 100% estático, igual que el MikuQuiz.
- Para probar el chat en tiempo real necesitas **dos pestañas/dispositivos
  distintos abiertos al mismo tiempo**, cada uno logueado con un usuario
  diferente.

## Cuentas de administrador incluidas

| Usuario        |
|----------------|
| `k4927789-wq`  |
| `Emmanuel`     |

Se crean automáticamente la primera vez que se abre la app en un dispositivo.
Sus contraseñas se guardan **hasheadas (SHA-256)**, nunca en texto plano —
por seguridad, ni siquiera el panel de admin muestra contraseñas de nadie.

## Funciones incluidas

- Registro / inicio de sesión con usuario y contraseña.
- Sesión persistente en el dispositivo (no hace falta loguearse cada vez).
- Chat contigo mismo ("Tú") con tu código de usuario generado al registrarte.
- Mensajes de texto, fotos, videos, notas de voz, emojis y stickers (packs
  integrados, sin depender de internet).
- Contactos (agregar por nombre de usuario), grupos (crear, agregar
  integrantes), bloquear/desbloquear usuarios, eliminar mensajes (para mí /
  para todos).
- Estados tipo "historias" (24 h), visibles para tus contactos; los estados
  de los admins se intentan mostrar a todos los usuarios conocidos.
- Insignia ✔️ de administrador junto al nombre.
- Panel de administración (solo visible para admins): lista de cuentas,
  botón para dar/quitar admin y para bloquear/desbloquear una cuenta.
- Diseño responsive: pantalla completa tipo WhatsApp Web en computadora,
  una sola columna tipo app en celular.

## Limitaciones importantes (por no tener servidor)

Esto es honesto, para que no haya sorpresas:

1. **Los mensajes solo se entregan en tiempo real**, mientras ambas personas
   tengan la página abierta al mismo tiempo. No hay notificaciones push ni
   entrega garantizada si la otra persona está completamente desconectada
   (se reintenta enviar cuando vuelves a abrir esa conversación).
2. **El historial de chats se guarda en cada dispositivo por separado.** Si
   inicias sesión con tu mismo usuario en otro celular o computadora, el
   login funciona, pero no vas a ver los mensajes que se guardaron en el
   otro dispositivo — no existe una base de datos central.
3. **El panel de admin solo puede listar cuentas registradas en ese mismo
   navegador/dispositivo.** Sin un servidor no hay forma de tener una lista
   global de "todos los usuarios de internet".
4. Los "estados" de los admins solo llegan a otros usuarios que estén
   conectados al mismo tiempo (mismo motivo que el punto 1).

Si en algún momento quieres que esto funcione como un WhatsApp real (chats
sincronizados entre dispositivos, mensajes entregados aunque estés
desconectado, lista global de usuarios), la única forma es agregar un
backend real (por ejemplo Firebase, Supabase o un servidor propio con base
de datos) — puedo ayudarte a hacerlo en otra sesión si te interesa.

---
*Basado en la misma idea de red P2P (WebRTC vía PeerJS) usada en MikuQuiz.*
