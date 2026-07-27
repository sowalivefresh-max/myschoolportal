/**
 * ============================================================
 *  MYSCHOOL PORTAL - Database.gs
 *  Core CRUD operations via Firebase Firestore
 * ============================================================
 *  All public function signatures are IDENTICAL to the
 *  Google Sheets version to avoid breaking any callers.
 * ============================================================
 */

// --- USERS ---------------------------------------------------

function getAllUsers() {
  var users = firebaseGetAll('users');
  users.forEach(function(u) { delete u.passwordHash; delete u.salt; });
  return users;
}

function getUserById(userId) {
  if (!userId) return null;
  var user = firebaseGet('users', String(userId));
  if (!user) return null;
  delete user.passwordHash; delete user.salt;
  return user;
}

function createUser(data) {
  var v = validateInput(data, [
    { field: 'fullName', required: true,  maxLength: 100 },
    { field: 'email',    required: true,  type: 'email' },
    { field: 'role',     required: true,  maxLength: 30  },
    { field: 'password', required: true,  maxLength: 128 },
    { field: 'phone',    required: false, maxLength: 20  },
    { field: 'section',  required: false, maxLength: 20  }
  ]);
  if (!v.valid) return { success: false, message: v.message };
  if (!isValidEmail(data.email)) return { success: false, message: 'Invalid email.' };
  var existing = firebaseQuery('users', [{ field: 'email', op: 'EQUAL', value: data.email.trim().toLowerCase() }]);
  if (existing && existing.length > 0) return { success: false, message: 'Email already exists.' };
  var id = generateId(), salt = generateSalt();
  var doc = {
    id: id, fullName: data.fullName.trim(), email: data.email.trim().toLowerCase(),
    passwordHash: hashPassword(data.password, salt), salt: salt,
    role: data.role.toLowerCase(), section: data.section || 'both',
    linkedStudentIds: data.linkedStudentIds || '', classAssigned: data.classAssigned || '',
    status: 'active', profilePicture: '', phone: data.phone || '',
    signature: data.signature || '', createdAt: new Date().toISOString()
  };
  firebaseSet('users', id, doc);
  logAudit('system', 'CREATE_USER', 'Created user: ' + data.email);
  return { success: true, id: id, message: 'User created.' };
}

function updateUser(userId, data) {
  var v = validateInput(data, [
    { field: 'fullName', required: false, maxLength: 100 },
    { field: 'email',    required: false, type: 'email' },
    { field: 'password', required: false, maxLength: 128 },
    { field: 'phone',    required: false, maxLength: 20  }
  ]);
  if (!v.valid) return { success: false, message: v.message };
  var updates = {};
  if (data.fullName         !== undefined) updates.fullName         = data.fullName.trim();
  if (data.email            !== undefined) updates.email            = data.email.trim().toLowerCase();
  if (data.role             !== undefined) updates.role             = data.role.toLowerCase();
  if (data.section          !== undefined) updates.section          = data.section;
  if (data.linkedStudentIds !== undefined) updates.linkedStudentIds = data.linkedStudentIds;
  if (data.classAssigned    !== undefined) updates.classAssigned    = data.classAssigned;
  if (data.status           !== undefined) updates.status           = data.status;
  if (data.profilePicture   !== undefined) updates.profilePicture   = data.profilePicture;
  if (data.phone            !== undefined) updates.phone            = data.phone;
  if (data.signature        !== undefined) updates.signature        = data.signature;
  if (data.password) {
    var ns = generateSalt();
    updates.passwordHash = hashPassword(data.password, ns); updates.salt = ns;
  }
  if (Object.keys(updates).length === 0) return { success: true, message: 'Nothing to update.' };
  firebasePatch('users', userId, updates);
  clearFirebaseCache('users');
  return { success: true, message: 'User updated.' };
}

function deleteUser(userId) {
  firebaseDelete('users', userId);
  logAudit('system', 'DELETE_USER', 'Deleted user ID: ' + userId);
  clearFirebaseCache('users');
  return { success: true, message: 'User deleted.' };
}

// --- STUDENTS ------------------------------------------------

function getAllStudents() {
  var students = firebaseGetAll('students');
  students = students.map(function(s) { if (s) s.photoUrl = s.photoUrl || ''; return s; });
  var type = (getSettings().institution_type || 'both').toLowerCase().trim();
  if (type === 'both') return students;
  function normSec(sec) {
    var v2 = String(sec || '').toLowerCase().trim();
    if (v2 === 'high' || v2 === 'highschool' || v2 === 'high school' || v2 === 'secondary') return 'high';
    if (v2 === 'primary' || v2 === 'primaryschool' || v2 === 'primary school') return 'primary';
    return v2;
  }
  var target = (type === 'secondary') ? 'high' : 'primary';
  return students.filter(function(s) {
    var sec = normSec(s.section);
    return sec === target || sec === '' || sec === 'both';
  });
}

function getStudentById(studentId) {
  if (!studentId) return null;
  return firebaseGet('students', String(studentId));
}

function createStudent(data) {
  var v = validateInput(data, [
    { field: 'fullName',        required: true,  maxLength: 100 },
    { field: 'className',       required: true,  maxLength: 50  },
    { field: 'section',         required: true,  maxLength: 20  },
    { field: 'admissionNumber', required: false, maxLength: 30  },
    { field: 'gender',          required: false, maxLength: 10  },
    { field: 'school',          required: false, maxLength: 100 }
  ]);
  if (!v.valid) return { success: false, message: v.message };
  var id = generateId();
  var doc = {
    id: id, fullName: data.fullName.trim(), admissionNumber: data.admissionNumber || '',
    className: data.className.trim(), section: data.section || 'high',
    school: data.school || '', parentId: data.parentId || '', gender: data.gender || '',
    dateOfBirth: data.dateOfBirth || '', photoUrl: data.photoUrl || '',
    enrolledAt: new Date().toISOString().split('T')[0], status: 'active'
  };
  firebaseSet('students', id, doc);
  if (data.parentId) _syncParentChildLink(id, data.parentId);
  logAudit('system', 'CREATE_STUDENT', 'Created student: ' + data.fullName);
  return { success: true, id: id, message: 'Student created.' };
}

function bulkCreateStudents(students) {
  var writes = [], count = 0;
  for (var i = 0; i < students.length; i++) {
    var d = students[i];
    if (!d.fullName && !d.FullName) continue;
    var id = generateId();
    writes.push({ type: 'set', collection: 'students', docId: id, data: {
      id: id, fullName: String(d.fullName || d.FullName || '').trim(),
      admissionNumber: String(d.admissionNumber || d.AdmissionNumber || '').trim(),
      className: String(d.className || d.ClassName || '').trim(),
      section: String(d.section || d.Section || 'both').toLowerCase().trim(),
      school: '', parentId: '', gender: String(d.gender || d.Gender || '').trim(),
      dateOfBirth: String(d.dateOfBirth || d.DateOfBirth || '').trim(),
      photoUrl: '', enrolledAt: new Date().toISOString().split('T')[0], status: 'active'
    }});
    count++;
    if (writes.length === 499) { firebaseBatchWrite(writes); writes = []; }
  }
  if (writes.length > 0) firebaseBatchWrite(writes);
  logAudit('system', 'BULK_CREATE_STUDENTS', 'Uploaded ' + count + ' students');
  return { success: true, message: count + ' students successfully uploaded.' };
}

function updateStudent(studentId, data) {
  var v = validateInput(data, [
    { field: 'fullName',        required: false, maxLength: 100 },
    { field: 'className',       required: false, maxLength: 50  },
    { field: 'admissionNumber', required: false, maxLength: 30  },
    { field: 'gender',          required: false, maxLength: 10  },
    { field: 'school',          required: false, maxLength: 100 }
  ]);
  if (!v.valid) return { success: false, message: v.message };
  var oldStudent = getStudentById(studentId);
  if (!oldStudent) return { success: false, message: 'Student not found.' };
  var oldParentId = oldStudent.parentId || '';
  var updates = {};
  if (data.fullName        !== undefined) updates.fullName        = data.fullName.trim();
  if (data.admissionNumber !== undefined) updates.admissionNumber = data.admissionNumber;
  if (data.className       !== undefined) updates.className       = data.className.trim();
  if (data.section         !== undefined) updates.section         = data.section;
  if (data.school          !== undefined) updates.school          = data.school;
  if (data.parentId        !== undefined) updates.parentId        = data.parentId;
  if (data.gender          !== undefined) updates.gender          = data.gender;
  if (data.dateOfBirth     !== undefined) updates.dateOfBirth     = data.dateOfBirth;
  if (data.photoUrl        !== undefined) updates.photoUrl        = data.photoUrl;
  if (data.status          !== undefined) updates.status          = data.status;
  firebasePatch('students', studentId, updates);
  if (data.parentId !== undefined && String(data.parentId) !== String(oldParentId)) {
    if (oldParentId) _syncParentChildLink(studentId, oldParentId, true);
    if (data.parentId) _syncParentChildLink(studentId, data.parentId);
  }
  return { success: true, message: 'Student updated.' };
}

function deleteStudent(studentId) {
  firebaseDelete('students', studentId);
  return { success: true, message: 'Student deleted.' };
}

function getStudentsByClass(className) {
  return firebaseQuery('students', [
    { field: 'className', op: 'EQUAL', value: className },
    { field: 'status',    op: 'EQUAL', value: 'active' }
  ]);
}

// --- CLASSES -------------------------------------------------

function getAllClasses() {
  var classes = firebaseCached('classes', 3600);
  var type = getSettings().institution_type || 'both';
  if (type === 'primary')   return classes.filter(function(c) { return String(c.section).toLowerCase() === 'primary'; });
  if (type === 'secondary') return classes.filter(function(c) { return String(c.section).toLowerCase() === 'high'; });
  return classes;
}

function createClass(data) {
  if (!data.className) return { success: false, message: 'Class name required.' };
  var id = generateId();
  firebaseSet('classes', id, { id: id, className: data.className.trim(), section: data.section || 'high',
    school: data.school || '', classTeacherId: data.classTeacherId || '', academicSession: data.academicSession || '' });
  clearFirebaseCache('classes');
  return { success: true, id: id, message: 'Class created.' };
}

function updateClass(classId, data) {
  var updates = {};
  if (data.className       !== undefined) updates.className       = data.className.trim();
  if (data.section         !== undefined) updates.section         = data.section;
  if (data.school          !== undefined) updates.school          = data.school;
  if (data.classTeacherId  !== undefined) updates.classTeacherId  = data.classTeacherId;
  if (data.academicSession !== undefined) updates.academicSession = data.academicSession;
  firebasePatch('classes', classId, updates);
  clearFirebaseCache('classes');
  return { success: true, message: 'Class updated.' };
}

function deleteClass(classId) {
  firebaseDelete('classes', classId);
  clearFirebaseCache('classes');
  return { success: true, message: 'Class deleted.' };
}

function bulkCreateClasses(classes) {
  var writes = [], count = 0;
  for (var i = 0; i < classes.length; i++) {
    var d = classes[i];
    if (!d.ClassName && !d.className) continue;
    var id = generateId();
    writes.push({ type: 'set', collection: 'classes', docId: id, data: {
      id: id, className: String(d.ClassName || d.className || '').trim(),
      section: String(d.Section || d.section || 'high').toLowerCase().trim(),
      school: '', classTeacherId: '',
      academicSession: String(d.AcademicSession || d.academicSession || '').trim()
    }});
    count++;
    if (writes.length === 499) { firebaseBatchWrite(writes); writes = []; }
  }
  if (writes.length > 0) firebaseBatchWrite(writes);
  clearFirebaseCache('classes');
  logAudit('system', 'BULK_CREATE_CLASSES', 'Imported ' + count + ' classes');
  return { success: true, message: count + ' classes imported successfully.' };
}

// --- SUBJECTS ------------------------------------------------

function getAllSubjects() {
  var subjects = firebaseCached('subjects', 3600);
  var type = getSettings().institution_type || 'both';
  if (type === 'primary')   return subjects.filter(function(s) { return String(s.section).toLowerCase() === 'primary'; });
  if (type === 'secondary') return subjects.filter(function(s) { return String(s.section).toLowerCase() === 'high'; });
  return subjects;
}

function getSubjectById(subjectId) { return firebaseGet('subjects', String(subjectId)); }

function createSubject(data) {
  if (!data.subjectName) return { success: false, message: 'Subject name required.' };
  var id = generateId();
  firebaseSet('subjects', id, { id: id, subjectName: data.subjectName.trim(),
    section: data.section || 'high', className: data.className || '', assignedTeacherId: data.assignedTeacherId || '' });
  clearFirebaseCache('subjects');
  return { success: true, id: id, message: 'Subject created.' };
}

function updateSubject(subjectId, data) {
  var updates = {};
  if (data.subjectName !== undefined) updates.subjectName = data.subjectName.trim();
  if (data.section     !== undefined) updates.section     = data.section;
  var cls = data.className !== undefined ? data.className : data.class;
  if (cls !== undefined) updates.className = cls;
  if (data.assignedTeacherId !== undefined) updates.assignedTeacherId = data.assignedTeacherId;
  firebasePatch('subjects', subjectId, updates);
  clearFirebaseCache('subjects');
  return { success: true, message: 'Subject updated.' };
}

function deleteSubject(subjectId) {
  firebaseDelete('subjects', subjectId); clearFirebaseCache('subjects');
  return { success: true, message: 'Subject deleted.' };
}

function getTeacherSubjects(teacherUserId) {
  return firebaseQuery('subjects', [{ field: 'assignedTeacherId', op: 'EQUAL', value: String(teacherUserId) }]);
}

function assignSubjectsToTeacher(teacherUserId, subjectIds) {
  var all = getAllSubjects(), writes = [];
  all.forEach(function(s) {
    var curT = String(s.assignedTeacherId || '');
    var shouldAssign = subjectIds.indexOf(s.id) !== -1;
    if (curT === String(teacherUserId) && !shouldAssign)
      writes.push({ type: 'patch', collection: 'subjects', docId: s.id, data: { assignedTeacherId: '' } });
    else if (shouldAssign)
      writes.push({ type: 'patch', collection: 'subjects', docId: s.id, data: { assignedTeacherId: teacherUserId } });
  });
  if (writes.length > 0) firebaseBatchWrite(writes);
  clearFirebaseCache('subjects');
  return { success: true, message: subjectIds.length + ' subject(s) assigned.' };
}

function bulkCreateSubjects(subjects) {
  var writes = [], count = 0;
  for (var i = 0; i < subjects.length; i++) {
    var d = subjects[i];
    if (!d.SubjectName && !d.subjectName) continue;
    var sec = String(d.Section || d.section || 'high').toLowerCase().trim();
    if (sec === 'high school') sec = 'high';
    if (sec === 'primary school') sec = 'primary';
    var id = generateId();
    writes.push({ type: 'set', collection: 'subjects', docId: id, data: {
      id: id, subjectName: String(d.SubjectName || d.subjectName || '').trim(),
      section: sec, className: String(d.TargetClass || d.className || '').trim(), assignedTeacherId: ''
    }});
    count++;
    if (writes.length === 499) { firebaseBatchWrite(writes); writes = []; }
  }
  if (writes.length > 0) firebaseBatchWrite(writes);
  clearFirebaseCache('subjects');
  logAudit('system', 'BULK_CREATE_SUBJECTS', 'Imported ' + count + ' subjects');
  return { success: true, message: count + ' subjects imported successfully.' };
}

// --- ENROLLMENTS ---------------------------------------------

function getEnrollments(filters) {
  var rows;
  if (filters && filters.studentId && !filters.subjectId) {
    rows = firebaseQuery('enrollments', [{ field: 'studentId', op: 'EQUAL', value: String(filters.studentId) }]);
  } else if (filters && filters.subjectId && !filters.studentId) {
    rows = firebaseQuery('enrollments', [{ field: 'subjectId', op: 'EQUAL', value: String(filters.subjectId) }]);
  } else { rows = firebaseGetAll('enrollments'); }
  if (!filters) return rows;
  return rows.filter(function(r) {
    if (filters.studentId && String(r.studentId) !== String(filters.studentId)) return false;
    if (filters.subjectId && String(r.subjectId) !== String(filters.subjectId)) return false;
    if (filters.className && String(r.className)  !== String(filters.className)) return false;
    return true;
  });
}

function enrollStudent(studentId, subjectId, session, term) {
  var existing = firebaseQuery('enrollments', [
    { field: 'studentId', op: 'EQUAL', value: String(studentId) },
    { field: 'subjectId', op: 'EQUAL', value: String(subjectId) },
    { field: 'session',   op: 'EQUAL', value: String(session) }
  ]);
  if (existing && existing.length > 0) return { success: false, message: 'Already enrolled.' };
  var id = generateId();
  firebaseSet('enrollments', id, { id: id, studentId: studentId, subjectId: subjectId, session: session, term: term || '' });
  return { success: true, message: 'Student enrolled.' };
}

function unenrollStudent(studentId, subjectId, session) {
  var existing = firebaseQuery('enrollments', [
    { field: 'studentId', op: 'EQUAL', value: String(studentId) },
    { field: 'subjectId', op: 'EQUAL', value: String(subjectId) },
    { field: 'session',   op: 'EQUAL', value: String(session) }
  ]);
  if (!existing || existing.length === 0) return { success: false, message: 'Enrollment not found.' };
  firebaseDelete('enrollments', existing[0].id);
  return { success: true, message: 'Unenrolled.' };
}

function getSubjectStudents(subjectId, session) {
  var enrollments = getEnrollments({ subjectId: subjectId });
  if (session) enrollments = enrollments.filter(function(e) { return String(e.session) === String(session); });
  var students = getAllStudents();
  return enrollments.map(function(e) {
    return students.find(function(s) { return String(s.id) === String(e.studentId); }) || null;
  }).filter(Boolean);
}

function getStudentSubjects(studentId, session) {
  var enrollments = getEnrollments({ studentId: studentId });
  if (session) enrollments = enrollments.filter(function(e) { return String(e.session) === String(session); });
  var subjects = getAllSubjects();
  return enrollments.map(function(e) {
    return subjects.find(function(s) { return String(s.id) === String(e.subjectId); }) || null;
  }).filter(Boolean);
}

// --- ASSESSMENTS (SCORES) ------------------------------------

function getScores(filters) {
  var scores;
  if (filters) {
    var qf = [];
    if (filters.studentId) qf.push({ field: 'studentId', op: 'EQUAL', value: String(filters.studentId) });
    if (filters.term)      qf.push({ field: 'term',      op: 'EQUAL', value: String(filters.term) });
    if (filters.session)   qf.push({ field: 'session',   op: 'EQUAL', value: String(filters.session) });
    scores = qf.length > 0 ? firebaseQuery('assessments', qf) : firebaseGetAll('assessments');
    scores = scores.filter(function(s) {
      if (filters.subjectId && String(s.subjectId) !== String(filters.subjectId)) return false;
      if (filters.className && String(s.className)  !== String(filters.className)) return false;
      return true;
    });
  } else { scores = firebaseGetAll('assessments'); }
  var students = getAllStudents(), subjects = getAllSubjects();
  var sMap = {}, subMap = {};
  students.forEach(function(s) { sMap[s.id] = s.fullName; });
  subjects.forEach(function(s) { subMap[s.id] = s.subjectName; });
  return scores.map(function(s) {
    s.studentName = s.studentName || sMap[s.studentId] || s.studentId;
    s.subjectName = s.subjectName || subMap[s.subjectId] || s.subjectId;
    return s;
  });
}

function saveScore(data) {
  var existing = firebaseQuery('assessments', [
    { field: 'studentId', op: 'EQUAL', value: String(data.studentId) },
    { field: 'subjectId', op: 'EQUAL', value: String(data.subjectId) },
    { field: 'term',      op: 'EQUAL', value: String(data.term) },
    { field: 'session',   op: 'EQUAL', value: String(data.session) }
  ]);
  if (existing && existing.length > 0) {
    var locked = existing[0].locked;
    if (String(locked) === 'true' || locked === true) return { success: false, message: 'Scores are locked.' };
  }
  var ca1 = safeFloat(data.ca1,0), ca2 = safeFloat(data.ca2,0), ca3 = safeFloat(data.ca3,0), exam = safeFloat(data.exam,0);
  if (ca1<0||ca1>10) return { success: false, message: 'CA1 must be 0-10.' };
  if (ca2<0||ca2>10) return { success: false, message: 'CA2 must be 0-10.' };
  if (ca3<0||ca3>10) return { success: false, message: 'CA3 must be 0-10.' };
  if (exam<0||exam>70) return { success: false, message: 'Exam must be 0-70.' };
  var total = computeTotal(ca1,ca2,ca3,exam), grade = computeGrade(total);
  var student = getStudentById(data.studentId);
  var studentName = student ? student.fullName : '';
  var className   = student ? (student.className || '') : (data.className || '');
  if (existing && existing.length > 0) {
    firebasePatch('assessments', existing[0].id, {
      studentName: studentName, ca1: ca1, ca2: ca2, ca3: ca3, exam: exam, total: total, grade: grade,
      teacherComment: data.teacherComment !== undefined ? data.teacherComment : (existing[0].teacherComment || '')
    });
    return { success: true, message: 'Score updated.', total: total, grade: grade };
  }
  var id = generateId();
  firebaseSet('assessments', id, {
    id: id, studentId: data.studentId, studentName: studentName, subjectId: data.subjectId,
    className: className, term: data.term, session: data.session,
    ca1: ca1, ca2: ca2, ca3: ca3, exam: exam, total: total, grade: grade,
    bonus: 0, teacherComment: data.teacherComment || '', locked: 'false', published: 'false'
  });
  return { success: true, message: 'Score saved.', total: total, grade: grade };
}

function lockScores(filters) {
  var scores = getScores(filters);
  var writes = scores.map(function(s) { return { type:'patch', collection:'assessments', docId:s.id, data:{locked:'true'} }; });
  if (writes.length > 0) firebaseBatchWrite(writes);
  return { success: true, message: writes.length + ' score(s) locked.' };
}

function unlockScores(filters) {
  var scores = getScores(filters);
  var writes = scores.map(function(s) { return { type:'patch', collection:'assessments', docId:s.id, data:{locked:'false'} }; });
  if (writes.length > 0) firebaseBatchWrite(writes);
  return { success: true, message: writes.length + ' score(s) unlocked.' };
}

function bulkSaveScores(scoresArray) {
  var count = 0, errs = 0;
  for (var i = 0; i < scoresArray.length; i++) {
    var res = saveScore(scoresArray[i]);
    if (res.success) count++; else errs++;
  }
  logAudit('system','BULK_SAVE_SCORES','Saved '+count+' scores, '+errs+' errors');
  return { success: true, message: count+' scores saved.'+(errs>0?' ('+errs+' skipped/locked)':'') };
}

// --- PSYCHOMOTOR & AFFECTIVE ---------------------------------

function savePsychomotorRecord(data) {
  var existing = firebaseQuery('psychomotorRecords', [
    { field:'studentId', op:'EQUAL', value:String(data.studentId) },
    { field:'term',      op:'EQUAL', value:String(data.term) },
    { field:'session',   op:'EQUAL', value:String(data.session) }
  ]);
  var doc = { studentId:data.studentId, className:data.className||'', term:data.term, session:data.session,
    handwriting:data.handwriting||'', sportSkills:data.sportSkills||'', drawing:data.drawing||'',
    creativity:data.creativity||'', speaking:data.speaking||'', attentiveness:data.attentiveness||'' };
  if (existing && existing.length>0) { firebasePatch('psychomotorRecords', existing[0].id, doc); return { success:true, message:'Psychomotor record updated.' }; }
  var id=generateId(); doc.id=id; firebaseSet('psychomotorRecords',id,doc);
  return { success:true, message:'Psychomotor record saved.' };
}

function saveAffectiveRecord(data) {
  var existing = firebaseQuery('affectiveRecords', [
    { field:'studentId', op:'EQUAL', value:String(data.studentId) },
    { field:'term',      op:'EQUAL', value:String(data.term) },
    { field:'session',   op:'EQUAL', value:String(data.session) }
  ]);
  var doc = { studentId:data.studentId, className:data.className||'', term:data.term, session:data.session,
    punctuality:data.punctuality||'', neatness:data.neatness||'', politeness:data.politeness||'',
    honesty:data.honesty||'', leadership:data.leadership||'', cooperation:data.cooperation||'' };
  if (existing && existing.length>0) { firebasePatch('affectiveRecords', existing[0].id, doc); return { success:true, message:'Affective record updated.' }; }
  var id=generateId(); doc.id=id; firebaseSet('affectiveRecords',id,doc);
  return { success:true, message:'Affective record saved.' };
}

function getPsychomotorRecord(studentId, term, session) {
  var r = firebaseQuery('psychomotorRecords', [
    {field:'studentId',op:'EQUAL',value:String(studentId)},{field:'term',op:'EQUAL',value:String(term)},{field:'session',op:'EQUAL',value:String(session)}
  ]);
  return r && r.length>0 ? r[0] : null;
}

function getAffectiveRecord(studentId, term, session) {
  var r = firebaseQuery('affectiveRecords', [
    {field:'studentId',op:'EQUAL',value:String(studentId)},{field:'term',op:'EQUAL',value:String(term)},{field:'session',op:'EQUAL',value:String(session)}
  ]);
  return r && r.length>0 ? r[0] : null;
}

// --- SETTINGS ------------------------------------------------

function getSettings() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('FB_Settings');
  if (cached) { try { return JSON.parse(cached); } catch(e) {} }
  var doc = firebaseGet('settings','config');
  var settings = doc || {};
  try { cache.put('FB_Settings', JSON.stringify(settings), 21600); } catch(e) {}
  return settings;
}

function updateSettings(newSettings) {
  var current = getSettings(), merged = {};
  for (var k in current)     { if (current.hasOwnProperty(k))     merged[k] = current[k]; }
  for (var k2 in newSettings) { if (newSettings.hasOwnProperty(k2)) merged[k2] = newSettings[k2]; }
  firebaseSet('settings','config',merged);
  try { CacheService.getScriptCache().remove('FB_Settings'); } catch(e) {}
  return { success:true, message:'Settings updated successfully.' };
}

function updateGradingRule(data) {
  var id = data.id || generateId();
  firebaseSet('grading', id, { id:id, grade:data.grade, min:data.min, max:data.max, remark:data.remark||'' });
  clearFirebaseCache('grading');
  return { success:true, message: data.id ? 'Rule updated.' : 'Rule created.' };
}

// --- PARENT HELPERS ------------------------------------------

function _syncParentChildLink(studentId, parentUserId, isRemoval) {
  try {
    var parent = firebaseGet('users', parentUserId);
    if (!parent) return;
    var ids = parent.linkedStudentIds ? String(parent.linkedStudentIds).split(',').map(function(s){return s.trim();}).filter(Boolean) : [];
    var idx = ids.indexOf(String(studentId));
    if (isRemoval) { if (idx!==-1) ids.splice(idx,1); } else { if (idx===-1) ids.push(String(studentId)); }
    firebasePatch('users', parentUserId, { linkedStudentIds: ids.join(',') });
  } catch(e) { Logger.log('_syncParentChildLink error: ' + e.message); }
}

function getParentChildren(parentUserId) {
  var user = firebaseGet('users', parentUserId);
  if (!user || !user.linkedStudentIds) return [];
  return String(user.linkedStudentIds).split(',').filter(Boolean).map(function(id) { return getStudentById(id.trim()); }).filter(Boolean);
}

function getStudentResult(studentId, term, session) {
  var student = getStudentById(studentId);
  if (!student) return { success:false, message:'Student not found.' };
  var scores = getScores({ studentId:studentId, term:term, session:session });
  var totalSum = 0;
  scores.forEach(function(s) { totalSum += safeFloat(s.total,0); });
  var avg = scores.length>0 ? Math.round((totalSum/scores.length)*10)/10 : 0;
  return { success:true, student:student, scores:scores,
    summary:{ totalSubjects:scores.length, totalScore:totalSum, average:avg, overallGrade:computeGrade(avg) } };
}

// --- ADMIN STATS & PENDING TASKS -----------------------------

function getAdminStats(section) {
  var users = firebaseGetAll('users'), students = firebaseGetAll('students');
  var classes = getAllClasses(), subjects = getAllSubjects();
  if (section && section!=='both') {
    users    = users.filter(function(u) { return u.section===section||u.section==='both'; });
    students = students.filter(function(s) { return s.section===section; });
  }
  var staffRoles = ['admin','admin_assistant','principal','vp','headteacher','teacher','primary_teacher','accounts'];
  var totalStaff = users.filter(function(u) { return staffRoles.indexOf(u.role)!==-1; }).length;
  return { users:totalStaff,
    students:students.filter(function(s) { return s.status!=='inactive'; }).length,
    classes:classes.length, subjects:subjects.length, totalStudents:students.length,
    totalUsers:users.length, totalStaff:totalStaff,
    totalTeachers:users.filter(function(u) { return u.role==='teacher'||u.role==='primary_teacher'; }).length,
    totalParents:users.filter(function(u) { return u.role==='parent'; }).length };
}

function logPendingTask(taskType, payload, requestedBy) {
  var id = generateId();
  firebaseSet('pendingAdminTasks', id, { id:id, taskType:taskType, payloadJSON:JSON.stringify(payload),
    requestedBy:requestedBy, status:'pending', createdAt:new Date().toISOString(), adminNotes:'' });
  logAudit(requestedBy,'PENDING_TASK_CREATED',taskType);
  return { success:true, message:'Request submitted for Admin approval.' };
}

function getPendingTasks() {
  var tasks = firebaseQuery('pendingAdminTasks',[{field:'status',op:'EQUAL',value:'pending'}]);
  var users = firebaseGetAll('users');
  return tasks.map(function(t) {
    try { t.payload = JSON.parse(t.payloadJSON); } catch(e) { t.payload = {}; }
    var req = users.find(function(u) { return String(u.id)===String(t.requestedBy); });
    t.requesterName = req ? req.fullName : 'Unknown';
    return t;
  });
}

function updatePendingTaskStatus(taskId, status, note, adminId) {
  firebasePatch('pendingAdminTasks', taskId, { status:status, adminNotes:note||'' });
  logAudit(adminId,'TASK_'+status.toUpperCase(),'Task ID: '+taskId);
  return { success:true, message:'Task '+status+'.' };
}

// --- SEED DATA -----------------------------------------------

function seedNigerianSubjects() {
  var primSubs = ['Mathematics','English Studies','Basic Science and Technology','Social Studies','Civic Education','Cultural and Creative Arts','Home Economics','Agricultural Science','Physical and Health Education','Computer Studies','Christian Religious Studies','Islamic Religious Studies','French Language','Yoruba Language','Igbo Language','Hausa Language'];
  var highSubs = ['Mathematics','English Language','Civic Education','Biology','Chemistry','Physics','Agricultural Science','Economics','Geography','Government','Literature-in-English','Christian Religious Studies','Islamic Religious Studies','Financial Accounting','Commerce','Further Mathematics','Technical Drawing','Data Processing','Computer Studies'];
  var existing = getAllSubjects();
  var keys = existing.map(function(s) { return String(s.subjectName||'').toLowerCase()+'||'+String(s.section||'').toLowerCase(); });
  var writes = [], count = 0;
  primSubs.forEach(function(n) { if (keys.indexOf(n.toLowerCase()+'||primary')===-1) { var id=generateId(); writes.push({type:'set',collection:'subjects',docId:id,data:{id:id,subjectName:n,section:'primary',className:'',assignedTeacherId:''}}); count++; } });
  highSubs.forEach(function(n) { if (keys.indexOf(n.toLowerCase()+'||high')===-1) { var id=generateId(); writes.push({type:'set',collection:'subjects',docId:id,data:{id:id,subjectName:n,section:'high',className:'',assignedTeacherId:''}}); count++; } });
  if (writes.length>0) firebaseBatchWrite(writes);
  clearFirebaseCache('subjects');
  return { success:true, message:count+' standard subjects added.' };
}

function seedNigerianClasses() {
  var primCls = ['Primary 1','Primary 2','Primary 3','Primary 4','Primary 5','Primary 6'];
  var highCls = ['JSS 1','JSS 2','JSS 3','SSS 1','SSS 2','SSS 3'];
  var existing = getAllClasses();
  var keys = existing.map(function(c) { return String(c.className||'').toLowerCase()+'||'+String(c.section||'').toLowerCase(); });
  var writes = [], count = 0;
  primCls.forEach(function(n) { if (keys.indexOf(n.toLowerCase()+'||primary')===-1) { var id=generateId(); writes.push({type:'set',collection:'classes',docId:id,data:{id:id,className:n,section:'primary',school:'',classTeacherId:'',academicSession:''}}); count++; } });
  highCls.forEach(function(n) { if (keys.indexOf(n.toLowerCase()+'||high')===-1) { var id=generateId(); writes.push({type:'set',collection:'classes',docId:id,data:{id:id,className:n,section:'high',school:'',classTeacherId:'',academicSession:''}}); count++; } });
  if (writes.length>0) firebaseBatchWrite(writes);
  clearFirebaseCache('classes');
  return { success:true, message:count+' standard classes added.' };
}
