/* =========================================================
   MikuChat · js/crypto.js — utilidades
   Las contraseñas NUNCA se guardan ni se muestran en texto
   plano: se guardan como hash SHA-256. Ni siquiera los admins
   pueden ver contraseñas de otros usuarios.
   ========================================================= */

async function hashPass(pw) {
  const enc = new TextEncoder().encode("mikuchat::" + pw);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function genCode() {
  return "MK-" + Math.floor(100000 + Math.random() * 900000);
}

function uid() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
}

/* convierte un nombre de usuario en un id de peer válido (a-z0-9-) */
function slug(u) {
  const s = String(u || "").toLowerCase().trim().replace(/[^a-z0-9_-]/g, "");
  return s || ("u" + Math.random().toString(36).slice(2, 8));
}
