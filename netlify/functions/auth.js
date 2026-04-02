// netlify/functions/auth.js - Handle login and token management
const crypto = require('crypto');

// Simple in-memory cache for demo (in production, use Redis or similar)
// In Netlify free tier, we can't persist across deployments, so we store in environment or accept token from frontend
const tokenCache = {};

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  
  try {
    const { email, password } = JSON.parse(event.body);
    
    if (!email || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email and password required' })
      };
    }

    // Call Boson Motors login API
    const loginResponse = await fetch('https://botcontrol.bosonmotors.com/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!loginResponse.ok) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid credentials' })
      };
    }

    const loginData = await loginResponse.json();
    
    // Cache the token temporarily (7 days validity from server)
    tokenCache[email] = {
      token: loginData.token,
      vehicleDetails: loginData.vehicleDetails,
      containsBothVehicleType: loginData.containsBothVehicleType,
      timestamp: Date.now()
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        token: loginData.token,
        vehicleDetails: loginData.vehicleDetails,
        containsBothVehicleType: loginData.containsBothVehicleType,
        message: 'Login successful. Token is valid for 7 days.'
      })
    };

  } catch (error) {
    console.error('Auth error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
