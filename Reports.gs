/**
 * ABECEDARIAN ACADEMY — Reports.gs
 * Academic report computation: positions, grades, auto-comments.
 */

/**
 * Compute class positions for a term/session.
 * Ranks students by their average score across all subjects.
 */
function computeClassPositions(className, term, session, reportType) {
  var students = getStudentsByClass(className);
  var isHalf = (reportType === 'Half Term');

  var ranked = students.map(function(s) {
    var sid = s.iD || s.id;
    var scores = getScores({ studentId: sid, term: term, session: session });
    var t1 = [], t2 = [];
    if (!isHalf && (term === 'Second Term' || term === 'Third Term')) {
      t1 = getScores({ studentId: sid, term: 'First Term', session: session });
    }
    if (!isHalf && term === 'Third Term') {
      t2 = getScores({ studentId: sid, term: 'Second Term', session: session });
    }

    var totalSum = 0;
    scores.forEach(function(sc) {
      if (isHalf) {
        sc.termTotal = safeFloat(sc.cA1 || sc.ca1, 0) + safeFloat(sc.cA2 || sc.ca2, 0);
      } else {
        sc.termTotal = safeFloat(sc.total, 0);
        if (term === 'Second Term') {
          var f1 = t1.find(function(x) { return x.subjectId === sc.subjectId; });
          sc.term1Total = f1 ? safeFloat(f1.total, 0) : null;
        } else if (term === 'Third Term') {
          var f1 = t1.find(function(x) { return x.subjectId === sc.subjectId; });
          var f2 = t2.find(function(x) { return x.subjectId === sc.subjectId; });
          sc.term1Total = f1 ? safeFloat(f1.total, 0) : null;
          sc.term2Total = f2 ? safeFloat(f2.total, 0) : null;
          var vals = [sc.termTotal];
          if (sc.term1Total !== null) vals.push(sc.term1Total);
          if (sc.term2Total !== null) vals.push(sc.term2Total);
          var sum = vals.reduce(function(a,b){return a+b}, 0);
          sc.weightedAvg = Math.round((sum / vals.length) * 10) / 10;
        }
      }
      totalSum += (term === 'Third Term' && !isHalf) ? (sc.weightedAvg || 0) : sc.termTotal;
    });

    var avg = scores.length > 0 ? Math.round((totalSum / scores.length) * 10) / 10 : 0;
    return { studentId: sid, studentName: s.fullName, average: avg, scores: scores };
  });

  ranked.sort(function(a, b) { return b.average - a.average; });

  var pos = 1;
  for (var i = 0; i < ranked.length; i++) {
    if (i > 0 && ranked[i].average === ranked[i - 1].average) {
      ranked[i].position = ranked[i - 1].position;
    } else {
      ranked[i].position = pos;
    }
    pos++;
  }

  // Only save positions for Full Term reports
  if (!isHalf) {
    var sheet = getSpreadsheet().getSheetByName('Assessments');
    var data = sheet.getDataRange().getValues();
    ranked.forEach(function(r) {
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][1]) === String(r.studentId) &&
            String(data[i][5]) === String(term) && String(data[i][6]) === String(session)) {
          sheet.getRange(i + 1, 14).setValue(r.position);
        }
      }
    });
  }

  return ranked;
}

/**
 * Generate a full academic report object for one student.
 */
function generateStudentReport(studentId, term, session, reportType) {
  var student = getStudentById(studentId);
  if (!student) return { success: false, message: 'Student not found.' };

  var isHalf = (reportType === 'Half Term');
  var scores = getScores({ studentId: studentId, term: term, session: session });
  
  var t1 = [], t2 = [];
  if (!isHalf && (term === 'Second Term' || term === 'Third Term')) {
    t1 = getScores({ studentId: studentId, term: 'First Term', session: session });
  }
  if (!isHalf && term === 'Third Term') {
    t2 = getScores({ studentId: studentId, term: 'Second Term', session: session });
  }

  var attendance = getStudentAttendanceSummary(studentId, term, session);
  var psychomotor = getPsychomotorRecord(studentId, term, session);
  var affective = getAffectiveRecord(studentId, term, session);
  var settings = getSettings();
  var className = student.class || student.className || '';

  // Compute totals and average
  var totalScore = 0;
  scores.forEach(function(sc) {
    if (isHalf) {
      sc.termTotal = safeFloat(sc.cA1 || sc.ca1, 0) + safeFloat(sc.cA2 || sc.ca2, 0);
      sc.termGrade = computeGrade(sc.termTotal); // This might not be out of 100, but computeGrade will fallback
    } else {
      sc.termTotal = safeFloat(sc.total, 0);
      if (term === 'Second Term') {
        var f1 = t1.find(function(x) { return x.subjectId === sc.subjectId; });
        sc.term1Total = f1 ? safeFloat(f1.total, 0) : null;
        sc.termGrade = computeGrade(sc.termTotal);
      } else if (term === 'Third Term') {
        var f1 = t1.find(function(x) { return x.subjectId === sc.subjectId; });
        var f2 = t2.find(function(x) { return x.subjectId === sc.subjectId; });
        sc.term1Total = f1 ? safeFloat(f1.total, 0) : null;
        sc.term2Total = f2 ? safeFloat(f2.total, 0) : null;
        var vals = [sc.termTotal];
        if (sc.term1Total !== null) vals.push(sc.term1Total);
        if (sc.term2Total !== null) vals.push(sc.term2Total);
        var sum = vals.reduce(function(a,b){return a+b}, 0);
        sc.weightedAvg = Math.round((sum / vals.length) * 10) / 10;
        sc.termGrade = computeGrade(sc.weightedAvg); // Grade based on weighted average for 3rd term
      } else {
        sc.termGrade = computeGrade(sc.termTotal);
      }
    }
    totalScore += (term === 'Third Term' && !isHalf) ? (sc.weightedAvg || 0) : sc.termTotal;
  });

  var average = scores.length > 0 ? Math.round((totalScore / scores.length) * 10) / 10 : 0;
  var overallGrade = computeGrade(isHalf ? (average * (100/40)) : average); // scale up if out of 40 CA

  // Get position from already-computed positions (stored in Assessments) or recompute
  var position = null;
  var totalStudents = getStudentsByClass(className).length;
  if (!isHalf && scores.length > 0) position = scores[0].position || null;

  // Auto-generate comments
  var classTeacherComment = generateClassTeacherComment(average, attendance.percentage, student.fullName);
  var headTeacherComment = generateHeadTeacherComment(average, position, totalStudents, student.fullName);
  var principalComment = generatePrincipalComment(average, position, totalStudents, student.fullName);

  // Fetch Class Teacher Signature from User Profile
  var classObj = getAllClasses().find(function(c) { return c.className === className; });
  var ctSig = '';
  if (classObj && classObj.classTeacherId) {
    var teacher = getUser(classObj.classTeacherId);
    if (teacher && teacher.signature) ctSig = teacher.signature;
  }

  return {
    success: true,
    student: student,
    term: term, session: session, reportType: reportType,
    scores: scores,
    summary: {
      totalSubjects: scores.length, totalScore: totalScore,
      average: average, overallGrade: overallGrade,
      position: position, totalStudents: totalStudents,
      overallRemark: getGradeRemark(overallGrade)
    },
    attendance: attendance,
    psychomotor: psychomotor || {},
    affective: affective || {},
    comments: {
      classTeacher: classTeacherComment,
      headTeacher: headTeacherComment,
      principal: principalComment
    },
    settings: {
      schoolName: settings.school_name || 'My School',
      schoolMotto: settings.school_motto || '',
      principalName: settings.principal_name || 'The Principal',
      headTeacherName: settings.head_teacher_name || 'The Head Teacher',
      currentTerm: settings.current_term || term,
      nextTermBegins: settings.next_term_begins || '',
      principal_signature: settings.principal_signature || '',
      head_teacher_signature: settings.head_teacher_signature || '',
      class_teacher_signature: ctSig || settings.class_teacher_signature || ''
    }
  };
}

/**
 * Generate reports for all students in a class.
 */
function generateClassReport(className, term, session) {
  // First compute positions
  computeClassPositions(className, term, session);
  var students = getStudentsByClass(className);
  return students.map(function(s) {
    return generateStudentReport(s.iD || s.id, term, session);
  });
}

/**
 * Get subject performance analytics for a class.
 */
function getSubjectPerformanceAnalytics(className, term, session) {
  var subjects = getAllSubjects().filter(function(s) {
    return !s.class || String(s.class) === String(className) ||
           String(s.className) === String(className);
  });

  return subjects.map(function(subj) {
    var sid = subj.iD || subj.id;
    var scores = getScores({ subjectId: sid, className: className, term: term, session: session });
    if (scores.length === 0) return null;
    var totals = scores.map(function(s) { return safeFloat(s.total, 0); });
    var sum = totals.reduce(function(a, b) { return a + b; }, 0);
    var avg = Math.round((sum / totals.length) * 10) / 10;
    var passing = totals.filter(function(t) { return t >= 40; }).length;
    var dist = {};
    scores.forEach(function(s) { var g = s.grade || 'F9'; dist[g] = (dist[g] || 0) + 1; });
    return {
      subjectId: sid, subjectName: subj.subjectName,
      count: scores.length, average: avg,
      highest: Math.max.apply(null, totals), lowest: Math.min.apply(null, totals),
      passingCount: passing, failingCount: scores.length - passing,
      passRate: Math.round((passing / scores.length) * 100),
      gradeDistribution: dist
    };
  }).filter(Boolean);
}

/**
 * Get school-wide academic performance overview.
 */
function getSchoolPerformanceOverview(term, session, section) {
  var classes = getAllClasses();
  if (section && section !== 'both') {
    classes = classes.filter(function(cls) { return cls.section === section; });
  }

  return classes.map(function(cls) {
    var className = cls.className;
    var students = getStudentsByClass(className);
    var totalAvg = 0; var count = 0;
    students.forEach(function(s) {
      var scores = getScores({ studentId: s.iD || s.id, term: term, session: session });
      if (scores.length > 0) {
        var sum = scores.reduce(function(a, sc) { return a + safeFloat(sc.total, 0); }, 0);
        totalAvg += sum / scores.length;
        count++;
      }
    });
    return {
      className: className, section: cls.section,
      totalStudents: students.length,
      classAverage: count > 0 ? Math.round((totalAvg / count) * 10) / 10 : 0
    };
  });
}

/**
 * Get a student's academic history across multiple terms.
 */
function getStudentAcademicHistory(studentId) {
  var scores = getScores({ studentId: studentId });
  var termMap = {};
  scores.forEach(function(s) {
    var key = (s.session || '') + '__' + (s.term || '');
    if (!termMap[key]) termMap[key] = { session: s.session, term: s.term, scores: [] };
    termMap[key].scores.push(s);
  });
  return Object.values(termMap).map(function(t) {
    var sum = t.scores.reduce(function(a, s) { return a + safeFloat(s.total, 0); }, 0);
    t.average = t.scores.length > 0 ? Math.round((sum / t.scores.length) * 10) / 10 : 0;
    t.totalSubjects = t.scores.length;
    return t;
  });
}
