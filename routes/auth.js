const express = require('express');
const axios = require('axios');
const router = express.Router();

// Generate authentication challenge
router.post('/challenge', async (req, res) => {
  try {
    const { piUserId } = req.body;

    if (!piUserId) {
      return res.status(400).json({
        error: 'Pi User ID is required'
      });
    }

    // Generate a unique challenge
    const challenge = Math.random().toString(36).substring(2, 15);
    const timestamp = Date.now();
    
    // Store challenge temporarily (in production, use Redis)
    global.authChallenges = global.authChallenges || new Map();
    global.authChallenges.set(piUserId, {
      challenge,
      timestamp,
      expiresAt: timestamp + (5 * 60 * 1000) // 5 minutes
    });

    res.json({
      challenge,
      timestamp,
      message: `Authenticate with Pi Network: ${challenge}`
    });

  } catch (error) {
    console.error('Challenge generation error:', error);
    res.status(500).json({
      error: 'Failed to generate authentication challenge'
    });
  }
});

// Helper function to verify Pi Network access token
async function verifyPiAccessToken(accessToken, piUserId) {
  try {
    console.log('Verifying Pi Network access token...');
    
    // Real Pi Network API call
    const response = await axios.get('https://api.minepi.com/v2/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        ...(process.env.PI_API_KEY && { 'X-API-Key': process.env.PI_API_KEY })
      },
      timeout: 10000 // 10 second timeout
    });

    console.log('Pi API Response:', {
      uid: response.data.uid,
      username: response.data.username,
      roles: response.data.roles
    });
    
    // Verify the user ID matches
    if (response.data && response.data.uid === piUserId) {
      return {
        valid: true,
        username: response.data.username,
        uid: response.data.uid,
        roles: response.data.roles || [],
        verified: response.data.verified || false
      };
    }

    console.warn('UID mismatch:', { expected: piUserId, received: response.data.uid });
    return { valid: false, error: 'User ID mismatch' };

  } catch (error) {
    console.error('Pi Network API Error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    // Handle specific error cases
    if (error.response?.status === 401) {
      return { valid: false, error: 'Invalid or expired access token' };
    }
    
    if (error.response?.status === 403) {
      return { valid: false, error: 'Insufficient permissions' };
    }
    
    if (error.response?.status === 429) {
      return { valid: false, error: 'Rate limit exceeded' };
    }
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return { valid: false, error: 'Pi Network API unavailable' };
    }
    
    return { valid: false, error: 'Pi Network verification failed' };
  }
}

// Verify Pi Network authentication
router.post('/verify', async (req, res) => {
  try {
    const { piUserId, accessToken, username } = req.body;

    if (!piUserId || !accessToken) {
      return res.status(400).json({
        error: 'Pi User ID and access token are required'
      });
    }

    console.log('Verifying authentication for user:', piUserId);
    
    let piVerification;
    
    // Check if we should use real Pi API or sandbox
    const useRealPiAPI = process.env.PI_SANDBOX !== 'true' && process.env.PI_API_KEY;
    
    if (useRealPiAPI) {
      console.log('Using real Pi Network API');
      piVerification = await verifyPiAccessToken(accessToken, piUserId);
    } else {
      console.log('Using sandbox mode');
      // Sandbox verification for development
      piVerification = {
        valid: true,
        username: username || `user_${piUserId.slice(-6)}`,
        uid: piUserId,
        roles: ['user'],
        verified: false
      };
    }

    if (!piVerification.valid) {
      console.log('Pi verification failed:', piVerification.error);
      return res.status(401).json({
        error: piVerification.error || 'Invalid Pi Network access token'
      });
    }

    // Create enhanced session token
    const sessionData = {
      userId: piUserId,
      username: piVerification.username,
      roles: piVerification.roles || [],
      verified: piVerification.verified || false,
      timestamp: Date.now(),
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    };

    const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString('base64');

    console.log('Authentication successful for:', piVerification.username);

    res.json({
      success: true,
      user: {
        id: piUserId,
        username: piVerification.username,
        walletAddress: piUserId,
        roles: piVerification.roles || [],
        verified: piVerification.verified || false,
        apiMode: useRealPiAPI ? 'production' : 'sandbox'
      },
      token: sessionToken
    });

  } catch (error) {
    console.error('Authentication verification error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get user profile
router.get('/me', (req, res) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No token provided'
      });
    }

    const token = authHeader.substring(7);
    const userData = JSON.parse(Buffer.from(token, 'base64').toString());

    // Check if token is expired
    if (userData.expiresAt && Date.now() > userData.expiresAt) {
      return res.status(401).json({
        error: 'Token expired'
      });
    }

    res.json({
      user: {
        id: userData.userId,
        username: userData.username,
        walletAddress: userData.userId,
        roles: userData.roles || [],
        verified: userData.verified || false,
        tokenIssuedAt: new Date(userData.timestamp).toISOString()
      }
    });

  } catch (error) {
    console.error('Token validation error:', error);
    res.status(401).json({
      error: 'Invalid token'
    });
  }
});

// Health check for auth service
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Pi NFT Bay Auth Service',
    piApiMode: process.env.PI_SANDBOX !== 'true' ? 'production' : 'sandbox',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;