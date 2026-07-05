import { io } from 'socket.io-client';

export class VirtualPlayer {
  constructor({ baseUrl, id, name, log }) {
    this.baseUrl = baseUrl;
    this.id = id;
    this.name = name;
    this.log = log;
    this.room = null;
    this.card = null;
    this.socket = io(baseUrl, { autoConnect: false, transports: ['websocket'] });
    this.socket.on('room_updated', (room) => { this.room = room; });
  }

  async connect() {
    if (this.socket.connected) return;
    const connected = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${this.name}: connection timeout`)), 5000);
      this.socket.once('connect', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    this.socket.connect();
    await connected;
    this.socket.emit('identify', { playerId: this.id });
    this.log(`${this.name} connected`);
  }

  async request(event, payload = {}) {
    const response = await new Promise((resolve, reject) => {
      this.socket.timeout(5000).emit(event, payload, (error, result) => {
        if (error) return reject(new Error(`${this.name}: ${event} timed out`));
        if (!result?.ok) return reject(new Error(`${this.name}: ${result?.error || `${event} failed`}`));
        resolve(result);
      });
    });
    this.log(`${this.name}: ${event}`);
    return response;
  }

  async createRoom() {
    const result = await this.request('create_room', { playerId: this.id, name: this.name });
    this.room = result.room;
    return result.room;
  }

  async joinRoom(code) {
    const result = await this.request('join_room', { playerId: this.id, name: this.name, code });
    this.room = result.room;
    return result.room;
  }

  async act(event, payload = {}) {
    return this.request(event, { roomId: this.room?.id, ...payload });
  }

  async revealRole() {
    const result = await this.act('get_role');
    this.card = result.card;
    return this.card;
  }

  waitForRoom(predicate, timeoutMs = 5000) {
    if (this.room && predicate(this.room)) return Promise.resolve(this.room);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.socket.off('room_updated', handler);
        reject(new Error(`${this.name}: room state timeout`));
      }, timeoutMs);
      const handler = (room) => {
        this.room = room;
        if (!predicate(room)) return;
        clearTimeout(timer);
        this.socket.off('room_updated', handler);
        resolve(room);
      };
      this.socket.on('room_updated', handler);
    });
  }

  disconnect() {
    this.socket.disconnect();
  }
}
