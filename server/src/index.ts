import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import organizationRoutes from './routes/organizationRoutes';
import contactRoutes from './routes/contactRoutes';
import { logger } from './logger';
import { requestLogger } from './middleware/requestLogger';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Routes
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'Orion CRM API is running' });
});

app.use('/api/organizations', organizationRoutes);
app.use('/api/contacts', contactRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler (4 arguments so Express recognizes it as an error handler)
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(err.message, { stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});

export default app;
