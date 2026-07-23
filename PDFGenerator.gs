/**
 * ABECEDARIAN ACADEMY - PDFGenerator.gs
 * HTML→PDF generation via Apps Script for report cards, receipts, lesson plans.
 */

// --- RESULT / REPORT CARD PDF --------------------------------

function generateResultPDF(studentId, term, session, reportType) {
  var report = generateStudentReport(studentId, term, session, reportType);
  if (!report.success) return report;

  var s = report.student;
  var cfg = report.settings;
  var logoB64 = imageToBase64(getSettings().school_logo_url || '');

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8">';
  html += getReportCSS();
  html += '</head><body><div class="wrap">';
  html += generateStudentReportHTML(report, cfg, logoB64);
  html += '</div></body></html>';

  var studentName = (s.fullName || 'Student').replace(/\s+/g, '_');
  var prefix = reportType === 'Half Term' ? 'Half_Term_' : '';
  var blob = Utilities.newBlob(html, MimeType.HTML)
    .getAs(MimeType.PDF)
    .setName(studentName + '_' + prefix + term.replace(/\s+/g, '_') + '_Report.pdf');

  var folder = getOrCreateFolder((cfg.schoolName || 'My School') + ' - Reports');
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    success: true,
    pdfUrl: file.getUrl(),
    downloadUrl: 'https://drive.google.com/uc?export=download&id=' + file.getId(),
    previewUrl: 'https://drive.google.com/file/d/' + file.getId() + '/preview',
    fileName: blob.getName()
  };
}

function getReportCSS() {
  var html = '<style>';
  html += 'body{font-family:"Times New Roman",serif;margin:0;padding:0;color:#1a1a1a;font-size:10.5px;}';
  html += '.wrap{max-width:780px;margin:0 auto;border:3px double #0d1b2a;padding:8px;box-sizing:border-box;}';
  html += '.hdr{display:flex;align-items:center;border-bottom:2px solid #0d1b2a;padding-bottom:6px;margin-bottom:6px;}';
  html += '.logo{width:60px;height:60px;object-fit:contain;margin-right:15px;}';
  html += '.logo-ph{width:60px;height:60px;background:#0d1b2a;display:flex;align-items:center;justify-content:center;color:#f0a500;font-weight:bold;font-size:14px;margin-right:15px;}';
  html += '.school-info{flex:1;text-align:center;}';
  html += '.school-name{font-size:18px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#0d1b2a;}';
  html += '.school-motto{font-size:10px;font-style:italic;color:#555;margin:2px 0;}';
  html += '.rpt-title{font-size:12px;font-weight:bold;text-transform:uppercase;background:#0d1b2a;color:#f0a500;padding:3px 10px;display:inline-block;margin-top:4px;}';
  html += '.bio-box{display:flex;border:1px solid #ccc;margin-bottom:6px;}';
  html += '.bio-data{flex:1;padding:4px;}';
  html += '.bio-row{display:flex;margin-bottom:2px;}';
  html += '.bio-label{font-weight:bold;width:100px;flex-shrink:0;}';
  html += '.passport{width:70px;border-left:1px solid #ccc;display:flex;align-items:center;justify-content:center;background:#f5f5f5;font-size:9px;color:#888;text-align:center;padding:3px;}';
  html += 'table{width:100%;border-collapse:collapse;margin:4px 0;font-size:10px;}';
  html += 'th{background:#0d1b2a;color:#f0a500;padding:3px 2px;border:1px solid #0d1b2a;text-align:center;}';
  html += 'td{padding:2px;border:1px solid #ccc;text-align:center;}';
  html += 'tr:nth-child(even){background:#f8f8f8;}';
  html += '.sec-title{font-weight:bold;font-size:11px;background:#e8ecf0;padding:3px 6px;margin:6px 0 2px;border-left:3px solid #0d1b2a;}';
  html += '.summary-grid{display:flex;gap:6px;margin:4px 0;}';
  html += '.sum-box{flex:1;border:1px solid #ccc;padding:4px;text-align:center;}';
  html += '.sum-val{font-size:14px;font-weight:bold;color:#0d1b2a;}';
  html += '.sum-lbl{font-size:9px;color:#666;}';
  html += '.comment-box{border:1px solid #ccc;padding:4px;margin:4px 0;font-size:10px;}';
  html += '.sig-row{display:flex;justify-content:space-between;margin-top:10px;}';
  html += '.sig-box{text-align:center;width:30%;}';
  html += '.sig-line{border-top:1px solid #333;margin-top:20px;padding-top:2px;font-size:9px;}';
  html += '.footer{text-align:center;margin-top:8px;font-size:8px;color:#888;border-top:1px solid #e0e0e0;padding-top:4px;}';
  html += '.grade-a{color:#16a34a;font-weight:bold;} .grade-b{color:#2563eb;font-weight:bold;} .grade-c{color:#d97706;font-weight:bold;} .grade-f{color:#dc2626;font-weight:bold;}';
  html += '.att-box{display:flex;gap:8px;margin:6px 0;}';
  html += '.att-item{flex:1;border:1px solid #ccc;padding:5px;text-align:center;}';
  html += '.page-break { page-break-after: always; }';
  html += '</style>';
  return html;
}

function generateStudentReportHTML(report, cfg, logoB64) {
  var s = report.student;
  var scores = report.scores;
  var summary = report.summary;
  var att = report.attendance;
  var psy = report.psychomotor;
  var aff = report.affective;
  var comments = report.comments;
  var term = report.term || '';
  var session = report.session || '';

  var html = '';

  // Header
  html += '<div class="hdr">';
  html += logoB64 ? '<img class="logo" src="' + logoB64 + '">' : '<div class="logo-ph">AA</div>';
  html += '<div class="school-info">';
  html += '<div class="school-name">' + cfg.schoolName + '</div>';
  if (cfg.schoolMotto) html += '<div class="school-motto">"' + cfg.schoolMotto + '"</div>';
  html += '<div style="font-size:11px;color:#555;margin:2px 0;">Academic Report Card</div>';
  html += '<div class="rpt-title">' + term + ' Report - ' + session + '</div>';
  html += '</div>';
  
  var studentPhotoB64 = s.photoUrl ? imageToBase64(s.photoUrl) : '';
  if (studentPhotoB64) {
    html += '<img class="logo" src="' + studentPhotoB64 + '" style="margin-right:0; margin-left:15px; border-radius:4px; object-fit:cover;">';
  } else {
    html += '<div class="logo-ph" style="margin-right:0; margin-left:15px; background:#f5f5f5; color:#888; border:1px solid #ccc; font-size:10px; text-align:center; line-height:1.2;">Passport<br>Photo</div>';
  }
  html += '</div>';

  // Biodata
  html += '<div class="bio-box"><div class="bio-data">';
  html += '<div class="bio-row"><span class="bio-label">Student Name:</span><span>' + (s.fullName || '') + '</span></div>';
  html += '<div class="bio-row"><span class="bio-label">Admission No:</span><span>' + (s.admissionNumber || '') + '</span></div>';
  html += '<div class="bio-row"><span class="bio-label">Class:</span><span>' + (s.class || s.className || '') + '</span></div>';
  html += '<div class="bio-row"><span class="bio-label">Gender:</span><span>' + (s.gender || '') + '</span></div>';
  html += '<div class="bio-row"><span class="bio-label">Date of Birth:</span><span>' + formatDate(s.dateOfBirth || '') + '</span></div>';
  html += '<div class="bio-row"><span class="bio-label">Session:</span><span>' + session + '</span></div>';
  html += '</div></div>';

  // Summary
  html += '<div class="summary-grid">';
  html += '<div class="sum-box"><div class="sum-val">' + scores.length + '</div><div class="sum-lbl">Subjects</div></div>';
  html += '<div class="sum-box"><div class="sum-val">' + summary.average + (report.reportType === 'Half Term' ? '' : '%') + '</div><div class="sum-lbl">Average</div></div>';
  if (report.reportType !== 'Half Term') {
    html += '<div class="sum-box"><div class="sum-val">' + summary.overallGrade + '</div><div class="sum-lbl">Overall Grade</div></div>';
    html += '<div class="sum-box"><div class="sum-val">' + (summary.position ? ordinal(summary.position) : 'N/A') + '</div><div class="sum-lbl">Position /' + summary.totalStudents + '</div></div>';
  } else {
    html += '<div class="sum-box"><div class="sum-val">Half-Term</div><div class="sum-lbl">Status</div></div>';
  }
  html += '<div class="sum-box"><div class="sum-val">' + att.percentage + '%</div><div class="sum-lbl">Attendance</div></div>';
  html += '</div>';

  // Scores Table
  html += '<div class="sec-title">Academic Performance</div>';
  var isHalf = (report.reportType === 'Half Term');
  
  html += '<table><tr><th>S/N</th><th>Subject</th><th>CA1</th><th>CA2</th><th>CA3</th>';
  if (!isHalf) html += '<th>Exam</th>';
  if (term === 'Second Term' && !isHalf) {
    html += '<th>Term 1</th><th>Term 2 Total</th>';
  } else if (term === 'Third Term' && !isHalf) {
    html += '<th>Term 1</th><th>Term 2</th><th>Term 3 Total</th><th>Wgt. Avg</th>';
  } else {
    html += '<th>Total</th>';
  }
  if (!isHalf) html += '<th>Grade</th>';
  html += '<th>Remark</th></tr>';

  for (var i = 0; i < scores.length; i++) {
    var sc = scores[i];
    var g = sc.termGrade || 'F9';
    var gcls = (g === 'A1') ? 'grade-a' : (g === 'B2' || g === 'B3') ? 'grade-b' : (g.indexOf('C') === 0) ? 'grade-c' : 'grade-f';
    
    html += '<tr><td>' + (i + 1) + '</td>';
    html += '<td style="text-align:left;padding-left:6px;">' + (sc.subjectName || '') + '</td>';
    html += '<td>' + (sc.cA1 || sc.ca1 || 0) + '</td><td>' + (sc.cA2 || sc.ca2 || 0) + '</td><td>' + (sc.cA3 || sc.ca3 || 0) + '</td>';
    
    if (!isHalf) {
      html += '<td>' + (sc.exam || sc.Exam || 0) + '</td>';
      if (term === 'Second Term') {
        html += '<td>' + (sc.term1Total !== null ? sc.term1Total : '-') + '</td>';
        html += '<td><strong>' + (sc.termTotal || 0) + '</strong></td>';
      } else if (term === 'Third Term') {
        html += '<td>' + (sc.term1Total !== null ? sc.term1Total : '-') + '</td>';
        html += '<td>' + (sc.term2Total !== null ? sc.term2Total : '-') + '</td>';
        html += '<td>' + (sc.termTotal || 0) + '</td>';
        html += '<td><strong>' + (sc.weightedAvg || 0) + '</strong></td>';
      } else {
        html += '<td><strong>' + (sc.termTotal || 0) + '</strong></td>';
      }
      html += '<td class="' + gcls + '">' + g + '</td>';
      html += '<td style="font-size:10px;">' + getGradeRemark(g) + '</td></tr>';
    } else {
      html += '<td><strong>' + (sc.termTotal || 0) + '</strong></td>';
      html += '<td style="font-size:10px;">-</td></tr>';
    }
  }
  html += '</table>';

  // Attendance
  html += '<div class="sec-title">Attendance Summary</div>';
  html += '<div class="att-box">';
  html += '<div class="att-item"><div class="sum-val" style="color:#16a34a;">' + att.present + '</div><div class="sum-lbl">Days Present</div></div>';
  html += '<div class="att-item"><div class="sum-val" style="color:#dc2626;">' + att.absent + '</div><div class="sum-lbl">Days Absent</div></div>';
  html += '<div class="att-item"><div class="sum-val" style="color:#d97706;">' + att.late + '</div><div class="sum-lbl">Late Arrivals</div></div>';
  html += '<div class="att-item"><div class="sum-val">' + att.total + '</div><div class="sum-lbl">School Days</div></div>';
  html += '<div class="att-item"><div class="sum-val">' + att.percentage + '%</div><div class="sum-lbl">Attendance %</div></div>';
  html += '</div>';

  // Psychomotor
  if (psy && Object.keys(psy).length > 0) {
    html += '<div class="sec-title">Psychomotor Skills</div>';
    html += '<table><tr><th>Skill</th><th>Rating</th><th>Skill</th><th>Rating</th></tr>';
    html += '<tr><td>Handwriting</td><td>' + (psy.handwriting || '-') + '</td><td>Sport Skills</td><td>' + (psy.sportSkills || '-') + '</td></tr>';
    html += '<tr><td>Drawing</td><td>' + (psy.drawing || '-') + '</td><td>Creativity</td><td>' + (psy.creativity || '-') + '</td></tr>';
    html += '<tr><td>Speaking</td><td>' + (psy.speaking || '-') + '</td><td>Attentiveness</td><td>' + (psy.attentiveness || '-') + '</td></tr>';
    html += '</table>';
  }

  // Affective
  if (aff && Object.keys(aff).length > 0) {
    html += '<div class="sec-title">Affective Domain</div>';
    html += '<table><tr><th>Trait</th><th>Rating</th><th>Trait</th><th>Rating</th></tr>';
    html += '<tr><td>Punctuality</td><td>' + (aff.punctuality || '-') + '</td><td>Neatness</td><td>' + (aff.neatness || '-') + '</td></tr>';
    html += '<tr><td>Politeness</td><td>' + (aff.politeness || '-') + '</td><td>Honesty</td><td>' + (aff.honesty || '-') + '</td></tr>';
    html += '<tr><td>Leadership</td><td>' + (aff.leadership || '-') + '</td><td>Cooperation</td><td>' + (aff.cooperation || '-') + '</td></tr>';
    html += '</table>';
  }

  // Comments & Signatures - section-aware
  var studentSection = (s.section || '').toLowerCase();
  if (studentSection === 'highschool') studentSection = 'high';
  var isPrimary = (studentSection === 'primary');

  html += '<div class="sec-title">Remarks</div>';

  // -- Class Teacher's comment + signature --
  html += '<div class="comment-box"><strong>Class Teacher\'s Remark:</strong> ' + comments.classTeacher + '</div>';
  var ctSig = cfg.class_teacher_signature ? '<img src="' + cfg.class_teacher_signature + '" style="max-height:40px; margin-bottom: 2px;">' : '<div style="height:20px;"></div>';
  html += '<div style="text-align:right;margin:4px 0 14px;"><div style="display:inline-block;text-align:center;min-width:180px;">' + ctSig + '<div class="sig-line" style="margin-top:0;">Class Teacher</div></div></div>';

  if (isPrimary) {
    // -- Head Teacher's comment + signature (Primary only) --
    html += '<div class="comment-box"><strong>Head Teacher\'s Remark:</strong> ' + comments.headTeacher + '</div>';
    var htSig = cfg.head_teacher_signature ? '<img src="' + cfg.head_teacher_signature + '" style="max-height:40px; margin-bottom: 2px;">' : '<div style="height:20px;"></div>';
    html += '<div style="text-align:right;margin:4px 0 14px;"><div style="display:inline-block;text-align:center;min-width:180px;">' + htSig + '<div class="sig-line" style="margin-top:0;">' + cfg.headTeacherName + '<br><span style="font-size:9px;color:#555;">Head Teacher</span></div></div></div>';
  } else {
    // -- Principal's comment + signature (High School only) --
    html += '<div class="comment-box"><strong>Principal\'s Remark:</strong> ' + comments.principal + '</div>';
    var pSig = cfg.principal_signature ? '<img src="' + cfg.principal_signature + '" style="max-height:40px; margin-bottom: 2px;">' : '<div style="height:20px;"></div>';
    html += '<div style="text-align:right;margin:4px 0 14px;"><div style="display:inline-block;text-align:center;min-width:180px;">' + pSig + '<div class="sig-line" style="margin-top:0;">' + cfg.principalName + '<br><span style="font-size:9px;color:#555;">Principal</span></div></div></div>';
  }

  if (cfg.nextTermBegins) html += '<div class="comment-box"><strong>Next Term Begins:</strong> ' + formatDate(cfg.nextTermBegins) + '</div>';

  html += '<div class="footer">' + cfg.schoolName + ' &bull; ' + term + ' Academic Report &bull; ' + session + ' &bull; Generated: ' + formatDate(new Date()) + '</div>';

  return html;
}

function generateBulkClassResultPDF(className, term, session, reportType) {
  var students = getStudentsByClass(className);
  if (!students || students.length === 0) return { success: false, message: 'No students found in ' + className + '.' };

  var rawSettings = getSettings();
  var cfg = {
    schoolName: rawSettings.school_name || 'My School',
    schoolMotto: rawSettings.school_motto || '',
    principalName: rawSettings.principal_name || 'The Principal',
    headTeacherName: rawSettings.head_teacher_name || 'The Head Teacher',
    currentTerm: rawSettings.current_term || term,
    nextTermBegins: rawSettings.next_term_begins || ''
  };
  var logoB64 = imageToBase64(rawSettings.school_logo_url || '');

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8">';
  html += getReportCSS();
  html += '</head><body>';
  
  var successCount = 0;
  
  for (var i = 0; i < students.length; i++) {
    var sid = students[i].iD || students[i].id;
    var report = generateStudentReport(sid, term, session, reportType);
    
    if (report.success) {
      html += '<div class="wrap">';
      html += generateStudentReportHTML(report, cfg, logoB64);
      html += '</div>';
      if (i < students.length - 1) {
        html += '<div class="page-break"></div>';
      }
      successCount++;
    }
  }
  
  html += '</body></html>';
  
  if (successCount === 0) return { success: false, message: 'Could not generate reports for any student in this class.' };
  
  var prefix = reportType === 'Half Term' ? 'Half_Term_' : '';
  var blob = Utilities.newBlob(html, MimeType.HTML)
    .getAs(MimeType.PDF)
    .setName(className.replace(/\s+/g, '_') + '_' + prefix + term.replace(/\s+/g, '_') + '_Bulk_Result.pdf');

  var folder = getOrCreateFolder((cfg.schoolName || 'My School') + ' - Reports');
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    success: true,
    pdfUrl: file.getUrl(),
    downloadUrl: 'https://drive.google.com/uc?export=download&id=' + file.getId(),
    previewUrl: 'https://drive.google.com/file/d/' + file.getId() + '/preview',
    fileName: blob.getName()
  };
}

// --- PAYMENT RECEIPT PDF -------------------------------------

function generateReceiptPDF(paymentId) {
  var payments = getSheetData('Payments');
  var payment = payments.find(function(p) { return String(p.iD || p.id) === String(paymentId); });
  if (!payment) return { success: false, message: 'Payment not found.' };

  var student = getStudentById(payment.studentID || payment.studentId);
  var bill = student ? getStudentBill(student.iD || student.id, payment.term, payment.session) : null;
  var settings = getSettings();
  var schoolName = settings.school_name || 'My School';

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<style>body{font-family:Arial,sans-serif;padding:30px;} .wrap{max-width:500px;margin:0 auto;border:2px solid #0d1b2a;padding:20px;}' +
    '.hdr{background:#0d1b2a;color:#f0a500;text-align:center;padding:15px;margin:-20px -20px 20px;} h2{margin:0;}' +
    'table{width:100%;border-collapse:collapse;} td{padding:8px;border-bottom:1px solid #eee;}' +
    '.label{color:#666;width:50%;} .val{font-weight:bold;} .total{background:#f0f0f0;font-size:16px;}' +
    '.footer{text-align:center;margin-top:20px;font-size:10px;color:#999;}</style></head><body>' +
    '<div class="wrap"><div class="hdr"><h2>' + schoolName + '</h2><p style="margin:3px 0;font-size:12px;">Official Payment Receipt</p></div>' +
    '<table>' +
    '<tr><td class="label">Receipt Ref</td><td class="val">' + (payment.receiptRef || paymentId) + '</td></tr>' +
    '<tr><td class="label">Student</td><td class="val">' + (student ? student.fullName : '') + '</td></tr>' +
    '<tr><td class="label">Class</td><td class="val">' + (student ? (student.class || '') : '') + '</td></tr>' +
    '<tr><td class="label">Term / Session</td><td class="val">' + payment.term + ' / ' + payment.session + '</td></tr>' +
    '<tr><td class="label">Payment Method</td><td class="val">' + (payment.method || 'Cash') + '</td></tr>' +
    '<tr><td class="label">Payment Date</td><td class="val">' + formatDate(payment.paymentDate || payment.date) + '</td></tr>' +
    '<tr class="total"><td class="label"><strong>Amount Paid</strong></td><td class="val" style="color:#16a34a;">' + formatNaira(payment.amount) + '</td></tr>' +
    (bill ? '<tr><td class="label">Outstanding Balance</td><td class="val" style="color:' + (safeFloat(bill.balance,0) > 0 ? '#dc2626' : '#16a34a') + ';">' + formatNaira(bill.balance) + '</td></tr>' : '') +
    '</table>' +
    '<p style="text-align:center;margin-top:20px;font-size:11px;">______________________________<br>Authorised Signature</p>' +
    '<div class="footer">' + schoolName + ' &bull; ' + formatDate(new Date()) + '<br>This receipt is computer-generated and valid without signature.</div>' +
    '</div></body></html>';

  var blob = Utilities.newBlob(html, MimeType.HTML).getAs(MimeType.PDF)
    .setName('Receipt_' + (payment.receiptRef || paymentId) + '.pdf');
  var folder = getOrCreateFolder(schoolName + ' - Receipts');
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    success: true,
    pdfUrl: file.getUrl(),
    downloadUrl: 'https://drive.google.com/uc?export=download&id=' + file.getId(),
    previewUrl: 'https://drive.google.com/file/d/' + file.getId() + '/preview'
  };
}

// --- LESSON PLAN PDF -----------------------------------------

function generateLessonPlanPDF(planId) {
  var plans = getSheetData('LessonPlans');
  var plan = plans.find(function(p) { return String(p.iD || p.id) === String(planId); });
  if (!plan) return { success: false, message: 'Lesson plan not found.' };

  var subjects = getAllSubjects();
  var sid = plan.subjectID || plan.subjectId;
  var subj = subjects.find(function(s) { return String(s.iD || s.id) === String(sid); });
  var settings = getSettings();
  var schoolName = settings.school_name || 'My School';

  var logoB64 = imageToBase64(settings.school_logo_url || '');
  var logoTag = logoB64
    ? '<img src="' + logoB64 + '" style="width:65px;height:65px;object-fit:contain;">'
    : '<div style="width:65px;height:65px;background:#0d1b2a;display:flex;align-items:center;justify-content:center;color:#f0a500;font-weight:bold;font-size:14px;">AA</div>';

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<style>' +
    'body{font-family:Arial,sans-serif;padding:30px;font-size:13px;color:#1a1a1a;}' +
    '.hdr{display:flex;align-items:center;border-bottom:3px solid #0d1b2a;padding-bottom:12px;margin-bottom:18px;}' +
    '.hdr-logo{width:65px;flex-shrink:0;}' +
    '.hdr-title{flex:1;text-align:center;}' +
    '.hdr-spacer{width:65px;flex-shrink:0;}' +
    '.school-name{font-size:18px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#0d1b2a;margin:0;}' +
    '.plan-label{font-size:13px;color:#555;margin:3px 0 0;font-style:italic;}' +
    '.section{margin-bottom:15px;}' +
    '.sec-title{font-weight:bold;color:#0d1b2a;border-bottom:1px solid #ccc;padding-bottom:4px;margin-bottom:6px;}' +
    '.info-grid{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:15px;}' +
    '.info-item{border:1px solid #ddd;padding:6px 10px;border-radius:4px;min-width:150px;}' +
    '.info-label{font-size:10px;color:#888;} .info-val{font-weight:bold;}' +
    '</style></head><body>' +
    '<div class="hdr">' +
      '<div class="hdr-logo">' + logoTag + '</div>' +
      '<div class="hdr-title">' +
        '<p class="school-name">' + schoolName + '</p>' +
        '<p class="plan-label">Lesson Plan</p>' +
      '</div>' +
      '<div class="hdr-spacer"></div>' +
    '</div>' +
    '<div class="info-grid">' +
    '<div class="info-item"><div class="info-label">Subject</div><div class="info-val">' + (subj ? subj.subjectName : '') + '</div></div>' +
    '<div class="info-item"><div class="info-label">Class</div><div class="info-val">' + (plan.class || plan.className || '') + '</div></div>' +
    '<div class="info-item"><div class="info-label">Week</div><div class="info-val">' + (plan.week || '') + '</div></div>' +
    '<div class="info-item"><div class="info-label">Term</div><div class="info-val">' + (plan.term || '') + '</div></div>' +
    '<div class="info-item"><div class="info-label">Session</div><div class="info-val">' + (plan.session || '') + '</div></div>' +
    '<div class="info-item"><div class="info-label">Status</div><div class="info-val">' + (plan.status || '') + '</div></div>' +
    '</div>';

  var sections = [
    ['Topic', plan.topic],
    ['Reference Book(s)', plan.referenceBook],
    ['Behavioural Objectives', plan.objectives],
    ['Entry Behaviour / Prior Knowledge', plan.entryBehaviour],
    ['Teaching Aids / Instructional Materials', plan.teachingAids],
    ['Step-by-Step Presentation', plan.presentationSteps],
    ['Evaluation', plan.evaluation],
    ['Assignment / Homework', plan.assignment]
  ];
  sections.forEach(function(sec) {
    if (sec[1]) {
      html += '<div class="section"><div class="sec-title">' + sec[0] + '</div>';
      html += '<p style="margin:0;white-space:pre-wrap;">' + sec[1] + '</p></div>';
    }
  });

  if (plan.approvalNote) html += '<div class="section"><div class="sec-title">Approval Note</div><p>' + plan.approvalNote + '</p></div>';
  html += '<p style="text-align:center;margin-top:30px;font-size:10px;color:#999;">' + schoolName + ' &bull; ' + formatDate(new Date()) + '</p></body></html>';

  var blob = Utilities.newBlob(html, MimeType.HTML).getAs(MimeType.PDF)
    .setName('LessonPlan_' + planId + '.pdf');
  var folder = getOrCreateFolder(schoolName + ' - Lesson Plans');
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return {
    success: true,
    pdfUrl: file.getUrl(),
    downloadUrl: 'https://drive.google.com/uc?export=download&id=' + file.getId(),
    previewUrl: 'https://drive.google.com/file/d/' + file.getId() + '/preview'
  };
}

// --- STUDENT ID CARD PDF -------------------------------------

function generateStudentIDCardPDF(studentId) {
  var student = getStudentById(studentId);
  if (!student) return { success: false, message: 'Student not found.' };

  var settings  = getSettings();
  var schoolName    = settings.school_name    || 'My School';
  var schoolMotto   = settings.school_motto   || '';
  var schoolAddress = settings.school_address || '';
  var schoolPhone   = settings.school_phone   || '';
  var schoolEmail   = settings.school_email   || '';
  var session       = settings.current_session || '';

  var logoB64  = imageToBase64(settings.school_logo_url || '');
  var photoB64 = student.photoUrl ? imageToBase64(student.photoUrl) : '';

  var logoTag = logoB64
    ? '<img src="' + logoB64 + '" style="width:45px;height:45px;object-fit:contain;display:block;">'
    : '<div style="width:45px;height:45px;background:#f0a500;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:14px;">AA</div>';

  var photoTag = photoB64
    ? '<img src="' + photoB64 + '" style="width:80px;height:96px;object-fit:cover;border-radius:6px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);">'
    : '<div style="width:80px;height:96px;background:#e8edf2;border-radius:6px;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:32px;color:#aab;">&#128100;</div>';

  var watermarkTag = logoB64
    ? '<img src="' + logoB64 + '" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:140px;height:140px;object-fit:contain;opacity:0.08;pointer-events:none;">'
    : '';

  var name     = student.fullName        || '';
  var admNo    = student.admissionNumber || 'N/A';
  var cls      = student.className || student.class || '';
  var gender   = student.gender          || '';
  var dob      = student.dateOfBirth ? formatDate(student.dateOfBirth) : '';
  var section  = (student.section === 'primary') ? 'Primary' : 'High School';

  // Card dimensions: CR80 landscape ≈ 85.6mm × 53.98mm → scale to ≈ 323px × 204px at 96dpi
  var html = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<style>' +
    'body{margin:0;padding:20px;background:#d9dde4;font-family:Arial,sans-serif;}' +
    '.card{width:323px;border-radius:12px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,0.35);margin:0 auto 30px;background:#fff;page-break-inside:avoid;}' +

    /* ---- FRONT: Header ---- */
    '.card-front .header{position:relative;background:linear-gradient(135deg,#0a1628 0%,#112240 50%,#1a3a6e 100%);padding:11px 12px 14px;overflow:hidden;min-height:62px;}' +
    /* decorative circles */
    '.card-front .hdr-circle-1{position:absolute;top:-18px;right:-18px;width:70px;height:70px;border-radius:50%;background:rgba(240,165,0,0.18);pointer-events:none;}' +
    '.card-front .hdr-circle-2{position:absolute;top:-8px;right:18px;width:38px;height:38px;border-radius:50%;background:rgba(240,165,0,0.1);pointer-events:none;}' +
    '.card-front .hdr-circle-3{position:absolute;bottom:-20px;left:40px;width:55px;height:55px;border-radius:50%;background:rgba(255,255,255,0.04);pointer-events:none;}' +
    /* diagonal slash accent */
    '.card-front .hdr-slash{position:absolute;top:0;right:55px;width:3px;height:100%;background:linear-gradient(to bottom,transparent,rgba(240,165,0,0.6),transparent);transform:skewX(-15deg);pointer-events:none;}' +
    '.card-front .hdr-inner{display:flex;align-items:center;gap:10px;position:relative;z-index:1;}' +
    '.card-front .hdr-logo-wrap{flex-shrink:0;width:46px;height:46px;background:rgba(255,255,255,0.1);border-radius:8px;border:1px solid rgba(240,165,0,0.35);display:flex;align-items:center;justify-content:center;}' +
    '.card-front .hdr-text{flex:1;text-align:center;}' +
    '.card-front .school-name{color:#f0a500;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;line-height:1.25;margin:0;}' +
    '.card-front .school-motto{color:rgba(255,255,255,0.6);font-size:6.5px;font-style:italic;margin:2px 0 0;}' +
    '.card-front .card-type-wrap{margin-top:4px;display:inline-block;background:rgba(240,165,0,0.2);border:1px solid rgba(240,165,0,0.5);border-radius:20px;padding:1px 7px;}' +
    '.card-front .card-label{color:#f0a500;font-size:6px;letter-spacing:1.5px;text-transform:uppercase;}' +
    /* gold rule below header */
    '.card-front .gold-rule{height:3px;background:linear-gradient(90deg,#c07d00,#f0a500,#c07d00);}' +

    /* ---- FRONT: Body ---- */
    '.card-front .body{display:flex;align-items:stretch;min-height:110px;position:relative;background:#fff;}' +
    /* dot-grid overlay */
    '.card-front .body-bg{position:absolute;inset:0;background-image:radial-gradient(circle,#c8d0dc 1px,transparent 1px);background-size:10px 10px;opacity:0.35;pointer-events:none;}' +
    /* left gold accent stripe */
    '.card-front .photo-stripe{flex-shrink:0;width:96px;background:linear-gradient(180deg,#0d1b2a 0%,#1a3558 100%);display:flex;align-items:center;justify-content:center;padding:10px 8px;position:relative;}' +
    '.card-front .photo-stripe::after{content:"";position:absolute;right:0;top:0;bottom:0;width:4px;background:linear-gradient(180deg,#f0a500,#c07d00);}' +
    /* photo frame */
    '.card-front .photo-frame{width:72px;height:88px;border-radius:8px;border:3px solid #f0a500;box-shadow:0 0 0 2px rgba(255,255,255,0.3),0 3px 10px rgba(0,0,0,0.4);overflow:hidden;background:#e8edf2;position:relative;z-index:1;}' +
    '.card-front .photo-frame img{width:100%;height:100%;object-fit:cover;display:block;}' +
    '.card-front .photo-placeholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:30px;color:#aab;background:#e8edf2;}' +
    /* info column */
    '.card-front .info-col{flex:1;padding:10px 10px 8px;position:relative;z-index:1;}' +
    '.card-front .student-name{font-size:10.5px;font-weight:700;color:#0d1b2a;text-transform:uppercase;letter-spacing:.4px;margin:0 0 2px;line-height:1.3;border-bottom:1.5px solid #f0a500;padding-bottom:4px;}' +
    '.card-front .section-badge{display:inline-block;background:#0d1b2a;color:#f0a500;font-size:5.5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;padding:2px 6px;border-radius:10px;margin:3px 0 5px;}' +
    '.card-front .info-row{display:flex;gap:4px;margin-bottom:2.5px;font-size:8px;line-height:1.35;align-items:baseline;}' +
    '.card-front .info-dot{width:4px;height:4px;border-radius:50%;background:#f0a500;flex-shrink:0;margin-top:3px;}' +
    '.card-front .info-label{color:#7a8899;flex-shrink:0;width:52px;font-size:7.5px;}' +
    '.card-front .info-val{color:#0d1b2a;font-weight:700;font-size:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +

    /* ---- FRONT: Footer ---- */
    '.card-front .footer{background:linear-gradient(90deg,#0a1628,#1a3558,#0a1628);padding:5px 12px;display:flex;align-items:center;justify-content:space-between;position:relative;overflow:hidden;}' +
    '.card-front .footer-watermark{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:7px;font-weight:700;color:rgba(255,255,255,0.05);text-transform:uppercase;letter-spacing:3px;white-space:nowrap;pointer-events:none;}' +
    '.card-front .footer-left{display:flex;align-items:center;gap:5px;}' +
    '.card-front .footer-dot{width:6px;height:6px;border-radius:50%;background:#f0a500;}' +
    '.card-front .footer-text{color:#f0a500;font-size:7.5px;font-weight:700;letter-spacing:.4px;}' +
    '.card-front .footer-session{color:rgba(255,255,255,0.4);font-size:6.5px;font-style:italic;}' +

    /* ---- BACK ---- */
    '.card-back{position:relative;background:linear-gradient(160deg,#f8f9fb 0%,#eef0f4 100%);}' +
    '.card-back .back-header{background:linear-gradient(135deg,#0d1b2a,#1a3558);padding:8px 12px;text-align:center;}' +
    '.card-back .back-title{color:#f0a500;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0;}' +
    '.card-back .back-body{padding:10px 14px;position:relative;}' +
    '.card-back .terms-title{font-size:8px;font-weight:700;color:#0d1b2a;text-transform:uppercase;letter-spacing:.5px;margin:0 0 5px;}' +
    '.card-back .term-item{font-size:7.5px;color:#444;margin-bottom:3px;line-height:1.4;padding-left:10px;position:relative;}' +
    '.card-back .term-item::before{content:"•";position:absolute;left:0;color:#f0a500;font-weight:700;}' +
    '.card-back .contact-box{border:1px solid #dde2ea;border-radius:5px;padding:6px 8px;margin:8px 0;background:rgba(255,255,255,0.7);}' +
    '.card-back .contact-title{font-size:7px;font-weight:700;color:#0d1b2a;text-transform:uppercase;letter-spacing:.5px;margin:0 0 4px;}' +
    '.card-back .contact-row{font-size:7.5px;color:#444;margin-bottom:2px;}' +
    '.card-back .contact-row span{font-weight:600;color:#0d1b2a;}' +
    '.card-back .adm-strip{background:#0d1b2a;color:#f0a500;font-family:monospace;font-size:9px;font-weight:700;letter-spacing:3px;text-align:center;padding:5px;margin-top:6px;border-radius:0 0 10px 10px;}' +
    '.page-break{page-break-after:always;}' +
    '</style></head><body>';

  // === FRONT OF CARD ===
  html += '<div class="card card-front">';

  // --- Header ---
  html += '<div class="header">';
  html += '<div class="hdr-circle-1"></div>';
  html += '<div class="hdr-circle-2"></div>';
  html += '<div class="hdr-circle-3"></div>';
  html += '<div class="hdr-slash"></div>';
  html += '<div class="hdr-inner">';
  html += '<div class="hdr-logo-wrap">' + logoTag + '</div>';
  html += '<div class="hdr-text">';
  html += '<p class="school-name">' + schoolName + '</p>';
  if (schoolMotto) html += '<p class="school-motto">' + schoolMotto + '</p>';
  html += '<div class="card-type-wrap"><span class="card-label">Student Identity Card</span></div>';
  html += '</div>';
  html += '<div style="width:46px;"></div>'; // balance spacer
  html += '</div>'; // hdr-inner
  html += '</div>'; // header

  // gold rule
  html += '<div class="gold-rule"></div>';

  // --- Body ---
  html += '<div class="body">';
  html += '<div class="body-bg"></div>';

  // Left photo stripe
  html += '<div class="photo-stripe">';
  html += '<div class="photo-frame">';
  if (photoB64) {
    html += '<img src="' + photoB64 + '">';
  } else {
    html += '<div class="photo-placeholder">&#128100;</div>';
  }
  html += '</div>';
  html += '</div>'; // photo-stripe

  // Info column
  html += '<div class="info-col">';
  html += '<p class="student-name">' + name + '</p>';
  html += '<div class="section-badge">' + section + '</div>';
  html += '<div class="info-row"><span class="info-dot"></span><span class="info-label">Adm. No:</span><span class="info-val">' + admNo + '</span></div>';
  html += '<div class="info-row"><span class="info-dot"></span><span class="info-label">Class:</span><span class="info-val">' + cls + '</span></div>';
  if (gender) html += '<div class="info-row"><span class="info-dot"></span><span class="info-label">Gender:</span><span class="info-val">' + gender + '</span></div>';
  if (dob)    html += '<div class="info-row"><span class="info-dot"></span><span class="info-label">Date of Birth:</span><span class="info-val">' + dob + '</span></div>';
  html += '</div>'; // info-col

  html += '</div>'; // body

  // --- Footer ---
  html += '<div class="footer">';
  html += '<span class="footer-watermark">' + schoolName + '</span>';
  html += '<div class="footer-left"><div class="footer-dot"></div><span class="footer-text">Valid: ' + session + '</span></div>';
  html += '<span class="footer-session">Academic Session</span>';
  html += '</div>';

  html += '</div>'; // end card-front

  // Page break between front and back
  html += '<div class="page-break"></div>';

  // === BACK OF CARD ===
  html += '<div class="card card-back">';
  html += '<div class="back-header"><p class="back-title">' + schoolName + '</p></div>';
  html += '<div class="back-body">';
  html += watermarkTag;
  html += '<p class="terms-title">Terms &amp; Conditions</p>';
  html += '<div class="term-item">This card must be worn at all times within the school premises.</div>';
  html += '<div class="term-item">This card is non-transferable and must not be defaced.</div>';
  html += '<div class="term-item">Loss of card must be reported to the school office immediately.</div>';
  html += '<div class="term-item">If found, please return to the school office.</div>';

  if (schoolAddress || schoolPhone || schoolEmail) {
    html += '<div class="contact-box">';
    html += '<p class="contact-title">School Contact</p>';
    if (schoolAddress) html += '<div class="contact-row"><span>&#128205; </span>' + schoolAddress + '</div>';
    if (schoolPhone)   html += '<div class="contact-row"><span>&#128222; </span>' + schoolPhone + '</div>';
    if (schoolEmail)   html += '<div class="contact-row"><span>&#9993; </span>' + schoolEmail + '</div>';
    html += '</div>';
  }

  html += '</div>'; // end back-body
  html += '<div class="adm-strip">&#9646;&#9646;&#9646; ' + admNo + ' &#9646;&#9646;&#9646;</div>';
  html += '</div>'; // end card-back

  html += '</body></html>';

  var blob = Utilities.newBlob(html, MimeType.HTML).getAs(MimeType.PDF)
    .setName('IDCard_' + name.replace(/\s+/g, '_') + '_' + admNo + '.pdf');
  var folder = getOrCreateFolder(schoolName + ' - ID Cards');
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return {
    success: true,
    pdfUrl: file.getUrl(),
    downloadUrl: 'https://drive.google.com/uc?export=download&id=' + file.getId(),
    previewUrl: 'https://drive.google.com/file/d/' + file.getId() + '/preview'
  };
}
