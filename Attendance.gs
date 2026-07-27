/**
 * MYSCHOOL PORTAL - Attendance.gs
 * Daily attendance tracking via Firestore.
 */

function markAttendance(className, date, records, markedByUserId, term, session) {
  var isoDate = date || todayISO();
  // Delete existing records for this class+date
  var existing = firebaseQuery('attendance', [
    { field: 'className', op: 'EQUAL', value: String(className) },
    { field: 'date',      op: 'EQUAL', value: String(isoDate) }
  ]);
  var deletes = existing.map(function(r) { return { type: 'delete', collection: 'attendance', docId: r.id }; });
  if (deletes.length > 0) firebaseBatchWrite(deletes);

  var writes = [], added = 0;
  for (var j = 0; j < records.length; j++) {
    var r = records[j];
    if (!r.studentId) continue;
    var id = generateId();
    writes.push({ type: 'set', collection: 'attendance', docId: id, data: {
      id: id, studentId: r.studentId, className: className, date: isoDate,
      status: r.status || 'Present', markedBy: markedByUserId || '',
      session: session || '', term: term || ''
    }});
    added++;
    if (r.status === 'Absent') checkConsecutiveAbsences(r.studentId, isoDate, term, session);
  }
  if (writes.length > 0) firebaseBatchWrite(writes);
  logAudit(markedByUserId, 'MARK_ATTENDANCE', className + ' on ' + isoDate + ': ' + added + ' records');
  return { success: true, message: 'Attendance marked for ' + added + ' students.' };
}

function getClassAttendance(className, term, session) {
  var filters = [{ field: 'className', op: 'EQUAL', value: String(className) }];
  var rows = firebaseQuery('attendance', filters);
  return rows.filter(function(r) {
    if (term    && String(r.term)    !== String(term))    return false;
    if (session && String(r.session) !== String(session)) return false;
    return true;
  });
}

function getStudentAttendanceSummary(studentId, term, session) {
  var filters = [{ field: 'studentId', op: 'EQUAL', value: String(studentId) }];
  var records = firebaseQuery('attendance', filters).filter(function(r) {
    if (term    && String(r.term)    !== String(term))    return false;
    if (session && String(r.session) !== String(session)) return false;
    return true;
  });
  var present = 0, absent = 0, late = 0;
  records.forEach(function(r) {
    var s = String(r.status || '').toLowerCase();
    if (s === 'present') present++;
    else if (s === 'absent') absent++;
    else if (s === 'late') late++;
  });
  var total = present + absent + late;
  return { present: present, absent: absent, late: late, total: total,
    percentage: total > 0 ? Math.round((present / total) * 100) : 0 };
}

function getLateComingReport(className, term, session) {
  var records = getClassAttendance(className, term, session).filter(function(r) {
    return String(r.status || '').toLowerCase() === 'late';
  });
  var byStudent = {};
  records.forEach(function(r) {
    var sid = r.studentId;
    if (!byStudent[sid]) byStudent[sid] = { studentId: sid, count: 0, dates: [] };
    byStudent[sid].count++;
    byStudent[sid].dates.push(r.date);
  });
  return Object.values(byStudent).sort(function(a, b) { return b.count - a.count; });
}

function getAttendanceByDate(className, date) {
  return firebaseQuery('attendance', [
    { field: 'className', op: 'EQUAL', value: String(className) },
    { field: 'date',      op: 'EQUAL', value: String(date) }
  ]);
}

function checkConsecutiveAbsences(studentId, latestDate, term, session) {
  try {
    var records = firebaseQuery('attendance', [
      { field: 'studentId', op: 'EQUAL', value: String(studentId) },
      { field: 'term',      op: 'EQUAL', value: String(term) },
      { field: 'session',   op: 'EQUAL', value: String(session) }
    ]).sort(function(a, b) { return new Date(b.date) - new Date(a.date); });

    var consecutive = 0;
    for (var i = 0; i < records.length; i++) {
      if (String(records[i].status || '').toLowerCase() === 'absent') consecutive++;
      else break;
    }
    if (consecutive >= 3) {
      var student = getStudentById(studentId);
      if (student && student.parentId) sendAbsenceAlert(studentId, latestDate, consecutive);
    }
  } catch(e) { Logger.log('checkConsecutiveAbsences error: ' + e.message); }
}

function getClassAttendanceSummary(className, term, session) {
  var students = getStudentsByClass(className);
  return students.map(function(s) {
    var sid = s.id;
    return { studentId: sid, studentName: s.fullName, admissionNumber: s.admissionNumber || '',
      summary: getStudentAttendanceSummary(sid, term, session) };
  });
}
