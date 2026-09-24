# MikuChat 🎤💬

Mensajería estilo WhatsApp, sin backend: solo HTML/CSS/JS. Se conecta usuario a
usuario en tiempo real usando WebRTC (PeerJS), y guarda todo localmente en el
navegador con IndexedDB.

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
  
---
*Basado en la misma idea de red P2P (WebRTC vía PeerJS) usada en MikuQuiz.*

>[V2](https://kevinreyes-garcia-rgb.github.io/MikuChatV2/)
