/**
 * ============================================================
 *  ABECEDARIAN ACADEMY - SCHOOL MANAGEMENT PORTAL
 *  Code.gs  -  Main Entry Point, Router & All Endpoints
 * ============================================================
 */

const SPREADSHEET_ID = ''; // - Paste your Google Sheet ID here

function getSpreadsheet() {
  if (!SPREADSHEET_ID) return SpreadsheetApp.getActiveSpreadsheet();
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// --- WEB APP ENTRY POINT -------------------------------------

function doGet(e) {
  try {
    setupSheets(); // Ensure schema headers exist on page load
  } catch(err) {
    Logger.log('Auto setupSheets failed: ' + err);
  }
  var token = e && e.parameter && e.parameter.token ? e.parameter.token : '';
  if (token) {
    var session = validateSession(token);
    if (session) return serveDashboard(session.role, token);
  }
  return serveLogin();
}

/**
 * Returns the explicit whitelist of API actions callable from the frontend.
 * ONLY functions listed here can be invoked via doPost.
 * Internal helpers (getSpreadsheet, getSheetData, setupSheets, etc.) are NOT listed
 * and therefore cannot be reached by any external request.
 */
function getActionWhitelist() {
  return {
    // -- Auth --------------------------------------------------
    'loginUser':                  loginUser,
    'logoutUser':                 logoutUser,
    'getCurrentUser':             getCurrentUser,
    'userUpdateProfile':          userUpdateProfile,
    'userChangePassword':         userChangePassword,
    'getPublicBranding':          getPublicBranding,
    'requestPasswordReset':       requestPasswordReset,

    // -- Admin -------------------------------------------------
    'adminGetStats':              adminGetStats,
    'adminGetUsers':              adminGetUsers,
    'adminCreateUser':            adminCreateUser,
    'adminUpdateUser':            adminUpdateUser,
    'adminDeleteUser':            adminDeleteUser,
    'adminResetUserPassword':     adminResetUserPassword,
    'adminImpersonateUser':       adminImpersonateUser,
    'adminGetPasswordRequests':   adminGetPasswordRequests,
    'adminProcessPasswordReset':  adminProcessPasswordReset,
    'adminGetStudents':           adminGetStudents,
    'adminCreateStudent':         adminCreateStudent,
    'adminBulkCreateStudents':    adminBulkCreateStudents,
    'adminBulkCreateStudents':    adminBulkCreateStudents,
    'adminUpdateStudent':         adminUpdateStudent,
    'adminDeleteStudent':         adminDeleteStudent,
    'adminGetClasses':            adminGetClasses,
    'adminCreateClass':           adminCreateClass,
    'adminBulkCreateClasses':     adminBulkCreateClasses,
    'adminUpdateClass':           adminUpdateClass,
    'adminDeleteClass':           adminDeleteClass,
    'adminGetSubjects':           adminGetSubjects,
    'adminCreateSubject':         adminCreateSubject,
    'adminBulkCreateSubjects':    adminBulkCreateSubjects,
    'adminUpdateSubject':         adminUpdateSubject,
    'adminDeleteSubject':         adminDeleteSubject,
    'adminAssignSubjectsToTeacher': adminAssignSubjectsToTeacher,
    'adminGetSettings':           adminGetSettings,
    'adminUpdateSettings':        adminUpdateSettings,
    'adminGetScores':             adminGetScores,
    'adminLockScores':            adminLockScores,
    'adminUnlockScores':          adminUnlockScores,
    'adminGetAuditLogs':          adminGetAuditLogs,
    'adminEnrollStudent':         adminEnrollStudent,
    'adminUnenrollStudent':       adminUnenrollStudent,
    'adminGetPayments':           adminGetPayments,
    'adminGetBills':              adminGetBills,
    'adminGetFeeStructures':      adminGetFeeStructures,
    'adminSaveFeeStructure':      adminSaveFeeStructure,
    'adminDeleteFeeStructure':    adminDeleteFeeStructure,
    'adminGenerateBills':         adminGenerateBills,
    'adminGetExpenses':           adminGetExpenses,
    'adminRecordExpense':         adminRecordExpense,
    'adminGetFinancialStats':     adminGetFinancialStats,
    'adminGetIncomeExpenseReport': adminGetIncomeExpenseReport,
    'adminGetDebtors':            adminGetDebtors,
    'adminSendReminders':         adminSendReminders,
    'adminRecordPayment':         adminRecordPayment,
    'adminApprovePayment':        adminApprovePayment,
    'adminRejectPayment':         adminRejectPayment,
    'adminReversePayment':        adminReversePayment,
    'adminRecordCreditNote':      adminRecordCreditNote,
    'adminGenerateResult':        adminGenerateResult,
    'adminGenerateBulkResult':    adminGenerateBulkResult,
    'adminGenerateReceipt':       adminGenerateReceipt,
    'adminGetAllLessonPlans':     adminGetAllLessonPlans,
    'adminApproveLessonPlan':     adminApproveLessonPlan,
    'adminRejectLessonPlan':      adminRejectLessonPlan,
    'adminGetGrading':            adminGetGrading,
    'adminSaveGradeRule':         adminSaveGradeRule,
    'adminGetStudentSubjects':    adminGetStudentSubjects,
    'adminGetSchoolPerformance':  adminGetSchoolPerformance,
    'adminGetComplianceSummary':  adminGetComplianceSummary,
    'adminComputePositions':      adminComputePositions,
    'adminGetPendingTasks':       adminGetPendingTasks,
    'adminApproveTask':           adminApproveTask,
    'adminRejectTask':            adminRejectTask,

    // -- Principal / VP / Headteacher --------------------------
    'principalGetStats':          principalGetStats,
    'principalGetStudentReport':  principalGetStudentReport,
    'principalGetStudentResultPDF': principalGetStudentResultPDF,
    'principalGetLessonPlans':    principalGetLessonPlans,
    'principalApprovePlan':       principalApprovePlan,
    'principalRejectPlan':        principalRejectPlan,
    'principalGetCompliance':     principalGetCompliance,
    'principalGetAttendanceReport': principalGetAttendanceReport,
    'principalGetStudentAttendanceSummary': principalGetStudentAttendanceSummary,
    'principalGetSchoolPerformance': principalGetSchoolPerformance,
    'principalGetSubjectAnalytics': principalGetSubjectAnalytics,
    'principalGetAllStudents':    principalGetAllStudents,
    'principalGetClasses':        principalGetClasses,

    // -- Teacher -----------------------------------------------
    'teacherGetMySubjects':       teacherGetMySubjects,
    'teacherGetSubjectStudents':  teacherGetSubjectStudents,
    'teacherGetClassStudents':    teacherGetClassStudents,
    'teacherGetScores':           teacherGetScores,
    'teacherSaveScore':           teacherSaveScore,
    'teacherBulkSaveScores':      teacherBulkSaveScores,
    'teacherLockScores':          teacherLockScores,
    'teacherSubmitScores':        teacherSubmitScores,
    'teacherMarkAttendance':      teacherMarkAttendance,
    'teacherGetAttendance':       teacherGetAttendance,
    'teacherGetAttendanceByDate': teacherGetAttendanceByDate,
    'teacherGetStudentAttendanceSummary': teacherGetStudentAttendanceSummary,
    'teacherSavePsychomotor':     teacherSavePsychomotor,
    'teacherSaveAffective':       teacherSaveAffective,
    'teacherGetPsychomotor':      teacherGetPsychomotor,
    'teacherGetAffective':        teacherGetAffective,
    'teacherCreateLessonPlan':    teacherCreateLessonPlan,
    'teacherUpdateLessonPlan':    teacherUpdateLessonPlan,
    'teacherSubmitLessonPlan':    teacherSubmitLessonPlan,
    'teacherDeleteLessonPlan':    teacherDeleteLessonPlan,
    'teacherGetMyLessonPlans':    teacherGetMyLessonPlans,
    'teacherGenerateLessonPlanPDF': teacherGenerateLessonPlanPDF,
    'teacherEnrollStudent':       teacherEnrollStudent,
    'teacherUnenrollStudent':     teacherUnenrollStudent,
    'teacherGetStudentReport':    teacherGetStudentReport,
    'teacherComputePositions':    teacherComputePositions,

    // -- Accounts ----------------------------------------------
    'accountsGetFeeStructures':   accountsGetFeeStructures,
    'accountsSaveFeeStructure':   accountsSaveFeeStructure,
    'accountsDeleteFeeStructure': accountsDeleteFeeStructure,
    'accountsGenerateBills':      accountsGenerateBills,
    'accountsGetBills':           accountsGetBills,
    'accountsGetDebtors':         accountsGetDebtors,
    'accountsRecordPayment':      accountsRecordPayment,
    'accountsGetPayments':        accountsGetPayments,
    'accountsGetStudentLedger':   accountsGetStudentLedger,
    'accountsGenerateReceipt':    accountsGenerateReceipt,
    'accountsApprovePayment':     accountsApprovePayment,
    'accountsRejectPayment':     accountsRejectPayment,
    'accountsReversePayment':     accountsReversePayment,
    'accountsRecordCreditNote':   accountsRecordCreditNote,
    'accountsGetExpenses':        accountsGetExpenses,
    'accountsRecordExpense':      accountsRecordExpense,
    'accountsDeleteExpense':      accountsDeleteExpense,
    'accountsGetFinancialStats':  accountsGetFinancialStats,
    'accountsGetIncomeExpenseReport': accountsGetIncomeExpenseReport,
    'accountsSendReminders':      accountsSendReminders,
    'accountsGetStudents':        accountsGetStudents,

    // -- Parent ------------------------------------------------
    'parentGetChildren':          parentGetChildren,
    'parentGetReport':            parentGetReport,
    'parentDownloadReport':       parentDownloadReport,
    'parentGetBills':             parentGetBills,
    'parentGetPayments':          parentGetPayments,
    'parentGetStudentCredit':     parentGetStudentCredit,
    'parentDownloadReceipt':      parentDownloadReceipt,
    'parentSubmitPaymentData':    parentSubmitPaymentData
  };
}

function doPost(e) {
  try {
    var body = e.postData.contents;
    var data = JSON.parse(body);
    var action = data.action;
    var args = data.args || [];

    var whitelist = getActionWhitelist();

    // Only dispatch actions explicitly listed in the whitelist.
    // Internal helpers (getSpreadsheet, getSheetData, setupSheets etc.) are unreachable.
    if (whitelist.hasOwnProperty(action)) {
      var result = whitelist[action].apply(this, args);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Action not found.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


function serveLogin() {
  var t = HtmlService.createTemplateFromFile('Login');
  var schoolName = getSettings().school_name || 'School Portal';
  return t.evaluate().setTitle(schoolName + ' - Portal')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function serveDashboard(role, token) {
  var plan = getPlanLevel();
  var schoolName = getSettings().school_name || 'School Portal';

  // - Plan-based role blocking ----------------------------------
  // Basic plan: principal/vp/headteacher accounts exist only for report
  // signatures - they are NOT granted interactive dashboard access.
  if (plan < PLAN_LEVELS.standard) {
    if (['principal', 'vp', 'headteacher'].indexOf(role) !== -1) {
      return servePlanBlockedPage(
        schoolName,
        'Administrator Dashboard Access Restricted',
        'Your school\'s current subscription (Basic Plan) does not include interactive ' +
        'administrator dashboards. Your account exists to provide your name and signature on ' +
        'generated report cards. Please contact the portal administrator to upgrade to the ' +
        'Standard Plan or higher.'
      );
    }
  }
  // Deluxe plan required for Accounts Officer and Admin Assistant (Maker-Checker) roles.
  if (plan < PLAN_LEVELS.deluxe) {
    if (['accounts', 'admin_assistant'].indexOf(role) !== -1) {
      return servePlanBlockedPage(
        schoolName,
        'Feature Not Available On Your Plan',
        'The ' + (role === 'accounts' ? 'Finance / Accounts' : 'Maker-Checker (Admin Assistant)') +
        ' module requires the Deluxe Plan or higher. ' +
        'Please contact the portal administrator to upgrade your subscription.'
      );
    }
  }

  var map = {
    developer: 'AdminDashboard', admin: 'AdminDashboard', admin_assistant: 'AdminDashboard', principal: 'PrincipalDashboard', vp: 'VPDashboard',
    headteacher: 'HeadTeacherDashboard', teacher: 'TeacherDashboard',
    primary_teacher: 'PrimaryTeacherDashboard', accounts: 'AccountsDashboard', parent: 'ParentDashboard'
  };
  var tpl = map[role];
  if (!tpl) return serveLogin();
  var t = HtmlService.createTemplateFromFile(tpl);
  t.sessionToken = token;
  t.userRole = role;
  t.scriptUrl = ScriptApp.getService().getUrl();
  return t.evaluate().setTitle(schoolName + ' - ' + titleCase(role.replace('_', ' ')))
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Renders a styled, plan-restriction error page instead of a dashboard.
 */
function servePlanBlockedPage(schoolName, heading, message) {
  var html = '<!DOCTYPE html><html><head><meta charset="utf-8">';
  html += '<meta name="viewport" content="width=device-width, initial-scale=1">';
  html += '<title>' + schoolName + ' - Access Restricted</title>';
  html += '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">';
  html += '<style>';
  html += 'body{margin:0;padding:0;min-height:100vh;display:flex;align-items:center;justify-content:center;';
  html += 'background:linear-gradient(135deg,#0d1b2a 0%,#1a3a5c 100%);font-family:"Inter",Arial,sans-serif;}';
  html += '.card{background:#fff;border-radius:14px;padding:44px 52px;max-width:500px;width:90%;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,.45);}';
  html += '.icon{font-size:52px;margin-bottom:18px;}';
  html += 'h2{color:#0d1b2a;margin:0 0 14px;font-size:22px;font-weight:700;}';
  html += 'p{color:#555;font-size:14px;line-height:1.65;margin:0 0 26px;}';
  html += '.badge{display:inline-block;background:#fef3c7;color:#92400e;border:1px solid #fde68a;';
  html += 'border-radius:20px;padding:4px 14px;font-size:12px;font-weight:600;margin-bottom:20px;}';
  html += '.school{font-size:11px;color:#aaa;margin-top:20px;border-top:1px solid #f0f0f0;padding-top:14px;}';
  html += 'a{display:inline-block;padding:11px 28px;background:#0d1b2a;color:#f0a500;';
  html += 'border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;transition:opacity .2s;}';
  html += 'a:hover{opacity:.85;}';
  html += '</style></head><body>';
  html += '<div class="card">';
  html += '<div class="icon">🔒</div>';
  html += '<div class="badge">Plan Restriction</div>';
  html += '<h2>' + heading + '</h2>';
  html += '<p>' + message + '</p>';
  html += '<a href="javascript:history.back()">&#8592; Go Back</a>';
  html += '<div class="school">' + schoolName + ' &bull; School Management Portal</div>';
  html += '</div></body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle(schoolName + ' - Access Restricted')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// --- AUTH ENDPOINTS ------------------------------------------

function loginUser(email, password) {
  try {
    setupSheets(); // Ensures missing default accounts (like Developer) are seeded before auth
    var res = authenticate(email, password);
    if (res.success) {
      res.url = getDashboardUrl(res.token);
    }
    return res;
  }
  catch(e) { return { success: false, message: e.message }; }
}

function logoutUser(token) { return destroySession(token); }

function getDashboardUrl(token) {
  var url = ScriptApp.getService().getUrl();
  if (!url) {
    Logger.log('Warning: ScriptApp.getService().getUrl() returned empty.');
    return '';
  }
  var sep = (url.indexOf('?') === -1) ? '?' : '&';
  return url + sep + 'token=' + token;
}

function getCurrentUser(token) {
  var s = validateSession(token);
  if (!s) return { success: false, message: 'Invalid session.' };
  var u = getUserById(s.userId);
  if (!u) return { success: false, message: 'User not found.' };

  // Dynamically find class assigned from the Classes sheet
  var assignedClass = u.classAssigned || '';
  if (u.role === 'primary_teacher' || u.role === 'teacher' || u.role === 'headteacher' || u.role === 'principal' || u.role === 'vp') {
    var classes = getAllClasses();
    var cls = classes.find(function(c) { return String(c.classTeacherId || c.classTeacherID) === String(u.id); });
    if (cls) assignedClass = cls.className;
  }

  var isClassTeacher = u.role === 'teacher' && !!classes && classes.some(function(c) {
    return String(c.classTeacherId || c.classTeacherID) === String(u.id);
  });

  var settings = getSettings();
  var isLocked = settings.portal_locked === 'true';
  if (!isLocked && settings.subscription_expiry) {
    var expiryDate = new Date(settings.subscription_expiry);
    if (!isNaN(expiryDate.getTime()) && new Date() > expiryDate) {
      isLocked = true;
    }
  }

  return { success: true, user: { id: u.id, fullName: u.fullName, email: u.email,
    role: u.role, section: u.section, classAssigned: assignedClass,
    isClassTeacher: isClassTeacher,
    profilePicture: u.profilePicture, phone: u.phone,
    isLocked: isLocked, lockMessage: settings.lock_message } };
}

function userUpdateProfile(token, data) {
  var s = validateSession(token);
  if (!s) throw new Error('Unauthorized');
  return updateUser(s.userId, data);
}

function userChangePassword(token, oldPwd, newPwd) {
  var s = validateSession(token);
  if (!s) throw new Error('Unauthorized');
  if (!verifyUserPassword(s.userId, oldPwd)) return { success: false, message: 'Incorrect current password.' };
  return updateUser(s.userId, { password: newPwd });
}

function getPublicBranding() {
  var cfg = getSettings();
  var logo = cfg.school_logo_url || '';
  // If it's a Drive ID or needs conversion, imageToBase64 handles it
  if (logo && logo.indexOf('data:image') === -1) {
    logo = imageToBase64(logo);
  }
  return {
    school_name: cfg.school_name || 'My School',
    school_motto: cfg.school_motto || '',
    school_logo_url: logo,
    current_term: cfg.current_term || '',
    current_session: cfg.current_session || '',
    subscription_expiry: cfg.subscription_expiry || ''
  };
}

// --- ROLE CHECK HELPER ---------------------------------------

function requireRole(token, roles) {
  var s = validateSession(token);
  if (!s) throw new Error('Session expired. Please log in again.');

  if (s.role !== 'developer') {
    var settings = getSettings();
    var isLocked = settings.portal_locked === 'true';
    if (!isLocked && settings.subscription_expiry) {
      var expiryDate = new Date(settings.subscription_expiry);
      if (!isNaN(expiryDate.getTime()) && new Date() > expiryDate) {
        isLocked = true;
      }
    }
    if (isLocked) {
      throw new Error('PORTAL_LOCKED');
    }
  }

  var allowed = Array.isArray(roles) ? roles : [roles];
  if (allowed.indexOf(s.role) === -1 && s.role !== 'admin' && s.role !== 'developer')
    throw new Error('Access denied. Insufficient permissions.');
  return s;
}

// --- SUBSCRIPTION PLAN ENFORCEMENT --------------------------

var PLAN_LEVELS = { basic: 1, standard: 2, deluxe: 3, super_deluxe: 4 };

/**
 * Returns the numeric level of the school's current subscription plan.
 * Reads from the Settings sheet. Defaults to 1 (basic) if not configured.
 */
function getPlanLevel() {
  var plan = (getSettings().subscription_plan || 'basic').toLowerCase().replace(/-/g, '_');
  return PLAN_LEVELS[plan] || 1;
}

/**
 * Throws a descriptive error if the current plan is below the required minimum.
 * @param {string} minPlan - 'basic' | 'standard' | 'deluxe' | 'super_deluxe'
 */
function requirePlan(minPlan, token) {
  if (token) {
    try {
      var s = validateSession(token);
      if (s && s.role === 'developer') return; // Developers bypass all plan limits
    } catch(e) {
      // Ignore invalid token here, it will be caught by requireRole
    }
  }

  var current = getPlanLevel();
  var required = PLAN_LEVELS[minPlan] || 1;
  if (current < required) {
    var names = { 1: 'Basic', 2: 'Standard', 3: 'Deluxe', 4: 'Super Deluxe' };
    throw new Error(
      'This feature requires the ' + names[required] + ' Plan or higher. ' +
      'Your current plan is ' + (names[current] || 'Basic') + '. ' +
      'Please contact the portal administrator to upgrade your subscription.'
    );
  }
}

// --- ADMIN ENDPOINTS -----------------------------------------

function adminGetStats(token) { requireRole(token,['admin','admin_assistant']); return getAdminStats(); }
function adminGetUsers(token) { 
  var s = requireRole(token,['admin','admin_assistant']); 
  var users = getAllUsers();
  if (s.role !== 'developer') {
    users = users.filter(function(u) { return u.role !== 'developer'; });
  }
  return users;
}
function adminCreateUser(token, data) { 
  var s = requireRole(token,['admin','admin_assistant']); 
  if (data.role === 'developer' && s.role !== 'developer') throw new Error('Security Error: Only developers can create developer accounts.');
  if (s.role === 'admin_assistant') return logPendingTask('CREATE_USER', data, s.userId); 
  return createUser(data); 
}
function adminUpdateUser(token, uid, data) { 
  var s = requireRole(token,['admin','admin_assistant']); 
  if (data.role === 'developer' && s.role !== 'developer') throw new Error('Security Error: Only developers can grant developer privileges.');
  if (s.role !== 'developer') _requireNotDeveloperTarget(uid);
  if (s.role === 'admin_assistant') return logPendingTask('UPDATE_USER', {uid: uid, data: data}, s.userId); 
  return updateUser(uid, data); 
}
function adminDeleteUser(token, uid) { 
  var s = requireRole(token,['admin','admin_assistant']); 
  if (s.role !== 'developer') _requireNotDeveloperTarget(uid);
  if (s.role === 'admin_assistant') return logPendingTask('DELETE_USER', {uid: uid}, s.userId); 
  return deleteUser(uid); 
}
function adminResetUserPassword(token, uid) { 
  var s = requireRole(token,['admin','admin_assistant']); 
  if (s.role !== 'developer') _requireNotDeveloperTarget(uid);
  if (s.role === 'admin_assistant') return logPendingTask('RESET_PWD', {uid: uid}, s.userId);
  return updateUser(uid, { password: 'password123' }); 
}
function adminImpersonateUser(token, targetUserId) {
  requirePlan('standard', token);
  var s = requireRole(token, 'admin');
  var users = getSheetData('Users');
  var targetUser = users.find(function(u) { return String(u.id || u.iD) === String(targetUserId); });

  if (!targetUser) return { success: false, message: 'User not found.' };
  if (targetUser.status !== 'active') return { success: false, message: 'Cannot impersonate a suspended user.' };

  var newToken = createSession(targetUser.id || targetUser.iD, targetUser.role, targetUser.fullName, targetUser.section);
  logAudit(s.userId, 'IMPERSONATE', s.fullName + ' impersonated ' + targetUser.fullName + ' (' + targetUser.role + ')');

  return { success: true, url: getDashboardUrl(newToken), token: newToken, role: targetUser.role };
}
function adminGetPasswordRequests(token) {
  requireRole(token,['admin','admin_assistant']);
  return getSheetData('PasswordRequests').filter(function(r){ return r.status === 'pending'; });
}
function adminProcessPasswordReset(token, requestId, newPassword) {
  var s = requireRole(token,['admin','admin_assistant']);
  if (s.role === 'admin_assistant') return logPendingTask('PROCESS_PWD_RESET', {requestId: requestId, newPassword: newPassword}, s.userId);
  var sheet = getSpreadsheet().getSheetByName('PasswordRequests');
  var row = findRowById(sheet, requestId);
  if (row === -1) return { success: false, message: 'Request not found.' };
  
  var email = sheet.getRange(row, 2).getValue();
  var users = getSheetData('Users');
  var user = users.find(function(u){ return u.email.toLowerCase() === email.toLowerCase(); });
  
  if (!user) return { success: false, message: 'User with this email not found.' };
  
  var res = updateUser(user.id, { password: newPassword });
  if (res.success) {
    sheet.getRange(row, 5).setValue('completed');
    logAudit('admin', 'RESET_PWD_REQUEST', 'Approved reset for: ' + email);
  }
  return res;
}
function requestPasswordReset(email) {
  if (!email) return { success: false, message: 'Email required.' };
  var users = getSheetData('Users');
  var user = users.find(function(u){ return u.email.toLowerCase() === email.trim().toLowerCase(); });
  if (!user) return { success: false, message: 'Email not found in our records.' };
  
  var sheet = getSpreadsheet().getSheetByName('PasswordRequests');
  sheet.appendRow([generateId(), email.trim().toLowerCase(), user.fullName, user.role, 'pending', new Date().toISOString()]);
  return { success: true, message: 'Reset request submitted. Please contact the school admin to get your new password.' };
}
function adminGetStudents(token) { requireRole(token,['admin','admin_assistant']); return getAllStudents(); }
function adminCreateStudent(token, data) { var s = requireRole(token,['admin','admin_assistant']); if (s.role === 'admin_assistant') return logPendingTask('CREATE_STUDENT', data, s.userId); return createStudent(data); }
function adminBulkCreateStudents(token, data) { var s = requireRole(token,['admin','admin_assistant']); if (s.role === 'admin_assistant') return logPendingTask('BULK_CREATE_STUDENTS', data, s.userId); return bulkCreateStudents(data); }
function adminBulkCreateStudents(token, students) { var s = requireRole(token,['admin','admin_assistant']); if (s.role === 'admin_assistant') return { success: false, message: 'Admin Assistants cannot bulk upload.' }; return bulkCreateStudents(students); }
function adminUpdateStudent(token, sid, data) { var s = requireRole(token,['admin','admin_assistant']); if (s.role === 'admin_assistant') return logPendingTask('UPDATE_STUDENT', {sid: sid, data: data}, s.userId); return updateStudent(sid, data); }
function adminDeleteStudent(token, sid) { var s = requireRole(token,['admin','admin_assistant']); if (s.role === 'admin_assistant') return logPendingTask('DELETE_STUDENT', {sid: sid}, s.userId); return deleteStudent(sid); }
function adminGetClasses(token) { requireRole(token,['admin','admin_assistant']); return getAllClasses(); }
function adminCreateClass(token, data) { var s = requireRole(token,['admin','admin_assistant']); if (s.role === 'admin_assistant') return logPendingTask('CREATE_CLASS', data, s.userId); return createClass(data); }
function adminBulkCreateClasses(token, data) { var s = requireRole(token,['admin','admin_assistant']); if (s.role === 'admin_assistant') return logPendingTask('BULK_CREATE_CLASSES', data, s.userId); return bulkCreateClasses(data); }
function adminUpdateClass(token, cid, data) { var s = requireRole(token,['admin','admin_assistant']); if (s.role === 'admin_assistant') return logPendingTask('UPDATE_CLASS', {cid: cid, data: data}, s.userId); return updateClass(cid, data); }
function adminDeleteClass(token, cid) { var s = requireRole(token,['admin','admin_assistant']); if (s.role === 'admin_assistant') return logPendingTask('DELETE_CLASS', {cid: cid}, s.userId); return deleteClass(cid); }
function adminGetSubjects(token) { requireRole(token,['admin','admin_assistant']); return getAllSubjects(); }
function adminCreateSubject(token, data) { var s = requireRole(token,['admin','admin_assistant']); if (s.role === 'admin_assistant') return logPendingTask('CREATE_SUBJECT', data, s.userId); return createSubject(data); }
function adminBulkCreateSubjects(token, data) { var s = requireRole(token,['admin','admin_assistant']); if (s.role === 'admin_assistant') return logPendingTask('BULK_CREATE_SUBJECTS', data, s.userId); return bulkCreateSubjects(data); }
function adminUpdateSubject(token, sid, data) { var s = requireRole(token,['admin','admin_assistant']); if (s.role === 'admin_assistant') return logPendingTask('UPDATE_SUBJECT', {sid: sid, data: data}, s.userId); return updateSubject(sid, data); }
function adminDeleteSubject(token, sid) { var s = requireRole(token,['admin','admin_assistant']); if (s.role === 'admin_assistant') return logPendingTask('DELETE_SUBJECT', {sid: sid}, s.userId); return deleteSubject(sid); }
function adminAssignSubjectsToTeacher(token, tid, sids) { var s = requireRole(token,['admin','admin_assistant']); if (s.role === 'admin_assistant') return logPendingTask('ASSIGN_SUBJECTS', {tid: tid, sids: sids}, s.userId); return assignSubjectsToTeacher(tid, sids); }
function adminGetSettings(token) { requireRole(token,['admin','admin_assistant']); return getSettings(); }
function adminUpdateSettings(token, data) { 
  var s = requireRole(token,['admin','admin_assistant']); 
  // SECURITY: Prevent school admin from upgrading their own plan without paying
  if (s.role !== 'developer' && data && data.hasOwnProperty('subscription_plan')) {
    delete data.subscription_plan;
  }
  if (s.role === 'admin_assistant') return logPendingTask('UPDATE_SETTINGS', data, s.userId); 
  return updateSettings(data); 
}
function adminGetScores(token, filters) { requireRole(token,['admin','admin_assistant']); return getScores(filters); }
function adminLockScores(token, filters) { var s = requireRole(token,['admin','admin_assistant']); if (s.role === 'admin_assistant') return logPendingTask('LOCK_SCORES', filters, s.userId); return lockScores(filters); }
function adminUnlockScores(token, filters) { var s = requireRole(token,['admin','admin_assistant']); if (s.role === 'admin_assistant') return logPendingTask('UNLOCK_SCORES', filters, s.userId); return unlockScores(filters); }
function adminGetAuditLogs(token) { 
  requirePlan('deluxe', token); 
  var s = requireRole(token,['admin','admin_assistant']); 
  var logs = getAuditLogs();
  if (s.role !== 'developer') {
    var users = getAllUsers();
    var devIds = users.filter(function(u){ return u.role === 'developer'; }).map(function(u){ return String(u.id || u.iD || u.ID || u.Id); });
    devIds.push('developer@school.portal');
    logs = logs.filter(function(log) {
      var logUserId = String(log[1] || log.userId || log.userID || log.userid);
      return devIds.indexOf(logUserId) === -1 && logUserId !== 'undefined';
    });
  }
  return logs;
}
function adminEnrollStudent(token, sid, subId, sess, term) { 
  var s = requireRole(token,['admin','admin_assistant']); 
  var currentSettings = getSettings();
  sess = sess && sess !== 'undefined' ? sess : currentSettings.current_session;
  term = term && term !== 'undefined' ? term : currentSettings.current_term;
  if (s.role === 'admin_assistant') return logPendingTask('ENROLL_STUDENT', {sid:sid, subId:subId, sess:sess, term:term}, s.userId); 
  return enrollStudent(sid, subId, sess, term); 
}
function adminUnenrollStudent(token, sid, subId, sess) { 
  var s = requireRole(token,['admin','admin_assistant']); 
  var currentSettings = getSettings();
  sess = sess && sess !== 'undefined' ? sess : currentSettings.current_session;
  if (s.role === 'admin_assistant') return logPendingTask('UNENROLL_STUDENT', {sid:sid, subId:subId, sess:sess}, s.userId); 
  return unenrollStudent(sid, subId, sess); 
}
function adminGetPayments(token, filters) { requirePlan('deluxe', token); requireRole(token,'admin'); return getAllPayments(filters); }
function adminGetBills(token, filters) { requirePlan('deluxe', token); requireRole(token,'admin'); return getAllBills(filters); }
function adminGetFeeStructures(token) { requirePlan('deluxe', token); requireRole(token,'admin'); return getAllFeeStructures(); }
function adminSaveFeeStructure(token, data) { requirePlan('deluxe', token); requireRole(token,'admin'); return saveFeeStructure(data); }
function adminDeleteFeeStructure(token, id) { requirePlan('deluxe', token); requireRole(token,'admin'); return deleteFeeStructure(id); }
function adminGenerateBills(token, term, sess) { requirePlan('deluxe', token); var s = requireRole(token,'admin'); return generateTermBills(term, sess, s.userId); }
function adminGetExpenses(token) { requirePlan('deluxe', token); requireRole(token,'admin'); return getAllExpenses(); }
function adminRecordExpense(token, data) { requirePlan('deluxe', token); var s = requireRole(token,'admin'); return recordExpense(data, s.userId); }
function adminGetFinancialStats(token, term, sess) { requirePlan('deluxe', token); requireRole(token,'admin'); return getFinancialDashboardStats(term, sess); }
function adminGetIncomeExpenseReport(token, term, sess) { requirePlan('deluxe', token); requireRole(token,'admin'); return getIncomeExpenseReport(term, sess); }
function adminGetDebtors(token, term, sess) { requirePlan('deluxe', token); requireRole(token,'admin'); return getDebtors(term, sess); }
function adminSendReminders(token, term, sess, batchSize) { requirePlan('deluxe', token); requireRole(token,'admin'); return sendOutstandingBalanceReminders(term, sess, null, batchSize); }
function adminRecordPayment(token, data) { requirePlan('deluxe', token); var s = requireRole(token,'admin'); return recordPayment(data, s.userId); }
function adminApprovePayment(token, payId) { requirePlan('deluxe', token); var s = requireRole(token,'admin'); return approvePayment(payId, s.userId); }
function adminRejectPayment(token, payId) { requirePlan('deluxe', token); var s = requireRole(token,'admin'); return rejectPayment(payId, s.userId); }
function adminReversePayment(token, payId, reason) { requirePlan('deluxe', token); var s = requireRole(token,'admin'); return reversePayment(payId, reason, s.userId); }
function adminRecordCreditNote(token, data) { requirePlan('deluxe', token); var s = requireRole(token,'admin'); return recordCreditNote(data, s.userId); }
function adminGenerateResult(token, sid, term, sess, reportType) { requireRole(token,['admin','admin_assistant']); return generateResultPDF(sid, term, sess, reportType); }
function adminGenerateBulkResult(token, className, term, sess, reportType) { requireRole(token,['admin','admin_assistant','principal','vp','headteacher','teacher']); return generateBulkClassResultPDF(className, term, sess, reportType); }
function adminGenerateReceipt(token, payId) { requirePlan('deluxe', token); requireRole(token,'admin'); return generateReceiptPDF(payId); }
function adminGetAllLessonPlans(token, term, sess) { requirePlan('standard', token); requireRole(token,['admin','admin_assistant']); return getAllLessonPlans(term, sess); }
function adminApproveLessonPlan(token, planId, note) { requirePlan('standard', token); var s = requireRole(token,['admin','admin_assistant']); if (s.role === 'admin_assistant') return logPendingTask('APPROVE_LESSON', {planId:planId, note:note}, s.userId); return approveLessonPlan(s.userId, planId, note); }
function adminRejectLessonPlan(token, planId, note) { requirePlan('standard', token); var s = requireRole(token,['admin','admin_assistant']); if (s.role === 'admin_assistant') return logPendingTask('REJECT_LESSON', {planId:planId, note:note}, s.userId); return rejectLessonPlan(s.userId, planId, note); }
function adminGetGrading(token) { requireRole(token,['admin','admin_assistant']); return getSheetData('Grading'); }
function adminSaveGradeRule(token, data) { var s = requireRole(token,['admin','admin_assistant']); if (s.role === 'admin_assistant') return logPendingTask('SAVE_GRADE_RULE', data, s.userId); return updateGradingRule(data); }
function adminGetStudentSubjects(token, sid) {
  requireRole(token,['admin','admin_assistant']);
  var student = getStudentById(sid);
  if (!student) return { enrolled: [], available: [] };

  var settings = getSettings();
  var enrolled = getStudentSubjects(sid, settings.current_session);
  var all = getAllSubjects(); // Already filtered by institution_type (primary/secondary/both)
  var enrolledIds = enrolled.map(function(s){ return String(s.id || s.iD); });

  // Student's class - sheet column "Class" maps to key "class" via toCamelCase
  var studentClassName = String(student.class || student.className || '').trim().toLowerCase();

  var available = all.filter(function(sub){
    // Exclude already-enrolled subjects
    if (enrolledIds.indexOf(String(sub.id || sub.iD)) !== -1) return false;

    // Filter by target class mapping
    // Subject's "Class" column (key: sub.class) contains comma-separated class names
    var targetClassRaw = String(sub.class || sub.className || '').trim();
    if (targetClassRaw !== '') {
      var targetClasses = targetClassRaw.split(',').map(function(c) { return c.trim().toLowerCase(); });
      if (studentClassName && targetClasses.indexOf(studentClassName) === -1) return false;
    }
    // If subject has no class restriction (empty), it's available to all students in that section

    return true;
  });

  return { enrolled: enrolled, available: available };
}

function adminGetSchoolPerformance(token, term, sess) { requireRole(token,['admin','admin_assistant']); return getSchoolPerformanceOverview(term, sess); }
function adminGetComplianceSummary(token, term, sess) {
  requireRole(token,['admin','admin_assistant']);
  
  var teachers = getAllUsers().filter(function(u) { return u.role === 'teacher' || u.role === 'primary_teacher'; });
  var plans = getSheetData('LessonPlans').filter(function(p) { return String(p.term) === String(term) && String(p.session) === String(sess); });
  var scores = getSheetData('Assessments').filter(function(s) { return String(s.term) === String(term) && String(s.session) === String(sess); });
  
  var submittedPlans = plans.filter(function(p) { return ['submitted','approved'].indexOf(String(p.status||'').toLowerCase()) !== -1; }).length;
  
  return {
    totalTeachers: teachers.length,
    submittedPlans: submittedPlans,
    resultsEntered: scores.length
  };
}
function adminComputePositions(token, className, term, sess) { var s = requireRole(token,['admin','admin_assistant']); if (s.role === 'admin_assistant') return logPendingTask('COMPUTE_POSITIONS', {className:className, term:term, sess:sess}, s.userId); return computeClassPositions(className, term, sess); }

// --- PENDING TASK ENDPOINTS (Maker-Checker - Deluxe Plan only) --------------
function adminGetPendingTasks(token) {
  requirePlan('deluxe', token);
  requireRole(token, 'admin');
  return getPendingTasks();
}
function adminApproveTask(token, taskId) {
  requirePlan('deluxe', token);
  var s = requireRole(token, 'admin');
  var tasks = getPendingTasks();
  var task = tasks.find(function(t) { return String(t.id) === String(taskId); });
  if (!task) return { success: false, message: 'Task not found or already processed.' };
  
  var p = task.payload;
  var res = { success: false, message: 'Unknown task type' };
  
  try {
    switch(task.taskType) {
      case 'CREATE_USER': res = createUser(p); break;
      case 'UPDATE_USER': res = updateUser(p.uid, p.data); break;
      case 'DELETE_USER': res = deleteUser(p.uid); break;
      case 'RESET_PWD': res = updateUser(p.uid, { password: 'password123' }); break;
      case 'PROCESS_PWD_RESET':
        var sheet = getSpreadsheet().getSheetByName('PasswordRequests');
        var row = findRowById(sheet, p.requestId);
        if (row !== -1) {
          var email = sheet.getRange(row, 2).getValue();
          var users = getSheetData('Users');
          var user = users.find(function(u){ return u.email.toLowerCase() === email.toLowerCase(); });
          if (user) {
            res = updateUser(user.id, { password: p.newPassword });
            if (res.success) sheet.getRange(row, 5).setValue('completed');
          }
        }
        break;
      case 'CREATE_STUDENT': res = createStudent(p); break;
      case 'BULK_CREATE_STUDENTS': res = bulkCreateStudents(p); break;
      case 'UPDATE_STUDENT': res = updateStudent(p.sid, p.data); break;
      case 'DELETE_STUDENT': res = deleteStudent(p.sid); break;
      case 'CREATE_CLASS': res = createClass(p); break;
      case 'BULK_CREATE_CLASSES': res = bulkCreateClasses(p); break;
      case 'UPDATE_CLASS': res = updateClass(p.cid, p.data); break;
      case 'DELETE_CLASS': res = deleteClass(p.cid); break;
      case 'CREATE_SUBJECT': res = createSubject(p); break;
      case 'BULK_CREATE_SUBJECTS': res = bulkCreateSubjects(p); break;
      case 'UPDATE_SUBJECT': res = updateSubject(p.sid, p.data); break;
      case 'DELETE_SUBJECT': res = deleteSubject(p.sid); break;
      case 'ASSIGN_SUBJECTS': res = assignSubjectsToTeacher(p.tid, p.sids); break;
      case 'UPDATE_SETTINGS': res = updateSettings(p); break;
      case 'LOCK_SCORES': res = lockScores(p); break;
      case 'UNLOCK_SCORES': res = unlockScores(p); break;
      case 'ENROLL_STUDENT': res = enrollStudent(p.sid, p.subId, p.sess, p.term); break;
      case 'UNENROLL_STUDENT': res = unenrollStudent(p.sid, p.subId, p.sess); break;
      case 'APPROVE_LESSON': res = approveLessonPlan(task.requestedBy, p.planId, p.note); break;
      case 'REJECT_LESSON': res = rejectLessonPlan(task.requestedBy, p.planId, p.note); break;
      case 'SAVE_GRADE_RULE': res = updateGradingRule(p); break;
      case 'COMPUTE_POSITIONS': res = computeClassPositions(p.className, p.term, p.sess); break;
    }
  } catch(e) {
    res = { success: false, message: 'Execution error: ' + e.toString() };
  }
  
  if (res.success) {
    updatePendingTaskStatus(taskId, 'approved', '', s.userId);
  }
  return res;
}
function adminRejectTask(token, taskId, reason) {
  requirePlan('deluxe', token);
  var s = requireRole(token, 'admin');
  return updatePendingTaskStatus(taskId, 'rejected', reason, s.userId);
}

// --- PRINCIPAL / VP ENDPOINTS --------------------------------

function principalGetStats(token) {
  var s = requireRole(token, ['principal','vp', 'headteacher']);
  return getAdminStats(s.section);
}
function principalGetStudentReport(token, sid, term, sess) {
  requireRole(token, ['principal','vp','headteacher']);
  return generateStudentReport(sid, term, sess);
}
function principalGetStudentResultPDF(token, sid, term, sess, reportType) {
  requireRole(token, ['principal','vp','headteacher','teacher']);
  return generateResultPDF(sid, term, sess, reportType);
}
function principalGetLessonPlans(token, term, sess) {
  var s = requireRole(token, ['principal','vp', 'headteacher']);
  return getPendingLessonPlans(term, sess, s.section);
}
function principalApprovePlan(token, planId, note) {
  var s = requireRole(token, ['principal','vp']);
  return approveLessonPlan(s.userId, planId, note);
}
function principalRejectPlan(token, planId, note) {
  var s = requireRole(token, ['principal','vp']);
  return rejectLessonPlan(s.userId, planId, note);
}
function principalGetCompliance(token, term, sess) {
  requireRole(token, ['principal','vp','headteacher']);
  return getTeacherComplianceReport(term, sess);
}
function principalGetAttendanceReport(token, className, term, sess) {
  requireRole(token, ['principal','vp','headteacher']);
  return getClassAttendanceSummary(className, term, sess);
}
function principalGetStudentAttendanceSummary(token, studentId, term, sess) {
  requireRole(token, ['principal','vp','headteacher']);
  return getStudentAttendanceSummary(studentId, term, sess);
}
function principalGetSchoolPerformance(token, term, sess) {
  var s = requireRole(token, ['principal','vp','headteacher']);
  return getSchoolPerformanceOverview(term, sess, s.section);
}
function principalGetSubjectAnalytics(token, className, term, sess) {
  requireRole(token, ['principal','vp','headteacher']);
  return getSubjectPerformanceAnalytics(className, term, sess);
}
function principalGetAllStudents(token) {
  var s = requireRole(token, ['principal','vp','headteacher','teacher']);
  var students = getAllStudents();
  return s.section === 'both' ? students : students.filter(function(st) { return st.section === s.section; });
}
function principalGetClasses(token) {
  var s = requireRole(token, ['principal','vp','headteacher']);
  var classes = getAllClasses();
  return s.section === 'both' ? classes : classes.filter(function(c) { return c.section === s.section; });
}

// --- TEACHER ENDPOINTS ---------------------------------------

function teacherGetMySubjects(token) {
  var s = requireRole(token, ['teacher','primary_teacher']);
  if (s.role === 'primary_teacher') {
    var allSubjects = getAllSubjects();
    var myClass = s.classAssigned || '';
    return allSubjects.filter(function(sub) {
      if (String(sub.assignedTeacherID || sub.assignedTeacherId) === String(s.userId)) return true;
      if (sub.section === 'primary') {
        if (myClass && sub.className && String(sub.className) === String(myClass)) return true;
        if (!sub.className || String(sub.className).trim() === '') return true;
      }
      return false;
    });
  }
  return getTeacherSubjects(s.userId);
}
function teacherGetSubjectStudents(token, subId, sess) {
  requireRole(token, ['teacher','primary_teacher']);
  return getSubjectStudents(subId, sess);
}
function teacherGetClassStudents(token, className) {
  requireRole(token, ['teacher','primary_teacher']);
  return getStudentsByClass(className);
}
function teacherGetScores(token, filters) {
  var s = requireRole(token, ['teacher','primary_teacher']);
  if (filters && !filters.subjectId) filters.teacherId = s.userId;
  return getScores(filters);
}
function teacherSaveScore(token, data) {
  var s = requireRole(token, ['teacher','primary_teacher']);
  if (data && data.subjectId) _verifyTeacherSubjectAuth(s.userId, data.subjectId);
  return saveScore(data);
}
function teacherBulkSaveScores(token, data) {
  var s = requireRole(token, ['teacher','primary_teacher']);
  if (data && data.length > 0 && data[0].subjectId) {
    _verifyTeacherSubjectAuth(s.userId, data[0].subjectId);
  }
  return bulkSaveScores(data);
}
function teacherLockScores(token, filters) {
  var s = requireRole(token, ['teacher','primary_teacher']);
  if (filters && filters.subjectId) _verifyTeacherSubjectAuth(s.userId, filters.subjectId);
  return lockScores(filters);
}
function teacherSubmitScores(token, filters) {
  var s = requireRole(token, ['teacher','primary_teacher']);
  if (filters && filters.subjectId) _verifyTeacherSubjectAuth(s.userId, filters.subjectId);
  return lockScores(filters);
}
function teacherMarkAttendance(token, className, date, records, term, sess) {
  var s = requireRole(token, ['teacher','primary_teacher']);
  if (className) _verifyTeacherClassAuth(s.userId, className);
  return markAttendance(className, date, records, s.userId, term, sess);
}
function teacherGetAttendance(token, className, term, sess) {
  requireRole(token, ['teacher','primary_teacher']);
  return getClassAttendance(className, term, sess);
}
function teacherGetAttendanceByDate(token, className, date) {
  requireRole(token, ['teacher','primary_teacher']);
  return getAttendanceByDate(className, date);
}
function teacherGetStudentAttendanceSummary(token, studentId, term, sess) {
  requireRole(token, ['teacher','primary_teacher']);
  return getStudentAttendanceSummary(studentId, term, sess);
}
function teacherSavePsychomotor(token, data) {
  var s = requireRole(token, ['teacher','primary_teacher']);
  if (data && data.className) _verifyTeacherClassAuth(s.userId, data.className);
  return savePsychomotorRecord(data);
}
function teacherSaveAffective(token, data) {
  var s = requireRole(token, ['teacher','primary_teacher']);
  if (data && data.className) _verifyTeacherClassAuth(s.userId, data.className);
  return saveAffectiveRecord(data);
}
function teacherGetPsychomotor(token, sid, term, sess) {
  requireRole(token, ['teacher','primary_teacher']);
  return getPsychomotorRecord(sid, term, sess);
}
function teacherGetAffective(token, sid, term, sess) {
  requireRole(token, ['teacher','primary_teacher']);
  return getAffectiveRecord(sid, term, sess);
}
function teacherCreateLessonPlan(token, data) {
  requirePlan('standard', token);
  var s = requireRole(token, ['teacher','primary_teacher']);
  return createLessonPlan(s.userId, data);
}
function teacherUpdateLessonPlan(token, planId, data) {
  requirePlan('standard', token);
  var s = requireRole(token, ['teacher','primary_teacher']);
  return updateLessonPlan(s.userId, planId, data);
}
function teacherSubmitLessonPlan(token, planId) {
  requirePlan('standard', token);
  var s = requireRole(token, ['teacher','primary_teacher']);
  return submitLessonPlan(s.userId, planId);
}
function teacherDeleteLessonPlan(token, planId) {
  requirePlan('standard', token);
  var s = requireRole(token, ['teacher','primary_teacher']);
  return deleteLessonPlan(s.userId, planId);
}
function teacherGetMyLessonPlans(token, term, sess) {
  requirePlan('standard', token);
  var s = requireRole(token, ['teacher','primary_teacher']);
  return getTeacherLessonPlans(s.userId, term, sess);
}
function teacherGenerateLessonPlanPDF(token, planId) {
  requirePlan('standard', token);
  requireRole(token, ['teacher','primary_teacher']);
  return generateLessonPlanPDF(planId);
}
function teacherEnrollStudent(token, sid, subId, sess, term) {
  requireRole(token, ['teacher','primary_teacher']);
  return enrollStudent(sid, subId, sess, term);
}
function teacherUnenrollStudent(token, sid, subId, sess) {
  requireRole(token, ['teacher','primary_teacher']);
  return unenrollStudent(sid, subId, sess);
}
function teacherGetStudentReport(token, sid, term, sess, reportType) {
  requireRole(token, ['teacher','primary_teacher']);
  return generateStudentReport(sid, term, sess, reportType);
}
function teacherComputePositions(token, className, term, sess) {
  requireRole(token, ['teacher','primary_teacher']);
  return computeClassPositions(className, term, sess);
}

// --- ACCOUNTS ENDPOINTS --------------------------------------

function accountsGetFeeStructures(token) {
  var s = requireRole(token,'accounts');
  var fees = getAllFeeStructures();
  return s.section === 'both' ? fees : fees.filter(function(f) { return f.section === s.section; });
}
function accountsSaveFeeStructure(token, data) { requireRole(token,'accounts'); return saveFeeStructure(data); }
function accountsDeleteFeeStructure(token, feeId) { requireRole(token,'accounts'); return deleteFeeStructure(feeId); }
function accountsGenerateBills(token, term, sess) {
  var s = requireRole(token,'accounts');
  return generateTermBills(term, sess, s.userId, s.section);
}
function accountsGetBills(token, filters) {
  var s = requireRole(token,'accounts');
  filters = filters || {};
  if (s.section !== 'both') filters.section = s.section;
  return getAllBills(filters);
}
function accountsGetDebtors(token, term, sess) {
  var s = requireRole(token,'accounts');
  var debtors = getDebtors(term, sess);
  if (s.section === 'both') return debtors;
  var students = getAllStudents();
  return debtors.filter(function(b) {
    var student = students.find(function(st) { return String(st.iD || st.id) === String(b.studentID || b.studentId); });
    return student && student.section === s.section;
  });
}
function accountsRecordPayment(token, data) {
  var s = requireRole(token,'accounts');
  // Ensure the target student belongs to this officer's section
  if (s.section !== 'both') {
    var student = getStudentById(data.studentId);
    if (!student) return { success: false, message: 'Student not found.' };
    if (student.section !== s.section) return { success: false, message: 'Access denied: student is not in your section.' };
  }
  return recordPayment(data, s.userId);
}
function accountsGetPayments(token, filters) {
  var s = requireRole(token,'accounts');
  filters = filters || {};
  if (s.section !== 'both') filters.section = s.section;
  return getAllPayments(filters);
}
function accountsGetStudentLedger(token, sid) {
  var s = requireRole(token,'accounts');
  if (s.section !== 'both') {
    var student = getStudentById(sid);
    if (!student) return { bills: [], payments: [], creditBalance: 0 };
    if (student.section !== s.section) return { bills: [], payments: [], creditBalance: 0, error: 'Access denied: student is not in your section.' };
  }
  return getStudentLedger(sid);
}
function accountsGenerateReceipt(token, payId) { requireRole(token,'accounts'); return generateReceiptPDF(payId); }
function accountsApprovePayment(token, payId) { var s = requireRole(token,'accounts'); return approvePayment(payId, s.userId); }
function accountsRejectPayment(token, payId) { var s = requireRole(token,'accounts'); return rejectPayment(payId, s.userId); }
function accountsReversePayment(token, payId, reason) { requirePlan('deluxe', token); var s = requireRole(token,'accounts'); return reversePayment(payId, reason, s.userId); }
function accountsRecordCreditNote(token, data) { requirePlan('deluxe', token); var s = requireRole(token,'accounts'); return recordCreditNote(data, s.userId); }
function accountsGetExpenses(token) {
  var s = requireRole(token,'accounts');
  return getAllExpenses(s.section === 'both' ? null : { section: s.section });
}
function accountsRecordExpense(token, data) {
  var s = requireRole(token,'accounts');
  if (s.section !== 'both') data.section = s.section;
  return recordExpense(data, s.userId);
}
function accountsDeleteExpense(token, expId) { var s = requireRole(token,'accounts'); return deleteExpense(expId, s.userId); }
function accountsGetFinancialStats(token, term, sess) {
  var s = requireRole(token,'accounts');
  return getFinancialDashboardStats(term, sess, s.section);
}
function accountsGetIncomeExpenseReport(token, term, sess) { requireRole(token,'accounts'); return getIncomeExpenseReport(term, sess); }
function accountsSendReminders(token, term, sess, batchSize) {
  var s = requireRole(token,'accounts');
  return sendOutstandingBalanceReminders(term, sess, s.section !== 'both' ? s.section : null, batchSize);
}
function accountsGetStudents(token) {
  var s = requireRole(token,'accounts');
  var students = getAllStudents();
  return s.section === 'both' ? students : students.filter(function(st) { return st.section === s.section; });
}

// --- PARENT ENDPOINTS ----------------------------------------

function parentGetChildren(token) {
  var s = requireRole(token,'parent');
  return getParentChildren(s.userId);
}
function parentGetReport(token, sid, term, sess, reportType) {
  var s = requireRole(token,'parent');
  _verifyParentChild(s.userId, sid);
  return generateStudentReport(sid, term, sess, reportType);
}
function parentDownloadReport(token, sid, term, sess, reportType) {
  var s = requireRole(token,'parent');
  _verifyParentChild(s.userId, sid);
  return generateResultPDF(sid, term, sess, reportType);
}
function parentGetBills(token, sid) {
  var s = requireRole(token,'parent');
  _verifyParentChild(s.userId, sid);
  return getAllBills({ studentId: sid });
}
function parentGetPayments(token, sid) {
  var s = requireRole(token,'parent');
  _verifyParentChild(s.userId, sid);
  return getStudentPayments(sid);
}
function parentGetStudentCredit(token, sid) {
  var s = requireRole(token,'parent');
  _verifyParentChild(s.userId, sid);
  return getStudentCreditBalance(sid);
}
function parentDownloadReceipt(token, payId) {
  var s = requireRole(token,'parent');
  try {
    var payments = getSheetData('Payments');
    var payment = payments.find(function(p) { return String(p.iD || p.id) === String(payId); });
    if (!payment) return { success: false, message: 'Payment not found.' };
    _verifyParentChild(s.userId, payment.studentID || payment.studentId);
    
    return generateReceiptPDF(payId);
  } catch(e) {
    Logger.log('parentDownloadReceipt error: ' + e);
    return { success: false, message: 'Could not generate receipt: ' + e.message };
  }
}
function parentSubmitPaymentData(token, data) {
  var s = requireRole(token,'parent');
  _verifyParentChild(s.userId, data.studentId);
  return parentSubmitPayment(data, s.userId);
}

function _verifyParentChild(parentUserId, studentId) {
  var user = getUserById(parentUserId);
  if (!user) throw new Error('User not found.');
  var linked = user.linkedStudentIds ? String(user.linkedStudentIds).split(',').map(function(x){return x.trim();}) : [];
  if (linked.indexOf(String(studentId)) === -1)
    throw new Error('Access denied. Student not linked to this account.');
}

function _requireNotDeveloperTarget(targetUid) {
  var user = getUserById(targetUid);
  if (user && user.role === 'developer') {
    throw new Error('Security Error: Developer accounts cannot be modified or deleted by other users.');
  }
}

function _verifyTeacherClassAuth(teacherId, className) {
  if (!className) throw new Error('Class name is required.');
  var classes = getSheetData('Classes');
  var cls = classes.find(function(c) { return String(c.className || c.ClassName) === String(className); });
  if (!cls) throw new Error('Class not found.');
  if (String(cls.classTeacherId || cls.classTeacherID) !== String(teacherId)) {
    throw new Error('Access denied. You are not the class teacher for this class.');
  }
}

function _verifyTeacherSubjectAuth(teacherId, subjectId) {
  var subject = getSubjectById(subjectId);
  if (!subject) throw new Error('Subject not found.');
  if (String(subject.assignedTeacherId || subject.assignedTeacherID) === String(teacherId)) {
    return true;
  }
  if (subject.className || subject.class) {
    var className = subject.className || subject.class;
    var classes = getSheetData('Classes');
    var cls = classes.find(function(c) { return String(c.className || c.ClassName) === String(className); });
    if (cls && String(cls.classTeacherId || cls.classTeacherID) === String(teacherId)) {
      return true;
    }
  }
  throw new Error('Access denied. You are not assigned to this subject or class.');
}

// --- DATABASE SETUP ------------------------------------------

function setupSheets() {
  var ss = getSpreadsheet();
  var schema = {
    'Users':             ['ID','FullName','Email','PasswordHash','Role','Section','LinkedStudentIDs','ClassAssigned','Status','ProfilePicture','Phone','CreatedAt','Signature','PasswordSalt'],
    'Students':          ['ID','FullName','AdmissionNumber','Class','Section','School','ParentID','Gender','DateOfBirth','PhotoURL','EnrollmentDate','Status'],
    'Classes':           ['ID','ClassName','Section','School','ClassTeacherID','AcademicSession'],
    'Subjects':          ['ID','SubjectName','Section','Class','AssignedTeacherID'],
    'Enrollments':       ['StudentID','SubjectID','Session','Term'],
    'Attendance':        ['ID','StudentID','Class','Date','Status','MarkedByUserID','Session','Term'],
    'Assessments':       ['ID','StudentID','StudentName','SubjectID','Class','Term','Session','CA1','CA2','CA3','Exam','Total','Grade','Position','TeacherComment','Locked','Submitted'],
    'PsychomotorRecords':['ID','StudentID','Class','Term','Session','Handwriting','SportSkills','Drawing','Creativity','Speaking','Attentiveness'],
    'AffectiveRecords':  ['ID','StudentID','Class','Term','Session','Punctuality','Neatness','Politeness','Honesty','Leadership','Cooperation'],
    'LessonPlans':       ['ID','TeacherID','SubjectID','Class','Topic','Objectives','TeachingAids','EntryBehaviour','PresentationSteps','Evaluation','Assignment','Week','Term','Session','Status','ApprovedByID','ApprovalNote','CreatedAt'],
    'FeeStructure':      ['ID','ClassName','Section','Term','Session','TuitionFee','DevelopmentLevy','ExamFee','SportsFee','TotalFee','LineItems'],
    'Bills':             ['ID','StudentID','StudentName','Class','Term','Session','TotalBilled','TotalPaid','Balance','Status','GeneratedDate','LastReminderDate'],
    'Payments':          ['ID','BillID','StudentID','Term','Session','Amount','PaymentDate','Method','ReceiptRef','RecordedByID','EmailSent','Status','ProofOfPayment'],
    'Expenses':          ['ID','Category','Description','Amount','Date','RecordedByID','Section'],
    'AuditLogs':         ['ID','UserID','Action','Details','Timestamp'],
    'Settings':          ['Key','Value'],
    'PasswordRequests':  ['ID','Email','FullName','Role','Status','Timestamp']
  };

  for (var name in schema) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.getRange(1, 1, 1, schema[name].length).setValues([schema[name]]).setFontWeight('bold');
      sheet.setFrozenRows(1);
    } else {
      var lastCol = sheet.getLastColumn();
      var currentHeaders = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
      var schemaHeaders = schema[name];
      var headersUpdated = false;
      for (var idx = 0; idx < schemaHeaders.length; idx++) {
        if (idx >= currentHeaders.length || String(currentHeaders[idx]).trim() === '') {
          sheet.getRange(1, idx + 1).setValue(schemaHeaders[idx]).setFontWeight('bold');
          headersUpdated = true;
        }
      }
      if (headersUpdated) {
        SpreadsheetApp.flush();
      }
    }
  }

  // Seed default settings
  var st = ss.getSheetByName('Settings');
  if (st.getLastRow() <= 1) {
    var defaults = [
      ['school_name','My School'],['school_motto','Excellence in Education'],
      ['school_logo_url',''],['principal_name','The Principal'],
      ['head_teacher_name','The Head Teacher'],['current_term','First Term'],
      ['current_session','2025/2026'],['next_term_begins',''],
      ['subscription_plan','basic'],
      ['institution_type','both'],
      ['grade_a1_min','75'],['grade_b2_min','70'],['grade_b3_min','65'],
      ['grade_c4_min','60'],['grade_c5_min','55'],['grade_c6_min','50'],
      ['grade_d7_min','45'],['grade_e8_min','40']
    ];
    st.getRange(2, 1, defaults.length, 2).setValues(defaults);
  }

  // Seed default admin if database is completely empty
  var us = ss.getSheetByName('Users');
  if (us.getLastRow() <= 1) {
    var seedSaltAdmin = generateSalt();
    us.appendRow([generateId(),'System Administrator','admin@school.portal',
      hashPassword('admin123', seedSaltAdmin),'admin','both','','','active','','',new Date().toISOString(),'',seedSaltAdmin]);
  }

  // Always ensure a developer account exists (crucial for existing installations)
  var usersData = us.getDataRange().getValues();
  var hasDeveloper = false;
  for (var i = 1; i < usersData.length; i++) {
    if (usersData[i][4] === 'developer' || usersData[i][2] === 'developer@school.portal') {
      hasDeveloper = true;
      break;
    }
  }
  if (!hasDeveloper) {
    var seedSaltDev = generateSalt();
    us.appendRow([generateId(),'Portal Developer','developer@school.portal',
      hashPassword('dev123', seedSaltDev),'developer','both','','','active','','',new Date().toISOString(),'',seedSaltDev]);
  }

  // Remove default Sheet1
  var def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);

  // Seed standard Nigerian subjects
  seedNigerianSubjects();

  // Seed standard Nigerian classes
  seedNigerianClasses();

  // Setup Automated Backup
  setupBackupTrigger();

  return 'Setup complete! Admin login: admin@school.portal / admin123 (change this password immediately after first login!)';
}

