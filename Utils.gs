/**
 * ============================================================
 *  ABECEDARIAN ACADEMY — SCHOOL MANAGEMENT PORTAL
 *  Utils.gs  —  Core Utility & Helper Functions
 * ============================================================
 *  Grading: Nigerian A1–F9 system
 *  Assessment: CA1(10) + CA2(10) + CA3(10) + Exam(70) = 100
 * ============================================================
 */

// ─── ID Generation ──────────────────────────────────────────

/**
 * Generate a unique alphanumeric ID (12 characters).
 */
function generateId() {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var id = 'AA'; // prefix for Abecedarian Academy
  for (var i = 0; i < 10; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
 * Generate a receipt reference number.
 */
function generateReceiptRef() {
  var now = new Date();
  var y = now.getFullYear().toString().slice(2);
  var m = String(now.getMonth() + 1).padStart(2, '0');
  var d = String(now.getDate()).padStart(2, '0');
  var rand = Math.floor(Math.random() * 9000) + 1000;
  return 'RCT-' + y + m + d + '-' + rand;
}

// ─── Input Validation ────────────────────────────────────────

/**
 * Validate a data object against a set of field rules.
 *
 * Rule properties:
 *   field      {string}  - key in data object
 *   required   {boolean} - must be non-empty
 *   type       {string}  - 'string' | 'number' | 'email' (default: 'string')
 *   maxLength  {number}  - maximum character length (strings)
 *   min        {number}  - minimum value (numbers)
 *   max        {number}  - maximum value (numbers)
 *
 * Returns { valid: true } or { valid: false, message: 'Validation error: ...' }
 */
function validateInput(data, rules) {
  var errors = [];

  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i];
    var value = data[rule.field];
    var isEmpty = (value === undefined || value === null || String(value).trim() === '');

    // Required check
    if (rule.required && isEmpty) {
      errors.push('"' + rule.field + '" is required.');
      continue; // skip further checks for this field
    }

    // Skip remaining checks if field is optional and empty
    if (isEmpty) continue;

    var strVal = String(value).trim();

    // Max length check (strings)
    if (rule.maxLength && strVal.length > rule.maxLength) {
      errors.push('"' + rule.field + '" must be ' + rule.maxLength + ' characters or fewer (got ' + strVal.length + ').');
    }

    // Numeric checks
    if (rule.type === 'number') {
      var num = Number(value);
      if (isNaN(num)) {
        errors.push('"' + rule.field + '" must be a number.');
      } else {
        if (rule.min !== undefined && num < rule.min)
          errors.push('"' + rule.field + '" must be at least ' + rule.min + '.');
        if (rule.max !== undefined && num > rule.max)
          errors.push('"' + rule.field + '" must be at most ' + rule.max + '.');
      }
    }

    // Email format check
    if (rule.type === 'email' && !isValidEmail(strVal)) {
      errors.push('"' + rule.field + '" must be a valid email address.');
    }
  }

  if (errors.length > 0) {
    return { valid: false, message: 'Validation error: ' + errors.join(' ') };
  }
  return { valid: true };
}

// ─── Sheet Operations ────────────────────────────────────────

/**
 * Find the 1-based row index of a record by its ID (column A).
 * Returns -1 if not found.
 */
function findRowById(sheet, id) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      return i + 1;
    }
  }
  return -1;
}

/**
 * Convert a sheet row to a plain object using header names.
 * Header → camelCase key mapping.
 */
function rowToObject(headers, row) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) {
    var key = toCamelCase(String(headers[i]));
    var val = row[i] !== undefined ? row[i] : '';
    // Stringify Date objects to prevent JSON serialization failures
    if (val && Object.prototype.toString.call(val) === '[object Date]') {
      val = val.toISOString().split('T')[0];
    }
    obj[key] = val;
  }
  return obj;
}

/**
 * Get all data rows from a named sheet as an array of objects.
 * Skips empty rows.
 */
function getSheetData(sheetName) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var headers = data[0];
  var results = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] !== '' && data[i][0] !== undefined && data[i][0] !== null) {
      results.push(rowToObject(headers, data[i]));
    }
  }
  return results;
}

/**
 * Convert a string to camelCase.
 * "FullName" → "fullName", "Student ID" → "studentId"
 */
function toCamelCase(str) {
  if (!str) return '';
  // Remove spaces, convert PascalCase
  var result = str.replace(/\s+([\w])/g, function(m, letter) {
    return letter.toUpperCase();
  });
  return result.charAt(0).toLowerCase() + result.slice(1);
}

// ─── Nigerian Grading System ─────────────────────────────────

/**
 * Compute Nigerian A1–F9 grade from total score (0–100).
 * Configurable via Settings sheet.
 */
function computeGrade(total) {
  var t = Number(total) || 0;
  var rules = getSheetData('Grading');
  if (rules && rules.length > 0) {
    // Sort by min descending
    rules.sort(function(a, b){ return Number(b.min) - Number(a.min); });
    for (var i = 0; i < rules.length; i++) {
      if (t >= Number(rules[i].min)) return rules[i].grade;
    }
  }
  // Fallback
  if (t >= 75) return 'A1';
  if (t >= 70) return 'B2';
  if (t >= 65) return 'B3';
  if (t >= 60) return 'C4';
  if (t >= 55) return 'C5';
  if (t >= 50) return 'C6';
  if (t >= 45) return 'D7';
  if (t >= 40) return 'E8';
  return 'F9';
}

/**
 * Get a descriptive remark for a Nigerian grade.
 */
function getGradeRemark(grade) {
  var rules = getSheetData('Grading');
  if (rules && rules.length > 0) {
    var rule = rules.find(function(r){ return String(r.grade).toUpperCase() === String(grade).toUpperCase(); });
    if (rule) return rule.remark;
  }
  var remarks = {
    'A1': 'Excellent', 'B2': 'Very Good', 'B3': 'Good', 'C4': 'Credit',
    'C5': 'Credit', 'C6': 'Credit', 'D7': 'Pass', 'E8': 'Pass', 'F9': 'Fail'
  };
  return remarks[grade] || '';
}

/**
 * Check if grade is a pass (A1–E8).
 */
function isPassGrade(grade) {
  return ['A1', 'B2', 'B3', 'C4', 'C5', 'C6', 'D7', 'E8'].indexOf(grade) !== -1;
}

/**
 * Compute total score from assessment components.
 * CA1 (0-10) + CA2 (0-10) + CA3 (0-10) + Exam (0-70) = 100
 */
function computeTotal(ca1, ca2, ca3, exam) {
  var total = Number(ca1 || 0) + Number(ca2 || 0) + Number(ca3 || 0) + Number(exam || 0);
  return Math.round(total * 10) / 10;
}

// ─── Auto Comment Generation ─────────────────────────────────

/**
 * Generate class teacher comment based on performance data.
 * @param {number} average - student's average score
 * @param {number} attendancePct - attendance percentage
 * @param {string} studentName - student first name
 */
function generateClassTeacherComment(average, attendancePct, studentName) {
  var name = studentName ? studentName.split(' ')[0] : 'This student';
  var comment = '';

  if (average >= 75) {
    comment = name + ' has demonstrated an excellent academic performance this term. ';
  } else if (average >= 65) {
    comment = name + ' has performed very well academically this term. ';
  } else if (average >= 55) {
    comment = name + ' has shown a satisfactory level of academic performance this term. ';
  } else if (average >= 45) {
    comment = name + ' has shown some improvement but more effort is required. ';
  } else {
    comment = name + ' needs to put in significantly more effort to improve academic performance. ';
  }

  if (attendancePct < 70) {
    comment += 'Attendance has been a concern this term and must be addressed urgently.';
  } else if (attendancePct >= 90) {
    comment += 'Attendance has been exemplary.';
  } else {
    comment += 'Attendance has been adequate.';
  }

  return comment;
}

/**
 * Generate head teacher comment for primary section.
 */
function generateHeadTeacherComment(average, position, totalStudents, studentName) {
  var name = studentName ? studentName.split(' ')[0] : 'This pupil';
  var posStr = position ? (position + ' out of ' + totalStudents) : '';

  if (average >= 75) {
    return name + ' is an outstanding pupil. ' + (posStr ? 'Ranked ' + posStr + ' in class. ' : '') + 'Keep up the excellent work!';
  } else if (average >= 55) {
    return name + ' has performed well this term. ' + (posStr ? 'Positioned ' + posStr + '. ' : '') + 'Continue to strive for excellence.';
  } else if (average >= 45) {
    return name + ' shows potential but must put in more effort. ' + (posStr ? 'Currently ' + posStr + '. ' : '') + 'We encourage more dedication next term.';
  } else {
    return name + ' needs significant improvement. ' + (posStr ? 'Ranked ' + posStr + '. ' : '') + 'Parents are advised to provide additional support at home.';
  }
}

/**
 * Generate principal comment for high school.
 */
function generatePrincipalComment(average, position, totalStudents, studentName) {
  var name = studentName ? studentName.split(' ')[0] : 'This student';
  var posStr = position ? (position + ' out of ' + totalStudents) : '';

  if (average >= 75) {
    return name + ' is a model student and a credit to this institution. ' + (posStr ? 'Placed ' + posStr + '. ' : '') + 'Maintain this outstanding standard!';
  } else if (average >= 60) {
    return name + ' has performed commendably. ' + (posStr ? 'Position: ' + posStr + '. ' : '') + 'Continued dedication will yield greater success.';
  } else if (average >= 45) {
    return name + ' has demonstrated fair effort. ' + (posStr ? 'Position: ' + posStr + '. ' : '') + 'More rigour is expected in subsequent terms.';
  } else {
    return name + ' must work considerably harder. ' + (posStr ? 'Position: ' + posStr + '. ' : '') + 'The school enjoins greater commitment to studies.';
  }
}

// ─── Date & Formatting Utilities ────────────────────────────

/**
 * Format a date to "DD Mon YYYY" display format.
 */
function formatDate(date) {
  if (!date) return '';
  try {
    if (typeof date === 'string') date = new Date(date);
    if (isNaN(date.getTime())) return String(date).split('T')[0];
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
  } catch(e) {
    return '';
  }
}

/**
 * Get today as ISO date string (YYYY-MM-DD).
 */
function todayISO() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Format currency in Naira.
 */
function formatNaira(amount) {
  var n = Number(amount) || 0;
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Validation Utilities ────────────────────────────────────

/**
 * Validate email format.
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email));
}

/**
 * Safe parseFloat with default.
 */
function safeFloat(val, def) {
  var n = parseFloat(val);
  return isNaN(n) ? (def !== undefined ? def : 0) : n;
}

/**
 * Safe parseInt with default.
 */
function safeInt(val, def) {
  var n = parseInt(val, 10);
  return isNaN(n) ? (def !== undefined ? def : 0) : n;
}

// ─── Audit Logging ───────────────────────────────────────────

/**
 * Write an entry to the AuditLogs sheet.
 * @param {string} userId - performing user ID
 * @param {string} action - action label e.g. "CREATE_STUDENT"
 * @param {string} details - human-readable detail string
 */
function logAudit(userId, action, details) {
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName('AuditLogs');
    if (!sheet) return;
    sheet.appendRow([
      generateId(),
      userId || 'system',
      action,
      details || '',
      new Date().toISOString()
    ]);
  } catch (e) {
    Logger.log('AuditLog error: ' + e);
  }
}

// ─── Image Utility ────────────────────────────────────────────

/**
 * Convert a public URL or Google Drive URL to a Base64 data URI.
 * Used for embedding images in PDF reports.
 */
function imageToBase64(url) {
  if (!url) return '';
  if (String(url).indexOf('data:') === 0) return url;
  try {
    var blob = null;
    var driveMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    var driveIdMatch = url.match(/id=([a-zA-Z0-9_-]+)/);
    var fileId = driveMatch ? driveMatch[1] : (driveIdMatch ? driveIdMatch[1] : null);

    if (fileId) {
      blob = DriveApp.getFileById(fileId).getBlob();
    } else {
      var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (resp.getResponseCode() === 200) blob = resp.getBlob();
    }

    if (blob) {
      return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
    }
  } catch (e) {
    Logger.log('imageToBase64 failed: ' + e);
  }
  return url;
}

// ─── Drive Folder Helper ──────────────────────────────────────

/**
 * Get or create a Google Drive folder by name.
 */
function getOrCreateFolder(folderName) {
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(folderName);
}

/**
 * Upload a base64 image/file to Drive and return its public URL.
 */
function uploadReceiptToDrive(base64Data, filename) {
  if (!base64Data) return '';
  try {
    var parts = base64Data.split(',');
    if (parts.length !== 2) return base64Data; // Not a valid data URI, assume it's already a URL
    var contentType = parts[0].split(':')[1].split(';')[0];
    var decoded = Utilities.base64Decode(parts[1]);
    var blob = Utilities.newBlob(decoded, contentType, filename || 'receipt_' + new Date().getTime());
    var folder = getOrCreateFolder('Abecedarian_Payment_Receipts');
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (e) {
    Logger.log('uploadReceiptToDrive error: ' + e);
    return '';
  }
}

// ─── String Utilities ────────────────────────────────────────

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function titleCase(str) {
  if (!str) return '';
  return str.replace(/\w\S*/g, function(txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
 */
function ordinal(n) {
  var s = ['th','st','nd','rd'];
  var v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
