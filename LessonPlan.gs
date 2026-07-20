/**
 * ABECEDARIAN ACADEMY - LessonPlan.gs
 * Lesson plan creation, submission, and approval workflow.
 */

function createLessonPlan(teacherId, data) {
  if (!data.subjectId || !data.topic || !data.className)
    return { success: false, message: 'Subject, class, and topic required.' };
  var sheet = getSpreadsheet().getSheetByName('LessonPlans');
  var id = generateId();
  sheet.appendRow([id, teacherId, data.subjectId, data.className,
    data.topic || '', data.objectives || '', data.teachingAids || '',
    data.entryBehaviour || '', data.presentationSteps || '',
    data.evaluation || '', data.assignment || '',
    data.week || '', data.term || '', data.session || '',
    'draft', '', '', new Date().toISOString(), data.referenceBook || '']);
  logAudit(teacherId, 'CREATE_LESSON_PLAN', 'Topic: ' + data.topic);
  return { success: true, id: id, message: 'Lesson plan saved as draft.' };
}

function updateLessonPlan(teacherId, planId, data) {
  var sheet = getSpreadsheet().getSheetByName('LessonPlans');
  var row = findRowById(sheet, planId);
  if (row === -1) return { success: false, message: 'Not found.' };
  var v = sheet.getRange(row, 1, 1, 18).getValues()[0];
  if (String(v[1]) !== String(teacherId)) return { success: false, message: 'Cannot edit another teacher\'s plan.' };
  var status = String(v[14]).toLowerCase();
  if (status !== 'draft' && status !== 'rejected') return { success: false, message: 'Only draft/rejected plans can be edited.' };
  if (data.topic !== undefined) sheet.getRange(row, 5).setValue(data.topic);
  if (data.objectives !== undefined) sheet.getRange(row, 6).setValue(data.objectives);
  if (data.teachingAids !== undefined) sheet.getRange(row, 7).setValue(data.teachingAids);
  if (data.entryBehaviour !== undefined) sheet.getRange(row, 8).setValue(data.entryBehaviour);
  if (data.presentationSteps !== undefined) sheet.getRange(row, 9).setValue(data.presentationSteps);
  if (data.evaluation !== undefined) sheet.getRange(row, 10).setValue(data.evaluation);
  if (data.assignment !== undefined) sheet.getRange(row, 11).setValue(data.assignment);
  if (data.week !== undefined) sheet.getRange(row, 12).setValue(data.week);
  if (data.referenceBook !== undefined) sheet.getRange(row, 19).setValue(data.referenceBook);
  sheet.getRange(row, 15).setValue('draft');
  return { success: true, message: 'Lesson plan updated.' };
}

function submitLessonPlan(teacherId, planId) {
  var sheet = getSpreadsheet().getSheetByName('LessonPlans');
  var row = findRowById(sheet, planId);
  if (row === -1) return { success: false, message: 'Not found.' };
  var v = sheet.getRange(row, 1, 1, 18).getValues()[0];
  if (String(v[1]) !== String(teacherId)) return { success: false, message: 'Cannot submit another teacher\'s plan.' };
  sheet.getRange(row, 15).setValue('submitted');
  logAudit(teacherId, 'SUBMIT_LESSON_PLAN', 'Plan ID: ' + planId);
  return { success: true, message: 'Submitted for review.' };
}

function approveLessonPlan(approverId, planId, note) {
  var sheet = getSpreadsheet().getSheetByName('LessonPlans');
  var row = findRowById(sheet, planId);
  if (row === -1) return { success: false, message: 'Not found.' };
  sheet.getRange(row, 15).setValue('approved');
  sheet.getRange(row, 16).setValue(approverId);
  sheet.getRange(row, 17).setValue(note || 'Approved');
  logAudit(approverId, 'APPROVE_LESSON_PLAN', 'Plan ID: ' + planId);
  return { success: true, message: 'Lesson plan approved.' };
}

function rejectLessonPlan(approverId, planId, note) {
  var sheet = getSpreadsheet().getSheetByName('LessonPlans');
  var row = findRowById(sheet, planId);
  if (row === -1) return { success: false, message: 'Not found.' };
  sheet.getRange(row, 15).setValue('rejected');
  sheet.getRange(row, 16).setValue(approverId);
  sheet.getRange(row, 17).setValue(note || 'Needs revision');
  logAudit(approverId, 'REJECT_LESSON_PLAN', 'Plan ID: ' + planId);
  return { success: true, message: 'Plan returned for revision.' };
}

function deleteLessonPlan(teacherId, planId) {
  var sheet = getSpreadsheet().getSheetByName('LessonPlans');
  var row = findRowById(sheet, planId);
  if (row === -1) return { success: false, message: 'Not found.' };
  var v = sheet.getRange(row, 1, 1, 18).getValues()[0];
  if (String(v[1]) !== String(teacherId)) return { success: false, message: 'Cannot delete another teacher\'s plan.' };
  if (String(v[14]).toLowerCase() !== 'draft') return { success: false, message: 'Only drafts can be deleted.' };
  sheet.deleteRow(row);
  return { success: true, message: 'Deleted.' };
}

function getTeacherLessonPlans(teacherId, term, session) {
  var plans = getSheetData('LessonPlans').filter(function(p) {
    var match = String(p.teacherID || p.teacherId) === String(teacherId);
    if (term) match = match && String(p.term) === String(term);
    if (session) match = match && String(p.session) === String(session);
    return match;
  });
  var subjects = getAllSubjects();
  return plans.map(function(p) {
    var sid = p.subjectID || p.subjectId;
    var subj = subjects.find(function(s) { return String(s.iD || s.id) === String(sid); });
    p.subjectName = subj ? subj.subjectName : sid;
    return p;
  });
}

function getPendingLessonPlans(term, session, section) {
  var plans = getSheetData('LessonPlans').filter(function(p) {
    var match = String(p.status || '').toLowerCase() === 'submitted';
    if (term) match = match && String(p.term) === String(term);
    if (session) match = match && String(p.session) === String(session);
    return match;
  });
  var users = getAllUsers(); var subjects = getAllSubjects(); var classes = getAllClasses();
  var result = [];
  
  plans.forEach(function(p) {
    var tid = p.teacherID || p.teacherId;
    var teacher = users.find(function(u) { return String(u.iD || u.id) === String(tid); });
    
    // Filter by section
    if (section && section !== 'both') {
      var cls = classes.find(function(c) { return String(c.className) === String(p.class || p.className); });
      var planSection = cls ? cls.section : (teacher ? teacher.section : 'both');
      if (planSection !== section && planSection !== 'both') return;
    }
    
    var sid = p.subjectID || p.subjectId;
    var subj = subjects.find(function(s) { return String(s.iD || s.id) === String(sid); });
    p.teacherName = teacher ? teacher.fullName : tid;
    p.subjectName = subj ? subj.subjectName : sid;
    result.push(p);
  });
  return result;
}

function getAllLessonPlans(term, session) {
  var plans = getSheetData('LessonPlans');
  if (term) plans = plans.filter(function(p) { return String(p.term) === String(term); });
  if (session) plans = plans.filter(function(p) { return String(p.session) === String(session); });
  var users = getAllUsers(); var subjects = getAllSubjects();
  return plans.map(function(p) {
    var tid = p.teacherID || p.teacherId; var sid = p.subjectID || p.subjectId;
    var teacher = users.find(function(u) { return String(u.iD || u.id) === String(tid); });
    var subj = subjects.find(function(s) { return String(s.iD || s.id) === String(sid); });
    p.teacherName = teacher ? teacher.fullName : tid;
    p.subjectName = subj ? subj.subjectName : sid;
    return p;
  });
}

function getTeacherComplianceReport(term, session) {
  var teachers = getAllUsers().filter(function(u) { return u.role === 'teacher' || u.role === 'primary_teacher'; });
  var plans = getSheetData('LessonPlans');
  if (term) plans = plans.filter(function(p) { return String(p.term) === String(term); });
  if (session) plans = plans.filter(function(p) { return String(p.session) === String(session); });
  return teachers.map(function(t) {
    var tid = t.iD || t.id;
    var tp = plans.filter(function(p) { return String(p.teacherID || p.teacherId) === String(tid); });
    var submitted = tp.filter(function(p) { return ['submitted','approved'].indexOf(String(p.status||'').toLowerCase()) !== -1; }).length;
    return { teacherId: tid, teacherName: t.fullName, section: t.section, total: tp.length, submitted: submitted,
      compliance: tp.length > 0 ? Math.round((submitted/tp.length)*100) : 0 };
  });
}
