import { app } from './app';

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  process.stdout.write(`Recipe API: http://localhost:${port}/api/recipes\n`);
});
