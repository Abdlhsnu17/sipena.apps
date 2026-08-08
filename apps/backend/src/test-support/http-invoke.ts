import type { Application } from 'express';
import express from 'express';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Buffer } from 'node:buffer';
import { PassThrough } from 'node:stream';

type Headers = Record<string, string>;

export interface InMemoryResponse {
  status: number;
  statusCode: number;
  headers: Headers;
  header: Headers;
  body: unknown;
  text: string;
}

const normalizeHeaders = (headers: unknown): Headers => {
  if (!headers || typeof headers !== 'object') {
    return {};
  }

  const normalized: Headers = {};
  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      normalized[key.toLowerCase()] = value.map((item) => String(item)).join(', ');
    } else if (value !== undefined) {
      normalized[key.toLowerCase()] = String(value);
    }
  }
  return normalized;
};

class RequestBuilder {
  private readonly app: Application;
  private method = 'GET';
  private path = '/';
  private headers: Headers = {};
  private body: unknown = undefined;
  private executed: Promise<InMemoryResponse> | null = null;

  constructor(app: Application) {
    this.app = app;
  }

  private setMethod(method: string, path: string): this {
    this.method = method;
    this.path = path;
    return this;
  }

  get(path: string): this {
    return this.setMethod('GET', path);
  }

  post(path: string): this {
    return this.setMethod('POST', path);
  }

  patch(path: string): this {
    return this.setMethod('PATCH', path);
  }

  delete(path: string): this {
    return this.setMethod('DELETE', path);
  }

  set(name: string, value: string): this {
    this.headers[name.toLowerCase()] = value;
    return this;
  }

  send(body?: unknown): Promise<InMemoryResponse> {
    this.body = body;
    if (body !== undefined && this.headers['content-type'] === undefined) {
      this.headers['content-type'] = 'application/json';
    }
    return this.execute();
  }

  then<TResult1 = InMemoryResponse, TResult2 = never>(
    onfulfilled?: ((value: InMemoryResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private execute(): Promise<InMemoryResponse> {
    if (this.executed) {
      return this.executed;
    }

    this.executed = new Promise<InMemoryResponse>((resolve, reject) => {
      const rawBody =
        this.body === undefined
          ? ''
          : typeof this.body === 'string'
            ? this.body
            : JSON.stringify(this.body);
      const bodyBuffer = Buffer.from(rawBody);

      if (this.body !== undefined && this.headers['content-length'] === undefined) {
        this.headers['content-length'] = String(bodyBuffer.byteLength);
      }

      if (this.headers['x-forwarded-for'] === undefined) {
        this.headers['x-forwarded-for'] = '127.0.0.1';
      }
      if (this.headers['host'] === undefined) {
        this.headers['host'] = 'localhost';
      }

      const socket = new PassThrough();
      (socket as any).remoteAddress = '127.0.0.1';
      (socket as any).remotePort = 54321;
      (socket as any).localAddress = '127.0.0.1';
      (socket as any).localPort = 4000;
      const req = new IncomingMessage(socket as never);
      Object.setPrototypeOf(req, express.request);
      (req as any).method = this.method;
      (req as any).url = this.path;
      (req as any).originalUrl = this.path;
      (req as any).headers = this.headers;
      (req as any).socket = socket;
      (req as any).connection = socket;
      (req as any).complete = false;

      const res = new ServerResponse(req);
      res.assignSocket(socket as never);
      Object.setPrototypeOf(res, express.response);
      (req as any).res = res;
      (req as any).app = this.app;
      (res as any).req = req;
      (res as any).app = this.app;

      const responseChunks: Buffer[] = [];
      const originalWrite = res.write.bind(res);
      const originalJson = (res as any).json.bind(res);
      const originalSend = (res as any).send.bind(res);
      const originalEnd = res.end.bind(res);
      let sentBodyResponse = false;

      res.write = ((chunk: unknown, encoding?: BufferEncoding | ((error?: Error | null) => void), cb?: (error?: Error | null) => void) => {
        if (typeof encoding === 'function') {
          cb = encoding;
          encoding = undefined;
        }
        if (chunk !== undefined && chunk !== null) {
          const resolvedEncoding = typeof encoding === 'string' ? encoding : undefined;
          responseChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), resolvedEncoding));
        }
        return originalWrite(chunk as never, encoding as never, cb as never);
      }) as typeof res.write;

      (res as any).json = ((body: unknown) => {
        sentBodyResponse = true;
        return originalJson(body as never);
      });

      (res as any).send = ((body?: unknown) => {
        sentBodyResponse = true;
        return originalSend(body as never);
      });

      res.end = ((chunk?: unknown, encoding?: BufferEncoding | (() => void), cb?: () => void) => {
        if (typeof encoding === 'function') {
          cb = encoding;
          encoding = undefined;
        }
        if (chunk !== undefined && chunk !== null) {
          const resolvedEncoding = typeof encoding === 'string' ? encoding : undefined;
          responseChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), resolvedEncoding));
        }
        (req as any).complete = true;
        const result = originalEnd(chunk as never, encoding as never, cb as never);
        socket.end();
        return result;
      }) as typeof res.end;

      let settled = false;
      const finalize = () => {
        if (settled) {
          return;
        }
        settled = true;
        const headers = normalizeHeaders(res.getHeaders());
        const text = Buffer.concat(responseChunks).toString('utf8');
        let body: unknown = text;

        if ((headers['content-type'] || '').includes('application/json')) {
          try {
            body = text ? JSON.parse(text) : null;
          } catch {
            body = text;
          }
        }

        resolve({
          status: res.statusCode,
          statusCode: res.statusCode,
          headers,
          header: headers,
          body,
          text,
        });
        socket.end();
        socket.destroy();
      };

      res.once('finish', finalize);
      res.once('close', finalize);

      res.once('error', reject);

      try {
        (this.app as unknown as { handle: (req: IncomingMessage, res: ServerResponse) => void }).handle(req, res);
      } catch (error) {
        reject(error as Error);
        return;
      }

      process.nextTick(() => {
        if (bodyBuffer.length > 0) {
          req.push(bodyBuffer);
        }
        req.push(null);
      });
    });

    return this.executed;
  }
}

/**
 * Menjalankan Express tanpa bind socket TCP.
 *
 * Helper ini dipakai oleh route test yang sebelumnya menggunakan supertest,
 * tetapi sandbox tidak mengizinkan `listen(0)`. Request dan response tetap
 * diproses oleh Express asli, hanya transport network-nya yang digantikan oleh
 * stream in-memory.
 */
export const requestApp = (app: Application): RequestBuilder => new RequestBuilder(app);
