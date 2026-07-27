/**
 * ============================================================
 *  MYSCHOOL PORTAL - Firebase.gs
 *  Firestore REST API Client for Google Apps Script
 * ============================================================
 *  Replaces all Google Sheets data operations.
 *
 *  SETUP: Store in Script Properties (Project Settings -> Script Properties):
 *    FIREBASE_PROJECT_ID   - e.g. "myschool-abc123"
 *    FIREBASE_CLIENT_EMAIL - service account email
 *    FIREBASE_PRIVATE_KEY  - full PEM private key block
 *
 *  How to get these:
 *    1. Go to console.firebase.google.com and open your project
 *    2. Project Settings -> Service Accounts
 *    3. Click "Generate new private key" and download the JSON
 *    4. Copy project_id, client_email, private_key to Script Properties
 * ============================================================
 */

// --- CONFIGURATION -------------------------------------------

function getFirebaseConfig() {
  var props = PropertiesService.getScriptProperties();
  return {
    projectId:   props.getProperty('FIREBASE_PROJECT_ID'),
    clientEmail: props.getProperty('FIREBASE_CLIENT_EMAIL'),
    privateKey:  props.getProperty('FIREBASE_PRIVATE_KEY')
  };
}

function getFirestoreBaseUrl() {
  var cfg = getFirebaseConfig();
  if (!cfg.projectId) throw new Error('FIREBASE_PROJECT_ID not set in Script Properties.');
  return 'https://firestore.googleapis.com/v1/projects/' + cfg.projectId +
         '/databases/(default)/documents';
}

function getFirestoreRootPath() {
  var cfg = getFirebaseConfig();
  return 'projects/' + cfg.projectId + '/databases/(default)/documents';
}

// --- OAUTH2 TOKEN --------------------------------------------

/**
 * Generate an OAuth2 access token from the service account.
 * Cached for 55 min (tokens expire after 60 min).
 */
function getFirebaseToken() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('FB_ACCESS_TOKEN');
  if (cached) return cached;

  var cfg = getFirebaseConfig();
  if (!cfg.projectId || !cfg.clientEmail || !cfg.privateKey) {
    throw new Error('Firebase credentials incomplete. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in Script Properties.');
  }

  var now = Math.floor(Date.now() / 1000);
  var claim = {
    iss:   cfg.clientEmail,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now
  };

  var header  = _fbB64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  var payload = _fbB64url(JSON.stringify(claim));
  var sigInput = header + '.' + payload;
  var privateKey = cfg.privateKey.replace(/\\n/g, '\n');
  var sig = Utilities.base64EncodeWebSafe(
    Utilities.computeRsaSha256Signature(sigInput, privateKey)
  ).replace(/=+$/, '');
  var jwt = sigInput + '.' + sig;

  var resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method:      'post',
    contentType: 'application/x-www-form-urlencoded',
    payload:     'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt,
    muteHttpExceptions: true
  });

  var result = JSON.parse(resp.getContentText());
  if (!result.access_token) {
    throw new Error('Failed to get Firebase access token: ' + JSON.stringify(result));
  }
  cache.put('FB_ACCESS_TOKEN', result.access_token, 3300);
  return result.access_token;
}

function _fbB64url(str) {
  return Utilities.base64EncodeWebSafe(str).replace(/=+$/, '');
}

function _fbHeaders() {
  return { Authorization: 'Bearer ' + getFirebaseToken() };
}

// --- TYPE CONVERSION -----------------------------------------

function jsToFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean')          return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string')  return { stringValue: val };
  if (val instanceof Date)      return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(jsToFirestoreValue) } };
  }
  if (typeof val === 'object') {
    var fields = {};
    for (var k in val) {
      if (val.hasOwnProperty(k)) fields[k] = jsToFirestoreValue(val[k]);
    }
    return { mapValue: { fields: fields } };
  }
  return { stringValue: String(val) };
}

function firestoreValueToJs(val) {
  if (!val || typeof val !== 'object') return null;
  if ('nullValue'      in val) return null;
  if ('booleanValue'   in val) return val.booleanValue;
  if ('integerValue'   in val) return Number(val.integerValue);
  if ('doubleValue'    in val) return val.doubleValue;
  if ('stringValue'    in val) return val.stringValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue'     in val) return (val.arrayValue.values || []).map(firestoreValueToJs);
  if ('mapValue'       in val) return _fbFieldsToJs(val.mapValue.fields || {});
  return null;
}

function _fbFieldsToJs(fields) {
  var obj = {};
  for (var k in fields) {
    if (fields.hasOwnProperty(k)) obj[k] = firestoreValueToJs(fields[k]);
  }
  return obj;
}

function firestoreDocToJs(doc) {
  if (!doc || !doc.fields) return null;
  var obj = _fbFieldsToJs(doc.fields);
  if (doc.name) {
    var parts = doc.name.split('/');
    if (!obj.id) obj.id = parts[parts.length - 1];
  }
  return obj;
}

function jsToFirestoreFields(obj) {
  var fields = {};
  for (var k in obj) {
    if (obj.hasOwnProperty(k) && k !== '_docId') {
      fields[k] = jsToFirestoreValue(obj[k]);
    }
  }
  return fields;
}

// --- CRUD OPERATIONS -----------------------------------------

/** GET a single document by ID. Returns null if not found. */
function firebaseGet(collection, docId) {
  if (!docId) return null;
  var url = getFirestoreBaseUrl() + '/' + collection + '/' + encodeURIComponent(String(docId));
  var resp = UrlFetchApp.fetch(url, { method: 'get', headers: _fbHeaders(), muteHttpExceptions: true });
  if (resp.getResponseCode() === 404) return null;
  if (resp.getResponseCode() !== 200)
    throw new Error('Firestore GET [' + resp.getResponseCode() + ']: ' + resp.getContentText());
  return firestoreDocToJs(JSON.parse(resp.getContentText()));
}

/** SET (upsert) a document with a specific ID. Overwrites the whole document. */
function firebaseSet(collection, docId, data) {
  var url = getFirestoreBaseUrl() + '/' + collection + '/' + encodeURIComponent(String(docId));
  var resp = UrlFetchApp.fetch(url, {
    method: 'patch', contentType: 'application/json',
    headers: _fbHeaders(),
    payload: JSON.stringify({ fields: jsToFirestoreFields(data) }),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200)
    throw new Error('Firestore SET [' + resp.getResponseCode() + ']: ' + resp.getContentText());
  return firestoreDocToJs(JSON.parse(resp.getContentText()));
}

/**
 * PATCH (merge-update) specific fields only.
 * All other existing fields are preserved.
 */
function firebasePatch(collection, docId, data) {
  var fields = jsToFirestoreFields(data);
  var fieldKeys = Object.keys(fields);
  if (fieldKeys.length === 0) return;
  var maskParams = fieldKeys.map(function(k) {
    return 'updateMask.fieldPaths=' + encodeURIComponent(k);
  }).join('&');
  var url = getFirestoreBaseUrl() + '/' + collection + '/' +
            encodeURIComponent(String(docId)) + '?' + maskParams;
  var resp = UrlFetchApp.fetch(url, {
    method: 'patch', contentType: 'application/json',
    headers: _fbHeaders(),
    payload: JSON.stringify({ fields: fields }),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200)
    throw new Error('Firestore PATCH [' + resp.getResponseCode() + ']: ' + resp.getContentText());
  return firestoreDocToJs(JSON.parse(resp.getContentText()));
}

/** ADD a new document with an auto-generated ID. Returns the created doc with .id set. */
function firebaseAdd(collection, data) {
  var url = getFirestoreBaseUrl() + '/' + collection;
  var resp = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json',
    headers: _fbHeaders(),
    payload: JSON.stringify({ fields: jsToFirestoreFields(data) }),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200)
    throw new Error('Firestore ADD [' + resp.getResponseCode() + ']: ' + resp.getContentText());
  return firestoreDocToJs(JSON.parse(resp.getContentText()));
}

/** DELETE a document by ID. Silently succeeds if not found. */
function firebaseDelete(collection, docId) {
  if (!docId) return;
  var url = getFirestoreBaseUrl() + '/' + collection + '/' + encodeURIComponent(String(docId));
  var resp = UrlFetchApp.fetch(url, { method: 'delete', headers: _fbHeaders(), muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200 && resp.getResponseCode() !== 404)
    throw new Error('Firestore DELETE [' + resp.getResponseCode() + ']: ' + resp.getContentText());
  return true;
}

/** LIST all documents in a collection. Auto-paginates up to ~3000 docs. */
function firebaseGetAll(collection) {
  var results = [], pageToken = null;
  var baseUrl = getFirestoreBaseUrl() + '/' + collection;
  do {
    var url = baseUrl + '?pageSize=300' + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    var resp = UrlFetchApp.fetch(url, { method: 'get', headers: _fbHeaders(), muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200)
      throw new Error('Firestore LIST [' + resp.getResponseCode() + ']: ' + resp.getContentText());
    var data = JSON.parse(resp.getContentText());
    if (data.documents) {
      data.documents.forEach(function(doc) {
        var obj = firestoreDocToJs(doc);
        if (obj) results.push(obj);
      });
    }
    pageToken = data.nextPageToken || null;
  } while (pageToken);
  return results;
}

/** Check whether a document exists (no read). */
function firebaseExists(collection, docId) {
  var url = getFirestoreBaseUrl() + '/' + collection + '/' + encodeURIComponent(String(docId));
  var resp = UrlFetchApp.fetch(url, { method: 'get', headers: _fbHeaders(), muteHttpExceptions: true });
  return resp.getResponseCode() === 200;
}

// --- STRUCTURED QUERIES --------------------------------------

/**
 * Run a structured Firestore query.
 *
 * @param {string} collection  - Collection to query
 * @param {Array}  [filters]   - [{field, op, value}]
 *   op: 'EQUAL'|'NOT_EQUAL'|'LESS_THAN'|'LESS_THAN_OR_EQUAL'|
 *       'GREATER_THAN'|'GREATER_THAN_OR_EQUAL'|'ARRAY_CONTAINS'
 * @param {Object} [orderBy]   - {field, direction:'ASCENDING'|'DESCENDING'}
 * @param {number} [limit]     - Max docs to return
 *
 * NOTE: Multi-field queries require Composite Indexes in the Firebase Console.
 */
function firebaseQuery(collection, filters, orderBy, limit) {
  var cfg = getFirebaseConfig();
  var url = 'https://firestore.googleapis.com/v1/projects/' + cfg.projectId +
            '/databases/(default)/documents:runQuery';
  var sq = { from: [{ collectionId: collection }] };

  if (filters && filters.length > 0) {
    var ffs = filters.map(function(f) {
      return { fieldFilter: {
        field: { fieldPath: f.field },
        op: f.op || 'EQUAL',
        value: jsToFirestoreValue(f.value)
      }};
    });
    sq.where = ffs.length === 1 ? ffs[0] : { compositeFilter: { op: 'AND', filters: ffs } };
  }

  if (orderBy) {
    sq.orderBy = [{ field: { fieldPath: orderBy.field }, direction: orderBy.direction || 'ASCENDING' }];
  }
  if (limit) sq.limit = limit;

  var resp = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json',
    headers: _fbHeaders(),
    payload: JSON.stringify({ structuredQuery: sq }),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200)
    throw new Error('Firestore QUERY [' + resp.getResponseCode() + ']: ' + resp.getContentText());

  var rows = JSON.parse(resp.getContentText());
  return rows.filter(function(r) { return r.document; }).map(function(r) { return firestoreDocToJs(r.document); });
}

// --- BATCH WRITE ---------------------------------------------

/**
 * Atomic batch write up to 500 operations.
 * @param {Array} writes - [{type:'set'|'patch'|'delete', collection, docId, data}]
 */
function firebaseBatchWrite(writes) {
  var cfg = getFirebaseConfig();
  var url = 'https://firestore.googleapis.com/v1/projects/' + cfg.projectId + '/databases/(default)/documents:commit';
  var rootPath = getFirestoreRootPath();

  var batchWrites = writes.map(function(w) {
    var docPath = rootPath + '/' + w.collection + '/' + w.docId;
    if (w.type === 'delete') return { delete: docPath };
    var fields = jsToFirestoreFields(w.data || {});
    var op = { update: { name: docPath, fields: fields } };
    if (w.type === 'patch') op.updateMask = { fieldPaths: Object.keys(fields) };
    return op;
  });

  var resp = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json',
    headers: _fbHeaders(),
    payload: JSON.stringify({ writes: batchWrites }),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200)
    throw new Error('Firestore BATCH [' + resp.getResponseCode() + ']: ' + resp.getContentText());
  return true;
}

// --- CACHE HELPERS -------------------------------------------

/**
 * Return a cached collection, or fetch from Firestore and cache it.
 * Use for small, rarely-changing collections (classes, subjects, settings).
 */
function firebaseCached(collection, ttlSeconds) {
  var cache = CacheService.getScriptCache();
  var key = 'FB_COL_' + collection;
  var cached = cache.get(key);
  if (cached) { try { return JSON.parse(cached); } catch(e) {} }
  var docs = firebaseGetAll(collection);
  try {
    var json = JSON.stringify(docs);
    if (json.length < 100000) cache.put(key, json, ttlSeconds || 1800);
  } catch(e) {}
  return docs;
}

/** Invalidate a collection cache entry. */
function clearFirebaseCache(collection) {
  try { CacheService.getScriptCache().remove('FB_COL_' + collection); } catch(e) {}
}

// --- CONNECTION TEST -----------------------------------------

/**
 * Test Firebase connectivity. Run once from the Apps Script editor
 * after adding credentials to Script Properties.
 */
function testFirebaseConnection() {
  try {
    Logger.log('[1] Requesting access token...');
    getFirebaseToken();
    Logger.log('    OK');
    var testId = '_test_' + Date.now();
    Logger.log('[2] Writing test document...');
    firebaseSet('_connectivity', testId, { ok: true, ts: new Date().toISOString() });
    Logger.log('    OK');
    Logger.log('[3] Reading test document...');
    var doc = firebaseGet('_connectivity', testId);
    Logger.log('    ' + JSON.stringify(doc));
    Logger.log('[4] Deleting test document...');
    firebaseDelete('_connectivity', testId);
    Logger.log('Firebase connection test PASSED.');
    return { success: true, message: 'Firebase Firestore is connected and working.' };
  } catch (e) {
    Logger.log('Firebase connection test FAILED: ' + e.message);
    return { success: false, message: e.message };
  }
}
