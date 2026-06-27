/**
 * ABECEDARIAN ACADEMY — Notifications.gs
 * Gmail-based automated email notifications.
 */

/**
 * Send payment receipt email to parent.
 */
function sendPaymentReceipt(paymentId) {
  try {
    var payments = getSheetData('Payments');
    var payment = payments.find(function(p) { return String(p.iD || p.id) === String(paymentId); });
    if (!payment) return { success: false, message: 'Payment not found.' };

    var studentId = payment.studentID || payment.studentId;
    var student = getStudentById(studentId);
    if (!student) return { success: false, message: 'Student not found.' };

    var parentId = student.parentId || student.parentID;
    if (!parentId) return { success: false, message: 'No parent linked.' };

    var parent = getUserById(parentId);
    if (!parent || !parent.email) return { success: false, message: 'Parent email not found.' };

    var bill = getStudentBill(studentId, payment.term, payment.session);
    var balance = bill ? safeFloat(bill.balance, 0) : 0;
    var settings = getSettings();
    var schoolName = settings.school_name || 'My School';

    var subject = schoolName + ' — Payment Receipt (' + payment.receiptRef + ')';
    var body = buildPaymentReceiptEmail(schoolName, student, payment, balance);

    GmailApp.sendEmail(parent.email, subject, '', { htmlBody: body, name: schoolName });

    // Mark email as sent
    var sheet = getSpreadsheet().getSheetByName('Payments');
    var row = findRowById(sheet, paymentId);
    if (row > 0) sheet.getRange(row, 11).setValue('true');

    return { success: true, message: 'Receipt emailed to ' + parent.email };
  } catch (e) {
    Logger.log('sendPaymentReceipt error: ' + e);
    return { success: false, message: 'Email failed: ' + e.message };
  }
}

/**
 * Send payment rejection email to parent.
 */
function sendPaymentRejection(paymentId) {
  try {
    var payments = getSheetData('Payments');
    var payment = payments.find(function(p) { return String(p.iD || p.id) === String(paymentId); });
    if (!payment) return { success: false, message: 'Payment not found.' };

    var studentId = payment.studentID || payment.studentId;
    var student = getStudentById(studentId);
    if (!student) return { success: false, message: 'Student not found.' };

    var parentId = student.parentId || student.parentID;
    if (!parentId) return { success: false, message: 'No parent linked.' };

    var parent = getUserById(parentId);
    if (!parent || !parent.email) return { success: false, message: 'Parent email not found.' };

    var settings = getSettings();
    var schoolName = settings.school_name || 'My School';
    var subject = schoolName + ' — Payment Submission Rejected';

    var body = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">' +
      '<div style="background:#dc2626;color:white;padding:20px;text-align:center;">' +
      '<h2 style="margin:0;">' + schoolName + '</h2>' +
      '<p style="margin:5px 0 0;font-size:13px;">Payment Submission Update</p></div>' +
      '<div style="padding:25px;">' +
      '<p>Dear <strong>' + parent.fullName + '</strong>,</p>' +
      '<p>We regret to inform you that your recent payment submission has been <strong style="color:#dc2626;">REJECTED</strong> during validation.</p>' +
      '<table style="width:100%;border-collapse:collapse;margin:15px 0;">' +
      '<tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><strong>Student</strong></td><td style="padding:8px;border:1px solid #ddd;">' + student.fullName + '</td></tr>' +
      '<tr><td style="padding:8px;border:1px solid #ddd;"><strong>Term / Session</strong></td><td style="padding:8px;border:1px solid #ddd;">' + payment.term + ' — ' + payment.session + '</td></tr>' +
      '<tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><strong>Amount Submitted</strong></td><td style="padding:8px;border:1px solid #ddd;">' + formatNaira(payment.amount) + '</td></tr>' +
      '<tr><td style="padding:8px;border:1px solid #ddd;"><strong>Reference</strong></td><td style="padding:8px;border:1px solid #ddd;">' + (payment.receiptRef || 'N/A') + '</td></tr>' +
      '</table>' +
      '<p style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 15px;border-radius:0 4px 4px 0;color:#7f1d1d;">' +
      '⚠️ <strong>Reason:</strong> Your proof of payment could not be verified. Please ensure the proof is a clear, legible image showing the bank name, amount, date, and transaction reference.</p>' +
      '<p>To resolve this:</p><ol style="line-height:1.8;">' +
      '<li>Log in to the Parent Portal</li>' +
      '<li>Go to <strong>Bills &amp; Payments</strong></li>' +
      '<li>Submit a new, clearer proof of payment</li>' +
      '</ol>' +
      '<p>If you believe this rejection is in error, please contact the accounts office directly.</p>' +
      '<p style="margin-top:20px;">Thank you.<br><strong>The Accounts Department</strong><br>' + schoolName + '</p>' +
      '</div><div style="background:#f5f5f5;padding:10px;text-align:center;font-size:11px;color:#666;">' +
      'This is an automated message from ' + schoolName + '. Please do not reply to this email.</div></div>';

    GmailApp.sendEmail(parent.email, subject, '', { htmlBody: body, name: schoolName });
    return { success: true, message: 'Rejection email sent to ' + parent.email };
  } catch (e) {
    Logger.log('sendPaymentRejection error: ' + e);
    return { success: false, message: 'Email failed: ' + e.message };
  }
}

function buildPaymentReceiptEmail(schoolName, student, payment, balance) {
  return '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">' +
    '<div style="background:#0d1b2a;color:#f0a500;padding:20px;text-align:center;">' +
    '<h2 style="margin:0;">' + schoolName + '</h2>' +
    '<p style="margin:5px 0 0;color:#fff;font-size:13px;">Payment Receipt</p></div>' +
    '<div style="padding:25px;">' +
    '<p>Dear Parent/Guardian of <strong>' + student.fullName + '</strong>,</p>' +
    '<p>We confirm receipt of the following payment:</p>' +
    '<table style="width:100%;border-collapse:collapse;margin:15px 0;">' +
    '<tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><strong>Receipt Ref</strong></td><td style="padding:8px;border:1px solid #ddd;">' + (payment.receiptRef || '') + '</td></tr>' +
    '<tr><td style="padding:8px;border:1px solid #ddd;"><strong>Student</strong></td><td style="padding:8px;border:1px solid #ddd;">' + student.fullName + '</td></tr>' +
    '<tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><strong>Class</strong></td><td style="padding:8px;border:1px solid #ddd;">' + (student.class || student.className || '') + '</td></tr>' +
    '<tr><td style="padding:8px;border:1px solid #ddd;"><strong>Term / Session</strong></td><td style="padding:8px;border:1px solid #ddd;">' + payment.term + ' — ' + payment.session + '</td></tr>' +
    '<tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><strong>Amount Paid</strong></td><td style="padding:8px;border:1px solid #ddd;color:#16a34a;font-weight:bold;">' + formatNaira(payment.amount) + '</td></tr>' +
    '<tr><td style="padding:8px;border:1px solid #ddd;"><strong>Payment Method</strong></td><td style="padding:8px;border:1px solid #ddd;">' + (payment.method || 'Cash') + '</td></tr>' +
    '<tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><strong>Payment Date</strong></td><td style="padding:8px;border:1px solid #ddd;">' + formatDate(payment.paymentDate || payment.date) + '</td></tr>' +
    '<tr><td style="padding:8px;border:1px solid #ddd;"><strong>Outstanding Balance</strong></td><td style="padding:8px;border:1px solid #ddd;color:' + (balance > 0 ? '#dc2626' : '#16a34a') + ';font-weight:bold;">' + formatNaira(balance) + '</td></tr>' +
    '</table>' +
    (balance > 0 ? '<p style="background:#fef3c7;padding:10px;border-radius:4px;color:#92400e;">⚠️ An outstanding balance of <strong>' + formatNaira(balance) + '</strong> remains. Please settle at your earliest convenience.</p>' : '<p style="background:#d1fae5;padding:10px;border-radius:4px;color:#065f46;">✅ Your account is fully settled. Thank you!</p>') +
    '<p style="margin-top:20px;">Thank you for your prompt payment.<br><strong>The Accounts Department</strong><br>' + schoolName + '</p>' +
    '</div><div style="background:#f5f5f5;padding:10px;text-align:center;font-size:11px;color:#666;">' +
    'This is an automated message from ' + schoolName + '. Please do not reply to this email.</div></div>';
}

/**
 * Send absence alert to parent.
 */
function sendAbsenceAlert(studentId, date, consecutiveDays) {
  try {
    var student = getStudentById(studentId);
    if (!student) return;
    var parentId = student.parentId || student.parentID;
    if (!parentId) return;
    var parent = getUserById(parentId);
    if (!parent || !parent.email) return;

    var settings = getSettings();
    var schoolName = settings.school_name || 'My School';
    var subject = schoolName + ' — Absence Notification for ' + student.fullName;
    var body = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">' +
      '<div style="background:#dc2626;color:white;padding:20px;text-align:center;">' +
      '<h2 style="margin:0;">' + schoolName + '</h2>' +
      '<p style="margin:5px 0 0;font-size:13px;">Absence Notification</p></div>' +
      '<div style="padding:25px;">' +
      '<p>Dear Parent/Guardian of <strong>' + student.fullName + '</strong>,</p>' +
      '<p>This is to inform you that your ward, <strong>' + student.fullName + '</strong> (' + (student.class || '') + '), ' +
      'has been absent from school for <strong>' + consecutiveDays + ' consecutive day(s)</strong> as of <strong>' + formatDate(date) + '</strong>.</p>' +
      '<p>We urge you to contact the school immediately if there is an underlying issue, or ensure your ward resumes school promptly.</p>' +
      '<p>Thank you.<br><strong>The School Administration</strong><br>' + schoolName + '</p>' +
      '</div></div>';

    GmailApp.sendEmail(parent.email, subject, '', { htmlBody: body, name: schoolName });
  } catch (e) {
    Logger.log('sendAbsenceAlert error: ' + e);
  }
}

/**
 * Notify parent that the term report is ready.
 */
function sendReportReadyNotification(studentId, term, session, pdfUrl) {
  try {
    var student = getStudentById(studentId);
    if (!student) return;
    var parentId = student.parentId || student.parentID;
    if (!parentId) return;
    var parent = getUserById(parentId);
    if (!parent || !parent.email) return;
    var settings = getSettings();
    var schoolName = settings.school_name || 'My School';
    var subject = schoolName + ' — ' + term + ' Report Card Ready';
    var body = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">' +
      '<div style="background:#0d1b2a;color:#f0a500;padding:20px;text-align:center;">' +
      '<h2 style="margin:0;">' + schoolName + '</h2>' +
      '<p style="margin:5px 0 0;color:#fff;font-size:13px;">Academic Report Notification</p></div>' +
      '<div style="padding:25px;">' +
      '<p>Dear Parent/Guardian of <strong>' + student.fullName + '</strong>,</p>' +
      '<p>The <strong>' + term + ' ' + session + '</strong> academic report for <strong>' + student.fullName + '</strong> is now available.</p>' +
      (pdfUrl ? '<p><a href="' + pdfUrl + '" style="display:inline-block;background:#f0a500;color:#0d1b2a;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:bold;">📄 Download Report Card</a></p>' : '') +
      '<p>You may also log in to the parent portal to view and print the report.</p>' +
      '<p>Thank you.<br><strong>The Academic Office</strong><br>' + schoolName + '</p>' +
      '</div></div>';
    GmailApp.sendEmail(parent.email, subject, '', { htmlBody: body, name: schoolName });
  } catch (e) {
    Logger.log('sendReportReadyNotification error: ' + e);
  }
}

/**
 * Send outstanding balance reminder to all debtors.
 */
function sendOutstandingBalanceReminders(term, session, section, batchSize) {
  batchSize = batchSize || 50;
  var allDebtors = getDebtors(term, session);
  var debtors = allDebtors;
  if (section) {
    var students = getAllStudents();
    debtors = allDebtors.filter(function(bill) {
      var student = students.find(function(s) { return String(s.iD || s.id) === String(bill.studentID || bill.studentId); });
      return student && student.section === section;
    });
  }

  var now = new Date();
  var twentyFourHoursAgo = now.getTime() - (24 * 60 * 60 * 1000);

  // Filter out debtors who already received a reminder recently
  var eligibleDebtors = debtors.filter(function(bill) {
    if (!bill.lastReminderDate) return true;
    var lastSent = new Date(bill.lastReminderDate).getTime();
    if (isNaN(lastSent)) return true;
    return lastSent < twentyFourHoursAgo;
  });

  var batch = eligibleDebtors.slice(0, batchSize);

  var settings = getSettings();
  var schoolName = settings.school_name || 'My School';
  var sent = 0;

  var billSheet = getSpreadsheet().getSheetByName('Bills');

  batch.forEach(function(bill) {
    try {
      var sid = bill.studentID || bill.studentId;
      var student = getStudentById(sid);
      if (!student) return;
      var parentId = student.parentId || student.parentID;
      if (!parentId) return;
      var parent = getUserById(parentId);
      if (!parent || !parent.email) return;

      var subject = schoolName + ' — Outstanding Balance Reminder';
      var body = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">' +
        '<div style="background:#0d1b2a;color:#f0a500;padding:15px;text-align:center;"><h3>' + schoolName + '</h3></div>' +
        '<div style="padding:20px;">' +
        '<p>Dear Parent/Guardian of <strong>' + student.fullName + '</strong>,</p>' +
        '<p>This is a reminder that your ward has an outstanding school fee balance of <strong style="color:#dc2626;">' + formatNaira(bill.balance) + '</strong> for <strong>' + term + ' ' + session + '</strong>.</p>' +
        '<p>Please visit the accounts office or contact us to settle this balance.</p>' +
        '<p>Thank you.<br><strong>The Accounts Department</strong></p></div></div>';

      GmailApp.sendEmail(parent.email, subject, '', { htmlBody: body, name: schoolName });
      sent++;

      // Update LastReminderDate in Bills sheet
      var bRow = findRowById(billSheet, bill.iD || bill.id);
      if (bRow > 0) {
        if (billSheet.getMaxColumns() < 12) billSheet.insertColumnsAfter(billSheet.getMaxColumns(), 12 - billSheet.getMaxColumns());
        billSheet.getRange(bRow, 12).setValue(now.toISOString());
      }
    } catch (e) { Logger.log('Reminder error: ' + e); }
  });

  SpreadsheetApp.flush();
  var remaining = Math.max(0, eligibleDebtors.length - sent);

  return { 
    success: true, 
    sent: sent,
    remaining: remaining,
    totalDebtors: eligibleDebtors.length,
    message: sent + ' reminder(s) sent. ' + (remaining > 0 ? remaining + ' remaining in queue.' : 'All done.')
  };
}
