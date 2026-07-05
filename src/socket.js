import { io } from 'socket.io-client';

export const socket = io({
  autoConnect: true,
  transports: ['websocket', 'polling'],
});

export function emit(event, payload = {}) {
  return new Promise((resolve, reject) => {
    socket.timeout(8000).emit(event, payload, (error, result) => {
      if (error) return reject(new Error('Сервер не отвечает'));
      if (!result?.ok) return reject(new Error(result?.error || 'Ошибка'));
      resolve(result);
    });
  });
}
