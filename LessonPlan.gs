/**
 * MYSCHOOL PORTAL - LessonPlan.gs
 * Lesson plan creation, submission, and approval via Firestore.
 */

function createLessonPlan(teacherId, data) {
  if (!data.subjectId || !data.topic || !data.className)
    return { success: false, message: 'Subject, class, and topic required.' };
  var id = generateId();
  firebaseSet('lessonPlans', id, {
    id: id, teacherId: teacherId, subjectId: data.subjectId, className: data.className,
    topic: data.topic || '', objectives: data.objectives || '', teachingAids: data.teachingAids || '',
    entryBehaviour: data.entryBehaviour || '', presentationSteps: data.presentationSteps || '',
    evaluation: data.evaluation || '', assignment: data.assignment || '',
    week: data.week || '', term: data.term || '', session: data.session || '',
    status: 'draft', approverId: '', approverNote: '',
    createdAt: new Date().toISOString(), referenceBook: data.referenceBook || ''
  });
  logAudit(teacherId, 'CREATE_LESSON_PLAN', 'Topic: ' + data.topic);
  return { success: true, id: id, message: 'Lesson plan saved as draft.' };
}

function updateLessonPlan(teacherId, planId, data) {
  var plan = firebaseGet('lessonPlans', planId);
  if (!plan) return { success: false, message: 'Not found.' };
  if (String(plan.teacherId) !== String(teacherId)) return { success: false, message: 'Cannot edit another teacher\'s plan.' };
  var status = String(plan.status || '').toLowerCase();
  if (status !== 'draft' && status !== 'rejected') return { success: false, message: 'Only draft/rejected plans can be edited.' };
  var updates = { status: 'draft' };
  if (data.topic              !== undefined) updates.topic              = data.topic;
  if (data.objectives         !== undefined) updates.objectives         = data.objectives;
  if (data.teachingAids       !== undefined) updates.teachingAids       = data.teachingAids;
  if (data.entryBehaviour     !== undefined) updates.entryBehaviour     = data.entryBehaviour;
  if (data.presentationSteps  !== undefined) updates.presentationSteps  = data.presentationSteps;
  if (data.evaluation         !== undefined) updates.evaluation         = data.evaluation;
  if (data.assignment         !== undefined) updates.assignment         = data.assignment;
  if (data.week               !== undefined) updates.week               = data.week;
  if (data.referenceBook      !== undefined) updates.referenceBook      = data.referenceBook;
  firebasePatch('lessonPlans', planId, updates);
  return { success: true, message: 'Lesson plan updated.' };
}

function submitLessonPlan(teacherId, planId) {
  var plan = firebaseGet('lessonPlans', planId);
  if (!plan) return { success: false, message: 'Not found.' };
  if (String(plan.teacherId) !== String(teacherId)) return { success: false, message: 'Cannot submit another teacher\'s plan.' };
  firebasePatch('lessonPlans', planId, { status: 'submitted' });
  logAudit(teacherId, 'SUBMIT_LESSON_PLAN', 'Plan ID: ' + planId);
  return { success: true, message: 'Submitted for review.' };
}

function approveLessonPlan(approverId, planId, note) {
  if (!firebaseExists('lessonPlans', planId)) return { success: false, message: 'Not found.' };
  firebasePatch('lessonPlans', planId, { status: 'approved', approverId: approverId, approverNote: note || 'Approved' });
  logAudit(approverId, 'APPROVE_LESSON_PLAN', 'Plan ID: ' + planId);
  return { success: true, message: 'Lesson plan approved.' };
}

function rejectLessonPlan(approverId, planId, note) {
  if (!firebaseExists('lessonPlans', planId)) return { success: false, message: 'Not found.' };
  firebasePatch('lessonPlans', planId, { status: 'rejected', approverId: approverId, approverNote: note || 'Needs revision' });
  logAudit(approverId, 'REJECT_LESSON_PLAN', 'Plan ID: ' + planId);
  return { success: true, message: 'Plan returned for revision.' };
}

function deleteLessonPlan(teacherId, planId) {
  var plan = firebaseGet('lessonPlans', planId);
  if (!plan) return { success: false, message: 'Not found.' };
  if (String(plan.teacherId) !== String(teacherId)) return { success: false, message: 'Cannot delete another teacher\'s plan.' };
  if (String(plan.status || '').toLowerCase() !== 'draft') return { success: false, message: 'Only drafts can be deleted.' };
  firebaseDelete('lessonPlans', planId);
  return { success: true, message: 'Deleted.' };
}

function getTeacherLessonPlans(teacherId, term, session) {
  var plans = firebaseQuery('lessonPlans', [{ field: 'teacherId', op: 'EQUAL', value: String(teacherId) }]);
  if (term)    plans = plans.filter(function(p) { return String(p.term)    === String(term); });
  if (session) plans = plans.filter(function(p) { return String(p.session) === String(session); });
  var subjects = getAllSubjects();
  return plans.map(function(p) {
    var subj = subjects.find(function(s) { return String(s.id) === String(p.subjectId); });
    p.subjectName = subj ? subj.subjectName : p.subjectId;
    return p;
  });
}

function getPendingLessonPlans(term, session, section) {
  var plans = firebaseQuery('lessonPlans', [{ field: 'status', op: 'EQUAL', value: 'submitted' }]);
  if (term)    plans = plans.filter(function(p) { return String(p.term)    === String(term); });
  if (session) plans = plans.filter(function(p) { return String(p.session) === String(session); });
  var users = getAllUsers(), subjects = getAllSubjects(), classes = getAllClasses();
  return plans.map(function(p) {
    var teacher = users.find(function(u) { return String(u.id) === String(p.teacherId); });
    if (section && section !== 'both') {
      var cls = classes.find(function(c) { return String(c.className) === String(p.className); });
      var sec = cls ? cls.section : (teacher ? teacher.section : 'both');
      if (sec !== section && sec !== 'both') return null;
    }
    var subj = subjects.find(function(s) { return String(s.id) === String(p.subjectId); });
    p.teacherName = teacher ? teacher.fullName : p.teacherId;
    p.subjectName = subj   ? subj.subjectName  : p.subjectId;
    return p;
  }).filter(Boolean);
}

function getAllLessonPlans(term, session) {
  var plans = firebaseGetAll('lessonPlans');
  if (term)    plans = plans.filter(function(p) { return String(p.term)    === String(term); });
  if (session) plans = plans.filter(function(p) { return String(p.session) === String(session); });
  var users = getAllUsers(), subjects = getAllSubjects();
  return plans.map(function(p) {
    var teacher = users.find(function(u) { return String(u.id) === String(p.teacherId); });
    var subj    = subjects.find(function(s) { return String(s.id) === String(p.subjectId); });
    p.teacherName = teacher ? teacher.fullName : p.teacherId;
    p.subjectName = subj   ? subj.subjectName  : p.subjectId;
    return p;
  });
}

function getTeacherComplianceReport(term, session) {
  var teachers = getAllUsers().filter(function(u) { return u.role === 'teacher' || u.role === 'primary_teacher'; });
  var plans    = firebaseGetAll('lessonPlans');
  if (term)    plans = plans.filter(function(p) { return String(p.term)    === String(term); });
  if (session) plans = plans.filter(function(p) { return String(p.session) === String(session); });
  return teachers.map(function(t) {
    var tid = t.id;
    var tp  = plans.filter(function(p) { return String(p.teacherId) === String(tid); });
    var submitted = tp.filter(function(p) { return ['submitted','approved'].indexOf(String(p.status||'').toLowerCase()) !== -1; }).length;
    return { teacherId: tid, teacherName: t.fullName, section: t.section,
      total: tp.length, submitted: submitted, compliance: tp.length > 0 ? Math.round((submitted/tp.length)*100) : 0 };
  });
}
