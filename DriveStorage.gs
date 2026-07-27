/**
 * ============================================================
 *  MYSCHOOL PORTAL - DriveStorage.gs
 *  Google Drive File Management (PDFs, Images, Documents)
 * ============================================================
 *  Centralised upload, link, and delete helpers.
 *  All files are stored in Google Drive; their URLs are stored in Firestore.
 *
 *  Drive folder structure (auto-created):
 *    [School Name]/
 *    +-- Reports/        <- Result card PDFs
 *    +-- Receipts/       <- Payment receipt PDFs
 *    +-- ProfilePics/    <- Student and staff profile photos
 *    +-- Logos/          <- School logo
 *    +-- Signatures/     <- Staff signature images
 *    +-- Exports/        <- Bulk CSV / data exports
 * ============================================================
 */

// --- FOLDER MANAGEMENT ---------------------------------------

/**
 * Get or create a nested folder path ("School/Reports").
 * @param {string} folderPath - slash-separated folder path
 * @returns {Folder}
 */
function getOrCreateFolderPath(folderPath) {
  var parts = folderPath.split('/').map(function(p) { return p.trim(); }).filter(Boolean);
  var current = DriveApp.getRootFolder();
  for (var i = 0; i < parts.length; i++) {
    var iter = current.getFoldersByName(parts[i]);
    current = iter.hasNext() ? iter.next() : current.createFolder(parts[i]);
  }
  return current;
}

/**
 * Backward-compatible alias used by existing code.
 * @param {string} folderName - single folder name (no slashes)
 */
function getOrCreateFolder(folderName) {
  return getOrCreateFolderPath(folderName);
}

/** Get the school root folder name from settings (safe for Drive naming). */
function getSchoolFolderName() {
  try {
    var s = getSettings();
    return (s.school_name || 'MySchool Portal').replace(/[\/\\:*?"<>|]/g, '_');
  } catch(e) {
    return 'MySchool Portal';
  }
}

/** Build the full folder path for a given subfolder. */
function _drivePath(subFolder) {
  return getSchoolFolderName() + '/' + (subFolder || 'Files');
}

// --- FILE UPLOAD ---------------------------------------------

/**
 * Upload a base64 data URI to Google Drive.
 * @param {string} base64Data - "data:mime/type;base64,..." or plain base64
 * @param {string} filename
 * @param {string} subFolder  - subfolder name under the school root
 * @returns {{ fileId, viewUrl, downloadUrl, previewUrl }}
 */
function uploadFileToDrive(base64Data, filename, subFolder) {
  if (!base64Data) return _emptyDriveResult();
  try {
    var contentType, base64;
    if (String(base64Data).indexOf('data:') === 0) {
      var parts = base64Data.split(',');
      contentType = parts[0].split(':')[1].split(';')[0];
      base64 = parts[1];
    } else {
      contentType = 'application/octet-stream';
      base64 = base64Data;
    }
    var blob = Utilities.newBlob(
      Utilities.base64Decode(base64),
      contentType,
      filename || 'file_' + Date.now()
    );
    var folder = getOrCreateFolderPath(_drivePath(subFolder));
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return _buildDriveResult(file);
  } catch(e) {
    Logger.log('uploadFileToDrive error: ' + e.message);
    return _emptyDriveResult();
  }
}

/**
 * Upload a Blob (e.g. PDF blob from Utilities.newBlob) directly to Drive.
 * @param {Blob}   blob
 * @param {string} subFolder
 * @returns {{ fileId, viewUrl, downloadUrl, previewUrl }}
 */
function uploadBlobToDrive(blob, subFolder) {
  if (!blob) return _emptyDriveResult();
  try {
    var folder = getOrCreateFolderPath(_drivePath(subFolder));
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return _buildDriveResult(file);
  } catch(e) {
    Logger.log('uploadBlobToDrive error: ' + e.message);
    return _emptyDriveResult();
  }
}

/**
 * Backward-compatible wrapper for old uploadReceiptToDrive() calls.
 * @returns {string} viewUrl or empty string
 */
function uploadReceiptToDrive(base64Data, filename) {
  var result = uploadFileToDrive(base64Data, filename || 'receipt_' + Date.now(), 'Receipts');
  return result.viewUrl || '';
}

/**
 * Delete a file from Drive by ID. Moves to Trash (non-destructive).
 */
function deleteFileFromDrive(fileId) {
  if (!fileId) return;
  try {
    var fid = extractDriveFileId(fileId) || fileId;
    DriveApp.getFileById(fid).setTrashed(true);
  } catch(e) {
    Logger.log('deleteFileFromDrive: ' + e.message);
  }
}

/**
 * Replace a file: trash the old one, upload the new one.
 * @param {string} oldFileId  - Drive file ID to replace (can be null/empty)
 * @param {string} base64Data - New data URI
 * @param {string} filename
 * @param {string} subFolder
 */
function replaceFileInDrive(oldFileId, base64Data, filename, subFolder) {
  if (oldFileId) deleteFileFromDrive(oldFileId);
  return uploadFileToDrive(base64Data, filename, subFolder);
}

// --- URL HELPERS ---------------------------------------------

function _buildDriveResult(file) {
  var id = file.getId();
  return {
    fileId:      id,
    viewUrl:     file.getUrl(),
    downloadUrl: 'https://drive.google.com/uc?export=download&id=' + id,
    previewUrl:  'https://drive.google.com/file/d/' + id + '/preview'
  };
}

function _emptyDriveResult() {
  return { fileId: '', viewUrl: '', downloadUrl: '', previewUrl: '' };
}

/**
 * Extract a Drive file ID from any Drive URL format.
 * Handles /d/{id}/, id={id}, and bare IDs.
 */
function extractDriveFileId(url) {
  if (!url) return null;
  var m = String(url).match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = String(url).match(/id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  // If it looks like a raw ID (no slashes, 25-44 chars), return as-is
  if (/^[a-zA-Z0-9_-]{25,44}$/.test(url)) return url;
  return null;
}

/** Return public URL set for an existing Drive file ID. */
function getDriveFileUrls(fileId) {
  if (!fileId) return _emptyDriveResult();
  var id = extractDriveFileId(fileId) || fileId;
  return {
    fileId:      id,
    viewUrl:     'https://drive.google.com/file/d/' + id + '/view',
    downloadUrl: 'https://drive.google.com/uc?export=download&id=' + id,
    previewUrl:  'https://drive.google.com/file/d/' + id + '/preview'
  };
}

// --- IMAGE TO BASE64 ----------------------------------------

/**
 * Convert a public URL or Google Drive URL to a Base64 data URI.
 * Used for embedding images in generated PDFs.
 * Compatible with the old Utils.gs imageToBase64() signature.
 */
function imageToBase64(url) {
  if (!url) return '';
  if (String(url).indexOf('data:') === 0) return url;
  try {
    var blob = null;
    var fileId = extractDriveFileId(url);
    if (fileId) {
      blob = DriveApp.getFileById(fileId).getBlob();
    } else {
      var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (resp.getResponseCode() === 200) blob = resp.getBlob();
    }
    if (blob) {
      return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
    }
  } catch(e) {
    Logger.log('imageToBase64 failed: ' + e);
  }
  return url;
}
