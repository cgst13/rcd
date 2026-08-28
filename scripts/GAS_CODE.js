// GOOGLE APPS SCRIPT CODE
// 1. Go to https://script.google.com/
// 2. Create a new project attached to your Google Sheet
// 3. Paste this code
// 4. Deploy > New Deployment > Web App
//    - Execute as: Me
//    - Who has access: Anyone
// 5. Copy the Web App URL and put it in your .env file as VITE_GOOGLE_SCRIPT_URL

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === 'login') {
      return handleLogin(data);
    } else if (action === 'submitReport') {
      return handleSubmitReport(data);
    } else if (action === 'getReports') {
      return handleGetReports(data);
    }

    return ContentService.createTextOutput(JSON.stringify({ 'result': 'error', 'message': 'Invalid action' })).setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({ 'result': 'error', 'error': e.toString() })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function handleLogin(data) {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  
  // AUTO-SETUP: If Users sheet is missing, create it and add default admin
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Users');
    sheet.appendRow(['Email', 'Password', 'Name', 'Role']);
    sheet.appendRow(['admin@lgu.gov.ph', 'admin', 'Admin User', 'admin']);
    // Optional: Log this creation
    Logger.log('Users sheet created with default admin.');
  }
  
  const rows = sheet.getDataRange().getValues();
  // Skip header
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] == data.email && rows[i][1] == data.password) {
      return successResponse({
        email: rows[i][0],
        name: rows[i][2],
        role: rows[i][3]
      });
    }
  }
  return errorResponse('Invalid credentials');
}

function handleSubmitReport(data) {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Reports');
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Reports');
    sheet.appendRow(['Date', 'Report Number', 'Collector', 'Fund Type', 'Total Collection', 'Status', 'JSON Data']);
  }

  const report = data.report;
  sheet.appendRow([
    report.date,
    report.reportNumber,
    report.collectorName,
    report.fundType,
    report.totalCollection,
    report.status,
    JSON.stringify(report) // Store full JSON for easy retrieval
  ]);

  return successResponse({ message: 'Report saved successfully' });
}

function handleGetReports(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Reports');
  if (!sheet) return successResponse({ reports: [] });

  const rows = sheet.getDataRange().getValues();
  const reports = [];
  
  // Skip header, read from bottom up (newest first), limit to 50
  for (let i = rows.length - 1; i >= 1; i--) {
    if (reports.length >= 50) break;
    try {
      // Column 6 (index 6) is the JSON data
      const jsonStr = rows[i][6];
      if (jsonStr) {
        reports.push(JSON.parse(jsonStr));
      }
    } catch (e) {
      // Ignore malformed rows
    }
  }

  return successResponse({ reports: reports });
}

function successResponse(data) {
  return ContentService.createTextOutput(JSON.stringify({ 'result': 'success', ...data })).setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(message) {
  return ContentService.createTextOutput(JSON.stringify({ 'result': 'error', 'message': message })).setMimeType(ContentService.MimeType.JSON);
}

// Handle CORS for GET requests (if used)
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ 'status': 'alive' })).setMimeType(ContentService.MimeType.JSON);
}
