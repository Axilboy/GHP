import tls from 'node:tls';

export async function sendSystemEmail({ to, subject, text, replyTo = '' }) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return { delivered: false, reason: 'smtp_not_configured' };
  const from = process.env.FEEDBACK_FROM || user;
  const socket = tls.connect({ host, port: Number(process.env.SMTP_PORT || 465), servername: host, timeout: 10000 });
  socket.setEncoding('utf8');
  const smtp = createSmtpSession(socket);
  try {
    await smtp.ready();
    await smtp.command(`EHLO ${process.env.SMTP_HELO || 'gamehubparty.ru'}`, [250]);
    await smtp.command('AUTH LOGIN', [334]);
    await smtp.command(Buffer.from(user).toString('base64'), [334]);
    await smtp.command(Buffer.from(pass).toString('base64'), [235]);
    await smtp.command(`MAIL FROM:<${from}>`, [250]);
    await smtp.command(`RCPT TO:<${to}>`, [250, 251]);
    await smtp.command('DATA', [354]);
    socket.write(buildEmail({ from, to, subject, text, replyTo }));
    await smtp.read([250]);
    await smtp.command('QUIT', [221]).catch(() => {});
    return { delivered: true };
  } finally {
    socket.end();
  }
}

function createSmtpSession(socket) {
  let buffer = '';
  const readers = [];
  const fail = (error) => {
    while (readers.length) readers.shift().reject(error);
  };
  socket.on('data', (chunk) => {
    buffer += chunk;
    flushSmtpReaders();
  });
  socket.on('error', fail);
  socket.on('timeout', () => fail(new Error('SMTP timeout')));
  function flushSmtpReaders() {
    if (!readers.length) return;
    const lines = buffer.split(/\r?\n/).filter(Boolean);
    const finalIndex = lines.findIndex((line) => /^\d{3} /.test(line));
    if (finalIndex < 0) return;
    const response = lines.slice(0, finalIndex + 1).join('\n');
    buffer = lines.slice(finalIndex + 1).join('\r\n');
    readers.shift().resolve(response);
    flushSmtpReaders();
  }
  function read(expectedCodes) {
    return new Promise((resolve, reject) => {
      readers.push({
        resolve: (response) => {
          const code = Number(response.slice(0, 3));
          if (!expectedCodes.includes(code)) reject(new Error(`SMTP ${code}`));
          else resolve(response);
        },
        reject,
      });
      flushSmtpReaders();
    });
  }
  return {
    ready: () => read([220]),
    read,
    command: (line, expectedCodes) => {
      socket.write(`${line}\r\n`);
      return read(expectedCodes);
    },
  };
}

function encodeMailHeader(value) {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value).toString('base64')}?=`;
}

function buildEmail({ from, to, subject, text, replyTo }) {
  const headers = [
    `From: GameHubParty <${from}>`,
    `To: ${to}`,
    `Subject: ${encodeMailHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
  ];
  if (replyTo) headers.splice(2, 0, `Reply-To: ${replyTo}`);
  return `${headers.join('\r\n')}\r\n\r\n${String(text || '').replace(/^\./gm, '..')}\r\n.\r\n`;
}
