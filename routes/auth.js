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

// Verify Pi Network authentication
router.post('/verify', async (req, res) => {
  try {
    const { piUserId, accessToken, username } = req.body;

    if (!piUserId || !accessToken) {
      return res.status(400).json({
        error: 'Pi User ID and access token are required'
      });
    }

    // Verify with Pi Network API (sandbox mode)
    let piVerification;
    
    if (process.env.PI_SANDBOX === 'true') {
      // Sandbox verification
      piVerification = {
        valid: true,
        username: username || `user_${piUserId.slice(-6)}`,
        uid: piUserId
      };
    } else {
      // Production verification with Pi Network API
      try {
        const response = await axios.get('https://api.minepi.com/v2/me', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        piVerification = {
          valid: response.data.uid === piUserId,
          username: response.data.username,
          uid: response.data.uid
        };
      } catch (error) {
        piVerification = { valid: false };
      }
    }

    if (!piVerification.valid) {
      return res.status(401).json({
        error: 'Invalid Pi Network access token'
      });
    }

    // Create simple session token
    const sessionToken = Buffer.from(JSON.stringify({
      userId: piUserId,
      username: piVerification.username,
      timestamp: Date.now()
    })).toString('base64');

    res.json({
      success: true,
      user: {
        id: piUserId,
        username: piVerification.username,
        walletAddress: piUserId
      },
      token: sessionToken
    });

  } catch (error) {
    console.error('Authentication verification error:', error);
    res.status(500).json({
      error: 'Authentication failed'
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

    res.json({
      user: {
        id: userData.userId,
        username: userData.username,
        walletAddress: userData.userId
      }
    });

  } catch (error) {
    res.status(401).json({
      error: 'Invalid token'
    });
  }
});

module.exports = router;
        