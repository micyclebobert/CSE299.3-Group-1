export class CdpClient {
  constructor(wsUrl) {
    this._wsUrl = wsUrl;
    this._ws = null;
    this._nextId = 1;
    this._pending = new Map();
    this._handlers = new Map();
    this._connected = false;
  }
  connect() {
    return new Promise((resolve, reject) => {
      this._ws = new WebSocket(this._wsUrl);
      this._ws.onopen = () => {
        this._connected = true;
        resolve();
      };
      this._ws.onerror = () => reject(new Error('CDP WebSocket connection error'));
      this._ws.onmessage = (e) => this._onMessage(JSON.parse(e.data));
      this._ws.onclose = () => {
        this._connected = false;
      };
    });
  }
  _onMessage(msg) {
    if (typeof msg.id === 'number') {
      const resolver = this._pending.get(msg.id);
      if (resolver) {
        resolver(msg);
        this._pending.delete(msg.id);
      }
    } else if (msg.method) {
      const handler = this._handlers.get(msg.method);
      if (handler) handler(msg.params);
    }
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this._nextId++;
      this._pending.set(id, { resolve, reject });
      this._ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, handler) {
    this._handlers.set(method, handler);
  }
  off(method) {
    this._handlers.delete(method);
  }
  close() {
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
  }
  get connected() {
    return this._connected;
  }
  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.error) throw new Error(res.error.message);
    return res.result;
  }
  async enable(domain) {
    await this.send(`${domain}.enable`);
  }
}
