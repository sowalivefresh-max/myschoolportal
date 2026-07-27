/**
 * ============================================================
 *  MYSCHOOL PORTAL - Utils.gs
 *  Core Utility & Helper Functions
 * ============================================================
 *  - ID generation
 *  - Input validation
 *  - Nigerian A1-F9 grading
 *  - Comment generation
 *  - Date / number / string formatting
 *  - Audit logging (writes to Firestore)
 *  NOTE: Google Sheets helpers removed (getSheetData, findRowById, etc.)
 *        Drive file helpers moved to DriveStorage.gs
 * ============================================================
 */

// --- ID GENERATION -------------------------------------------

function generateId() {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var id = 'AA';
  for (var i = 0; i < 10; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function generateReceiptRef() {
  var now = new Date();
  var y = now.getFullYear().toString().slice(2);
  var m = String(now.getMonth() + 1).padStart(2, '0');
  var d = String(now.getDate()).padStart(2, '0');
  return 'RCT-' + y + m + d + '-' + (Math.floor(Math.random() * 9000) + 1000);
}

// --- INPUT VALIDATION ----------------------------------------

/**
 * Validate a data object against field rules.
 * Returns { valid: true } or { valid: false, message: '...' }
 */
function validateInput(data, rules) {
  var errors = [];
  for (var i = 0; i < rules.length; i++) {
    var rule  = rules[i];
    var value = data[rule.field];
    var empty = (value === undefined || value === null || String(value).trim() === '');
    if (rule.required && empty) { errors.push('"' + rule.field + '" is required.'); continue; }
    if (empty) continue;
    var str = String(value).trim();
    if (rule.maxLength && str.length > rule.maxLength)
      errors.push('"' + rule.field + '" must be ' + rule.maxLength + ' chars or fewer.');
    if (rule.type === 'number') {
      var n = Number(value);
      if (isNaN(n)) { errors.push('"' + rule.field + '" must be a number.'); }
      else {
        if (rule.min !== undefined && n < rule.min) errors.push('"' + rule.field + '" must be >= ' + rule.min + '.');
        if (rule.max !== undefined && n > rule.max) errors.push('"' + rule.field + '" must be <= ' + rule.max + '.');
      }
    }
    if (rule.type === 'email' && !isValidEmail(str))
      errors.push('"' + rule.field + '" must be a valid email address.');
  }
  return errors.length > 0 ? { valid: false, message: 'Validation error: ' + errors.join(' ') } : { valid: true };
}

// --- NIGERIAN GRADING ----------------------------------------

function computeGrade(total) {
  var t = Number(total) || 0;
  var rules = firebaseCached('grading', 3600);
  if (rules && rules.length > 0) {
    rules.sort(function(a, b) { return Number(b.min) - Number(a.min); });
    for (var i = 0; i < rules.length; i++) {
      if (t >= Number(rules[i].min)) return rules[i].grade;
    }
  }
  if (t >= 75) return 'A1'; if (t >= 70) return 'B2'; if (t >= 65) return 'B3';
  if (t >= 60) return 'C4'; if (t >= 55) return 'C5'; if (t >= 50) return 'C6';
  if (t >= 45) return 'D7'; if (t >= 40) return 'E8';
  return 'F9';
}

function getGradeRemark(grade) {
  var rules = firebaseCached('grading', 3600);
  if (rules && rules.length > 0) {
    var rule = rules.find(function(r) { return String(r.grade).toUpperCase() === String(grade).toUpperCase(); });
    if (rule) return rule.remark;
  }
  var map = { 'A1':'Excellent','B2':'Very Good','B3':'Good','C4':'Credit','C5':'Credit','C6':'Credit','D7':'Pass','E8':'Pass','F9':'Fail' };
  return map[grade] || '';
}

function isPassGrade(grade) {
  return ['A1','B2','B3','C4','C5','C6','D7','E8'].indexOf(grade) !== -1;
}

function computeTotal(ca1, ca2, ca3, exam) {
  return Math.round((Number(ca1||0)+Number(ca2||0)+Number(ca3||0)+Number(exam||0))*10)/10;
}

// --- AUTO COMMENT GENERATION ---------------------------------

function generateClassTeacherComment(average, attendancePct, studentName) {
  var name = studentName ? studentName.split(' ')[0] : 'This student';
  var c = '';
  if (average >= 75)      c = name + ' has demonstrated an excellent academic performance this term. ';
  else if (average >= 65) c = name + ' has performed very well academically this term. ';
  else if (average >= 55) c = name + ' has shown a satisfactory level of academic performance this term. ';
  else if (average >= 45) c = name + ' has shown some improvement but more effort is required. ';
  else                    c = name + ' needs to put in significantly more effort to improve academic performance. ';
  if      (attendancePct < 70)  c += 'Attendance has been a concern this term and must be addressed urgently.';
  else if (attendancePct >= 90) c += 'Attendance has been exemplary.';
  else                          c += 'Attendance has been adequate.';
  return c;
}

function generateHeadTeacherComment(average, position, totalStudents, studentName) {
  var name = studentName ? studentName.split(' ')[0] : 'This pupil';
  var pos  = position ? (position + ' out of ' + totalStudents) : '';
  if (average >= 75) return name + ' is an outstanding pupil. ' + (pos ? 'Ranked ' + pos + ' in class. ' : '') + 'Keep up the excellent work!';
  if (average >= 55) return name + ' has performed well this term. ' + (pos ? 'Positioned ' + pos + '. ' : '') + 'Continue to strive for excellence.';
  if (average >= 45) return name + ' shows potential but must put in more effort. ' + (pos ? 'Currently ' + pos + '. ' : '') + 'We encourage more dedication next term.';
  return name + ' needs significant improvement. ' + (pos ? 'Ranked ' + pos + '. ' : '') + 'Parents are advised to provide additional support at home.';
}

function generatePrincipalComment(average, position, totalStudents, studentName) {
  var name = studentName ? studentName.split(' ')[0] : 'This student';
  var pos  = position ? (position + ' out of ' + totalStudents) : '';
  if (average >= 75) return name + ' is a model student and a credit to this institution. ' + (pos ? 'Placed ' + pos + '. ' : '') + 'Maintain this outstanding standard!';
  if (average >= 60) return name + ' has performed commendably. ' + (pos ? 'Position: ' + pos + '. ' : '') + 'Continued dedication will yield greater success.';
  if (average >= 45) return name + ' has demonstrated fair effort. ' + (pos ? 'Position: ' + pos + '. ' : '') + 'More rigour is expected in subsequent terms.';
  return name + ' must work considerably harder. ' + (pos ? 'Position: ' + pos + '. ' : '') + 'The school enjoins greater commitment to studies.';
}

// --- DATE & FORMATTING ---------------------------------------

function formatDate(date) {
  if (!date) return '';
  try {
    if (typeof date === 'string') date = new Date(date);
    if (isNaN(date.getTime())) return String(date).split('T')[0];
    var m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return date.getDate() + ' ' + m[date.getMonth()] + ' ' + date.getFullYear();
  } catch(e) { return ''; }
}

function todayISO() { return new Date().toISOString().split('T')[0]; }

function formatNaira(amount) {
  var n = Number(amount) || 0;
  return 'N' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// --- VALIDATION UTILITIES ------------------------------------

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email));
}

function safeFloat(val, def) {
  var n = parseFloat(val);
  return isNaN(n) ? (def !== undefined ? def : 0) : n;
}

function safeInt(val, def) {
  var n = parseInt(val, 10);
  return isNaN(n) ? (def !== undefined ? def : 0) : n;
}

// --- AUDIT LOGGING -------------------------------------------

/**
 * Write an audit log entry to Firestore 'auditLogs' collection.
 */
function logAudit(userId, action, details) {
  try {
    var id = generateId();
    firebaseSet('auditLogs', id, {
      id: id, userId: userId || 'system', action: action,
      details: details || '', timestamp: new Date().toISOString()
    });
  } catch(e) {
    Logger.log('logAudit error: ' + e.message);
  }
}

function getAuditLogs() {
  var logs = firebaseQuery('auditLogs', [], { field: 'timestamp', direction: 'DESCENDING' }, 500);
  return logs;
}

// --- STRING UTILITIES ----------------------------------------

function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }

function titleCase(str) {
  if (!str) return '';
  return str.replace(/\w\S*/g, function(t) { return t.charAt(0).toUpperCase() + t.substr(1).toLowerCase(); });
}

function ordinal(n) {
  var s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}

// --- LEGACY SHIM (keeps Code.gs doGet route working) ---------

/**
 * setupSheets() was called on doGet to ensure sheet headers existed.
 * With Firestore this is a no-op; Firestore creates collections on first write.
 * Kept to avoid errors in any existing doGet references.
 */
function setupSheets() {
  Logger.log('setupSheets() is a no-op with Firebase. Firestore collections are created on first write.');
}
