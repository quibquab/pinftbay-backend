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

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Pi NFT Bay Backend is running!',
    timestamp: new Date().toISOString(),
    piSandbox: process.env.PI_SANDBOX === 'true'
  });
});

// Home route
app.get('/', (req, res) => {
  res.json({
    message: 'Pi NFT Bay Backend API',
    service: 'Pi NFT Marketplace Backend',
    endpoints: [
      'GET /health - Health check',
      'GET /wallet-test - Pi wallet test page',
      'POST /api/auth/challenge',
      'POST /api/auth/verify', 
      'GET /api/auth/me'
    ]
  });
});

// Pi wallet test page (COMPLETE VERSION)
app.get('/wallet-test', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
    <title>Pi NFT Bay - Wallet Test</title>
    <script src="https://sdk.minepi.com/pi-sdk.js"></script>
    <style>
        body { font-family: Arial; padding: 20px; text-align: center; background: #f0f9ff; }
        h1 { color: #f97316; }
        button { background: #f97316; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; }
        #status { margin: 20px; padding: 10px; border-radius: 5px; }
        .success { background: #d1fae5; color: #065f46; }
        .error { background: #fee2e2; color: #991b1b; }
        .info { background: #dbeafe; color: #1e40af; }
    </style>
</head>
<body>
    <h1>🚀 Pi NFT Bay</h1>
    <h2>Pi Wallet Test</h2>
    <button onclick="connectWallet()">Connect Pi Wallet</button>
    <div id="status"></div>
    
    <script>
        window.add