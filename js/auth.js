/* =========================================================
   MikuChat · js/auth.js — registro, login, sesión y admins
   Las contraseñas se guardan hasheadas (SHA-256), nunca en
   texto plano, ni siquiera las de los administradores.
   ========================================================= */

const ADMIN_SEED = [
  { username: "k4927789-wq", password: "KellySofia88902" },
  { username: "Emmanuel",    password: "KellySofia88902" }
];

async function seedAdmins() {
  for (const a of ADMIN_SEED) {
    const existing = await idbGet("users", a.username);
    if (existing) continue;
    const passHash = await hashPass(a.password);
    await idbPut("users", {
      username: a.username,
      passHash,
      role: "admin",
      photo: null,
      bio: "🛡️ Administrador de MikuChat",
      code: genCode(),
      createdAt: Date.now(),
      blockedGlobally: false
    });
  }
}

function validUsername(u) {
  return /^[a-zA-Z0-9_-]{3,20}$/.test(u);
}

async function registerUser(username, password, photo) {
  username = (username || "").trim();
  password = password || "";
  if (!validUsername(username)) throw new Error("Usuario inválido: 3-20 caracteres, sin espacios ni acentos");
  if (password.length < 4) throw new Error("La contraseña debe tener al menos 4 caracteres");
  const existing = await idbGet("users", username);
  if (existing) throw new Error("Ese nombre de usuario ya existe");

  const passHash = await hashPass(password);
  const code = genCode();
  const user = {
    username, passHash, role: "user", photo: photo || null,
    bio: "¡Hola! Uso MikuChat 🎤", code, createdAt: Date.now(), blockedGlobally: false
  };
  await idbPut("users", user);

  // mensaje de bienvenida a uno mismo (chat "Tú") con el código generado
  await idbPut("messages", {
    uid: uid(),
    convId: "dm:" + [username, username].sort().join("|"),
    from: username, to: username, kind: "dm",
    type: "text",
    content: "¡Bienvenido a MikuChat, " + username + "! 🎉\nTu código de usuario es: " + code +
      "\nGuárdalo, es tu identificador dentro de la app.",
    ts: Date.now(), deletedFor: []
  });

  return user;
}

async function loginUser(username, password) {
  username = (username || "").trim();
  const user = await idbGet("users", username);
  if (!user) throw new Error("Ese usuario no existe en este dispositivo");
  const passHash = await hashPass(password || "");
  if (passHash !== user.passHash) throw new Error("Contraseña incorrecta");
  if (user.blockedGlobally) throw new Error("Esta cuenta fue bloqueada por un administrador");
  return user;
}

function saveSession(username) { try { localStorage.setItem("mikuchat_session", username); } catch (e) {} }
function loadSession() { try { return localStorage.getItem("mikuchat_session"); } catch (e) { return null; } }
function clearSession() { try { localStorage.removeItem("mikuchat_session"); } catch (e) {} }
