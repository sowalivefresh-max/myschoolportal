/**
 * ABECEDARIAN ACADEMY — Database.gs
 * Core CRUD operations for all entities.
 */

// ─── USERS ──────────────────────────────────────────────────

function getAllUsers() {
  var users = getSheetData('Users');
  users.forEach(function(u) { delete u.passwordHash; });
  return users;
}

function getUserById(userId) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Users');
  if (!sheet) return null;
  var row = findRowById(sheet, userId);
  if (row === -1) return null;
  var v = sheet.getRange(row, 1, 1, 13).getValues()[0];
  return {
    id: v[0], fullName: v[1], email: v[2], role: v[4],
    section: v[5], linkedStudentIds: v[6], classAssigned: v[7],
    status: v[8], profilePicture: v[9], phone: v[10],
    signature: v[12]
  };
}

function createUser(data) {
  // ── Input validation ────────────────────────────────────────
  var v = validateInput(data, [
    { field: 'fullName', required: true,  maxLength: 100 },
    { field: 'email',    required: true,  type: 'email' },
    { field: 'role',     required: true,  maxLength: 30  },
    { field: 'password', required: true,  maxLength: 128 },
    { field: 'phone',    required: false, maxLength: 20  },
    { field: 'section',  required: false, maxLength: 20  }
  ]);
  if (!v.valid) return { success: false, message: v.message };
  // ────────────────────────────────────────────────────────────
  if (!isValidEmail(data.email))
    return { success: false, message: 'Invalid email.' };
  var existing = getSheetData('Users');
  for (var i = 0; i < existing.length; i++) {
    if (String(existing[i].email).toLowerCase() === data.email.trim().toLowerCase())
      return { success: false, message: 'Email already exists.' };
  }
  var sheet = getSpreadsheet().getSheetByName('Users');
  var id = generateId();
  var salt = generateSalt();
  sheet.appendRow([
    id, data.fullName.trim(), data.email.trim().toLowerCase(),
    hashPassword(data.password, salt), data.role.toLowerCase(),
    data.section || 'both', data.linkedStudentIds || '',
    data.classAssigned || '', 'active', '', data.phone || '',
    new Date().toISOString(), data.signature || '', salt
  ]);
  logAudit('system', 'CREATE_USER', 'Created user: ' + data.email);
  return { success: true, id: id, message: 'User created.' };
}

function updateUser(userId, data) {
  // ── Input validation (only fields that are being updated) ───
  var v = validateInput(data, [
    { field: 'fullName', required: false, maxLength: 100 },
    { field: 'email',    required: false, type: 'email' },
    { field: 'password', required: false, maxLength: 128 },
    { field: 'phone',    required: false, maxLength: 20  }
  ]);
  if (!v.valid) return { success: false, message: v.message };
  // ────────────────────────────────────────────────────────────
  var sheet = getSpreadsheet().getSheetByName('Users');
  var row = findRowById(sheet, userId);
  if (row === -1) return { success: false, message: 'User not found.' };
  if (sheet.getMaxColumns() < 12) sheet.insertColumnsAfter(sheet.getMaxColumns(), 12 - sheet.getMaxColumns());
  if (data.fullName) sheet.getRange(row, 2).setValue(data.fullName.trim());
  if (data.email) sheet.getRange(row, 3).setValue(data.email.trim().toLowerCase());
  if (data.password) {
    var newSalt = generateSalt();
    // Ensure the Users sheet has a column 14 (PasswordSalt)
    if (sheet.getMaxColumns() < 14) sheet.insertColumnsAfter(sheet.getMaxColumns(), 14 - sheet.getMaxColumns());
    sheet.getRange(row, 4).setValue(hashPassword(data.password, newSalt));
    sheet.getRange(row, 14).setValue(newSalt);
  }
  if (data.role) sheet.getRange(row, 5).setValue(data.role.toLowerCase());
  if (data.section !== undefined) sheet.getRange(row, 6).setValue(data.section);
  if (data.linkedStudentIds !== undefined) sheet.getRange(row, 7).setValue(data.linkedStudentIds);
  if (data.classAssigned !== undefined) sheet.getRange(row, 8).setValue(data.classAssigned);
  if (data.status) sheet.getRange(row, 9).setValue(data.status);
  if (data.profilePicture !== undefined) { var c = sheet.getRange(row, 10); c.clearDataValidations(); c.setValue(data.profilePicture); SpreadsheetApp.flush(); }
  if (data.phone !== undefined) sheet.getRange(row, 11).setValue(data.phone);
  if (data.signature !== undefined) sheet.getRange(row, 13).setValue(data.signature);
  return { success: true, message: 'User updated.' };
}

function deleteUser(userId) {
  var sheet = getSpreadsheet().getSheetByName('Users');
  var row = findRowById(sheet, userId);
  if (row === -1) return { success: false, message: 'User not found.' };
  sheet.deleteRow(row);
  logAudit('system', 'DELETE_USER', 'Deleted user ID: ' + userId);
  return { success: true, message: 'User deleted.' };
}

// ─── STUDENTS ───────────────────────────────────────────────

function getAllStudents() {
  var students = getSheetData('Students').map(function(s) {
    if (s) s.photoUrl = s.photoURL || s.photoUrl || '';
    return s;
  });
  var type = (getSettings().institution_type || 'both').toLowerCase().trim();
  if (type === 'both') return students;
  // Normalize all known section spellings to canonical 'high' or 'primary'
  function normSec(sec) {
    var v = String(sec || '').toLowerCase().trim();
    if (v === 'high' || v === 'highschool' || v === 'high school' || v === 'secondary') return 'high';
    if (v === 'primary' || v === 'primaryschool' || v === 'primary school') return 'primary';
    return v;
  }
  var target = (type === 'secondary') ? 'high' : 'primary';
  return students.filter(function(s) {
    var sec = normSec(s.section);
    // Include student if their section matches OR if section is empty/unset (fallback to institution)
    return sec === target || sec === '' || sec === 'both';
  });
}

function getStudentById(studentId) {
  var students = getSheetData('Students');
  for (var i = 0; i < students.length; i++) {
    if (String(students[i].iD || students[i].id) === String(studentId)) {
      var s = students[i];
      if (s) s.photoUrl = s.photoURL || s.photoUrl || '';
      return s;
    }
  }
  return null;
}

function createStudent(data) {
  // ── Input validation ────────────────────────────────────────
  var v = validateInput(data, [
    { field: 'fullName',        required: true,  maxLength: 100 },
    { field: 'className',       required: true,  maxLength: 50  },
    { field: 'section',         required: true,  maxLength: 20  },
    { field: 'admissionNumber', required: false, maxLength: 30  },
    { field: 'gender',          required: false, maxLength: 10  },
    { field: 'school',          required: false, maxLength: 100 }
  ]);
  if (!v.valid) return { success: false, message: v.message };
  // ────────────────────────────────────────────────────────────
  var sheet = getSpreadsheet().getSheetByName('Students');
  var id = generateId();
  sheet.appendRow([
    id, data.fullName.trim(), data.admissionNumber || '',
    data.className.trim(), data.section || 'high',
    data.school || '', data.parentId || '', data.gender || '',
    data.dateOfBirth || '', data.photoUrl || '',
    new Date().toISOString().split('T')[0], 'active'
  ]);
  SpreadsheetApp.flush();
  
  if (data.parentId) {
    _syncParentChildLink(id, data.parentId);
  }

  logAudit('system', 'CREATE_STUDENT', 'Created student: ' + data.fullName);
  return { success: true, id: id, message: 'Student created.' };
}

function updateStudent(studentId, data) {
  // ── Input validation (only fields that are being updated) ───
  var v = validateInput(data, [
    { field: 'fullName',        required: false, maxLength: 100 },
    { field: 'className',       required: false, maxLength: 50  },
    { field: 'admissionNumber', required: false, maxLength: 30  },
    { field: 'gender',          required: false, maxLength: 10  },
    { field: 'school',          required: false, maxLength: 100 }
  ]);
  if (!v.valid) return { success: false, message: v.message };
  // ────────────────────────────────────────────────────────────
  var sheet = getSpreadsheet().getSheetByName('Students');
  var row = findRowById(sheet, studentId);
  if (row === -1) return { success: false, message: 'Student not found.' };
  
  var oldStudent = getStudentById(studentId);
  var oldParentId = oldStudent ? oldStudent.parentId : '';

  if (data.fullName) sheet.getRange(row, 2).setValue(data.fullName.trim());
  if (data.admissionNumber !== undefined) sheet.getRange(row, 3).setValue(data.admissionNumber);
  if (data.className) sheet.getRange(row, 4).setValue(data.className.trim());
  if (data.section) sheet.getRange(row, 5).setValue(data.section);
  if (data.school !== undefined) sheet.getRange(row, 6).setValue(data.school);
  if (data.parentId !== undefined) sheet.getRange(row, 7).setValue(data.parentId);
  if (data.gender) sheet.getRange(row, 8).setValue(data.gender);
  if (data.dateOfBirth) sheet.getRange(row, 9).setValue(data.dateOfBirth);
  if (data.photoUrl !== undefined) sheet.getRange(row, 10).setValue(data.photoUrl);
  if (data.status) sheet.getRange(row, 12).setValue(data.status);
  SpreadsheetApp.flush();

  if (data.parentId !== undefined && String(data.parentId) !== String(oldParentId)) {
    if (oldParentId) _syncParentChildLink(studentId, oldParentId, true); // remove from old
    if (data.parentId) _syncParentChildLink(studentId, data.parentId); // add to new
  }

  return { success: true, message: 'Student updated.' };
}

function deleteStudent(studentId) {
  var sheet = getSpreadsheet().getSheetByName('Students');
  var row = findRowById(sheet, studentId);
  if (row === -1) return { success: false, message: 'Student not found.' };
  sheet.deleteRow(row);
  SpreadsheetApp.flush();
  return { success: true, message: 'Student deleted.' };
}

function getStudentsByClass(className) {
  return getSheetData('Students').filter(function(s) {
    return String(s.class || s.className).toLowerCase() === String(className).toLowerCase() && String(s.status || 'active') === 'active';
  }).map(function(s) {
    if (s) s.photoUrl = s.photoURL || s.photoUrl || '';
    return s;
  });
}

// ─── CLASSES ────────────────────────────────────────────────

function getAllClasses() { 
  var classes = getSheetData('Classes'); 
  var type = getSettings().institution_type || 'both';
  if (type === 'primary') return classes.filter(function(c) { return String(c.section).toLowerCase() === 'primary'; });
  if (type === 'secondary') return classes.filter(function(c) { return String(c.section).toLowerCase() === 'high'; });
  return classes;
}

function createClass(data) {
  if (!data.className) return { success: false, message: 'Class name required.' };
  var sheet = getSpreadsheet().getSheetByName('Classes');
  var id = generateId();
  sheet.appendRow([id, data.className.trim(), data.section || 'high',
    data.school || '', data.classTeacherId || '', data.academicSession || '']);
  return { success: true, id: id, message: 'Class created.' };
}

function updateClass(classId, data) {
  var sheet = getSpreadsheet().getSheetByName('Classes');
  var row = findRowById(sheet, classId);
  if (row === -1) return { success: false, message: 'Class not found.' };
  if (data.className) sheet.getRange(row, 2).setValue(data.className.trim());
  if (data.section) sheet.getRange(row, 3).setValue(data.section);
  if (data.school !== undefined) sheet.getRange(row, 4).setValue(data.school);
  if (data.classTeacherId !== undefined) sheet.getRange(row, 5).setValue(data.classTeacherId);
  if (data.academicSession !== undefined) sheet.getRange(row, 6).setValue(data.academicSession);
  return { success: true, message: 'Class updated.' };
}

function deleteClass(classId) {
  var sheet = getSpreadsheet().getSheetByName('Classes');
  var row = findRowById(sheet, classId);
  if (row === -1) return { success: false, message: 'Class not found.' };
  sheet.deleteRow(row);
  return { success: true, message: 'Class deleted.' };
}

// ─── SUBJECTS ───────────────────────────────────────────────

function getAllSubjects() { 
  var subjects = getSheetData('Subjects'); 
  var type = getSettings().institution_type || 'both';
  if (type === 'primary') return subjects.filter(function(s) { return String(s.section).toLowerCase() === 'primary'; });
  if (type === 'secondary') return subjects.filter(function(s) { return String(s.section).toLowerCase() === 'high'; });
  return subjects;
}

function getSubjectById(subjectId) {
  var subjects = getSheetData('Subjects');
  for (var i = 0; i < subjects.length; i++) {
    if (String(subjects[i].iD || subjects[i].id) === String(subjectId)) return subjects[i];
  }
  return null;
}

function createSubject(data) {
  if (!data.subjectName) return { success: false, message: 'Subject name required.' };
  var sheet = getSpreadsheet().getSheetByName('Subjects');
  var id = generateId();
  sheet.appendRow([id, data.subjectName.trim(), data.section || 'high',
    data.className || '', data.assignedTeacherId || '']);
  return { success: true, id: id, message: 'Subject created.' };
}

function updateSubject(subjectId, data) {
  var sheet = getSpreadsheet().getSheetByName('Subjects');
  var row = findRowById(sheet, subjectId);
  if (row === -1) return { success: false, message: 'Subject not found.' };
  if (data.subjectName) sheet.getRange(row, 2).setValue(data.subjectName.trim());
  if (data.section) sheet.getRange(row, 3).setValue(data.section);
  var cls = data.className !== undefined ? data.className : data.class;
  if (cls !== undefined) sheet.getRange(row, 4).setValue(cls);
  if (data.assignedTeacherId !== undefined) sheet.getRange(row, 5).setValue(data.assignedTeacherId);
  return { success: true, message: 'Subject updated.' };
}

function deleteSubject(subjectId) {
  var sheet = getSpreadsheet().getSheetByName('Subjects');
  var row = findRowById(sheet, subjectId);
  if (row === -1) return { success: false, message: 'Subject not found.' };
  sheet.deleteRow(row);
  return { success: true, message: 'Subject deleted.' };
}

function getTeacherSubjects(teacherUserId) {
  return getSheetData('Subjects').filter(function(s) {
    return String(s.assignedTeacherID || s.assignedTeacherId) === String(teacherUserId);
  });
}

function assignSubjectsToTeacher(teacherUserId, subjectIds) {
  var sheet = getSpreadsheet().getSheetByName('Subjects');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var sid = String(data[i][0]);
    var curTeacher = String(data[i][4]);
    if (curTeacher === String(teacherUserId) && subjectIds.indexOf(sid) === -1)
      sheet.getRange(i + 1, 5).setValue('');
    if (subjectIds.indexOf(sid) !== -1)
      sheet.getRange(i + 1, 5).setValue(teacherUserId);
  }
  return { success: true, message: subjectIds.length + ' subject(s) assigned.' };
}

// ─── ENROLLMENTS ─────────────────────────────────────────────

function getEnrollments(filters) {
  var sheet = getSpreadsheet().getSheetByName('Enrollments');
  var rows = getSheetData('Enrollments');
  
  if (sheet) {
    var currentSettings = null;
    var changed = false;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.session === 'undefined' || r.session === '' || !r.session || r.term === 'undefined' || r.term === '' || !r.term) {
        if (!currentSettings) currentSettings = getSettings();
        var rowIndex = i + 2;
        if (r.session === 'undefined' || r.session === '' || !r.session) {
          var sessVal = currentSettings.current_session || '2025/2026';
          sheet.getRange(rowIndex, 3).setValue(sessVal);
          r.session = sessVal;
          changed = true;
        }
        if (r.term === 'undefined' || r.term === '' || !r.term) {
          var termVal = currentSettings.current_term || 'First Term';
          sheet.getRange(rowIndex, 4).setValue(termVal);
          r.term = termVal;
          changed = true;
        }
      }
    }
    if (changed) {
      SpreadsheetApp.flush();
    }
  }

  if (!filters) return rows;
  return rows.filter(function(r) {
    var ok = true;
    if (filters.studentId && String(r.studentID || r.studentId) !== String(filters.studentId)) ok = false;
    if (filters.subjectId && String(r.subjectID || r.subjectId) !== String(filters.subjectId)) ok = false;
    if (filters.className && String(r.className) !== String(filters.className)) ok = false;
    return ok;
  });
}

function enrollStudent(studentId, subjectId, session, term) {
  var sheet = getSpreadsheet().getSheetByName('Enrollments');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(studentId) && String(data[i][1]) === String(subjectId) && String(data[i][2]) === String(session))
      return { success: false, message: 'Already enrolled.' };
  }
  sheet.appendRow([studentId, subjectId, session, term || '']);
  return { success: true, message: 'Student enrolled.' };
}

function unenrollStudent(studentId, subjectId, session) {
  var sheet = getSpreadsheet().getSheetByName('Enrollments');
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(studentId) && String(data[i][1]) === String(subjectId) && String(data[i][2]) === String(session)) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Unenrolled.' };
    }
  }
  return { success: false, message: 'Enrollment not found.' };
}

function getSubjectStudents(subjectId, session) {
  var enrollments = getEnrollments({ subjectId: subjectId });
  if (session) enrollments = enrollments.filter(function(e) { return String(e.session) === String(session); });
  var students = getAllStudents();
  return enrollments.map(function(e) {
    var sid = e.studentID || e.studentId;
    return students.find(function(s) { return String(s.iD || s.id) === String(sid); }) || null;
  }).filter(Boolean);
}

function getStudentSubjects(studentId, session) {
  var enrollments = getEnrollments({ studentId: studentId });
  if (session) enrollments = enrollments.filter(function(e) { return String(e.session) === String(session); });
  var subjects = getAllSubjects();
  return enrollments.map(function(e) {
    var sid = e.subjectID || e.subjectId;
    return subjects.find(function(s) { return String(s.iD || s.id) === String(sid); }) || null;
  }).filter(Boolean);
}

// ─── ASSESSMENTS (SCORES) ────────────────────────────────────

function getScores(filters) {
  var scores = getSheetData('Assessments');
  var students = getAllStudents();
  var subjects = getAllSubjects();
  var studentMap = {};
  students.forEach(function(s) { studentMap[s.iD || s.id] = s.fullName; });
  var subjectMap = {};
  subjects.forEach(function(s) { subjectMap[s.iD || s.id] = s.subjectName; });

  return scores.filter(function(s) {
    if (!filters) return true;
    if (filters.studentId && String(s.studentID || s.studentId) !== String(filters.studentId)) return false;
    if (filters.subjectId && String(s.subjectID || s.subjectId) !== String(filters.subjectId)) return false;
    if (filters.className && String(s.class) !== String(filters.className)) return false;
    if (filters.term && String(s.term) !== String(filters.term)) return false;
    if (filters.session && String(s.session) !== String(filters.session)) return false;
    return true;
  }).map(function(s) {
    var sid = s.studentID || s.studentId;
    var subId = s.subjectID || s.subjectId;
    s.studentName = s.studentName || studentMap[sid] || sid;
    s.subjectName = s.subjectName || subjectMap[subId] || subId;
    return s;
  });
}

function saveScore(data) {
  var sheet = getSpreadsheet().getSheetByName('Assessments');
  var existing = getScores({ studentId: data.studentId, subjectId: data.subjectId, term: data.term, session: data.session });

  if (existing.length > 0) {
    var locked = existing[0].locked;
    if (String(locked) === 'true' || locked === true)
      return { success: false, message: 'Scores are locked.' };
  }

  var ca1 = safeFloat(data.ca1, 0); var ca2 = safeFloat(data.ca2, 0);
  var ca3 = safeFloat(data.ca3, 0); var exam = safeFloat(data.exam, 0);

  if (ca1 < 0 || ca1 > 10) return { success: false, message: 'CA1 must be 0–10.' };
  if (ca2 < 0 || ca2 > 10) return { success: false, message: 'CA2 must be 0–10.' };
  if (ca3 < 0 || ca3 > 10) return { success: false, message: 'CA3 must be 0–10.' };
  if (exam < 0 || exam > 70) return { success: false, message: 'Exam must be 0–70.' };

  var total = computeTotal(ca1, ca2, ca3, exam);
  var grade = computeGrade(total);
  var student = getStudentById(data.studentId);
  var studentName = student ? student.fullName : '';
  var className = student ? (student.class || student.className || '') : (data.className || '');

  if (existing.length > 0) {
    var scoreId = existing[0].iD || existing[0].id;
    var row = findRowById(sheet, scoreId);
    if (row > 0) {
      sheet.getRange(row, 3).setValue(studentName);
      sheet.getRange(row, 8).setValue(ca1); sheet.getRange(row, 9).setValue(ca2);
      sheet.getRange(row, 10).setValue(ca3); sheet.getRange(row, 11).setValue(exam);
      sheet.getRange(row, 12).setValue(total); sheet.getRange(row, 13).setValue(grade);
      if (data.teacherComment !== undefined) sheet.getRange(row, 15).setValue(data.teacherComment);
      return { success: true, message: 'Score updated.', total: total, grade: grade };
    }
  }

  var id = generateId();
  sheet.appendRow([id, data.studentId, studentName, data.subjectId, className,
    data.term, data.session, ca1, ca2, ca3, exam, total, grade, 0, data.teacherComment || '', 'false', 'false']);
  return { success: true, message: 'Score saved.', total: total, grade: grade };
}

function lockScores(filters) {
  var sheet = getSpreadsheet().getSheetByName('Assessments');
  var data = sheet.getDataRange().getValues();
  var count = 0;
  for (var i = 1; i < data.length; i++) {
    var match = true;
    if (filters.studentId && String(data[i][1]) !== String(filters.studentId)) match = false;
    if (filters.subjectId && String(data[i][3]) !== String(filters.subjectId)) match = false;
    if (filters.className && String(data[i][4]) !== String(filters.className)) match = false;
    if (filters.term && String(data[i][5]) !== String(filters.term)) match = false;
    if (filters.session && String(data[i][6]) !== String(filters.session)) match = false;
    if (match) { sheet.getRange(i + 1, 16).setValue('true'); count++; }
  }
  return { success: true, message: count + ' score(s) locked.' };
}

function unlockScores(filters) {
  var sheet = getSpreadsheet().getSheetByName('Assessments');
  var data = sheet.getDataRange().getValues();
  var count = 0;
  for (var i = 1; i < data.length; i++) {
    var match = true;
    if (filters.studentId && String(data[i][1]) !== String(filters.studentId)) match = false;
    if (filters.term && String(data[i][5]) !== String(filters.term)) match = false;
    if (filters.session && String(data[i][6]) !== String(filters.session)) match = false;
    if (match) { sheet.getRange(i + 1, 16).setValue('false'); count++; }
  }
  return { success: true, message: count + ' score(s) unlocked.' };
}

// ─── PSYCHOMOTOR & AFFECTIVE ──────────────────────────────────

function savePsychomotorRecord(data) {
  var sheet = getSpreadsheet().getSheetByName('PsychomotorRecords');
  var existing = getSheetData('PsychomotorRecords').find(function(r) {
    return String(r.studentID || r.studentId) === String(data.studentId) &&
           String(r.term) === String(data.term) && String(r.session) === String(data.session);
  });
  if (existing) {
    var row = findRowById(sheet, existing.iD || existing.id);
    if (row > 0) {
      sheet.getRange(row, 6).setValue(data.handwriting || ''); sheet.getRange(row, 7).setValue(data.sportSkills || '');
      sheet.getRange(row, 8).setValue(data.drawing || ''); sheet.getRange(row, 9).setValue(data.creativity || '');
      sheet.getRange(row, 10).setValue(data.speaking || ''); sheet.getRange(row, 11).setValue(data.attentiveness || '');
      return { success: true, message: 'Psychomotor record updated.' };
    }
  }
  var id = generateId();
  sheet.appendRow([id, data.studentId, data.className || '', data.term, data.session,
    data.handwriting || '', data.sportSkills || '', data.drawing || '',
    data.creativity || '', data.speaking || '', data.attentiveness || '']);
  return { success: true, message: 'Psychomotor record saved.' };
}

function saveAffectiveRecord(data) {
  var sheet = getSpreadsheet().getSheetByName('AffectiveRecords');
  var existing = getSheetData('AffectiveRecords').find(function(r) {
    return String(r.studentID || r.studentId) === String(data.studentId) &&
           String(r.term) === String(data.term) && String(r.session) === String(data.session);
  });
  if (existing) {
    var row = findRowById(sheet, existing.iD || existing.id);
    if (row > 0) {
      sheet.getRange(row, 6).setValue(data.punctuality || ''); sheet.getRange(row, 7).setValue(data.neatness || '');
      sheet.getRange(row, 8).setValue(data.politeness || ''); sheet.getRange(row, 9).setValue(data.honesty || '');
      sheet.getRange(row, 10).setValue(data.leadership || ''); sheet.getRange(row, 11).setValue(data.cooperation || '');
      return { success: true, message: 'Affective record updated.' };
    }
  }
  var id = generateId();
  sheet.appendRow([id, data.studentId, data.className || '', data.term, data.session,
    data.punctuality || '', data.neatness || '', data.politeness || '',
    data.honesty || '', data.leadership || '', data.cooperation || '']);
  return { success: true, message: 'Affective record saved.' };
}

function getPsychomotorRecord(studentId, term, session) {
  return getSheetData('PsychomotorRecords').find(function(r) {
    return String(r.studentID || r.studentId) === String(studentId) &&
           String(r.term) === String(term) && String(r.session) === String(session);
  }) || null;
}

function getAffectiveRecord(studentId, term, session) {
  return getSheetData('AffectiveRecords').find(function(r) {
    return String(r.studentID || r.studentId) === String(studentId) &&
           String(r.term) === String(term) && String(r.session) === String(session);
  }) || null;
}

// ─── SETTINGS ────────────────────────────────────────────────

function getSettings() {
  var sheet = getSpreadsheet().getSheetByName('Settings');
  if (!sheet) return {};
  var data = sheet.getDataRange().getValues();
  var settings = {};
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) settings[String(data[i][0])] = String(data[i][1]);
  }
  return settings;
}

function updateSettings(newSettings) {
  var sheet = getSpreadsheet().getSheetByName('Settings');
  var data = sheet.getDataRange().getValues();
  for (var key in newSettings) {
    var found = false;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === key) { sheet.getRange(i + 1, 2).setValue(newSettings[key]); found = true; break; }
    }
    if (!found) sheet.appendRow([key, newSettings[key]]);
  }
  return { success: true, message: 'Settings updated.' };
}

function updateGradingRule(data) {
  var sheet = getSpreadsheet().getSheetByName('Grading');
  if (!sheet) {
    sheet = getSpreadsheet().insertSheet('Grading');
    sheet.appendRow(['ID', 'Grade', 'Min', 'Max', 'Remark']);
  }
  var row = data.id ? findRowById(sheet, data.id) : -1;
  if (row > 0) {
    sheet.getRange(row, 2).setValue(data.grade);
    sheet.getRange(row, 3).setValue(data.min);
    sheet.getRange(row, 4).setValue(data.max);
    sheet.getRange(row, 5).setValue(data.remark);
    return { success: true, message: 'Rule updated.' };
  } else {
    sheet.appendRow([generateId(), data.grade, data.min, data.max, data.remark]);
    return { success: true, message: 'Rule created.' };
  }
}

/**
 * Synchronize the link between a student and their parent in the Users sheet.
 */
function _syncParentChildLink(studentId, parentUserId, isRemoval) {
  try {
    var user = getUserById(parentUserId);
    if (!user) return;
    
    var linkedIds = user.linkedStudentIds ? String(user.linkedStudentIds).split(',').map(function(s){return s.trim();}).filter(Boolean) : [];
    var index = linkedIds.indexOf(String(studentId));
    
    if (isRemoval) {
      if (index !== -1) linkedIds.splice(index, 1);
    } else {
      if (index === -1) linkedIds.push(String(studentId));
    }
    
    updateUser(parentUserId, { linkedStudentIds: linkedIds.join(',') });
  } catch (e) {
    Logger.log('Error syncing parent-child link: ' + e.message);
  }
}

// ─── PARENT HELPERS ──────────────────────────────────────────

function getParentChildren(parentUserId) {
  var user = getUserById(parentUserId);
  if (!user) return [];
  var ids = user.linkedStudentIds ? String(user.linkedStudentIds).split(',') : [];
  return ids.map(function(id) { return getStudentById(id.trim()); }).filter(Boolean);
}

function getStudentResult(studentId, term, session) {
  var student = getStudentById(studentId);
  if (!student) return { success: false, message: 'Student not found.' };
  var scores = getScores({ studentId: studentId, term: term, session: session });
  var totalSum = 0;
  scores.forEach(function(s) { totalSum += safeFloat(s.total, 0); });
  var avg = scores.length > 0 ? Math.round((totalSum / scores.length) * 10) / 10 : 0;
  return {
    success: true, student: student, scores: scores,
    summary: { totalSubjects: scores.length, totalScore: totalSum, average: avg, overallGrade: computeGrade(avg) }
  };
}

// ─── ADMIN STATS ──────────────────────────────────────────────

function getAdminStats(section) {
  var users = getSheetData('Users');
  var students = getSheetData('Students');
  var classes = getAllClasses();
  var subjects = getAllSubjects();

  if (section && section !== 'both') {
    users = users.filter(function(u) { return u.section === section || u.section === 'both'; });
    students = students.filter(function(s) { return s.section === section; });
    classes = classes.filter(function(c) { return c.section === section; });
    subjects = subjects.filter(function(s) { return s.section === section; });
  }

  var staffRoles = ['admin', 'admin_assistant', 'principal', 'vp', 'headteacher', 'teacher', 'primary_teacher', 'accounts'];
  var totalStaff = users.filter(function(u) { return staffRoles.indexOf(u.role) !== -1; }).length;

  return {
    users: totalStaff,
    students: students.filter(function(s) { return s.status !== 'inactive'; }).length,
    classes: classes.length,
    subjects: subjects.length,
    totalStudents: students.length,
    totalUsers: users.length,
    totalStaff: totalStaff,
    totalTeachers: users.filter(function(u) { return u.role === 'teacher' || u.role === 'primary_teacher'; }).length,
    totalParents: users.filter(function(u) { return u.role === 'parent'; }).length
  };
}

// ─── ADMIN APPROVAL QUEUE ─────────────────────────────────────

function logPendingTask(taskType, payload, requestedBy) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('PendingAdminTasks');
  if (!sheet) {
    sheet = ss.insertSheet('PendingAdminTasks');
    sheet.appendRow(['id', 'taskType', 'payloadJSON', 'requestedBy', 'status', 'createdAt', 'adminNotes']);
  }
  var id = generateId();
  var payloadStr = JSON.stringify(payload);
  sheet.appendRow([id, taskType, payloadStr, requestedBy, 'pending', new Date().toISOString(), '']);
  logAudit(requestedBy, 'PENDING_TASK_CREATED', taskType);
  return { success: true, message: 'Request submitted for Admin approval.' };
}

function getPendingTasks() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('PendingAdminTasks');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  var tasks = [];
  var users = getSheetData('Users');
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    if (obj.status === 'pending') {
      try { obj.payload = JSON.parse(obj.payloadJSON); } catch(e) { obj.payload = {}; }
      var requester = users.find(function(u) { return String(u.iD || u.id) === String(obj.requestedBy); });
      obj.requesterName = requester ? requester.fullName : 'Unknown';
      tasks.push(obj);
    }
  }
  return tasks;
}

function updatePendingTaskStatus(taskId, status, note, adminId) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('PendingAdminTasks');
  if (!sheet) return { success: false, message: 'Sheet not found.' };
  var row = findRowById(sheet, taskId);
  if (row === -1) return { success: false, message: 'Task not found.' };
  
  sheet.getRange(row, 5).setValue(status);
  sheet.getRange(row, 7).setValue(note || '');
  logAudit(adminId, 'TASK_' + status.toUpperCase(), 'Task ID: ' + taskId);
  return { success: true, message: 'Task ' + status + '.' };
}

function seedNigerianSubjects() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Subjects');
  if (!sheet) return { success: false, message: 'Subjects sheet not found.' };

  var existing = getSheetData('Subjects');
  var existingNames = existing.map(function(s) { 
    return String(s.subjectName || '').toLowerCase().trim() + '||' + String(s.section || '').toLowerCase().trim();
  });

  var primarySubjects = [
    "Mathematics",
    "English Studies",
    "Basic Science and Technology",
    "Social Studies",
    "Civic Education",
    "Cultural and Creative Arts",
    "Home Economics",
    "Agricultural Science",
    "Physical and Health Education",
    "Computer Studies",
    "Christian Religious Studies",
    "Islamic Religious Studies",
    "French Language",
    "Yoruba Language",
    "Igbo Language",
    "Hausa Language"
  ];

  var highSchoolSubjects = [
    "Mathematics",
    "English Language",
    "Civic Education",
    "Biology",
    "Chemistry",
    "Physics",
    "Agricultural Science",
    "Economics",
    "Geography",
    "Government",
    "Literature-in-English",
    "Christian Religious Studies",
    "Islamic Religious Studies",
    "Financial Accounting",
    "Commerce",
    "Further Mathematics",
    "Technical Drawing",
    "Data Processing",
    "Computer Studies"
  ];

  var addedCount = 0;

  // Add primary subjects
  primarySubjects.forEach(function(subName) {
    var key = subName.toLowerCase().trim() + '||primary';
    if (existingNames.indexOf(key) === -1) {
      sheet.appendRow([generateId(), subName, 'primary', '', '']);
      addedCount++;
    }
  });

  // Add high school subjects
  highSchoolSubjects.forEach(function(subName) {
    var key = subName.toLowerCase().trim() + '||high';
    if (existingNames.indexOf(key) === -1) {
      sheet.appendRow([generateId(), subName, 'high', '', '']);
      addedCount++;
    }
  });

  SpreadsheetApp.flush();
  return { success: true, message: addedCount + ' standard subjects added successfully.' };
}

function seedNigerianClasses() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Classes');
  if (!sheet) return { success: false, message: 'Classes sheet not found.' };

  var existing = getSheetData('Classes');
  var existingNames = existing.map(function(c) { 
    return String(c.className || c.ClassName || '').toLowerCase().trim() + '||' + String(c.section || '').toLowerCase().trim();
  });

  var primaryClasses = [
    "Primary 1",
    "Primary 2",
    "Primary 3",
    "Primary 4",
    "Primary 5",
    "Primary 6"
  ];

  var highSchoolClasses = [
    "JSS 1",
    "JSS 2",
    "JSS 3",
    "SSS 1",
    "SSS 2",
    "SSS 3"
  ];

  var addedCount = 0;

  // Add primary classes
  primaryClasses.forEach(function(clsName) {
    var key = clsName.toLowerCase().trim() + '||primary';
    if (existingNames.indexOf(key) === -1) {
      sheet.appendRow([generateId(), clsName, 'primary', '', '', '']);
      addedCount++;
    }
  });

  // Add high school classes
  highSchoolClasses.forEach(function(clsName) {
    var key = clsName.toLowerCase().trim() + '||high';
    if (existingNames.indexOf(key) === -1) {
      sheet.appendRow([generateId(), clsName, 'high', '', '', '']);
      addedCount++;
    }
  });

  SpreadsheetApp.flush();
  return { success: true, message: addedCount + ' standard classes added successfully.' };
}

// ─── BULK OPERATIONS ──────────────────────────────────────────

function bulkCreateStudents(students) {
  var sheet = getSpreadsheet().getSheetByName('Students');
  var rows = [];
  for(var i=0; i<students.length; i++) {
    var d = students[i];
    if(!d.FullName || !d.ClassName || !d.Section) continue;
    rows.push([
      generateId(), String(d.FullName).trim(), String(d.AdmissionNumber || '').trim(),
      String(d.ClassName).trim(), String(d.Section).toLowerCase().trim() || 'high',
      '', '', String(d.Gender || '').trim(),
      String(d.DateOfBirth || '').trim(), '',
      new Date().toISOString().split('T')[0], 'active'
    ]);
  }
  if(rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    SpreadsheetApp.flush();
    logAudit('system', 'BULK_CREATE_STUDENTS', 'Imported ' + rows.length + ' students');
  }
  return { success: true, message: rows.length + ' students imported successfully.' };
}

function bulkCreateClasses(classes) {
  var sheet = getSpreadsheet().getSheetByName('Classes');
  var rows = [];
  for(var i=0; i<classes.length; i++) {
    var d = classes[i];
    if(!d.ClassName) continue;
    rows.push([
      generateId(), String(d.ClassName).trim(), String(d.Section).toLowerCase().trim() || 'high',
      '', '', String(d.AcademicSession || '').trim()
    ]);
  }
  if(rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    SpreadsheetApp.flush();
    logAudit('system', 'BULK_CREATE_CLASSES', 'Imported ' + rows.length + ' classes');
  }
  return { success: true, message: rows.length + ' classes imported successfully.' };
}

function bulkCreateSubjects(subjects) {
  var sheet = getSpreadsheet().getSheetByName('Subjects');
  var rows = [];
  for(var i=0; i<subjects.length; i++) {
    var d = subjects[i];
    if(!d.SubjectName) continue;
    var section = String(d.Section || '').toLowerCase().trim() || 'high';
    if(section === 'high school') section = 'high';
    if(section === 'primary school') section = 'primary';
    rows.push([
      generateId(), String(d.SubjectName).trim(), section,
      String(d.TargetClass || '').trim(), ''
    ]);
  }
  if(rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    SpreadsheetApp.flush();
    logAudit('system', 'BULK_CREATE_SUBJECTS', 'Imported ' + rows.length + ' subjects');
  }
  return { success: true, message: rows.length + ' subjects imported successfully.' };
}

function bulkSaveScores(scoresArray) {
  var count = 0;
  var errs = 0;
  for(var i=0; i<scoresArray.length; i++) {
    var res = saveScore(scoresArray[i]);
    if(res.success) count++; else errs++;
  }
  SpreadsheetApp.flush();
  logAudit('system', 'BULK_SAVE_SCORES', 'Saved ' + count + ' scores, ' + errs + ' errors');
  return { success: true, message: count + ' scores saved successfully.' + (errs > 0 ? ' (' + errs + ' skipped/locked)' : '') };
}
