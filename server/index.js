import 'dotenv/config';
import express from 'express';
import path from 'path';
import cors from 'cors';
import passport from 'passport';
import cookieParser from 'cookie-parser';
import cron from 'node-cron';
import connectDB from './config/db.js';
import interswitchRoutes from './interswitch.js';
import transactionRoutes from './transactions.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import * as Sentry from "@sentry/node";
import { sendAlert } from './utils/alerting.js';

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 9090;

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
  console.log('🛡️ Sentry initialized.');
}

// ── Global Error Hardening (Fail-Safe) ────────────────────────
// Prevent Redis errors or other unhandled promises from crashing the process
process.on('unhandledRejection', (reason, promise) => {
  if (reason?.message?.includes('Connection is closed') ||
    reason?.message?.includes('Redis') ||
    reason?.message?.includes('ECONNRESET')) {
    console.warn('[Redis] Unhandled rejection swallowed (Resilience Mode):', reason.message);
    return;
  }
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// ── Environment Hardening (Fail-Fast) ─────────────────────────
const CRITICAL_VARS = [
  'JWT_SECRET',
  'MONGODB_URI',
  'PLATFORM_FEE_WALLET_ID',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
];

const placeholders = [
  'fallback_secret_do_not_use_in_prod',
  'REPLACE_WITH_YOUR_MASTER_PRIVATE_KEY',
  'your_interswitch_client_id_here'
];

console.log('🛡️ Security: Validating environment variables...');
const missing = CRITICAL_VARS.filter(v => !process.env[v]);
const insecure = CRITICAL_VARS.filter(v => process.env[v] && placeholders.includes(process.env[v]));

if (missing.length > 0 || insecure.length > 0) {
  console.error('❌ FATAL ERROR: Insecure environment detected.');
  if (missing.length > 0) console.error(`   Missing: ${missing.join(', ')}`);
  if (insecure.length > 0) console.error(`   Insecure/Placeholder: ${insecure.join(', ')}`);
  console.error('   Server shutdown to protect user funds.');
  process.exit(1);
}

// ── Email Config Check ──────────────────────────────
if (process.env.MAIL_USER && process.env.MAIL_PASS) {
  console.log(`✅ [EMAIL] Mail config loaded for: ${process.env.MAIL_USER}`);
} else {
  console.warn('⚠️ [EMAIL] MAIL_USER or MAIL_PASS not set. OTP emails will fail.');
}

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
  console.log('ℹ️ NODE_ENV not set, defaulting to "development"');
}
console.log('✅ Environment validated.');

app.use(cors({
  origin: true, // Allow requests from Vite proxy or current origin
  credentials: true // Crucial for accepting cookies from frontend
}));
app.use(express.json({
  verify: (req, res, buf) => {
    if (req.originalUrl && req.originalUrl.includes('/webhook')) {
      req.rawBody = buf.toString();
    }
  }
}));
app.use(cookieParser());
app.use(passport.initialize());

import userRoutes from './routes/userRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import developerRoutes from './routes/developerRoutes.js';
import checkoutRoutes from './routes/checkoutRoutes.js';
import merchantRoutes from './routes/merchantRoutes.js';
import giftcardRoutes from './routes/giftcardRoutes.js';
import stakingRoutes from './routes/stakingRoutes.js';
import korapayRoutes from './routes/korapayRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

// Apply global rate limiter to all /api routes
// Note: apiLimiter is now configured to fail-open inside its own middleware
app.use('/api', apiLimiter);

app.use('/api/interswitch', interswitchRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);

// B2B Gateway Routes
app.use('/api/developer', developerRoutes);
app.use('/api/v1/checkout', checkoutRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/giftcards', giftcardRoutes);
app.use('/api/staking', stakingRoutes);
app.use('/api/korapay', korapayRoutes);
app.use('/api/ai', aiRoutes);


app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static assets in production
const __dirname = path.resolve();
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// Error Handling Middleware
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

import { startBlockchainListener } from './workers/blockchainListener.js';
import { startBtcListener } from './workers/btcListener.js';
import { startEthListener } from './workers/ethListener.js';
import { startSolListener } from './workers/solListener.js';
import { startWebhookWorker } from './workers/webhookRetryWorker.js';
import { startSweepWorker } from './workers/sweepWorker.js';
import { distributeYield } from './services/stakingService.js';
import { sendDailyStats } from './utils/alerting.js';

// ── Server Startup ───────────────────────────────────────────
const startServer = async () => {
  try {
    // 1. Force strict DB connection first
    await connectDB();
    console.log('✅ MongoDB Connected and ready');

    // 2. Start all workers only after DB is ready
    startBlockchainListener(); // TRC20 (USDT, ETH_TRC20, SOL_TRC20)
    startBtcListener();        // Native BTC
    startEthListener();        // Native ETH + USDT ERC20
    startSolListener();        // Native SOL
    startSweepWorker();        // TRON Sweep Retry Queue
    startWebhookWorker();      // Webhook Notification Queue

    console.log('✅ All workers started');

    // 3. Schedule recurring tasks
    cron.schedule('0 0 * * *', async () => {
      try {
        console.log('[STAKING CRON] Running daily yield distribution...');
        await distributeYield();
      } catch (err) {
        console.error('[STAKING CRON] Yield distribution failed:', err.message);
      }
    });
    console.log('📈 [STAKING CRON] Daily yield distribution scheduled (00:00)');

    // 4. Finally start listening for traffic
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error('❌ FATAL: Failed to start server:', err.message);
    process.exit(1);
  }
};

startServer();
