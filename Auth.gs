/**
 * ============================================================
 *  MYSCHOOL PORTAL - Auth.gs
 *  Authentication & Session Management
 * ============================================================
 *  - Sessions stored in Firestore 'sessions' collection
 *  - SHA-256 password hashing with per-user salt (unchanged)
 *  - 8-hour session timeout
 *  - Multi-role support
 * ============================================================
 */

// --- AUTHENTICATION ------------------------------------------

/**
 * Authenticate a user with email and password.
 * Queries Firestore 'users' collection by email.
 * @returns {{ success, token, role, userName, userId, section }}
 */
function authenticate(email, password) {
  if (!email || !password) {
    return { success: false, message: 'Email and password are required.' };
  }
  email = email.trim().toLowerCase();

  // Query users by email field
  var users = firebaseQuery('users', [{ field: 'email', op: 'EQUAL', value: email }]);
  if (!users || users.length === 0) {
    return { success: false, message: 'Invalid email or password. Please try again.' };
  }

  var user     = users[0];
  var userId   = user.id;
  var salt     = user.salt || '';
  var stored   = user.passwordHash || '';
  var status   = String(user.status || '').toLowerCase();
  var role     = String(user.role || '').toLowerCase();

  if (hashPassword(password, salt) !== stored) {
    return { success: false, message: 'Invalid email or password. Please try again.' };
  }

  if (status !== 'active') {
    return { success: false, message: 'Account is suspended. Please contact the administrator.' };
  }

  var token = createSession(userId, role, user.fullName, user.section);
  logAudit(userId, 'LOGIN', user.fullName + ' logged in as ' + role);

  return {
    success:  true,
    token:    token,
    role:     role,
    userName: user.fullName,
    userId:   userId,
    section:  user.section || 'both'
  };
}

// --- SESSION MANAGEMENT --------------------------------------

/**
 * Create a new session and store it in Firestore 'sessions' collection.
 * @returns {string} session token (UUID)
 */
function createSession(userId, role, fullName, section) {
  var token = Utilities.getUuid();
  var sessionData = {
    userId:    userId,
    role:      role,
    fullName:  fullName,
    section:   section || 'both',
    createdAt: new Date().toISOString()
  };
  firebaseSet('sessions', token, sessionData);
  return token;
}

/**
 * Validate a session token.
 * Returns session object (with .token) or null if invalid/expired.
 */
function validateSession(token) {
  if (!token) return null;
  try {
    var session = firebaseGet('sessions', token);
    if (!session) return null;

    var created      = new Date(session.createdAt);
    var hoursElapsed = (new Date() - created) / (1000 * 60 * 60);

    if (hoursElapsed > 8) {
      firebaseDelete('sessions', token);
      return null;
    }

    session.token = token;
    return session;
  } catch(e) {
    Logger.log('validateSession error: ' + e.message);
    return null;
  }
}

/**
 * Destroy a session (logout).
 */
function destroySession(token) {
  if (!token) return { success: false, message: 'No token provided.' };
  try {
    firebaseDelete('sessions', token);
  } catch(e) {}
  return { success: true, message: 'Logged out successfully.' };
}

/**
 * Clean up all expired sessions.
 * Can be scheduled via a time-based trigger (e.g. daily).
 */
function cleanExpiredSessions() {
  try {
    var eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
    var expired = firebaseQuery('sessions', [
      { field: 'createdAt', op: 'LESS_THAN', value: eightHoursAgo }
    ]);
    var count = 0;
    expired.forEach(function(s) {
      if (s.id) { firebaseDelete('sessions', s.id); count++; }
    });
    Logger.log('Cleaned ' + count + ' expired sessions.');
    return count;
  } catch(e) {
    Logger.log('cleanExpiredSessions error: ' + e.message);
    return 0;
  }
}

// --- PASSWORD HASHING ----------------------------------------

/**
 * Generate a random 32-character hex salt.
 */
function generateSalt() {
  var chars = '0123456789abcdef';
  var salt  = '';
  for (var i = 0; i < 32; i++) {
    salt += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return salt;
}

/**
 * Hash a password with SHA-256 and an optional per-user salt.
 * Backward-compatible: hashPassword(pwd) with no salt works as before.
 * @param {string} password
 * @param {string} [salt]
 * @returns {string} hex-encoded hash
 */
function hashPassword(password, salt) {
  var input = (salt || '') + String(password);
  var raw   = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input);
  var hex   = '';
  for (var i = 0; i < raw.length; i++) {
    var b = (raw[i] + 256) % 256;
    var h = b.toString(16);
    hex  += (h.length === 1 ? '0' : '') + h;
  }
  return hex;
}

/**
 * Verify a user's current password against their Firestore record.
 */
function verifyUserPassword(userId, password) {
  try {
    var user = firebaseGet('users', userId);
    if (!user) return false;
    return hashPassword(password, user.salt || '') === (user.passwordHash || '');
  } catch(e) {
    Logger.log('verifyUserPassword error: ' + e.message);
    return false;
  }
}
