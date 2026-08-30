import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
app.use(express.json({ limit: '6mb' }));

const PORT = Number(process.env.PORT || 3000);

async function start() {
  try {
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

   // Create Vite server for development
// Allow overriding Vite HMR/WebSocket port via env to avoid conflicts
const hmrPort = Number(process.env.VITE_WS_PORT || process.env.HMR_PORT || 24679);
const vite = await createViteServer({ 
  server: { middlewareMode: true, hmr: { port: hmrPort } } 
});

// Use Vite's connect instance as middleware 
app.use(vite.middlewares);

// Fallback to index.html for SPA 
app.get('/', (req, res) => { 
  res.sendFile(path.resolve(__dirname, 'index.html')); 
});

    // Fallback to index.html for SPA
    app.get('/', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'index.html'));
    });

    // Start server
    app.listen(PORT, () => {
      console.log(`\n✨ Server running at http://localhost:${PORT}\n`);
    });
  } catch (error) {
    console.error('Server startup error:', error);
    process.exit(1);
  }
}

start();





























