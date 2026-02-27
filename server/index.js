import 'dotenv/config';
import express from 'express';
import path from 'path';
import cors from 'cors';
import passport from 'passport';
import cookieParser from 'cookie-parser';
import connectDB from './config/db.js';
import interswitchRoutes from './interswitch.js';
import transactionRoutes from './transactions.js';
connectDB();

const app = express();
const PORT = process.env.PORT || 9090;

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

import { startBlockchainListener } from './workers/blockchainListener.js';
import { startBtcListener } from './workers/btcListener.js';
import { startEthListener } from './workers/ethListener.js';
import { startSolListener } from './workers/solListener.js';
import { startSweepWorker } from './workers/sweepWorker.js';
import { distributeYield } from './services/stakingService.js';

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  startBlockchainListener(); // TRC20 (USDT, ETH_TRC20, SOL_TRC20)
  startBtcListener();        // Native BTC
  startEthListener();        // Native ETH + USDT ERC20
  startSolListener();        // Native SOL
  startSweepWorker();        // TRON Sweep Retry Queue

  // Daily staking yield distribution (runs every 24h)
  const YIELD_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
  setInterval(async () => {
    try {
      console.log('[STAKING CRON] Running daily yield distribution...');
      await distributeYield();
    } catch (err) {
      console.error('[STAKING CRON] Yield distribution failed:', err.message);
    }
  }, YIELD_INTERVAL_MS);
  console.log('📈 [STAKING CRON] Daily yield distribution scheduled (every 24h)');
});
