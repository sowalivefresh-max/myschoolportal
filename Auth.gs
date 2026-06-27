/**
 * ============================================================
 *  ABECEDARIAN ACADEMY — SCHOOL MANAGEMENT PORTAL
 *  Auth.gs  —  Authentication & Session Management
 * ============================================================
 *  - SHA-256 password hashing
 *  - Token-based sessions via ScriptProperties
 *  - 8-hour session timeout
 *  - Multi-role support
 * ============================================================
 */

// ─── Authentication ──────────────────────────────────────────

/**
 * Authenticate a user with email and password.
 * @returns {Object} { success, token, role, userName, userId, section } or { success:false, message }
 */
function authenticate(email, password) {
  if (!email || !password) {
    return { success: false, message: 'Email and password are required.' };
  }

  email = email.trim().toLowerCase();
  var hash = hashPassword(password);

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Users');
  if (!sheet) return { success: false, message: 'System not initialised. Run setupSheets() first.' };

  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rowEmail  = String(row[2]).trim().toLowerCase();
    var rowHash   = String(row[3]);
    var rowStatus = String(row[8]).toLowerCase();  // Column I: Status
    var rowSalt   = String(row[13] || '');         // Column N: PasswordSalt (empty for legacy accounts)

    if (rowEmail === email && hashPassword(password, rowSalt) === rowHash) {
      if (rowStatus !== 'active') {
        return { success: false, message: 'Account is suspended. Please contact the administrator.' };
      }

      var userId   = String(row[0]);
      var fullName = String(row[1]);
      var role     = String(row[4]).toLowerCase();
      var section  = String(row[5]).toLowerCase();

      var token = createSession(userId, role, fullName, section);

      // Log the login
      logAudit(userId, 'LOGIN', fullName + ' logged in as ' + role);

      return {
        success:  true,
        token:    token,
        role:     role,
        userName: fullName,
        userId:   userId,
        section:  section
      };
    }
  }

  return { success: false, message: 'Invalid email or password. Please try again.' };
}

// ─── Session Management ──────────────────────────────────────

/**
 * Create a new session token and store it in ScriptProperties.
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

  var props = PropertiesService.getScriptProperties();
  props.setProperty('sess_' + token, JSON.stringify(sessionData));

  return token;
}

/**
 * Validate a session token.
 * Returns the session object (with .token field) or null if invalid/expired.
 */
function validateSession(token) {
  if (!token) return null;

  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('sess_' + token);
  if (!raw) return null;

  try {
    var session = JSON.parse(raw);
    var created = new Date(session.createdAt);
    var hoursElapsed = (new Date() - created) / (1000 * 60 * 60);

    if (hoursElapsed > 8) {
      props.deleteProperty('sess_' + token);
      return null;
    }

    session.token = token;
    return session;
  } catch (e) {
    return null;
  }
}

/**
 * Destroy a session (logout).
 * @returns {Object} { success: true }
 */
function destroySession(token) {
  if (!token) return { success: false, message: 'No token provided.' };
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty('sess_' + token);
  return { success: true, message: 'Logged out successfully.' };
}

/**
 * Clean up all expired sessions (run periodically via trigger).
 */
function cleanExpiredSessions() {
  var props = PropertiesService.getScriptProperties();
  var allProps = props.getProperties();
  var now = new Date();
  var cleaned = 0;

  for (var key in allProps) {
    if (key.indexOf('sess_') === 0) {
      try {
        var s = JSON.parse(allProps[key]);
        var hours = (now - new Date(s.createdAt)) / (1000 * 60 * 60);
        if (hours > 8) {
          props.deleteProperty(key);
          cleaned++;
        }
      } catch (e) {
        props.deleteProperty(key); // Remove corrupted sessions
      }
    }
  }

  Logger.log('Cleaned ' + cleaned + ' expired sessions.');
  return cleaned;
}

// ─── Password Hashing ────────────────────────────────────────

/**
 * Generate a random 16-character hex salt for password hashing.
 */
function generateSalt() {
  var chars = '0123456789abcdef';
  var salt = '';
  for (var i = 0; i < 32; i++) {
    salt += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return salt;
}

/**
 * Hash a password using SHA-256, optionally with a per-user salt.
 * Backward compatible: hashPassword(pwd) with no salt works as before.
 * @param {string} password - plain text password
 * @param {string} [salt]   - per-user random salt (empty string = legacy behaviour)
 * @returns {string} hex-encoded hash
 */
function hashPassword(password, salt) {
  var input = (salt || '') + String(password);
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input);
  var hex = '';
  for (var i = 0; i < raw.length; i++) {
    var byte = (raw[i] + 256) % 256;
    var h = byte.toString(16);
    hex += (h.length === 1 ? '0' : '') + h;
  }
  return hex;
}

/**
 * Verify a user's current password.
 */
function verifyUserPassword(userId, password) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Users');
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(userId)) {
      var salt = String(data[i][13] || '');
      return hashPassword(password, salt) === String(data[i][3]);
    }
  }
  return false;
}
