const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
require('dotenv').config();
const { ensureSpreadsheet } = require('./setup');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Google Sheets Auth
// Expects 'credentials.json' in the root of the server directory
// OR GOOGLE_SERVICE_ACCOUNT_JSON env var
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || 'credentials.json',
  scopes: SCOPES,
});

const sheets = google.sheets({ version: 'v4', auth });
let SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// Initialize
(async () => {
  try {
    console.log('Initializing server...');
    SPREADSHEET_ID = await ensureSpreadsheet(SPREADSHEET_ID);
    console.log(`Server initialized with Spreadsheet ID: ${SPREADSHEET_ID}`);
  } catch (error) {
    console.error('Failed to initialize spreadsheet:', error);
  }
})();

// Helper to get sheet data
async function getSheetData(range) {
  if (!SPREADSHEET_ID) throw new Error('Spreadsheet ID not initialized');
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  return response.data.values || [];
}

// Helper to append data
async function appendSheetData(range, values) {
  if (!SPREADSHEET_ID) throw new Error('Spreadsheet ID not initialized');
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [values],
    },
  });
  return response.data.values;
}

// Routes

// 1. LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const rows = await getSheetData('Users!A:D'); // Email, Password, Name, Role
    
    // Skip header (index 0)
    const user = rows.slice(1).find(row => row[0] === email && row[1] === password);
    
    if (user) {
      res.json({
        result: 'success',
        email: user[0],
        name: user[2],
        role: user[3]
      });
    } else {
      res.status(401).json({ result: 'error', message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ result: 'error', message: error.message });
  }
});

// 2. GET REPORTS
app.get('/api/reports', async (req, res) => {
  try {
    const rows = await getSheetData('Reports!A:G'); // JSON is in G (index 6)
    const reports = [];
    
    // Read from bottom up, skip header
    // rows[0] is header
    for (let i = rows.length - 1; i >= 1; i--) {
      if (reports.length >= 50) break;
      try {
        const jsonStr = rows[i][6];
        if (jsonStr) {
          reports.push(JSON.parse(jsonStr));
        }
      } catch (e) {
        console.warn('Failed to parse report row:', i);
      }
    }
    
    res.json({ result: 'success', reports });
  } catch (error) {
    console.error('Get Reports error:', error);
    res.status(500).json({ result: 'error', message: error.message });
  }
});

// 3. SUBMIT REPORT
app.post('/api/reports', async (req, res) => {
  try {
    const { report } = req.body;
    if (!report) return res.status(400).json({ message: 'Missing report data' });

    const row = [
      report.date,
      report.reportNumber,
      report.collectorName,
      report.fundType,
      report.totalCollection,
      report.status,
      JSON.stringify(report)
    ];

    await appendSheetData('Reports!A:G', row);
    res.json({ result: 'success', message: 'Report saved' });
  } catch (error) {
    console.error('Submit Report error:', error);
    res.status(500).json({ result: 'error', message: error.message });
  }
});

// 4. GET ACCOUNT CODES
app.get('/api/account-codes', async (req, res) => {
  try {
    const rows = await getSheetData("'Account Codes'!A:D"); // ID, Main, Sub, Code
    const codes = [];
    
    // Skip header
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 4) continue;
      codes.push({
        id: parseInt(row[0]),
        mainCategory: row[1],
        subCategory: row[2],
        code: row[3]
      });
    }
    
    res.json({ result: 'success', accountCodes: codes });
  } catch (error) {
    // If sheet doesn't exist, return empty
    if (error.message.includes('Unable to parse range')) {
      return res.json({ result: 'success', accountCodes: [] });
    }
    console.error('Get Account Codes error:', error);
    res.status(500).json({ result: 'error', message: error.message });
  }
});

// 5. SAVE ACCOUNT CODE (Upsert)
app.post('/api/account-codes', async (req, res) => {
  try {
    const { accountCode } = req.body;
    if (!accountCode) return res.status(400).json({ message: 'Missing data' });

    // We need to find if it exists to update it, or append if new.
    // However, Sheets API "update" requires knowing the specific range (Row number).
    // This is inefficient with simple "values.get". 
    // Optimization: Read all IDs, find index, update specific cell or append.
    
    const rows = await getSheetData("'Account Codes'!A:A"); // Get just IDs
    let rowIndex = -1;
    
    for (let i = 1; i < rows.length; i++) {
      if (parseInt(rows[i][0]) === accountCode.id) {
        rowIndex = i + 1; // 1-based index, +1 for header if we started at 1? No, rows includes header.
        // If rows includes header at 0. rows[1] is row 2.
        // rowIndex for API should be 2.
        rowIndex = i + 1;
        break;
      }
    }

    const values = [
      accountCode.id,
      accountCode.mainCategory,
      accountCode.subCategory,
      accountCode.code
    ];

    if (rowIndex > -1) {
      // Update existing
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `'Account Codes'!A${rowIndex}:D${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [values] }
      });
    } else {
      // Append new
      await appendSheetData("'Account Codes'!A:D", values);
    }

    res.json({ result: 'success' });
  } catch (error) {
    console.error('Save Account Code error:', error);
    res.status(500).json({ result: 'error', message: error.message });
  }
});

app.post('/api/account-codes/delete', async (req, res) => {
  try {
    const { id } = req.body;
    
    const rows = await getSheetData("'Account Codes'!A:A");
    let rowIndex = -1;
    
    for (let i = 1; i < rows.length; i++) {
      if (parseInt(rows[i][0]) === id) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex > -1) {
      // Clear the row content
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: `'Account Codes'!A${rowIndex}:D${rowIndex}`,
      });
      // Note: This leaves a blank row. Proper deletion requires batchUpdate 'deleteDimension'.
      // For simplicity in this demo, clearing is often acceptable or we implement proper delete.
      // Let's implement proper delete to keep sheet clean.
      
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: await getSheetId('Account Codes'),
                  dimension: 'ROWS',
                  startIndex: rowIndex - 1,
                  endIndex: rowIndex
                }
              }
            }
          ]
        }
      });
    }

    res.json({ result: 'success' });
  } catch (error) {
    console.error('Delete Account Code error:', error);
    res.status(500).json({ result: 'error', message: error.message });
  }
});

// Helper to get Sheet ID by title
async function getSheetId(title) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = meta.data.sheets.find(s => s.properties.title === title);
  return sheet ? sheet.properties.sheetId : 0;
}

// 6. COLLECTIONS
app.get('/api/collections', async (req, res) => {
  try {
    // Columns: ID, AF No., OR No., Payor, Sub Category, Main Category, Account Code, Amount, Date, Remarks
    const rows = await getSheetData("Collections!A:J");
    const entries = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 1) continue;
      entries.push({
        id: parseInt(row[0]),
        afNo: row[1],
        orNo: row[2],
        payor: row[3],
        subCategory: row[4],
        mainCategory: row[5],
        accountCode: row[6],
        amount: parseFloat(row[7] || 0),
        date: row[8],
        remarks: row[9]
      });
    }
    
    res.json({ result: 'success', entries });
  } catch (error) {
    console.error('Get Collections error:', error);
    res.status(500).json({ result: 'error', message: error.message });
  }
});

app.post('/api/collections', async (req, res) => {
  try {
    const { entry } = req.body;
    if (!entry) return res.status(400).json({ message: 'Missing entry data' });

    const row = [
      entry.id,
      entry.afNo,
      entry.orNo,
      entry.payor,
      entry.subCategory,
      entry.mainCategory,
      entry.accountCode,
      entry.amount,
      entry.date,
      entry.remarks
    ];

    await appendSheetData("Collections!A:J", row);
    res.json({ result: 'success' });
  } catch (error) {
    console.error('Save Collection error:', error);
    res.status(500).json({ result: 'error', message: error.message });
  }
});

async function getNextCollectionId() {
  const rows = await getSheetData("Collections!A:A");
  let maxId = 0;
  for (let i = 1; i < rows.length; i++) {
    const val = parseInt(rows[i][0]);
    if (!isNaN(val)) {
      maxId = Math.max(maxId, val);
    }
  }
  return maxId + 1;
}

app.post('/api/collections/bulk', async (req, res) => {
  try {
    const { header, charges } = req.body;
    if (!header || !Array.isArray(charges) || charges.length === 0) {
      return res.status(400).json({ message: 'Missing header or charges' });
    }
    const startId = await getNextCollectionId();
    for (let i = 0; i < charges.length; i++) {
      const c = charges[i];
      const row = [
        startId + i,
        header.afNo,
        header.orNo,
        header.payor,
        c.subCategory,
        c.mainCategory,
        c.accountCode,
        c.amount,
        header.date,
        header.remarks
      ];
      await appendSheetData("Collections!A:J", row);
    }
    res.json({ result: 'success', startId, count: charges.length });
  } catch (error) {
    console.error('Save Collections Bulk error:', error);
    res.status(500).json({ result: 'error', message: error.message });
  }
});

// 7. UPDATE COLLECTION ENTRY
app.post('/api/collections/update', async (req, res) => {
  try {
    const { entry } = req.body;
    if (!entry || !entry.id) return res.status(400).json({ message: 'Missing entry data or ID' });

    const rows = await getSheetData("Collections!A:A");
    let rowIndex = -1;
    
    for (let i = 1; i < rows.length; i++) {
      if (parseInt(rows[i][0]) === entry.id) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex > -1) {
      const row = [
        entry.id,
        entry.afNo,
        entry.orNo,
        entry.payor,
        entry.subCategory,
        entry.mainCategory,
        entry.accountCode,
        entry.amount,
        entry.date,
        entry.remarks
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Collections!A${rowIndex}:J${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [row] }
      });
      res.json({ result: 'success' });
    } else {
      res.status(404).json({ result: 'error', message: 'Entry not found' });
    }
  } catch (error) {
    console.error('Update Collection error:', error);
    res.status(500).json({ result: 'error', message: error.message });
  }
});

// 8. DELETE COLLECTION ENTRY
app.post('/api/collections/delete', async (req, res) => {
  try {
    const { id } = req.body;
    
    const rows = await getSheetData("Collections!A:A");
    let rowIndex = -1;
    
    for (let i = 1; i < rows.length; i++) {
      if (parseInt(rows[i][0]) === id) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex > -1) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: await getSheetId('Collections'),
                  dimension: 'ROWS',
                  startIndex: rowIndex - 1,
                  endIndex: rowIndex
                }
              }
            }
          ]
        }
      });
      res.json({ result: 'success' });
    } else {
      res.status(404).json({ result: 'error', message: 'Entry not found' });
    }
  } catch (error) {
    console.error('Delete Collection error:', error);
    res.status(500).json({ result: 'error', message: error.message });
  }
});

// 9. SIGNATORIES
app.get('/api/signatories', async (req, res) => {
  try {
    const rows = await getSheetData("Signatories!A:E"); // ID, Full Name, Position, Department, Remarks
    const signatories = [];
    
    // Skip header
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 4) continue;
      signatories.push({
        id: parseInt(row[0]),
        fullName: row[1],
        position: row[2],
        department: row[3],
        remarks: row[4] || ''
      });
    }
    
    res.json({ result: 'success', signatories });
  } catch (error) {
    if (error.message.includes('Unable to parse range')) {
      return res.json({ result: 'success', signatories: [] });
    }
    console.error('Get Signatories error:', error);
    res.status(500).json({ result: 'error', message: error.message });
  }
});

app.post('/api/signatories', async (req, res) => {
  try {
    const { signatory } = req.body;
    if (!signatory) return res.status(400).json({ message: 'Missing data' });

    const rows = await getSheetData("Signatories!A:A");
    let rowIndex = -1;
    
    // Check for update
    if (signatory.id) {
        for (let i = 1; i < rows.length; i++) {
            if (parseInt(rows[i][0]) === signatory.id) {
                rowIndex = i + 1;
                break;
            }
        }
    }

    const values = [
      signatory.id,
      signatory.fullName,
      signatory.position,
      signatory.department,
      signatory.remarks || ''
    ];

    if (rowIndex > -1) {
      // Update
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Signatories!A${rowIndex}:E${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [values] }
      });
    } else {
      // Append
      await appendSheetData("Signatories!A:E", values);
    }

    res.json({ result: 'success' });
  } catch (error) {
    console.error('Save Signatory error:', error);
    res.status(500).json({ result: 'error', message: error.message });
  }
});

app.post('/api/signatories/delete', async (req, res) => {
  try {
    const { id } = req.body;
    
    const rows = await getSheetData("Signatories!A:A");
    let rowIndex = -1;
    
    for (let i = 1; i < rows.length; i++) {
      if (parseInt(rows[i][0]) === id) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex > -1) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: await getSheetId('Signatories'),
                  dimension: 'ROWS',
                  startIndex: rowIndex - 1,
                  endIndex: rowIndex
                }
              }
            }
          ]
        }
      });
    }

    res.json({ result: 'success' });
  } catch (error) {
    console.error('Delete Signatory error:', error);
    res.status(500).json({ result: 'error', message: error.message });
  }
});

// 10. RPT COLLECTIONS
app.get('/api/rpt-collections', async (req, res) => {
  try {
    // Columns: ID, AF56 ID, OR Number, Payor, Barangay, Land Name, TD #, Years paid, Amount, Date, Remarks
    const rows = await getSheetData("'RPT Collections'!A:K");
    const collections = [];
    
    // Skip header
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 1) continue;
      
      // Helper to clean and parse amount string (removes currency symbols, commas, etc.)
      const parseAmount = (val) => {
        if (!val) return 0;
        // Convert to string, remove everything except digits, dots, and minus sign
        const cleaned = String(val).replace(/[^0-9.-]/g, '');
        return parseFloat(cleaned) || 0;
      };

      collections.push({
        id: parseInt(row[0]),
        af56Id: row[1],
        orNumber: row[2],
        payor: row[3],
        barangay: row[4],
        landName: row[5],
        tdNumber: row[6],
        yearsPaid: row[7],
        amount: parseAmount(row[8]),
        date: row[9],
        remarks: row[10] || ''
      });
    }
    
    res.json({ result: 'success', collections });
  } catch (error) {
    if (error.message.includes('Unable to parse range')) {
      return res.json({ result: 'success', collections: [] });
    }
    console.error('Get RPT Collections error:', error);
    res.status(500).json({ result: 'error', message: error.message });
  }
});

app.post('/api/rpt-collections', async (req, res) => {
  try {
    const { collection } = req.body;
    if (!collection) return res.status(400).json({ message: 'Missing data' });

    const rows = await getSheetData("'RPT Collections'!A:A");
    let rowIndex = -1;
    
    // Check for update
    if (collection.id) {
        for (let i = 1; i < rows.length; i++) {
            if (parseInt(rows[i][0]) === collection.id) {
                rowIndex = i + 1;
                break;
            }
        }
    }

    const values = [
      collection.id,
      collection.af56Id,
      collection.orNumber,
      collection.payor,
      collection.barangay,
      collection.landName,
      collection.tdNumber,
      collection.yearsPaid,
      collection.amount,
      collection.date,
      collection.remarks || ''
    ];

    if (rowIndex > -1) {
      // Update
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `'RPT Collections'!A${rowIndex}:K${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [values] }
      });
    } else {
      // Append
      await appendSheetData("'RPT Collections'!A:K", values);
    }

    res.json({ result: 'success' });
  } catch (error) {
    console.error('Save RPT Collection error:', error);
    res.status(500).json({ result: 'error', message: error.message });
  }
});

app.post('/api/rpt-collections/delete', async (req, res) => {
  try {
    const { id } = req.body;
    
    const rows = await getSheetData("'RPT Collections'!A:A");
    let rowIndex = -1;
    
    for (let i = 1; i < rows.length; i++) {
      if (parseInt(rows[i][0]) === id) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex > -1) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: await getSheetId('RPT Collections'),
                  dimension: 'ROWS',
                  startIndex: rowIndex - 1,
                  endIndex: rowIndex
                }
              }
            }
          ]
        }
      });
    }

    res.json({ result: 'success' });
  } catch (error) {
    console.error('Delete RPT Collection error:', error);
    res.status(500).json({ result: 'error', message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
