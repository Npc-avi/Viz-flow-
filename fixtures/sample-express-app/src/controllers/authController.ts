import { Request, Response } from 'express';

export function validateUserInput(email: string, pass: string): boolean {
  return email.includes('@') && pass.length >= 8;
}

export function generateAuthToken(userId: string): string {
  return `jwt-token-for-${userId}`;
}

export async function loginHandler(req: Request, res: Response) {
  const { email, password } = req.body;
  const isValid = validateUserInput(email, password);
  if (!isValid) {
    return res.status(400).json({ error: 'Invalid input credentials' });
  }
  const token = generateAuthToken('user-123');
  return res.json({ token, message: 'Logged in successfully' });
}

export async function registerHandler(req: Request, res: Response) {
  const { email, password } = req.body;
  const isValid = validateUserInput(email, password);
  if (!isValid) {
    return res.status(400).json({ error: 'Invalid email or weak password' });
  }
  return res.status(201).json({ success: true, message: 'User registered' });
}
