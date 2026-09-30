import assert from 'node:assert/strict';
import net from 'node:net';
import test from 'node:test';

const loadNodemailer = new Function("return import('nodemailer')");

test('existing dynamic-import SMTP contract survives the Nodemailer upgrade', { timeout: 10000 }, async (t) => {
  const sockets = new Set<net.Socket>();
  const messages: string[] = [];
  let authenticated = false;
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.setEncoding('utf8');
    socket.write('220 localhost test fixture\r\n');
    let buffer = '', body = '', receiving = false;
    socket.on('data', (chunk) => {
      buffer += chunk;
      assert.ok(buffer.length < 65536, 'fixture input is bounded');
      let end;
      while ((end = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (receiving) {
          if (line === '.') {
            messages.push(body); body = ''; receiving = false;
            socket.write('250 Message accepted\r\n');
          } else {
            body += line + '\r\n';
            assert.ok(body.length < 65536, 'fixture body is bounded');
          }
        } else if (/^EHLO /.test(line)) socket.write('250-localhost\r\n250 AUTH PLAIN\r\n');
        else if (/^AUTH PLAIN /.test(line)) { authenticated = true; socket.write('235 Authenticated\r\n'); }
        else if (/^MAIL FROM:/.test(line)) socket.write('250 Sender accepted\r\n');
        else if (/^RCPT TO:.*blocked@/.test(line)) socket.write('550 Recipient refused\r\n');
        else if (/^RCPT TO:/.test(line)) socket.write('250 Recipient accepted\r\n');
        else if (line === 'DATA') { receiving = true; socket.write('354 End with a dot\r\n'); }
        else if (line === 'QUIT') socket.end('221 Bye\r\n');
        else socket.write('250 OK\r\n');
      }
    });
  });
  t.after(async () => { for (const socket of sockets) socket.destroy(); await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const nodemailer = await loadNodemailer();
  const createTransport = nodemailer.createTransport || nodemailer.default?.createTransport;
  assert.equal(typeof createTransport, 'function');
  const transport = createTransport({ host: '127.0.0.1', port: address.port, secure: false,
    auth: { user: 'fixture-user', pass: 'fixture-only' }, connectionTimeout: 2000, greetingTimeout: 2000, socketTimeout: 2000 });
  t.after(() => transport.close());
  const result = await transport.sendMail({ from: 'Platform Test <sender@example.invalid>', to: 'recipient@example.invalid',
    replyTo: 'reply@example.invalid', subject: 'Unicode 回归', text: 'Text body\n第二行', html: '<p>HTML body</p>' });
  assert.equal(authenticated, true);
  assert.deepEqual(result.accepted, ['recipient@example.invalid']);
  assert.equal(messages.length, 1);
  assert.match(messages[0], /Reply-To: reply@example\.invalid/i);
  assert.match(messages[0], /Content-Type: multipart\/alternative/i);
  assert.match(messages[0], /Content-Type: text\/plain/i);
  assert.match(messages[0], /Content-Type: text\/html/i);
  await assert.rejects(transport.sendMail({ from: 'sender@example.invalid', to: 'blocked@example.invalid', subject: 'rejected', text: 'fixture' }),
    (error: unknown) => error instanceof Error && 'code' in error && error.code === 'EENVELOPE'
      && 'responseCode' in error && error.responseCode === 550);
});
