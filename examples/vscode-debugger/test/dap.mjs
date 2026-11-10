import net from 'node:net';
import { EventEmitter, once } from 'node:events';
export class Dap extends EventEmitter {
  sequence = 0;
  pending = new Map();
  events = [];
  buffer = Buffer.alloc(0);
  static async connect(port, onRequest) {
    const socket = net.connect(port, '127.0.0.1');
    await once(socket, 'connect');
    return new Dap(socket, onRequest);
  }
  constructor(socket, onRequest) {
    super();
    this.socket = socket;
    socket.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.parse(onRequest);
    });
    socket.on('error', (err) => {
      for (const p of this.pending.values()) p.reject(err);
    });
  }
  parse(onRequest) {
    while (true) {
      const end = this.buffer.indexOf('\r\n\r\n');
      if (end < 0) return;
      const length = Number(
        this.buffer
          .subarray(0, end)
          .toString()
          .match(/Content-Length: (\d+)/i)[1],
      );
      if (this.buffer.length < end + 4 + length) return;
      const msg = JSON.parse(this.buffer.subarray(end + 4, end + 4 + length));
      this.buffer = this.buffer.subarray(end + 4 + length);
      if (process.env.KB_DAP_TRACE)
        console.error(
          'IN',
          msg.type,
          msg.command ?? msg.event,
          msg.request_seq ?? '',
          msg.success ?? '',
          msg.event === 'output'
            ? [
                msg.body?.category,
                msg.body?.output,
                Object.keys(msg.body?.data ?? {}),
                msg.body?.data?.error?.message ?? '',
              ]
            : '',
        );
      if (msg.type === 'response') {
        const p = this.pending.get(msg.request_seq);
        if (p) {
          clearTimeout(p.timer);
          this.pending.delete(msg.request_seq);
          msg.success
            ? p.resolve(msg.body ?? {})
            : p.reject(new Error(msg.message ?? 'DAP failed'));
        }
      } else if (msg.type === 'event') {
        this.events.push(msg);
        this.emit('event');
      } else if (msg.type === 'request') {
        Promise.resolve(onRequest?.(msg)).then(
          (body) =>
            this.write({
              type: 'response',
              request_seq: msg.seq,
              command: msg.command,
              success: true,
              body: body ?? {},
            }),
          (err) =>
            this.write({
              type: 'response',
              request_seq: msg.seq,
              command: msg.command,
              success: false,
              message: err.message,
            }),
        );
      }
    }
  }
  write(msg) {
    if (process.env.KB_DAP_TRACE)
      console.error('OUT', msg.type, msg.command ?? '', msg.request_seq ?? '');
    const body = JSON.stringify({ ...msg, seq: ++this.sequence });
    this.socket.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  }
  request(command, args = {}) {
    const seq = this.sequence + 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(seq);
        reject(new Error('DAP timeout: ' + command));
      }, 10000);
      this.pending.set(seq, { resolve, reject, timer });
      this.write({ type: 'request', command, arguments: args });
    });
  }
  async event(name) {
    const deadline = Date.now() + 10000;
    while (true) {
      const i = this.events.findIndex((e) => e.event === name);
      if (i >= 0) return this.events.splice(i, 1)[0].body ?? {};
      if (Date.now() > deadline) throw new Error('Event timeout: ' + name);
      await new Promise((resolve) => {
        const timer = setTimeout(done, 100);
        const self = this;
        function done() {
          clearTimeout(timer);
          self.off('event', done);
          resolve();
        }
        this.once('event', done);
      });
    }
  }
  close() {
    this.socket.destroy();
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error('DAP closed'));
    }
    this.pending.clear();
  }
}
