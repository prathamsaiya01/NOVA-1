import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

import express from 'express';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';

const app = express();
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization']
}));
app.use(express.json({ limit: '6mb' }));

const PORT = Number(process.env.PORT || 3000);

// The wardrobe UI relies on this local service to remove the background and
// crop the selected garment. Start it with the development server so a raw
// photo is never silently used as an AI-generated garment.
const startGarmentProcessor = () => {
  if (process.env.NOVA_DISABLE_AI === 'true') return;
  const processor = spawn('python', ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000'], {
    cwd: path.resolve(currentDirectory, 'server_ai'),
    stdio: 'ignore',
    windowsHide: true
  });
  processor.once('error', () => console.warn('NOVA garment processor could not start.'));
};

async function start() {
  try {
    startGarmentProcessor();
    const [
      { default: authRouter },
      { default: chatRouter },
      { default: analysisRouter },
      { default: productRouter }
    ] = await Promise.all([
      import('./server/authRouter.ts'),
      import('./server/chatRouter.ts'),
      import('./server/analysisRouter.ts'),
      import('./server/productRouter.ts')
    ]);

    app.use('/api', authRouter);
    app.use('/api', chatRouter);
    app.use('/api', analysisRouter);
    app.use('/api', productRouter);

    // Create Vite server for development. HMR is disabled because this server
    // runs Vite in middleware mode and owns the application port itself.
const vite = await createViteServer({
  server: {
    middlewareMode: true,
    allowedHosts: ['nova-1-1.onrender.com'],
    hmr: false
  }
});

// Use Vite's connect instance as middleware 
app.use(vite.middlewares);

// Fallback to index.html for SPA 
app.get('/', (req, res) => { 
  res.sendFile(path.resolve(currentDirectory, 'index.html')); 
});

    // Fallback to index.html for SPA
    app.get('/', (req, res) => {
      res.sendFile(path.resolve(currentDirectory, 'index.html'));
    });

    // Keep a second local dev process from making startup fail completely.
    const listen = (port: number) => {
      const server = app.listen(port, () => {
        console.log(`\n✨ Server running at http://localhost:${port}\n`);
      });

      server.once('error', (error: NodeJS.ErrnoException) => {
        if (error.code !== 'EADDRINUSE') {
          console.error('Server listen error:', error);
          process.exit(1);
        }
      });

      return server;
    };

    const server = listen(PORT);
    server.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        const fallbackPort = PORT + 1;
        console.warn(`Port ${PORT} is already in use. Retrying on ${fallbackPort}.`);
        listen(fallbackPort);
      }
    });
  } catch (error) {
    console.error('Server startup error:', error);
    process.exit(1);
  }
}

start();





























