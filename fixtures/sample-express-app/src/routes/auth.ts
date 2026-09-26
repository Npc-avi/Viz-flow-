import { Router, Request, Response } from 'express';
import { loginHandler, registerHandler } from '../controllers/authController';

const authRouter = Router();

// Route 1: Direct function reference
authRouter.post('/login', loginHandler);

// Route 2: Direct function reference
authRouter.post('/register', registerHandler);

// Route 3: Inline arrow function handler
authRouter.get('/session', (req: Request, res: Response) => {
  return res.json({ authenticated: true });
});

export default authRouter;
