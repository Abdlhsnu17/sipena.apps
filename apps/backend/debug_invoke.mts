import { IncomingMessage, ServerResponse } from 'node:http';
import { Buffer } from 'node:buffer';
import { PassThrough } from 'node:stream';
import express from 'express';

const app = express();
app.use(express.json());
app.post('/test', (req, res) => {
  console.log('ROUTE HIT body:', req.body);
  // Simulate async work
  Promise.resolve().then(() => {
    res.status(400).json({ success: false });
  });
});

const rawBody = JSON.stringify({ hello: 'world' });
const bodyBuffer = Buffer.from(rawBody);

const socket = new PassThrough();
(socket as any).remoteAddress = '127.0.0.1';

// Track socket events
socket.on('close', () => console.log('SOCKET CLOSE'));
socket.on('end', () => console.log('SOCKET END'));
socket.on('finish', () => console.log('SOCKET FINISH'));
socket.on('destroy', () => console.log('SOCKET DESTROY'));

const req = new IncomingMessage(socket as never);
Object.setPrototypeOf(req, express.request);
(req as any).method = 'POST';
(req as any).url = '/test';
(req as any).originalUrl = '/test';
(req as any).headers = { 'content-type': 'application/json', 'content-length': String(bodyBuffer.byteLength), 'x-forwarded-for': '127.0.0.1', 'host': 'localhost' };
(req as any).socket = socket;
(req as any).connection = socket;
(req as any).complete = false;
(req as any).app = app;

req.on('close', () => console.log('REQ CLOSE'));
req.on('end', () => console.log('REQ END'));

const res = new ServerResponse(req);
res.assignSocket(socket as never);
Object.setPrototypeOf(res, express.response);
(req as any).res = res;
(res as any).req = req;
(res as any).app = app;

res.once('finish', () => console.log('RES FINISH statusCode=', res.statusCode));
res.once('close', () => console.log('RES CLOSE statusCode=', res.statusCode));

(app as any).handle(req, res);

process.nextTick(() => {
  console.log('nextTick: pushing body');
  req.push(bodyBuffer);
  req.push(null);
  console.log('nextTick: done');
});

setTimeout(() => console.log('TIMEOUT done, statusCode=', res.statusCode), 200);
