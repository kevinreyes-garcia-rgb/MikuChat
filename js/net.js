/* =========================================================
   MikuChat · js/net.js — capa de red P2P (WebRTC vía PeerJS)
   No hay servidor de MikuChat: cada usuario abre su propio Peer
   con un id derivado de su nombre de usuario. Para chatear con
   alguien, te conectas directo a su Peer. Esto SOLO funciona si
   la otra persona tiene la página abierta en ese momento — no
   existe entrega de mensajes offline sin un backend real.
   ========================================================= */

const Net = {
  peer: null,
  me: null,
  conns: new Map(),     // "mikuchat-xxx" -> DataConnection abierta
  handlers: {},

  on(evt, fn) { this.handlers[evt] = fn; },
  emit(evt, data) { if (this.handlers[evt]) this.handlers[evt](data); },

  peerIdOf(username) { return "mikuchat-" + slug(username); },

  start(username) {
    this.me = username;
    const id = this.peerIdOf(username);
    return new Promise((resolve) => {
      try {
        this.peer = new Peer(id, { debug: 0 });
      } catch (e) { resolve(false); return; }
      this.peer.on("open", () => resolve(true));
      this.peer.on("connection", (conn) => this._wire(conn));
      this.peer.on("error", (err) => {
        if (err && err.type === "unavailable-id") this.emit("dupe");
        // otros errores de red no detienen la app: simplemente esa conexión falla
      });
    });
  },

  _wire(conn) {
    this.conns.set(conn.peer, conn);
    conn.on("data", (d) => this.emit("data", d));
    conn.on("close", () => this.conns.delete(conn.peer));
  },

  connectTo(username) {
    const key = this.peerIdOf(username);
    const existing = this.conns.get(key);
    if (existing && existing.open) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      if (!this.peer) return reject(new Error("sin conexión"));
      let conn;
      try { conn = this.peer.connect(key, { reliable: true }); }
      catch (e) { return reject(e); }
      const to = setTimeout(() => reject(new Error("timeout")), 7000);
      conn.on("open", () => { clearTimeout(to); this._wire(conn); resolve(conn); });
      conn.on("error", (e) => { clearTimeout(to); reject(e); });
    });
  },

  async sendTo(username, payload) {
    try {
      const conn = await this.connectTo(username);
      conn.send(payload);
      return true;
    } catch (e) { return false; }
  },

  isOnline(username) {
    const c = this.conns.get(this.peerIdOf(username));
    return !!(c && c.open);
  },

  stop() {
    this.conns.forEach(c => { try { c.close(); } catch (e) {} });
    this.conns.clear();
    if (this.peer) { try { this.peer.destroy(); } catch (e) {} this.peer = null; }
  }
};
