import express, { Request, Response } from 'express';
import authRouter from './routes/auth';

const app = express();
app.use(express.json());

// Direct app route definition
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/info', (req: Request, res: Response) => {
  res.json({ version: '1.0.0', service: 'sample-express-app' });
});

// Mounted router
app.use('/auth', authRouter);

export default app;