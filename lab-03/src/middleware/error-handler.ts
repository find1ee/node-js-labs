import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      issues: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
    });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: 'HTTP_ERROR', message: error.message });
    return;
  }
  if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    res.status(400).json({ error: 'INVALID_JSON', message: 'Тіло запиту не є коректним JSON' });
    return;
  }
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Помилка сервера' });
};
