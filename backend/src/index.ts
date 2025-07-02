import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { logger } from './utils/logger';
import { connectDatabase } from './database/connection';
import { initializeRedis } from './services/redis';
import { initializeMinIO } from './services/storage';

// Import routes
import authRoutes from './routes/auth';
import agentsRoutes from './routes/agents';
import conversationsRoutes from './routes/conversations';
import integrationsRoutes from './routes/integrations';
import analyticsRoutes from './routes/analytics';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(rateLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/analytics', analyticsRoutes);

// WebSocket handling
io.on('connection', (socket) => {
  logger.info(`New WebSocket connection: ${socket.id}`);

  socket.on('join-conversation', (conversationId: string) => {
    socket.join(`conversation-${conversationId}`);
    logger.info(`Socket ${socket.id} joined conversation ${conversationId}`);
  });

  socket.on('leave-conversation', (conversationId: string) => {
    socket.leave(`conversation-${conversationId}`);
    logger.info(`Socket ${socket.id} left conversation ${conversationId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

// Error handling
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // Initialize services
    await connectDatabase();
    await initializeRedis();
    await initializeMinIO();

    httpServer.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🇮🇱 Hebrew AI Agents Platform - Ready to serve!`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });
});

export { app, io };