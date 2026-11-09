import express from 'express';
import { randomUUID } from 'node:crypto';
export function createApp() {
  const app = express();
  const sessions = new Map<string, string>();
  const notes = new Map<string, { id: string; owner: string; text: string }>();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2kb' }));
  // Deliberately test-only session issuer; not a password authentication endpoint.
  app.post('/test-session', (req, res) => {
    if (req.body?.user !== 'alice') {
      res.status(400).json({ error: 'invalid_fixture_user' });
      return;
    }
    const token = randomUUID();
    sessions.set(token, 'alice');
    res.cookie('sid', token, { httpOnly: true, sameSite: 'strict', path: '/' });
    res.sendStatus(204);
  });
  app.get('/old', (req, res) => res.redirect(302, '/me'));
  app.use((req, res, next) => {
    const value = req.headers.cookie
      ?.split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('sid='))
      ?.slice(4);
    const user = value ? sessions.get(value) : undefined;
    if (!user) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
    res.locals.user = user;
    next();
  });
  app.get('/me', (req, res) => res.json({ user: res.locals.user }));
  app.post('/notes', (req, res) => {
    if (!req.is('application/json')) {
      res.status(415).json({ error: 'unsupported_media_type' });
      return;
    }
    const data: unknown = req.body;
    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data) ||
      !('text' in data) ||
      typeof data.text !== 'string' ||
      !data.text.trim() ||
      data.text.length > 200 ||
      Object.keys(data).some((k) => k !== 'text')
    ) {
      res.status(400).json({ error: 'invalid_note' });
      return;
    }
    const id = randomUUID(),
      note = { id, owner: String(res.locals.user), text: data.text.trim() };
    notes.set(id, note);
    res
      .location('/notes/' + id)
      .status(201)
      .json({ id, text: note.text });
  });
  app.get('/notes/:id', (req, res) => {
    const n = notes.get(String(req.params.id));
    if (!n || n.owner !== res.locals.user) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ id: n.id, text: n.text });
  });
  app.use(
    (error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
      void next;
      const status = error && typeof error === 'object' && 'status' in error ? error.status : 500;
      if (status === 400) res.status(400).json({ error: 'invalid_json' });
      else if (status === 413) res.status(413).json({ error: 'body_too_large' });
      else res.status(500).json({ error: 'internal_error' });
    },
  );
  return app;
}
