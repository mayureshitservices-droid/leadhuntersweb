import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});
redisClient.connect().catch(console.error);

app.use(session({
  store: new RedisStore({ client: redisClient, prefix: "leadhunters:" }),
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using HTTPS
}));

import webRoutes from './routes/web.routes.js';
import authRoutes from './routes/auth.routes.js';
import leadsRoutes from './routes/leads.routes.js';
import syncRoutes from './routes/sync.routes.js';
import appRoutes from './routes/app.routes.js';

app.use('/', webRoutes);
app.use('/', appRoutes); // Allow /version as well as /api/app/version
app.use('/api/auth', authRoutes);
app.use('/api/v1', leadsRoutes);
app.use('/api/v1', syncRoutes);
app.use('/api/app', appRoutes);

export default app;
