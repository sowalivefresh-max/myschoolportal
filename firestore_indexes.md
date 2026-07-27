# Firestore Composite Indexes Required

Firestore requires composite indexes for any query that filters on more than one
field. Create these in the Firebase Console under:
  Firestore Database -> Indexes -> Composite

## HOW TO CREATE AN INDEX
1. Go to: console.firebase.google.com
2. Select your project
3. Firestore Database -> Indexes -> Composite -> Add Index
4. Enter Collection ID and fields as listed below

---

## REQUIRED COMPOSITE INDEXES

### assessments
| Collection    | Field 1    | Field 2 | Field 3 | Field 4 | Order     |
|---------------|------------|---------|---------|---------|-----------|
| assessments   | studentId  | term    |         |         | Ascending |
| assessments   | studentId  | term    | session |         | Ascending |
| assessments   | studentId  | subjectId | term  | session | Ascending |

### attendance
| Collection    | Field 1    | Field 2  | Order     |
|---------------|------------|----------|-----------|
| attendance    | className  | date     | Ascending |
| attendance    | studentId  | term     | Ascending |
| attendance    | studentId  | term     | session | Ascending |

### bills
| Collection | Field 1    | Field 2  | Order     |
|------------|------------|----------|-----------|
| bills      | term       | session  | Ascending |
| bills      | studentId  | term     | session | Ascending |

### payments
| Collection | Field 1    | Field 2  | Order     |
|------------|------------|----------|-----------|
| payments   | term       | session  | Ascending |
| payments   | studentId  | term     | session | Ascending |

### enrollments
| Collection  | Field 1    | Field 2   | Field 3  | Order     |
|-------------|------------|-----------|----------|-----------|
| enrollments | studentId  | subjectId | session  | Ascending |
| enrollments | subjectId  | session   |          | Ascending |

### sessions
| Collection | Field 1     | Order     |
|------------|-------------|-----------|
| sessions   | createdAt   | Ascending |

### pendingAdminTasks
| Collection       | Field 1 | Order     |
|------------------|---------|-----------|
| pendingAdminTasks| status  | Ascending |

### lessonPlans
| Collection  | Field 1   | Field 2  | Order     |
|-------------|-----------|----------|-----------|
| lessonPlans | teacherId | term     | Ascending |
| lessonPlans | status    | term     | session | Ascending |

### psychomotorRecords / affectiveRecords
| Collection          | Field 1    | Field 2 | Field 3  | Order     |
|---------------------|------------|---------|----------|-----------|
| psychomotorRecords  | studentId  | term    | session  | Ascending |
| affectiveRecords    | studentId  | term    | session  | Ascending |

---

## NOTES
- Firestore will suggest missing indexes in the Apps Script logs.
  Copy the URL from the error message to create the index automatically.
- Single-field queries do NOT require composite indexes.
- The `sessions` createdAt index is needed for cleanExpiredSessions().
