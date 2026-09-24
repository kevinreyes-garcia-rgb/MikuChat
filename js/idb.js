/* =========================================================
   MikuChat · js/idb.js — mini capa sobre IndexedDB
   Guarda todo localmente en el navegador: usuarios, contactos,
   bloqueos, grupos, mensajes y estados. No hay servidor: cada
   dispositivo/navegador tiene su propia base de datos.
   ========================================================= */

const DB_NAME = "MikuChatDB";
const DB_VERSION = 1;
let _dbPromise = null;

function idbOpen() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("users")) db.createObjectStore("users", { keyPath: "username" });
      if (!db.objectStoreNames.contains("contacts")) db.createObjectStore("contacts", { keyPath: "id" });
      if (!db.objectStoreNames.contains("blocks")) db.createObjectStore("blocks", { keyPath: "id" });
      if (!db.objectStoreNames.contains("groups")) db.createObjectStore("groups", { keyPath: "id" });
      if (!db.objectStoreNames.contains("messages")) {
        const s = db.createObjectStore("messages", { keyPath: "key", autoIncrement: true });
        s.createIndex("byConv", "convId");
        s.createIndex("byUid", "uid");
      }
      if (!db.objectStoreNames.contains("statuses")) {
        const s = db.createObjectStore("statuses", { keyPath: "key", autoIncrement: true });
        s.createIndex("byUser", "username");
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  return _dbPromise;
}

function _store(name, mode) {
  return idbOpen().then(db => db.transaction(name, mode).objectStore(name));
}
function idbGet(store, key) {
  return _store(store, "readonly").then(os => new Promise((res, rej) => {
    const r = os.get(key); r.onsuccess = () => res(r.result || null); r.onerror = () => rej(r.error);
  }));
}
function idbPut(store, val) {
  return _store(store, "readwrite").then(os => new Promise((res, rej) => {
    const r = os.put(val); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
}
function idbDelete(store, key) {
  return _store(store, "readwrite").then(os => new Promise((res, rej) => {
    const r = os.delete(key); r.onsuccess = () => res(); r.onerror = () => rej(r.error);
  }));
}
function idbAll(store) {
  return _store(store, "readonly").then(os => new Promise((res, rej) => {
    const r = os.getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error);
  }));
}
function idbByIndex(store, index, value) {
  return _store(store, "readonly").then(os => new Promise((res, rej) => {
    const r = os.index(index).getAll(value); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error);
  }));
}
