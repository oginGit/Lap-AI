/**
 * recaptcha.js — Google reCAPTCHA v2 Verification
 * Validates the reCAPTCHA token sent from the frontend.
 */
require('dotenv').config();

/**
 * Verify a reCAPTCHA response token with Google's API
 * @param {string} token - The reCAPTCHA response token from the client
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function verifyRecaptcha(token) {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  // Skip verification in development if no key is set
  if (!secretKey || secretKey === 'your_recaptcha_secret_key_here') {
    console.warn('  ⚠️  reCAPTCHA secret key not configured — skipping verification');
    return { success: true };
  }

  if (!token) {
    return { success: false, error: 'reCAPTCHA token is missing' };
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`,
    });

    const data = await response.json();

    if (data.success) {
      return { success: true };
    } else {
      return {
        success: false,
        error: 'reCAPTCHA verification failed',
        errors: data['error-codes'] || [],
      };
    }
  } catch (err) {
    console.error('reCAPTCHA verification error:', err.message);
    return { success: false, error: 'reCAPTCHA service unavailable' };
  }
}

module.exports = { verifyRecaptcha };
