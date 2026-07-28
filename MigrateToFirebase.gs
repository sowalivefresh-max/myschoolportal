/**
 * ============================================================
 *  MYSCHOOL PORTAL - MigrateToFirebase.gs
 *  One-time migration: Google Sheets -> Firestore
 * ============================================================
 *
 *  INSTRUCTIONS:
 *  1. Complete Firebase setup (Script Properties + service account)
 *  2. Run testFirebaseConnection() in Firebase.gs to confirm connection
 *  3. Run migrateAllData() from this file
 *  4. Verify data in Firebase Console
 *  5. After migration is confirmed OK, this file can be deleted
 *
 *  IMPORTANT: Migration is ADDITIVE and SAFE to re-run.
 *  It checks for existing Firestore docs before writing.
 *  For a clean start, delete collections in Firebase Console first.
 * ============================================================
 */

var _LEGACY_SS_ID = ''; // Paste your OLD Spreadsheet ID here before running

function _getLegacySheet(sheetName) {
  if (!_LEGACY_SS_ID) throw new Error('Set _LEGACY_SS_ID at the top of MigrateToFirebase.gs');
  return SpreadsheetApp.openById(_LEGACY_SS_ID).getSheetByName(sheetName);
}

function _getLegacyData(sheetName) {
  try {
    var sheet = _getLegacySheet(sheetName);
    if (!sheet) { Logger.log('Sheet not found: ' + sheetName); return []; }
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    var headers = data[0].map(function(h) { return String(h).trim(); });
    return data.slice(1).map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) { obj[h] = row[i]; });
      return obj;
    });
  } catch(e) {
    Logger.log('Error reading sheet ' + sheetName + ': ' + e.message);
    return [];
  }
}

// --- MAIN MIGRATION ------------------------------------------

/**
 * Master migration function. Calls each individual migrator in order.
 * Run this once. Review the log afterwards.
 */
function migrateAllData() {
  Logger.log('=== Firebase Migration Start ===');
  Logger.log('Time: ' + new Date().toISOString());

  var results = {};
  var steps = [
    ['Settings',         migrateSettings],
    ['Users',            migrateUsers],
    ['Students',         migrateStudents],
    ['Classes',          migrateClasses],
    ['Subjects',         migrateSubjects],
    ['Enrollments',      migrateEnrollments],
    ['Assessments',      migrateAssessments],
    ['Psychomotor',      migratePsychomotor],
    ['Affective',        migrateAffective],
    ['FeeStructure',     migrateFeeStructures],
    ['Bills',            migrateBills],
    ['Payments',         migratePayments],
    ['Expenses',         migrateExpenses],
    ['Attendance',       migrateAttendance],
    ['LessonPlans',      migrateLessonPlans]
  ];

  steps.forEach(function(step) {
    try {
      Logger.log('--- Migrating: ' + step[0] + ' ---');
      results[step[0]] = step[1]();
      Logger.log('  Done: ' + JSON.stringify(results[step[0]]));
    } catch(e) {
      Logger.log('  ERROR in ' + step[0] + ': ' + e.message);
      results[step[0]] = { error: e.message };
    }
  });

  Logger.log('=== Migration Complete ===');
  Logger.log(JSON.stringify(results));
  return results;
}

// --- INDIVIDUAL MIGRATORS -----------------------------------

function migrateSettings() {
  var rows = _getLegacyData('Settings');
  if (rows.length === 0) return { skipped: 'No settings sheet found.' };
  // Settings sheet: each row is key + value
  var settings = {};
  rows.forEach(function(row) {
    var key = row['Setting'] || row['Key'] || row['setting'] || row['key'];
    var val = row['Value'] || row['value'];
    if (key) settings[String(key).trim()] = val;
  });
  if (Object.keys(settings).length === 0) {
    Logger.log('Settings: No key-value rows found.');
    return { migrated: 0 };
  }
  firebaseSet('settings', 'config', settings);
  return { migrated: 1 };
}

function migrateUsers() {
  var rows = _getLegacyData('Users');
  var migrated = 0, skipped = 0;
  var writes = [];
  rows.forEach(function(r) {
    var id = String(r['iD'] || r['id'] || r['ID'] || '').trim();
    if (!id) { skipped++; return; }
    var doc = {
      id: id,
      fullName:         String(r['fullName'] || r['FullName'] || '').trim(),
      email:            String(r['email'] || r['Email'] || '').trim().toLowerCase(),
      passwordHash:     String(r['passwordHash'] || r['PasswordHash'] || ''),
      salt:             String(r['salt'] || r['PasswordSalt'] || ''),
      role:             String(r['role'] || r['Role'] || '').toLowerCase(),
      section:          String(r['section'] || r['Section'] || 'both'),
      status:           String(r['status'] || r['Status'] || 'active'),
      profilePicture:   String(r['profilePicture'] || r['ProfilePicture'] || ''),
      phone:            String(r['phone'] || r['Phone'] || ''),
      signature:        String(r['signature'] || r['Signature'] || ''),
      classAssigned:    String(r['classAssigned'] || r['ClassAssigned'] || ''),
      linkedStudentIds: String(r['linkedStudentIds'] || r['LinkedStudentIDs'] || ''),
      createdAt:        String(r['createdAt'] || r['CreatedAt'] || new Date().toISOString())
    };
    writes.push({ type: 'set', collection: 'users', docId: id, data: doc });
    migrated++;
    if (writes.length >= 499) { firebaseBatchWrite(writes); writes = []; }
  });
  if (writes.length > 0) firebaseBatchWrite(writes);
  return { migrated: migrated, skipped: skipped };
}

function migrateStudents() {
  var rows = _getLegacyData('Students');
  var migrated = 0, skipped = 0, writes = [];
  rows.forEach(function(r) {
    var id = String(r['iD'] || r['id'] || r['ID'] || '').trim();
    if (!id) { skipped++; return; }
    var doc = {
      id: id,
      fullName:        String(r['fullName']        || r['FullName']        || '').trim(),
      admissionNumber: String(r['admissionNumber'] || r['AdmissionNumber'] || '').trim(),
      className:       String(r['class']           || r['className']       || r['ClassName'] || '').trim(),
      section:         String(r['section']         || r['Section']         || 'high').toLowerCase().trim(),
      school:          String(r['school']          || ''),
      parentId:        String(r['parentId']        || ''),
      gender:          String(r['gender']          || r['Gender']          || ''),
      dateOfBirth:     String(r['dateOfBirth']     || r['DateOfBirth']     || ''),
      photoUrl:        String(r['photoUrl']        || r['photo']           || ''),
      enrolledAt:      String(r['enrolledAt']      || ''),
      status:          String(r['status']          || 'active')
    };
    writes.push({ type: 'set', collection: 'students', docId: id, data: doc });
    migrated++;
    if (writes.length >= 499) { firebaseBatchWrite(writes); writes = []; }
  });
  if (writes.length > 0) firebaseBatchWrite(writes);
  return { migrated: migrated, skipped: skipped };
}

function migrateClasses() {
  var rows = _getLegacyData('Classes');
  var migrated = 0, skipped = 0, writes = [];
  rows.forEach(function(r) {
    var id = String(r['iD'] || r['id'] || r['ID'] || '').trim();
    if (!id) { skipped++; return; }
    var doc = {
      id: id,
      className:       String(r['className']       || r['ClassName']       || '').trim(),
      section:         String(r['section']         || r['Section']         || 'high').toLowerCase().trim(),
      school:          String(r['school']          || r['School']          || ''),
      classTeacherId:  String(r['classTeacherId']  || r['ClassTeacherID']  || r['ClassTeacherId'] || ''),
      academicSession: String(r['academicSession'] || r['AcademicSession'] || '')
    };
    writes.push({ type: 'set', collection: 'classes', docId: id, data: doc });
    migrated++;
    if (writes.length >= 499) { firebaseBatchWrite(writes); writes = []; }
  });
  if (writes.length > 0) firebaseBatchWrite(writes);
  clearFirebaseCache('classes');
  return { migrated: migrated, skipped: skipped };
}

function migrateSubjects() {
  var rows = _getLegacyData('Subjects');
  var migrated = 0, skipped = 0, writes = [];
  rows.forEach(function(r) {
    var id = String(r['iD'] || r['id'] || r['ID'] || '').trim();
    if (!id) { skipped++; return; }
    var doc = {
      id: id,
      subjectName:       String(r['subjectName']       || r['SubjectName']       || '').trim(),
      section:           String(r['section']           || r['Section']           || 'high').toLowerCase().trim(),
      // Old sheet used column 'Class' not 'ClassName' or 'TargetClass'
      className:         String(r['className']         || r['ClassName']         || r['Class'] || r['TargetClass'] || ''),
      assignedTeacherId: String(r['assignedTeacherId'] || r['AssignedTeacherID'] || r['AssignedTeacherId'] || '')
    };
    writes.push({ type: 'set', collection: 'subjects', docId: id, data: doc });
    migrated++;
    if (writes.length >= 499) { firebaseBatchWrite(writes); writes = []; }
  });
  if (writes.length > 0) firebaseBatchWrite(writes);
  clearFirebaseCache('subjects');
  return { migrated: migrated, skipped: skipped };
}

function migrateEnrollments() {
  var rows = _getLegacyData('Enrollments');
  // Old sheet columns: StudentID, SubjectID, Session, Term
  var migrated = 0, skipped = 0, writes = [];
  rows.forEach(function(r) {
    var id = String(r['iD'] || r['id'] || r['ID'] || '').trim();
    if (!id) { skipped++; return; }
    var doc = {
      id: id,
      studentId: String(r['studentId'] || r['StudentID'] || r['studentID'] || ''),
      subjectId: String(r['subjectId'] || r['SubjectID'] || r['subjectID'] || ''),
      session:   String(r['session']   || r['Session']   || ''),
      term:      String(r['term']      || r['Term']      || '')
    };
    writes.push({ type: 'set', collection: 'enrollments', docId: id, data: doc });
    migrated++;
    if (writes.length >= 499) { firebaseBatchWrite(writes); writes = []; }
  });
  if (writes.length > 0) firebaseBatchWrite(writes);
  return { migrated: migrated, skipped: skipped };
}

function migrateAssessments() {
  var rows = _getLegacyData('Assessments');
  // Old sheet columns (PascalCase): ID, StudentID, StudentName, SubjectID, Class,
  // Term, Session, CA1, CA2, CA3, Exam, Total, Grade, Position, TeacherComment, Locked, Submitted
  var migrated = 0, skipped = 0, writes = [];
  rows.forEach(function(r) {
    var id = String(r['iD'] || r['id'] || r['ID'] || '').trim();
    if (!id) { skipped++; return; }
    var doc = {
      id:             id,
      studentId:      String(r['studentId']      || r['StudentID']      || r['studentID']      || ''),
      studentName:    String(r['studentName']    || r['StudentName']    || ''),
      subjectId:      String(r['subjectId']      || r['SubjectID']      || r['subjectID']      || ''),
      subjectName:    String(r['subjectName']    || r['SubjectName']    || ''),
      className:      String(r['className']      || r['ClassName']      || r['Class']          || r['class'] || ''),
      term:           String(r['term']           || r['Term']           || ''),
      session:        String(r['session']        || r['Session']        || ''),
      ca1:   Number(r['ca1']   || r['CA1']   || 0),
      ca2:   Number(r['ca2']   || r['CA2']   || 0),
      ca3:   Number(r['ca3']   || r['CA3']   || 0),
      exam:  Number(r['exam']  || r['Exam']  || 0),
      total: Number(r['total'] || r['Total'] || 0),
      grade:          String(r['grade']          || r['Grade']          || ''),
      position:       Number(r['position']       || r['Position']       || 0),
      bonus:          Number(r['bonus']          || r['Bonus']          || 0),
      teacherComment: String(r['teacherComment'] || r['TeacherComment'] || ''),
      locked:         String(r['locked']         || r['Locked']         || 'false'),
      submitted:      String(r['submitted']      || r['Submitted']      || 'false')
    };
    writes.push({ type: 'set', collection: 'assessments', docId: id, data: doc });
    migrated++;
    if (writes.length >= 499) { firebaseBatchWrite(writes); writes = []; }
  });
  if (writes.length > 0) firebaseBatchWrite(writes);
  return { migrated: migrated, skipped: skipped };
}

function migratePsychomotor() {
  var rows = _getLegacyData('PsychomotorRecords');
  // Old sheet columns: ID, StudentID, Class, Term, Session, Handwriting, SportSkills,
  // Drawing, Creativity, Speaking, Attentiveness
  var migrated = 0, skipped = 0, writes = [];
  rows.forEach(function(r) {
    var id = String(r['iD'] || r['id'] || r['ID'] || '').trim();
    if (!id) { skipped++; return; }
    var doc = {
      id:            id,
      studentId:     String(r['studentId']    || r['StudentID']     || r['studentID']     || ''),
      className:     String(r['className']    || r['ClassName']     || r['Class']         || ''),
      term:          String(r['term']         || r['Term']          || ''),
      session:       String(r['session']      || r['Session']       || ''),
      handwriting:   String(r['handwriting']  || r['Handwriting']   || ''),
      sportSkills:   String(r['sportSkills']  || r['SportSkills']   || ''),
      drawing:       String(r['drawing']      || r['Drawing']       || ''),
      creativity:    String(r['creativity']   || r['Creativity']    || ''),
      speaking:      String(r['speaking']     || r['Speaking']      || ''),
      attentiveness: String(r['attentiveness']|| r['Attentiveness'] || '')
    };
    writes.push({ type: 'set', collection: 'psychomotorRecords', docId: id, data: doc });
    migrated++;
    if (writes.length >= 499) { firebaseBatchWrite(writes); writes = []; }
  });
  if (writes.length > 0) firebaseBatchWrite(writes);
  return { migrated: migrated, skipped: skipped };
}

function migrateAffective() {
  var rows = _getLegacyData('AffectiveRecords');
  // Old sheet columns: ID, StudentID, Class, Term, Session, Punctuality, Neatness,
  // Politeness, Honesty, Leadership, Cooperation
  var migrated = 0, skipped = 0, writes = [];
  rows.forEach(function(r) {
    var id = String(r['iD'] || r['id'] || r['ID'] || '').trim();
    if (!id) { skipped++; return; }
    var doc = {
      id:          id,
      studentId:   String(r['studentId']   || r['StudentID']   || r['studentID']   || ''),
      className:   String(r['className']   || r['ClassName']   || r['Class']       || ''),
      term:        String(r['term']        || r['Term']        || ''),
      session:     String(r['session']     || r['Session']     || ''),
      punctuality: String(r['punctuality'] || r['Punctuality'] || ''),
      neatness:    String(r['neatness']    || r['Neatness']    || ''),
      politeness:  String(r['politeness']  || r['Politeness']  || ''),
      honesty:     String(r['honesty']     || r['Honesty']     || ''),
      leadership:  String(r['leadership']  || r['Leadership']  || ''),
      cooperation: String(r['cooperation'] || r['Cooperation'] || '')
    };
    writes.push({ type: 'set', collection: 'affectiveRecords', docId: id, data: doc });
    migrated++;
    if (writes.length >= 499) { firebaseBatchWrite(writes); writes = []; }
  });
  if (writes.length > 0) firebaseBatchWrite(writes);
  return { migrated: migrated, skipped: skipped };
}

function migrateFeeStructures() {
  var rows = _getLegacyData('FeeStructure');
  var migrated = 0, skipped = 0, writes = [];
  rows.forEach(function(r) {
    var id = String(r['iD'] || r['id'] || r['ID'] || '').trim();
    if (!id) { skipped++; return; }
    var lineItems = [];
    try { lineItems = JSON.parse(String(r['lineItems'] || '[]')); } catch(e) { lineItems = []; }
    var doc = { id: id, className: String(r['className'] || ''), section: String(r['section'] || ''),
      term: String(r['term'] || ''), session: String(r['session'] || ''),
      totalAmount: Number(r['totalFee'] || r['totalAmount'] || 0), lineItems: lineItems };
    writes.push({ type: 'set', collection: 'feeStructure', docId: id, data: doc });
    migrated++;
    if (writes.length >= 499) { firebaseBatchWrite(writes); writes = []; }
  });
  if (writes.length > 0) firebaseBatchWrite(writes);
  return { migrated: migrated, skipped: skipped };
}

function migrateBills() {
  var rows = _getLegacyData('Bills');
  var migrated = 0, skipped = 0, writes = [];
  rows.forEach(function(r) {
    var id = String(r['iD'] || r['id'] || r['ID'] || '').trim();
    if (!id) { skipped++; return; }
    var doc = { id: id, studentId: String(r['studentID'] || r['studentId'] || ''),
      studentName: String(r['studentName'] || ''), className: String(r['class'] || r['className'] || ''),
      term: String(r['term'] || ''), session: String(r['session'] || ''),
      totalBilled: Number(r['totalBilled'] || 0), totalPaid: Number(r['totalPaid'] || 0),
      balance: Number(r['balance'] || 0), status: String(r['status'] || 'Outstanding'),
      createdAt: String(r['createdAt'] || '') };
    writes.push({ type: 'set', collection: 'bills', docId: id, data: doc });
    migrated++;
    if (writes.length >= 499) { firebaseBatchWrite(writes); writes = []; }
  });
  if (writes.length > 0) firebaseBatchWrite(writes);
  return { migrated: migrated, skipped: skipped };
}

function migratePayments() {
  var rows = _getLegacyData('Payments');
  var migrated = 0, skipped = 0, writes = [];
  rows.forEach(function(r) {
    var id = String(r['iD'] || r['id'] || r['ID'] || '').trim();
    if (!id) { skipped++; return; }
    var doc = { id: id, billId: String(r['billId'] || r['billID'] || ''),
      studentId: String(r['studentID'] || r['studentId'] || ''),
      term: String(r['term'] || ''), session: String(r['session'] || ''),
      amount: Number(r['amount'] || 0), date: String(r['date'] || ''),
      method: String(r['method'] || 'Cash'), receiptRef: String(r['receiptRef'] || r['receiptReference'] || ''),
      recordedBy: String(r['recordedBy'] || ''), emailSent: String(r['emailSent'] || 'false'),
      status: String(r['status'] || 'Approved'), receiptUrl: String(r['receiptUrl'] || r['receiptURL'] || '') };
    writes.push({ type: 'set', collection: 'payments', docId: id, data: doc });
    migrated++;
    if (writes.length >= 499) { firebaseBatchWrite(writes); writes = []; }
  });
  if (writes.length > 0) firebaseBatchWrite(writes);
  return { migrated: migrated, skipped: skipped };
}

function migrateExpenses() {
  var rows = _getLegacyData('Expenses');
  var migrated = 0, skipped = 0, writes = [];
  rows.forEach(function(r) {
    var id = String(r['iD'] || r['id'] || r['ID'] || '').trim();
    if (!id) { skipped++; return; }
    var doc = { id: id, category: String(r['category'] || ''), description: String(r['description'] || ''),
      amount: Number(r['amount'] || 0), date: String(r['date'] || ''),
      recordedBy: String(r['recordedBy'] || ''), section: String(r['section'] || 'both'), receiptUrl: '' };
    writes.push({ type: 'set', collection: 'expenses', docId: id, data: doc });
    migrated++;
    if (writes.length >= 499) { firebaseBatchWrite(writes); writes = []; }
  });
  if (writes.length > 0) firebaseBatchWrite(writes);
  return { migrated: migrated, skipped: skipped };
}

function migrateAttendance() {
  var rows = _getLegacyData('Attendance');
  var migrated = 0, skipped = 0, writes = [];
  rows.forEach(function(r) {
    var id = String(r['iD'] || r['id'] || r['ID'] || '').trim();
    if (!id) { skipped++; return; }
    var doc = { id: id, studentId: String(r['studentId'] || r['studentID'] || ''),
      className: String(r['className'] || r['class'] || ''), date: String(r['date'] || ''),
      status: String(r['status'] || 'Present'), markedBy: String(r['markedBy'] || ''),
      session: String(r['session'] || ''), term: String(r['term'] || '') };
    writes.push({ type: 'set', collection: 'attendance', docId: id, data: doc });
    migrated++;
    if (writes.length >= 499) { firebaseBatchWrite(writes); writes = []; }
  });
  if (writes.length > 0) firebaseBatchWrite(writes);
  return { migrated: migrated, skipped: skipped };
}

function migrateLessonPlans() {
  var rows = _getLegacyData('LessonPlans');
  // Old sheet columns (PascalCase): ID, TeacherID, SubjectID, Class, Topic,
  // Objectives, TeachingAids, EntryBehaviour, PresentationSteps, Evaluation,
  // Assignment, Week, Term, Session, Status, ApprovedByID, ApprovalNote, CreatedAt
  var migrated = 0, skipped = 0, writes = [];
  rows.forEach(function(r) {
    var id = String(r['iD'] || r['id'] || r['ID'] || '').trim();
    if (!id) { skipped++; return; }
    var doc = {
      id:                id,
      teacherId:         String(r['teacherId']         || r['TeacherID']         || r['TeacherId']         || ''),
      subjectId:         String(r['subjectId']         || r['SubjectID']         || r['SubjectId']         || ''),
      className:         String(r['className']         || r['ClassName']         || r['Class']             || ''),
      topic:             String(r['topic']             || r['Topic']             || ''),
      objectives:        String(r['objectives']        || r['Objectives']        || ''),
      teachingAids:      String(r['teachingAids']      || r['TeachingAids']      || ''),
      entryBehaviour:    String(r['entryBehaviour']    || r['EntryBehaviour']    || ''),
      presentationSteps: String(r['presentationSteps'] || r['PresentationSteps'] || ''),
      evaluation:        String(r['evaluation']        || r['Evaluation']        || ''),
      assignment:        String(r['assignment']        || r['Assignment']        || ''),
      week:              String(r['week']              || r['Week']              || ''),
      term:              String(r['term']              || r['Term']              || ''),
      session:           String(r['session']           || r['Session']           || ''),
      status:            String(r['status']            || r['Status']           || 'draft'),
      approverId:        String(r['approverId']        || r['ApprovedByID']      || r['ApprovedById']      || ''),
      approverNote:      String(r['approverNote']      || r['ApprovalNote']      || ''),
      createdAt:         String(r['createdAt']         || r['CreatedAt']         || ''),
      referenceBook:     String(r['referenceBook']     || r['ReferenceBook']     || '')
    };
    writes.push({ type: 'set', collection: 'lessonPlans', docId: id, data: doc });
    migrated++;
    if (writes.length >= 499) { firebaseBatchWrite(writes); writes = []; }
  });
  if (writes.length > 0) firebaseBatchWrite(writes);
  return { migrated: migrated, skipped: skipped };
}
