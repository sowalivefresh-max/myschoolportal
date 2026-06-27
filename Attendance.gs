/**
 * ABECEDARIAN ACADEMY — Attendance.gs
 * Daily attendance tracking, statistics, and alerts.
 */

/**
 * Mark attendance for a list of students in a class.
 * @param {Array} records - [{studentId, status: 'Present'|'Absent'|'Late'}]
 */
function markAttendance(className, date, records, markedByUserId, term, session) {
  var sheet = getSpreadsheet().getSheetByName('Attendance');
  var isoDate = date || todayISO();
  var added = 0; var updated = 0;

  // Remove existing records for this class+date to allow re-marking
  var existing = sheet.getDataRange().getValues();
  for (var i = existing.length - 1; i >= 1; i--) {
    if (String(existing[i][2]) === String(className) && String(existing[i][3]) === String(isoDate)) {
      sheet.deleteRow(i + 1);
    }
  }

  for (var j = 0; j < records.length; j++) {
    var r = records[j];
    if (!r.studentId) continue;
    var id = generateId();
    sheet.appendRow([id, r.studentId, className, isoDate,
      r.status || 'Present', markedByUserId || '', session || '', term || '']);
    added++;

    // Trigger parent notification on 3+ consecutive absences
    if (r.status === 'Absent') {
      checkConsecutiveAbsences(r.studentId, isoDate, term, session);
    }
  }

  SpreadsheetApp.flush();
  logAudit(markedByUserId, 'MARK_ATTENDANCE', className + ' on ' + isoDate + ': ' + added + ' records');
  return { success: true, message: 'Attendance marked for ' + added + ' students.' };
}

/**
 * Get all attendance records for a class in a term/session.
 */
function getClassAttendance(className, term, session) {
  return getSheetData('Attendance').filter(function(r) {
    var match = String(r.class || r.className || '').toLowerCase() === String(className).toLowerCase();
    if (term) match = match && String(r.term) === String(term);
    if (session) match = match && String(r.session) === String(session);
    return match;
  });
}

/**
 * Get attendance summary for a single student in a term.
 * Returns counts and percentages.
 */
function getStudentAttendanceSummary(studentId, term, session) {
  var records = getSheetData('Attendance').filter(function(r) {
    var match = String(r.studentID || r.studentId) === String(studentId);
    if (term) match = match && String(r.term) === String(term);
    if (session) match = match && String(r.session) === String(session);
    return match;
  });

  var present = 0, absent = 0, late = 0;
  records.forEach(function(r) {
    var s = String(r.status || '').toLowerCase();
    if (s === 'present') present++;
    else if (s === 'absent') absent++;
    else if (s === 'late') late++;
  });

  var total = present + absent + late;
  var pct = total > 0 ? Math.round((present / total) * 100) : 0;

  return { present: present, absent: absent, late: late, total: total, percentage: pct };
}

/**
 * Get late-coming report for a class.
 */
function getLateComingReport(className, term, session) {
  var records = getClassAttendance(className, term, session).filter(function(r) {
    return String(r.status || '').toLowerCase() === 'late';
  });

  var byStudent = {};
  records.forEach(function(r) {
    var sid = r.studentID || r.studentId;
    if (!byStudent[sid]) byStudent[sid] = { studentId: sid, count: 0, dates: [] };
    byStudent[sid].count++;
    byStudent[sid].dates.push(r.date);
  });

  return Object.values(byStudent).sort(function(a, b) { return b.count - a.count; });
}

/**
 * Get attendance for a specific date in a class (roll call view).
 */
function getAttendanceByDate(className, date) {
  return getSheetData('Attendance').filter(function(r) {
    return String(r.class || r.className || '') === String(className) &&
           String(r.date) === String(date);
  });
}

/**
 * Check if a student has 3+ consecutive absences and notify parent.
 */
function checkConsecutiveAbsences(studentId, latestDate, term, session) {
  try {
    var records = getSheetData('Attendance').filter(function(r) {
      return String(r.studentID || r.studentId) === String(studentId) &&
             String(r.term) === String(term) && String(r.session) === String(session);
    }).sort(function(a, b) { return new Date(b.date) - new Date(a.date); });

    var consecutive = 0;
    for (var i = 0; i < records.length; i++) {
      if (String(records[i].status || '').toLowerCase() === 'absent') consecutive++;
      else break;
    }

    if (consecutive >= 3) {
      var student = getStudentById(studentId);
      if (student && student.parentId) {
        sendAbsenceAlert(studentId, latestDate, consecutive);
      }
    }
  } catch (e) {
    Logger.log('checkConsecutiveAbsences error: ' + e);
  }
}

/**
 * Get class-level attendance summary for a term (for compliance/dashboard).
 */
function getClassAttendanceSummary(className, term, session) {
  var students = getStudentsByClass(className);
  return students.map(function(s) {
    var sid = s.iD || s.id;
    var summary = getStudentAttendanceSummary(sid, term, session);
    return { studentId: sid, studentName: s.fullName, admissionNumber: s.admissionNumber || '', summary: summary };
  });
}
