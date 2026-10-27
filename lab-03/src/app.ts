import cors from 'cors';
import express from 'express';
import { entityRouter } from './routes/entity';
import { errorHandler, HttpError } from './middleware/error-handler';

export const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/recipes', entityRouter);
app.use((_req, _res, next) => next(new HttpError(404, 'Маршрут не знайдено')));
app.use(errorHandler);
