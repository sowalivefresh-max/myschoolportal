/**
 * MYSCHOOL PORTAL - Finance.gs
 * Fee structures, bill generation, payment tracking,
 * expenses, receipts - all via Firebase Firestore.
 */

// --- FEE STRUCTURE -------------------------------------------

function getAllFeeStructures() { return firebaseGetAll('feeStructure'); }

function saveFeeStructure(data) {
  if (!data.className || !data.term || !data.session)
    return { success: false, message: 'Class, term, and session required.' };

  var lineItems = [];
  if (data.lineItems) {
    try { lineItems = typeof data.lineItems === 'string' ? JSON.parse(data.lineItems) : data.lineItems; }
    catch(e) { lineItems = []; }
  }
  var total = lineItems.length > 0
    ? lineItems.reduce(function(s,i) { return s + safeFloat(i.amount,0); }, 0)
    : safeFloat(data.tuitionFee,0) + safeFloat(data.developmentLevy,0) + safeFloat(data.examFee,0) + safeFloat(data.sportsFee,0);

  var section = data.section || '';
  var all = getAllFeeStructures();

  // Update by ID if provided
  if (data.id) {
    firebasePatch('feeStructure', data.id, { className: data.className.trim(), section: section, totalAmount: total, lineItems: lineItems });
    return { success: true, message: 'Fee structure updated. Total: ' + formatNaira(total) };
  }

  var classes = data.className.split(',').map(function(c) { return c.trim(); }).filter(Boolean);
  var saved = [];
  classes.forEach(function(cls) {
    var existing = all.find(function(f) {
      return String(f.className).toLowerCase() === cls.toLowerCase() &&
             String(f.term) === String(data.term) && String(f.session) === String(data.session);
    });
    if (existing) {
      firebasePatch('feeStructure', existing.id, { section: section, totalAmount: total, lineItems: lineItems });
    } else {
      var id = generateId();
      firebaseSet('feeStructure', id, { id: id, className: cls, section: section, term: data.term, session: data.session,
        totalAmount: total, lineItems: lineItems, createdAt: new Date().toISOString() });
    }
    saved.push(cls);
  });
  return { success: true, message: 'Fee structures saved for: ' + saved.join(', ') + '. Total: ' + formatNaira(total) };
}

function deleteFeeStructure(feeId) {
  firebaseDelete('feeStructure', feeId);
  return { success: true, message: 'Fee structure deleted.' };
}

// --- BILL GENERATION -----------------------------------------

function generateTermBills(term, session, recordedByUserId, section) {
  var students = getAllStudents().filter(function(s) {
    if (String(s.status || 'active') !== 'active') return false;
    if (section && section !== 'both' && s.section !== section) return false;
    return true;
  });
  var feeStructures = getAllFeeStructures();
  var generated = 0, skipped = 0;
  var writes = [], payWrites = [];

  students.forEach(function(student) {
    var sid = student.id, className = student.className || '';
    var existing = firebaseQuery('bills', [
      { field: 'studentId', op: 'EQUAL', value: String(sid) },
      { field: 'term',      op: 'EQUAL', value: String(term) },
      { field: 'session',   op: 'EQUAL', value: String(session) }
    ]);
    if (existing && existing.length > 0) { skipped++; return; }

    var fee = feeStructures.find(function(f) {
      return String(f.className) === String(className) &&
             String(f.term) === String(term) && String(f.session) === String(session);
    });
    if (!fee) { skipped++; return; }

    var total = safeFloat(fee.totalAmount, 0);
    var credit = getStudentCreditBalance(sid);
    var appliedCredit = Math.min(credit, total);
    var finalBalance = total - appliedCredit;
    var billStatus = finalBalance <= 0 ? 'Paid' : (appliedCredit > 0 ? 'Partial' : 'Outstanding');
    var billId = generateId();

    writes.push({ type: 'set', collection: 'bills', docId: billId, data: {
      id: billId, studentId: sid, studentName: student.fullName, className: className,
      term: term, session: session, totalBilled: total, totalPaid: appliedCredit,
      balance: finalBalance, status: billStatus, createdAt: todayISO()
    }});

    if (appliedCredit > 0) {
      var payId = generateId(), rRef = generateReceiptRef();
      payWrites.push({ type: 'set', collection: 'payments', docId: payId, data: {
        id: payId, billId: billId, studentId: sid, term: term, session: session,
        amount: appliedCredit, date: todayISO(), method: 'Credit Deduction', receiptRef: rRef,
        recordedBy: recordedByUserId || 'system', emailSent: 'false', status: 'Approved', receiptUrl: ''
      }});
    }
    generated++;
    if (writes.length >= 499) { firebaseBatchWrite(writes); writes = []; }
  });

  if (writes.length > 0) firebaseBatchWrite(writes);
  if (payWrites.length > 0) firebaseBatchWrite(payWrites);
  logAudit(recordedByUserId, 'GENERATE_BILLS', term + ' ' + session + ': ' + generated + ' bills, ' + skipped + ' skipped');
  return { success: true, message: generated + ' bill(s) generated. ' + skipped + ' skipped.' };
}

function getAllBills(filters) {
  var bills;
  if (filters && filters.studentId) {
    bills = firebaseQuery('bills', [{ field: 'studentId', op: 'EQUAL', value: String(filters.studentId) }]);
  } else if (filters && filters.term && filters.session) {
    bills = firebaseQuery('bills', [
      { field: 'term',    op: 'EQUAL', value: String(filters.term) },
      { field: 'session', op: 'EQUAL', value: String(filters.session) }
    ]);
  } else {
    bills = firebaseGetAll('bills');
  }
  if (!filters) return bills;
  var students = filters.section && filters.section !== 'both' ? getAllStudents() : null;
  return bills.filter(function(b) {
    if (filters.term      && String(b.term)      !== String(filters.term))      return false;
    if (filters.session   && String(b.session)   !== String(filters.session))   return false;
    if (filters.className && String(b.className) !== String(filters.className)) return false;
    if (filters.status    && String(b.status||'').toLowerCase() !== String(filters.status).toLowerCase()) return false;
    if (filters.studentId && String(b.studentId) !== String(filters.studentId)) return false;
    if (students) {
      var s = students.find(function(s2) { return String(s2.id) === String(b.studentId); });
      if (!s || s.section !== filters.section) return false;
    }
    return true;
  });
}

function getStudentBill(studentId, term, session) {
  var results = firebaseQuery('bills', [
    { field: 'studentId', op: 'EQUAL', value: String(studentId) },
    { field: 'term',      op: 'EQUAL', value: String(term) },
    { field: 'session',   op: 'EQUAL', value: String(session) }
  ]);
  return results && results.length > 0 ? results[0] : null;
}

// --- PAYMENT RECORDING ---------------------------------------

function _updateBillAfterPayment(billId, amount) {
  var bill = firebaseGet('bills', billId);
  if (!bill) return;
  var newPaid    = safeFloat(bill.totalPaid, 0) + amount;
  var newBalance = safeFloat(bill.totalBilled, 0) - newPaid;
  var status     = newBalance <= 0 ? 'Paid' : (newPaid > 0 ? 'Partial' : 'Outstanding');
  firebasePatch('bills', billId, { totalPaid: newPaid, balance: Math.max(0, newBalance), status: status });
}

function recordPayment(data, recordedByUserId) {
  if (!data.studentId || !data.term || !data.session || !data.amount)
    return { success: false, message: 'Student, term, session, and amount required.' };
  var amount = safeFloat(data.amount, 0);
  if (amount <= 0) return { success: false, message: 'Amount must be greater than zero.' };

  var bill = getStudentBill(data.studentId, data.term, data.session);
  if (!bill) return { success: false, message: 'Bill not found. Please generate bills first.' };

  var billId  = bill.id;
  var newPaid = safeFloat(bill.totalPaid, 0) + amount;
  var balance = Math.max(0, safeFloat(bill.totalBilled, 0) - newPaid);
  var status  = balance <= 0 ? 'Paid' : (newPaid > 0 ? 'Partial' : 'Outstanding');

  firebasePatch('bills', billId, { totalPaid: newPaid, balance: balance, status: status });

  var rRef = generateReceiptRef(), payId = generateId();
  firebaseSet('payments', payId, {
    id: payId, billId: billId, studentId: data.studentId, term: data.term, session: data.session,
    amount: amount, date: todayISO(), method: data.method || 'Cash', receiptRef: rRef,
    recordedBy: recordedByUserId || '', emailSent: 'false', status: 'Approved', receiptUrl: ''
  });

  logAudit(recordedByUserId, 'RECORD_PAYMENT', 'Student: ' + data.studentId + ' Amount: ' + amount + ' Ref: ' + rRef);
  try { sendPaymentReceipt(payId); } catch(e) { Logger.log('Email failed: ' + e); }
  return { success: true, paymentId: payId, receiptRef: rRef, newBalance: balance, status: status,
    message: 'Payment of ' + formatNaira(amount) + ' recorded. Ref: ' + rRef };
}

function parentSubmitPayment(data, recordedByUserId) {
  if (!data.studentId || !data.term || !data.session || !data.amount)
    return { success: false, message: 'Student, term, session, and amount required.' };
  var amount = safeFloat(data.amount, 0);
  if (amount <= 0) return { success: false, message: 'Amount must be greater than zero.' };
  var bill = getStudentBill(data.studentId, data.term, data.session);
  if (!bill) return { success: false, message: 'Bill not found.' };

  var receiptUrl = '';
  if (data.proofOfPayment) {
    var driveResult = uploadFileToDrive(data.proofOfPayment, 'Receipt_' + data.studentId + '_' + Date.now(), 'Receipts');
    receiptUrl = driveResult.viewUrl || '';
  }

  var rRef = generateReceiptRef(), payId = generateId();
  firebaseSet('payments', payId, {
    id: payId, billId: bill.id, studentId: data.studentId, term: data.term, session: data.session,
    amount: amount, date: todayISO(), method: data.method || 'Bank Transfer', receiptRef: rRef,
    recordedBy: recordedByUserId || '', emailSent: 'false', status: 'Pending', receiptUrl: receiptUrl
  });

  logAudit(recordedByUserId, 'SUBMIT_PAYMENT', 'Student: ' + data.studentId + ' Amount: ' + amount + ' Ref: ' + rRef);
  return { success: true, paymentId: payId, receiptRef: rRef,
    message: 'Payment of ' + formatNaira(amount) + ' submitted for validation.' };
}

function approvePayment(paymentId, approverUserId) {
  var pay = firebaseGet('payments', paymentId);
  if (!pay) return { success: false, message: 'Payment not found.' };
  if (pay.status === 'Approved') return { success: false, message: 'Already approved.' };
  firebasePatch('payments', paymentId, { status: 'Approved' });
  _updateBillAfterPayment(pay.billId, safeFloat(pay.amount, 0));
  logAudit(approverUserId, 'APPROVE_PAYMENT', 'Payment ID: ' + paymentId);
  try { sendPaymentReceipt(paymentId); } catch(e) {}
  return { success: true, message: 'Payment approved successfully.' };
}

function rejectPayment(paymentId, rejectorUserId) {
  var pay = firebaseGet('payments', paymentId);
  if (!pay) return { success: false, message: 'Payment not found.' };
  if (pay.status === 'Approved') return { success: false, message: 'Cannot reject an approved payment.' };
  firebasePatch('payments', paymentId, { status: 'Rejected' });
  logAudit(rejectorUserId, 'REJECT_PAYMENT', 'Payment ID: ' + paymentId);
  try { sendPaymentRejection(paymentId); } catch(e) {}
  return { success: true, message: 'Payment rejected.' };
}

function reversePayment(paymentId, reason, userId) {
  var pay = firebaseGet('payments', paymentId);
  if (!pay) return { success: false, message: 'Payment not found.' };
  if (pay.status !== 'Approved') return { success: false, message: 'Only approved payments can be reversed.' };
  firebasePatch('payments', paymentId, { status: 'Reversed' });
  // Subtract from bill
  var bill = firebaseGet('bills', pay.billId);
  if (bill) {
    var newPaid = Math.max(0, safeFloat(bill.totalPaid,0) - safeFloat(pay.amount,0));
    var newBal  = safeFloat(bill.totalBilled,0) - newPaid;
    firebasePatch('bills', pay.billId, { totalPaid: newPaid, balance: Math.max(0,newBal), status: newBal<=0?'Paid':(newPaid>0?'Partial':'Outstanding') });
  }
  logAudit(userId, 'REVERSE_PAYMENT', 'Payment ID: ' + paymentId + ' Reason: ' + (reason || ''));
  return { success: true, message: 'Payment reversed successfully.' };
}

function recordCreditNote(data, recordedByUserId) {
  if (!data.studentId || !data.term || !data.session || !data.amount || !data.type)
    return { success: false, message: 'Student, term, session, amount, and type required.' };
  var amount = safeFloat(data.amount, 0);
  if (amount <= 0) return { success: false, message: 'Amount must be greater than zero.' };
  var bill = getStudentBill(data.studentId, data.term, data.session);
  if (!bill) return { success: false, message: 'Bill not found.' };
  if (data.type === 'Write-Off') amount = Math.min(amount, safeFloat(bill.balance, 0));
  if (amount <= 0) return { success: false, message: 'Nothing to write off.' };

  var billId = bill.id;
  var newPaid = safeFloat(bill.totalPaid,0) + amount;
  var newBal  = safeFloat(bill.totalBilled,0) - newPaid;
  var status  = newBal <= 0 ? 'Paid' : (newPaid > 0 ? 'Partial' : 'Outstanding');
  firebasePatch('bills', billId, { totalPaid: newPaid, balance: Math.max(0,newBal), status: status });

  var rRef = (data.type === 'Write-Off' ? 'WO-' : 'CN-') + generateId().substring(0,6);
  var payId = generateId();
  firebaseSet('payments', payId, {
    id: payId, billId: billId, studentId: data.studentId, term: data.term, session: data.session,
    amount: amount, date: todayISO(), method: data.type, receiptRef: rRef,
    recordedBy: recordedByUserId || '', emailSent: 'false', status: 'Approved', receiptUrl: ''
  });
  logAudit(recordedByUserId, 'RECORD_' + data.type.toUpperCase().replace('-','_'), 'Student: ' + data.studentId + ' Amount: ' + amount);
  return { success: true, paymentId: payId, newBalance: Math.max(0,newBal), status: status, message: data.type + ' of ' + formatNaira(amount) + ' recorded.' };
}

function getAllPayments(filters) {
  var payments;
  if (filters && filters.studentId) {
    payments = firebaseQuery('payments', [{ field: 'studentId', op: 'EQUAL', value: String(filters.studentId) }]);
  } else if (filters && filters.term && filters.session) {
    payments = firebaseQuery('payments', [
      { field: 'term', op: 'EQUAL', value: String(filters.term) },
      { field: 'session', op: 'EQUAL', value: String(filters.session) }
    ]);
  } else { payments = firebaseGetAll('payments'); }
  if (!filters) return payments;
  var students = filters.section && filters.section !== 'both' ? getAllStudents() : null;
  return payments.filter(function(p) {
    if (filters.studentId && String(p.studentId) !== String(filters.studentId)) return false;
    if (filters.term      && String(p.term)      !== String(filters.term))      return false;
    if (filters.session   && String(p.session)   !== String(filters.session))   return false;
    if (filters.status    && String(p.status||'').toLowerCase() !== String(filters.status).toLowerCase()) return false;
    if (students) {
      var s = students.find(function(s2) { return String(s2.id) === String(p.studentId); });
      if (!s || s.section !== filters.section) return false;
    }
    return true;
  });
}

function getStudentPayments(studentId) {
  return firebaseQuery('payments', [{ field: 'studentId', op: 'EQUAL', value: String(studentId) }]);
}

function getStudentLedger(studentId) {
  return { bills: getAllBills({ studentId: studentId }),
    payments: getStudentPayments(studentId), creditBalance: getStudentCreditBalance(studentId) };
}

function getDebtors(term, session) {
  return getAllBills({ term: term, session: session }).filter(function(b) {
    return String(b.status || '').toLowerCase() !== 'paid';
  }).sort(function(a, b) { return safeFloat(b.balance, 0) - safeFloat(a.balance, 0); });
}

// --- EXPENSES ------------------------------------------------

function getAllExpenses(filters) {
  var expenses = firebaseGetAll('expenses');
  if (!filters) return expenses;
  return expenses.filter(function(e) {
    if (filters.section   && String(e.section) !== String(filters.section)) return false;
    if (filters.category  && String(e.category).toLowerCase() !== String(filters.category).toLowerCase()) return false;
    return true;
  });
}

function recordExpense(data, recordedByUserId) {
  if (!data.category || !data.amount) return { success: false, message: 'Category and amount required.' };
  var id = generateId();
  firebaseSet('expenses', id, { id: id, category: data.category, description: data.description || '',
    amount: safeFloat(data.amount, 0), date: data.date || todayISO(),
    recordedBy: recordedByUserId || '', section: data.section || 'both', receiptUrl: '' });
  logAudit(recordedByUserId, 'RECORD_EXPENSE', data.category + ': ' + data.amount);
  return { success: true, id: id, message: 'Expense recorded.' };
}

function deleteExpense(expenseId, userId) {
  firebaseDelete('expenses', expenseId);
  logAudit(userId, 'DELETE_EXPENSE', 'Expense ID: ' + expenseId);
  return { success: true, message: 'Expense deleted.' };
}

// --- REPORTS -------------------------------------------------

function getIncomeExpenseReport(term, session) {
  var payments = getAllPayments({ term: term, session: session });
  var approved = payments.filter(function(p) { return String(p.status||'').toLowerCase() === 'approved'; });
  var pending  = payments.filter(function(p) { return String(p.status||'').toLowerCase() === 'pending'; });
  var expenses = getAllExpenses();
  var totalIncome   = approved.reduce(function(s,p) { return s + safeFloat(p.amount,0); }, 0);
  var totalPending  = pending.reduce(function(s,p)  { return s + safeFloat(p.amount,0); }, 0);
  var totalExpenses = expenses.reduce(function(s,e) { return s + safeFloat(e.amount,0); }, 0);
  var byCategory = {};
  expenses.forEach(function(e) { var c=e.category||'Other'; byCategory[c]=(byCategory[c]||0)+safeFloat(e.amount,0); });
  return { term:term, session:session, totalIncome:totalIncome, totalPending:totalPending,
    totalExpenses:totalExpenses, netBalance:totalIncome-totalExpenses,
    expensesByCategory:byCategory, totalPayments:approved.length, pendingCount:pending.length };
}

function getFinancialDashboardStats(term, session, section) {
  var f = { term: term, session: session };
  if (section && section !== 'both') f.section = section;
  var bills    = getAllBills(f);
  var expenses = getAllExpenses(section && section !== 'both' ? { section: section } : null);
  var totalBilled      = bills.reduce(function(s,b) { return s+safeFloat(b.totalBilled,0); }, 0);
  var totalCollected   = bills.reduce(function(s,b) { return s+safeFloat(b.totalPaid,0); }, 0);
  var totalOutstanding = bills.reduce(function(s,b) { return s+safeFloat(b.balance,0); }, 0);
  var totalExpenses    = expenses.reduce(function(s,e) { return s+safeFloat(e.amount,0); }, 0);
  return { totalBilled:totalBilled, totalCollected:totalCollected, totalOutstanding:totalOutstanding,
    totalExpenses:totalExpenses, netBalance:totalCollected-totalExpenses, totalStudentsBilled:bills.length,
    paidCount:bills.filter(function(b){return b.status==='Paid';}).length,
    partialCount:bills.filter(function(b){return b.status==='Partial';}).length,
    outstandingCount:bills.filter(function(b){return b.status==='Outstanding';}).length };
}

function getStudentCreditBalance(studentId) {
  var payments = firebaseQuery('payments', [{ field: 'studentId', op: 'EQUAL', value: String(studentId) }])
    .filter(function(p) { return String(p.status).toLowerCase() === 'approved' && String(p.method).toLowerCase() !== 'credit deduction'; });
  var bills = firebaseQuery('bills', [{ field: 'studentId', op: 'EQUAL', value: String(studentId) }]);
  var totalPaid   = payments.reduce(function(s,p) { return s+safeFloat(p.amount,0); }, 0);
  var totalBilled = bills.reduce(function(s,b)    { return s+safeFloat(b.totalBilled,0); }, 0);
  var credit = totalPaid - totalBilled;
  return credit > 0 ? credit : 0;
}
