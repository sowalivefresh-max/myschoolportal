/**
 * ABECEDARIAN ACADEMY — Finance.gs
 * Fee structure, bill generation, payment tracking, expenses, receipts.
 */

// ─── FEE STRUCTURE ──────────────────────────────────────────

function getAllFeeStructures() { return getSheetData('FeeStructure'); }

function saveFeeStructure(data) {
  if (!data.className || !data.term || !data.session)
    return { success: false, message: 'Class, term, and session required.' };

  var sheet = getSpreadsheet().getSheetByName('FeeStructure');

  // Ensure column 11 (LineItems) header exists
  if (sheet.getMaxColumns() < 11) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), 11 - sheet.getMaxColumns());
  }
  if (!sheet.getRange(1, 11).getValue()) {
    sheet.getRange(1, 11).setValue('LineItems');
  }
  var all = getSheetData('FeeStructure');

  // Parse line items if provided as JSON string
  var lineItems = [];
  if (data.lineItems) {
    try {
      lineItems = typeof data.lineItems === 'string' ? JSON.parse(data.lineItems) : data.lineItems;
    } catch(e) { lineItems = []; }
  }

  // Compute total from line items, or fall back to legacy fields
  var total = 0;
  if (lineItems.length > 0) {
    lineItems.forEach(function(item) { total += safeFloat(item.amount, 0); });
  } else {
    total = safeFloat(data.tuitionFee, 0) + safeFloat(data.developmentLevy, 0) +
            safeFloat(data.examFee, 0) + safeFloat(data.sportsFee, 0);
  }

  var lineItemsStr = JSON.stringify(lineItems);
  var section = data.section || '';

  // Check if updating an existing record by ID
  if (data.id) {
    var row = findRowById(sheet, data.id);
    if (row > 0) {
      sheet.getRange(row, 2).setValue(data.className.trim());
      sheet.getRange(row, 3).setValue(section);
      sheet.getRange(row, 10).setValue(total);
      // Store lineItems in a new column 11 if it exists, extend if needed
      if (sheet.getMaxColumns() < 11) sheet.insertColumnsAfter(sheet.getMaxColumns(), 11 - sheet.getMaxColumns());
      sheet.getRange(row, 11).setValue(lineItemsStr);
      return { success: true, message: 'Fee structure updated. Total: ' + formatNaira(total) };
    }
  }

  // Split class name by comma to handle multiple classes
  var classes = data.className.split(',').map(function(c) { return c.trim(); }).filter(Boolean);
  if (classes.length === 0) {
    return { success: false, message: 'Valid class name(s) required.' };
  }

  var savedClasses = [];

  for (var i = 0; i < classes.length; i++) {
    var cls = classes[i];
    // Check for existing by class+term+session
    var existing = all.find(function(f) {
      return String(f.className).toLowerCase() === cls.toLowerCase() &&
             String(f.term) === String(data.term) && String(f.session) === String(data.session);
    });

    if (existing) {
      var row2 = findRowById(sheet, existing.iD || existing.id);
      if (row2 > 0) {
        sheet.getRange(row2, 3).setValue(section);
        sheet.getRange(row2, 10).setValue(total);
        if (sheet.getMaxColumns() < 11) sheet.insertColumnsAfter(sheet.getMaxColumns(), 11 - sheet.getMaxColumns());
        sheet.getRange(row2, 11).setValue(lineItemsStr);
        savedClasses.push(cls);
      }
    } else {
      // Insert new row
      var id = generateId();
      var newRow = [id, cls, section, data.term, data.session,
        0, 0, 0, 0, total];
      sheet.appendRow(newRow);
      // Write lineItems to column 11
      var lastRow = sheet.getLastRow();
      if (sheet.getMaxColumns() < 11) sheet.insertColumnsAfter(sheet.getMaxColumns(), 11 - sheet.getMaxColumns());
      sheet.getRange(lastRow, 11).setValue(lineItemsStr);
      savedClasses.push(cls);
    }
  }

  return { success: true, message: 'Fee structures saved/updated for: ' + savedClasses.join(', ') + '. Total: ' + formatNaira(total) };
}

function deleteFeeStructure(feeId) {
  var sheet = getSpreadsheet().getSheetByName('FeeStructure');
  var row = findRowById(sheet, feeId);
  if (row === -1) return { success: false, message: 'Fee structure not found.' };
  sheet.deleteRow(row);
  return { success: true, message: 'Fee structure deleted.' };
}

// ─── BILL GENERATION ────────────────────────────────────────

/**
 * Generate bills for all active students in a term/session.
 * Looks up the fee structure for each student's class.
 */
function generateTermBills(term, session, recordedByUserId, section) {
  var students = getAllStudents().filter(function(s) {
    if (String(s.status || 'active') !== 'active') return false;
    if (section && section !== 'both' && s.section !== section) return false;
    return true;
  });
  var feeStructures = getAllFeeStructures();
  var billSheet = getSpreadsheet().getSheetByName('Bills');
  var generated = 0; var skipped = 0;

  students.forEach(function(student) {
    var sid = student.iD || student.id;
    var className = student.class || student.className || '';

    // Check if bill already exists
    var existing = getSheetData('Bills').find(function(b) {
      return String(b.studentID || b.studentId) === String(sid) &&
             String(b.term) === String(term) && String(b.session) === String(session);
    });
    if (existing) { skipped++; return; }

    // Find fee structure
    var fee = feeStructures.find(function(f) {
      return String(f.className) === String(className) &&
             String(f.term) === String(term) && String(f.session) === String(session);
    });
    if (!fee) { skipped++; return; }

    var total = safeFloat(fee.totalFee, 0);
    var credit = getStudentCreditBalance(sid);
    var appliedCredit = 0;
    if (credit > 0) {
      appliedCredit = Math.min(credit, total);
    }
    
    var finalBalance = total - appliedCredit;
    var status = finalBalance <= 0 ? 'Paid' : (appliedCredit > 0 ? 'Partial' : 'Outstanding');
    
    var id = generateId();
    billSheet.appendRow([id, sid, student.fullName, className, term, session, total, appliedCredit, finalBalance, status, todayISO()]);
    
    if (appliedCredit > 0) {
      var paySheet = getSpreadsheet().getSheetByName('Payments');
      var receiptRef = generateReceiptRef();
      var payId = generateId();
      paySheet.appendRow([payId, id, sid, term, session,
        appliedCredit, todayISO(), 'Credit Deduction', receiptRef, recordedByUserId || 'system', 'false', 'Approved', '']);
    }

    generated++;
  });

  SpreadsheetApp.flush();
  logAudit(recordedByUserId, 'GENERATE_BILLS', term + ' ' + session + ': ' + generated + ' bills, ' + skipped + ' skipped');
  return { success: true, message: generated + ' bill(s) generated. ' + skipped + ' skipped (existing or no fee structure).' };
}

function getAllBills(filters) {
  var bills = getSheetData('Bills');
  if (!filters) return bills;
  // Pre-load students for section filtering (more reliable than class lookup)
  var students = filters.section && filters.section !== 'both' ? getAllStudents() : null;
  return bills.filter(function(b) {
    var ok = true;
    if (filters.term && String(b.term) !== String(filters.term)) ok = false;
    if (filters.session && String(b.session) !== String(filters.session)) ok = false;
    if (filters.className && String(b.class || b.className || '') !== String(filters.className)) ok = false;
    if (filters.status && String(b.status || '').toLowerCase() !== String(filters.status).toLowerCase()) ok = false;
    if (filters.studentId && String(b.studentID || b.studentId) !== String(filters.studentId)) ok = false;
    if (students && ok) {
      var student = students.find(function(s) { return String(s.iD || s.id) === String(b.studentID || b.studentId); });
      // Exclude if student not found or belongs to a different section
      if (!student || student.section !== filters.section) ok = false;
    }
    return ok;
  });
}

function getStudentBill(studentId, term, session) {
  return getSheetData('Bills').find(function(b) {
    return String(b.studentID || b.studentId) === String(studentId) &&
           String(b.term) === String(term) && String(b.session) === String(session);
  }) || null;
}

// ─── PAYMENT RECORDING ──────────────────────────────────────

function recordPayment(data, recordedByUserId) {
  if (!data.studentId || !data.term || !data.session || !data.amount)
    return { success: false, message: 'Student, term, session, and amount required.' };

  var amount = safeFloat(data.amount, 0);
  if (amount <= 0) return { success: false, message: 'Amount must be greater than zero.' };

  // Find or create bill
  var bill = getStudentBill(data.studentId, data.term, data.session);
  if (!bill) return { success: false, message: 'Bill not found. Please generate bills first.' };

  var billId = bill.iD || bill.id;
  var newPaid = safeFloat(bill.totalPaid, 0) + amount;
  var billed = safeFloat(bill.totalBilled, 0);
  var newBalance = billed - newPaid;
  var status = newBalance <= 0 ? 'Paid' : (newPaid > 0 ? 'Partial' : 'Outstanding');

  // Update bill
  var billSheet = getSpreadsheet().getSheetByName('Bills');
  var billRow = findRowById(billSheet, billId);
  if (billRow > 0) {
    billSheet.getRange(billRow, 8).setValue(newPaid);
    billSheet.getRange(billRow, 9).setValue(Math.max(0, newBalance));
    billSheet.getRange(billRow, 10).setValue(status);
  }

  // Record payment (Approved by default for staff)
  var paySheet = getSpreadsheet().getSheetByName('Payments');
  var receiptRef = generateReceiptRef();
  var payId = generateId();
  paySheet.appendRow([payId, billId, data.studentId, data.term, data.session,
    amount, todayISO(), data.method || 'Cash', receiptRef, recordedByUserId || '', 'false', 'Approved', '']);

  SpreadsheetApp.flush();
  logAudit(recordedByUserId, 'RECORD_PAYMENT', 'Student: ' + data.studentId + ' Amount: ' + amount + ' Ref: ' + receiptRef);

  // Send email receipt to parent
  try { sendPaymentReceipt(payId); } catch(e) { Logger.log('Email failed: ' + e); }

  return { success: true, paymentId: payId, receiptRef: receiptRef,
    newBalance: Math.max(0, newBalance), status: status,
    message: 'Payment of ' + formatNaira(amount) + ' recorded. Ref: ' + receiptRef };
}

// ─── PARENT WORKFLOW ──────────────────────────────────────────

function parentSubmitPayment(data, recordedByUserId) {
  if (!data.studentId || !data.term || !data.session || !data.amount)
    return { success: false, message: 'Student, term, session, and amount required.' };

  var amount = safeFloat(data.amount, 0);
  if (amount <= 0) return { success: false, message: 'Amount must be greater than zero.' };

  var bill = getStudentBill(data.studentId, data.term, data.session);
  if (!bill) return { success: false, message: 'Bill not found. Cannot submit payment.' };

  var receiptUrl = '';
  if (data.proofOfPayment) {
    receiptUrl = uploadReceiptToDrive(data.proofOfPayment, 'Receipt_' + data.studentId + '_' + Date.now());
  }

  var paySheet = getSpreadsheet().getSheetByName('Payments');
  var receiptRef = generateReceiptRef();
  var payId = generateId();
  
  // Notice we DO NOT update the Bills sheet here. Status is 'Pending'.
  paySheet.appendRow([payId, bill.iD || bill.id, data.studentId, data.term, data.session,
    amount, todayISO(), data.method || 'Bank Transfer', receiptRef, recordedByUserId || '', 'false', 'Pending', receiptUrl]);

  SpreadsheetApp.flush();
  logAudit(recordedByUserId, 'SUBMIT_PAYMENT', 'Student: ' + data.studentId + ' Amount: ' + amount + ' Ref: ' + receiptRef);

  return { success: true, paymentId: payId, receiptRef: receiptRef,
    message: 'Payment of ' + formatNaira(amount) + ' submitted for validation.' };
}

function approvePayment(paymentId, approverUserId) {
  var paySheet = getSpreadsheet().getSheetByName('Payments');
  var pRow = findRowById(paySheet, paymentId);
  if (pRow === -1) return { success: false, message: 'Payment not found.' };

  var currentStatus = paySheet.getRange(pRow, 12).getValue();
  if (currentStatus === 'Approved') return { success: false, message: 'Already approved.' };

  var billId = paySheet.getRange(pRow, 2).getValue();
  var amount = safeFloat(paySheet.getRange(pRow, 6).getValue(), 0);

  // Update payment status
  paySheet.getRange(pRow, 12).setValue('Approved');

  // Update bill balance
  var billSheet = getSpreadsheet().getSheetByName('Bills');
  var bRow = findRowById(billSheet, billId);
  if (bRow > 0) {
    var billed = safeFloat(billSheet.getRange(bRow, 7).getValue(), 0);
    var oldPaid = safeFloat(billSheet.getRange(bRow, 8).getValue(), 0);
    var newPaid = oldPaid + amount;
    var newBalance = billed - newPaid;
    var bStatus = newBalance <= 0 ? 'Paid' : (newPaid > 0 ? 'Partial' : 'Outstanding');

    billSheet.getRange(bRow, 8).setValue(newPaid);
    billSheet.getRange(bRow, 9).setValue(Math.max(0, newBalance));
    billSheet.getRange(bRow, 10).setValue(bStatus);
  }

  SpreadsheetApp.flush();
  logAudit(approverUserId, 'APPROVE_PAYMENT', 'Payment ID: ' + paymentId);

  // Send receipt email
  try { sendPaymentReceipt(paymentId); } catch(e) {}

  return { success: true, message: 'Payment approved successfully.' };
}

function rejectPayment(paymentId, rejectorUserId) {
  var paySheet = getSpreadsheet().getSheetByName('Payments');
  var pRow = findRowById(paySheet, paymentId);
  if (pRow === -1) return { success: false, message: 'Payment not found.' };

  var currentStatus = paySheet.getRange(pRow, 12).getValue();
  if (currentStatus === 'Approved') return { success: false, message: 'Cannot reject an already approved payment.' };

  paySheet.getRange(pRow, 12).setValue('Rejected');
  SpreadsheetApp.flush();
  logAudit(rejectorUserId, 'REJECT_PAYMENT', 'Payment ID: ' + paymentId);

  // Send rejection email to parent
  try { sendPaymentRejection(paymentId); } catch(e) { Logger.log('Reject email error: ' + e); }

  return { success: true, message: 'Payment rejected.' };
}

function reversePayment(paymentId, reason, userId) {
  var paySheet = getSpreadsheet().getSheetByName('Payments');
  var pRow = findRowById(paySheet, paymentId);
  if (pRow === -1) return { success: false, message: 'Payment not found.' };

  var currentStatus = paySheet.getRange(pRow, 12).getValue();
  if (currentStatus !== 'Approved') return { success: false, message: 'Only approved payments can be reversed.' };

  var billId = paySheet.getRange(pRow, 2).getValue();
  var amount = safeFloat(paySheet.getRange(pRow, 6).getValue(), 0);

  // Update payment status
  paySheet.getRange(pRow, 12).setValue('Reversed');

  // Update bill balance
  var billSheet = getSpreadsheet().getSheetByName('Bills');
  var bRow = findRowById(billSheet, billId);
  if (bRow > 0) {
    var billed = safeFloat(billSheet.getRange(bRow, 7).getValue(), 0);
    var oldPaid = safeFloat(billSheet.getRange(bRow, 8).getValue(), 0);
    var newPaid = Math.max(0, oldPaid - amount);
    var newBalance = billed - newPaid;
    var bStatus = newBalance <= 0 ? 'Paid' : (newPaid > 0 ? 'Partial' : 'Outstanding');

    billSheet.getRange(bRow, 8).setValue(newPaid);
    billSheet.getRange(bRow, 9).setValue(Math.max(0, newBalance));
    billSheet.getRange(bRow, 10).setValue(bStatus);
  }

  SpreadsheetApp.flush();
  logAudit(userId, 'REVERSE_PAYMENT', 'Payment ID: ' + paymentId + ' Reason: ' + (reason || 'No reason provided'));

  return { success: true, message: 'Payment reversed successfully.' };
}

function recordCreditNote(data, recordedByUserId) {
  if (!data.studentId || !data.term || !data.session || !data.amount || !data.type)
    return { success: false, message: 'Student, term, session, amount, and type required.' };

  var amount = safeFloat(data.amount, 0);
  if (amount <= 0) return { success: false, message: 'Amount must be greater than zero.' };

  var bill = getStudentBill(data.studentId, data.term, data.session);
  if (!bill) return { success: false, message: 'Bill not found. Please generate bills first.' };

  var currentBalance = safeFloat(bill.balance, 0);
  if (data.type === 'Write-Off' && amount > currentBalance) {
      amount = currentBalance; // Cap write-off to current balance
  }

  if (amount <= 0) return { success: false, message: 'Adjusted amount is zero. Nothing to do.' };

  var billId = bill.iD || bill.id;
  var newPaid = safeFloat(bill.totalPaid, 0) + amount;
  var billed = safeFloat(bill.totalBilled, 0);
  var newBalance = billed - newPaid;
  var status = newBalance <= 0 ? 'Paid' : (newPaid > 0 ? 'Partial' : 'Outstanding');

  var billSheet = getSpreadsheet().getSheetByName('Bills');
  var billRow = findRowById(billSheet, billId);
  if (billRow > 0) {
    billSheet.getRange(billRow, 8).setValue(newPaid);
    billSheet.getRange(billRow, 9).setValue(data.type === 'Credit Note' ? newBalance : Math.max(0, newBalance));
    billSheet.getRange(billRow, 10).setValue(status);
  }

  var paySheet = getSpreadsheet().getSheetByName('Payments');
  var receiptRef = data.type === 'Write-Off' ? 'WO-' + generateId().substring(0,6) : 'CN-' + generateId().substring(0,6);
  var payId = generateId();
  paySheet.appendRow([payId, billId, data.studentId, data.term, data.session,
    amount, todayISO(), data.type, receiptRef, recordedByUserId || '', 'false', 'Approved', '']);

  SpreadsheetApp.flush();
  logAudit(recordedByUserId, 'RECORD_' + data.type.toUpperCase().replace('-','_'), 'Student: ' + data.studentId + ' Amount: ' + amount + ' Reason: ' + (data.reason || ''));

  return { success: true, paymentId: payId,
    newBalance: data.type === 'Credit Note' ? newBalance : Math.max(0, newBalance), status: status,
    message: data.type + ' of ' + formatNaira(amount) + ' recorded.' };
}

function getAllPayments(filters) {
  var payments = getSheetData('Payments');
  if (!filters) return payments;
  var students = filters.section && filters.section !== 'both' ? getAllStudents() : null;
  return payments.filter(function(p) {
    var ok = true;
    if (filters.studentId && String(p.studentID || p.studentId) !== String(filters.studentId)) ok = false;
    if (filters.term && String(p.term) !== String(filters.term)) ok = false;
    if (filters.session && String(p.session) !== String(filters.session)) ok = false;
    if (filters.status && String(p.status || '').toLowerCase() !== String(filters.status).toLowerCase()) ok = false;
    if (students && ok) {
      var student = students.find(function(s) { return String(s.iD || s.id) === String(p.studentID || p.studentId); });
      // Exclude if student not found or belongs to a different section
      if (!student || student.section !== filters.section) ok = false;
    }
    return ok;
  });
}

function getStudentPayments(studentId) {
  return getSheetData('Payments').filter(function(p) {
    return String(p.studentID || p.studentId) === String(studentId);
  });
}

function getStudentLedger(studentId) {
  var bills = getAllBills({ studentId: studentId });
  var payments = getStudentPayments(studentId);
  return { bills: bills, payments: payments, creditBalance: getStudentCreditBalance(studentId) };
}

// ─── DEBTORS ────────────────────────────────────────────────

function getDebtors(term, session) {
  return getAllBills({ term: term, session: session }).filter(function(b) {
    return String(b.status || '').toLowerCase() !== 'paid';
  }).sort(function(a, b) { return safeFloat(b.balance, 0) - safeFloat(a.balance, 0); });
}

// ─── EXPENSES ───────────────────────────────────────────────

function getAllExpenses(filters) {
  var expenses = getSheetData('Expenses');
  if (!filters) return expenses;
  return expenses.filter(function(e) {
    var ok = true;
    if (filters.section && String(e.section) !== String(filters.section)) ok = false;
    if (filters.category && String(e.category).toLowerCase() !== String(filters.category).toLowerCase()) ok = false;
    return ok;
  });
}

function recordExpense(data, recordedByUserId) {
  if (!data.category || !data.amount) return { success: false, message: 'Category and amount required.' };
  var sheet = getSpreadsheet().getSheetByName('Expenses');
  var id = generateId();
  sheet.appendRow([id, data.category, data.description || '', safeFloat(data.amount, 0),
    data.date || todayISO(), recordedByUserId || '', data.section || 'both']);
  logAudit(recordedByUserId, 'RECORD_EXPENSE', data.category + ': ' + data.amount);
  return { success: true, id: id, message: 'Expense recorded.' };
}

function deleteExpense(expenseId, userId) {
  var sheet = getSpreadsheet().getSheetByName('Expenses');
  var row = findRowById(sheet, expenseId);
  if (row === -1) return { success: false, message: 'Expense not found.' };
  sheet.deleteRow(row);
  logAudit(userId, 'DELETE_EXPENSE', 'Expense ID: ' + expenseId);
  return { success: true, message: 'Expense deleted.' };
}

// ─── INCOME & EXPENDITURE REPORT ────────────────────────────

function getIncomeExpenseReport(term, session) {
  // Only count Approved payments as confirmed income
  var payments = getAllPayments({ term: term, session: session });
  var approvedPayments = payments.filter(function(p) { return String(p.status || '').toLowerCase() === 'approved'; });
  var pendingPayments = payments.filter(function(p) { return String(p.status || '').toLowerCase() === 'pending'; });
  var expenses = getAllExpenses();

  var totalIncome = approvedPayments.reduce(function(sum, p) { return sum + safeFloat(p.amount, 0); }, 0);
  var totalPending = pendingPayments.reduce(function(sum, p) { return sum + safeFloat(p.amount, 0); }, 0);
  var totalExpenses = expenses.reduce(function(sum, e) { return sum + safeFloat(e.amount, 0); }, 0);
  var netBalance = totalIncome - totalExpenses;

  // Group expenses by category
  var byCategory = {};
  expenses.forEach(function(e) {
    var cat = e.category || 'Other';
    byCategory[cat] = (byCategory[cat] || 0) + safeFloat(e.amount, 0);
  });

  return {
    term: term, session: session,
    totalIncome: totalIncome, totalPending: totalPending, totalExpenses: totalExpenses, netBalance: netBalance,
    expensesByCategory: byCategory,
    totalPayments: approvedPayments.length, pendingCount: pendingPayments.length, totalExpenseRecords: expenses.length
  };
}

// ─── FINANCIAL DASHBOARD STATS ───────────────────────────────

function getFinancialDashboardStats(term, session, section) {
  var filters = { term: term, session: session };
  if (section && section !== 'both') filters.section = section;
  
  var bills = getAllBills(filters);
  var payments = getAllPayments(filters);
  var expenses = getAllExpenses(section && section !== 'both' ? { section: section } : null);
  
  var totalBilled = bills.reduce(function(s, b) { return s + safeFloat(b.totalBilled, 0); }, 0);
  var totalCollected = bills.reduce(function(s, b) { return s + safeFloat(b.totalPaid, 0); }, 0);
  var totalOutstanding = bills.reduce(function(s, b) { return s + safeFloat(b.balance, 0); }, 0);
  var totalExpenses = expenses.reduce(function(s, e) { return s + safeFloat(e.amount, 0); }, 0);
  var paidCount = bills.filter(function(b) { return String(b.status) === 'Paid'; }).length;
  var partialCount = bills.filter(function(b) { return String(b.status) === 'Partial'; }).length;
  var outstandingCount = bills.filter(function(b) { return String(b.status) === 'Outstanding'; }).length;
  return {
    totalBilled: totalBilled, totalCollected: totalCollected,
    totalOutstanding: totalOutstanding, totalExpenses: totalExpenses,
    netBalance: totalCollected - totalExpenses, totalStudentsBilled: bills.length,
    paidCount: paidCount, partialCount: partialCount, outstandingCount: outstandingCount
  };
}

function getStudentCreditBalance(studentId) {
  var payments = getSheetData('Payments').filter(function(p) {
    return String(p.studentID || p.studentId) === String(studentId) && 
           String(p.status).toLowerCase() === 'approved' &&
           String(p.method).toLowerCase() !== 'credit deduction';
  });
  var bills = getSheetData('Bills').filter(function(b) {
    return String(b.studentID || b.studentId) === String(studentId);
  });

  var totalPaid = payments.reduce(function(sum, p) { return sum + safeFloat(p.amount, 0); }, 0);
  var totalBilled = bills.reduce(function(sum, b) { return sum + safeFloat(b.totalBilled, 0); }, 0);

  var credit = totalPaid - totalBilled;
  return credit > 0 ? credit : 0;
}
