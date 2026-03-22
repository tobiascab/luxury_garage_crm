const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const router = express.Router();

/**
 * OAuth callback handler for ARIZAR IA Marketplace App
 * Exchanges authorization code for access/refresh tokens
 */
router.get('/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ success: false, message: 'Código de autorización no recibido' });
  }

  try {
    console.log('🔐 OAuth callback recibido, intercambiando código por tokens...');

    const response = await axios.post('https://services.leadconnectorhq.com/oauth/token', 
      new URLSearchParams({
        client_id: process.env.ARIZAR_CLIENT_ID,
        client_secret: process.env.ARIZAR_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${process.env.FRONTEND_URL}/api/arizar/oauth/callback`,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token, expires_in, locationId } = response.data;

    if (!access_token) {
      console.error('❌ No se recibió access_token:', response.data);
      return res.status(500).json({ success: false, message: 'No se recibió token' });
    }

    // Save tokens to a file for persistence
    const tokensPath = path.join(__dirname, '../../.arizar-oauth-tokens.json');
    const tokenData = {
      access_token,
      refresh_token,
      expires_in,
      locationId,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + (expires_in || 86400) * 1000).toISOString(),
    };

    fs.writeFileSync(tokensPath, JSON.stringify(tokenData, null, 2));
    console.log(`✅ OAuth tokens guardados en ${tokensPath}`);
    console.log(`   Location: ${locationId}`);
    console.log(`   Expira en: ${expires_in}s`);

    // Redirect to admin panel with success message
    res.redirect('/admin/crm?oauth=success');

  } catch (err) {
    console.error('❌ Error intercambiando código OAuth:', err.response?.data || err.message);
    res.status(500).json({ 
      success: false, 
      message: 'Error intercambiando código',
      error: err.response?.data || err.message 
    });
  }
});

/**
 * Refresh token endpoint
 */
router.post('/refresh', async (req, res) => {
  try {
    const tokensPath = path.join(__dirname, '../../.arizar-oauth-tokens.json');
    if (!fs.existsSync(tokensPath)) {
      return res.status(400).json({ success: false, message: 'No hay tokens guardados' });
    }

    const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));

    const response = await axios.post('https://services.leadconnectorhq.com/oauth/token',
      new URLSearchParams({
        client_id: process.env.ARIZAR_CLIENT_ID,
        client_secret: process.env.ARIZAR_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token, expires_in } = response.data;

    tokens.access_token = access_token;
    tokens.refresh_token = refresh_token;
    tokens.expires_in = expires_in;
    tokens.created_at = new Date().toISOString();
    tokens.expires_at = new Date(Date.now() + (expires_in || 86400) * 1000).toISOString();

    fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));
    console.log('🔄 OAuth tokens renovados');

    res.json({ success: true, message: 'Tokens renovados', expires_at: tokens.expires_at });
  } catch (err) {
    console.error('❌ Error renovando tokens:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: err.response?.data || err.message });
  }
});

/**
 * Get current token status
 */
router.get('/status', (req, res) => {
  const tokensPath = path.join(__dirname, '../../.arizar-oauth-tokens.json');
  if (!fs.existsSync(tokensPath)) {
    return res.json({ success: true, connected: false });
  }
  const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
  res.json({ 
    success: true, 
    connected: true, 
    locationId: tokens.locationId,
    expires_at: tokens.expires_at,
    expired: new Date(tokens.expires_at) < new Date(),
  });
});

module.exports = router;
