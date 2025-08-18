const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Import routes
const authRoutes = require('./routes/auth');

// Middleware
app.use(cors({
  origin: ["https://pinftbay.art", "https://www.pinftbay.art", "http://localhost:3000"],
  credentials: true
}));

app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Routes
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Pi NFT Bay Backend is running!',
    timestamp: new Date().toISOString(),
    piSandbox: process.env.PI_SANDBOX === 'true'
  });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Test route
app.get('/api/test', (req, res) => {
  res.json({
    message: 'API is working!',
    service: 'Pi NFT Bay Backend',
    endpoints: [
      'POST /api/auth/challenge',
      'POST /api/auth/verify', 
      'GET /api/auth/me'
    ]
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Pi NFT Bay Backend running on http://localhost:${PORT}`);
  console.log(`📡 Health: http://localhost:${PORT}/health`);
  console.log(`🔑 Auth: http://localhost:${PORT}/api/auth/challenge`);
  console.log(`🌐 CORS: pinftbay.art enabled`);
});