// ===========================================================================
// Google OAuth Routes — Authentication for dashboard editor
// ===========================================================================

import { Elysia, t } from 'elysia';
import { OAuth2Client } from 'google-auth-library';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';
const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN || 'madhive.com';

// In-memory session store (use Redis/DB in production)
const sessions = new Map();

/**
 * Create OAuth2 client
 */
function getOAuthClient() {
  return new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

/**
 * Generate a random session token
 */
function generateSessionToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Google OAuth routes
 */
export const googleOAuthRoutes = new Elysia({ prefix: '/auth/google' })
  // Initiate OAuth flow
  .get('/login', () => {
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ error: 'OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }

    const oauth2Client = getOAuthClient();
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });

    // Redirect to Google's OAuth consent screen
    return new Response(null, {
      status: 302,
      headers: { 'Location': authUrl }
    });
  }, {
    detail: {
      tags: ['Authentication'],
      summary: 'Initiate Google OAuth',
      description: 'Redirects to Google OAuth consent screen'
    }
  })

  // Handle OAuth callback
  .get('/callback', async ({ query, set }) => {
    try {
      const { code } = query;

      if (!code) {
        set.status = 400;
        return { error: 'Authorization code missing' };
      }

      const oauth2Client = getOAuthClient();
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      // Get user info
      const ticket = await oauth2Client.verifyIdToken({
        idToken: tokens.id_token,
        audience: CLIENT_ID,
      });

      const payload = ticket.getPayload();
      const email = payload.email;
      const domain = email.split('@')[1];

      // Check if user's email domain is allowed
      if (ALLOWED_DOMAIN && domain !== ALLOWED_DOMAIN) {
        set.status = 403;
        return { error: `Access denied. Only ${ALLOWED_DOMAIN} emails are allowed.` };
      }

      // Create session
      const sessionToken = generateSessionToken();
      sessions.set(sessionToken, {
        email: email,
        name: payload.name,
        picture: payload.picture,
        tokens: tokens,
        createdAt: Date.now()
      });

      // Redirect to dashboard with session cookie
      return new Response(null, {
        status: 302,
        headers: {
          'Location': '/',
          'Set-Cookie': `session=${sessionToken}; HttpOnly; Path=/; Max-Age=86400; SameSite=Strict`
        }
      });
    } catch (error) {
      console.error('[OAuth] Callback error:', error);
      set.status = 500;
      return { error: 'Authentication failed' };
    }
  }, {
    detail: {
      tags: ['Authentication'],
      summary: 'OAuth callback',
      description: 'Handles OAuth callback from Google'
    }
  })

  // Logout
  .get('/logout', ({ cookie }) => {
    const sessionToken = cookie.session;
    if (sessionToken) {
      sessions.delete(sessionToken);
    }

    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/',
        'Set-Cookie': 'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict'
      }
    });
  }, {
    detail: {
      tags: ['Authentication'],
      summary: 'Logout',
      description: 'Clears session and logs out user'
    }
  })

  // Get current user
  .get('/me', ({ cookie, set }) => {
    const sessionToken = cookie.session;

    if (!sessionToken || !sessions.has(sessionToken)) {
      set.status = 401;
      return { error: 'Not authenticated' };
    }

    const session = sessions.get(sessionToken);

    // Check if session is expired (24 hours)
    if (Date.now() - session.createdAt > 86400000) {
      sessions.delete(sessionToken);
      set.status = 401;
      return { error: 'Session expired' };
    }

    return {
      email: session.email,
      name: session.name,
      picture: session.picture
    };
  }, {
    detail: {
      tags: ['Authentication'],
      summary: 'Get current user',
      description: 'Returns current authenticated user info'
    }
  });

/**
 * Middleware to check authentication
 */
export function requireAuth() {
  return new Elysia()
    .derive(({ cookie, set }) => {
      const sessionToken = cookie.session;

      if (!sessionToken || !sessions.has(sessionToken)) {
        set.status = 401;
        throw new Error('Authentication required');
      }

      const session = sessions.get(sessionToken);

      // Check if session is expired
      if (Date.now() - session.createdAt > 86400000) {
        sessions.delete(sessionToken);
        set.status = 401;
        throw new Error('Session expired');
      }

      return {
        user: {
          email: session.email,
          name: session.name,
          picture: session.picture
        }
      };
    });
}
