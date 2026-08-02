import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import multer from "multer";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { scheduledInsightsHandler } from "../scheduledInsights";
import { scheduledGoogleSyncHandler } from "../scheduledGoogleSync";
import { storagePut } from "../storage";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // Voice audio upload endpoint — accepts multipart audio blob, uploads to S3, returns URL
  const voiceUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 16 * 1024 * 1024 }, // 16 MB
    fileFilter: (_req, file, cb) => {
      // Accept all audio/* and video/* types — iOS Safari may send audio/mp4, video/mp4, etc.
      cb(null, file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/') || file.mimetype === 'application/octet-stream');
    },
  });
  app.post('/api/voice/upload', voiceUpload.single('audio'), async (req: express.Request & { file?: Express.Multer.File }, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No audio file provided' });
        return;
      }
      const ext = req.file.mimetype.includes('mp4') || req.file.mimetype.includes('m4a') ? 'm4a'
        : req.file.mimetype.includes('ogg') ? 'ogg'
        : req.file.mimetype.includes('wav') ? 'wav'
        : req.file.mimetype.includes('mpeg') ? 'mp3'
        : 'webm';
      const key = `voice/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { url } = await storagePut(key, req.file.buffer, req.file.mimetype);
      res.json({ url });
    } catch (err) {
      console.error('[voice/upload]', err);
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  // Scheduled (Heartbeat) endpoints — must be registered before the Vite/static fallthrough.
  app.post("/api/scheduled/insights", scheduledInsightsHandler);
  app.post("/api/scheduled/google-sync", scheduledGoogleSyncHandler);

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
