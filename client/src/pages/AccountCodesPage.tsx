import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  IconButton, 
  Chip, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  TextField, 
  Grid, 
  CircularProgress, 
  Backdrop, 
  Autocomplete, 
  Tooltip, 
  Stack,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
  Button,
  Select,
  MenuItem,
  InputLabel,
  Alert
} from '@mui/material';
import { 
  Add, 
  Edit, 
  Delete, 
  Refresh, 
  Clear, 
  Save, 
  ListAlt, 
  UploadFile, 
  FileDownload,
  CheckCircle,
  TableChart
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Notification } from '../components/Notification';
import { 
  getAccountCodes, 
  saveAccountCode, 
  deleteAccountCode, 
  importAccountCodes 
} from '../services/supabaseService';
import type { AccountCode } from '../types/rcd';

export const AccountCodesPage: React.FC = () => {
  const [accountCodes, setAccountCodes] = useState<AccountCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);

  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);

  // Import Dialog State
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importedRows, setImportedRows] = useState<{ mainCategory: string; subCategory: string; code: string }[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [workbookState, setWorkbookState] = useState<XLSX.WorkBook | null>(null);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [replaceMode, setReplaceMode] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notification State
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({ open: false, message: '', severity: 'info' });

  // Form State
  const [formData, setFormData] = useState({
    mainCategory: '',
    subCategory: '',
    code: ''
  });

  const uniqueMainCategories = Array.from(new Set(accountCodes.map(c => c.mainCategory))).filter(Boolean).sort();

  const getCommonPrefix = (category: string, codes: AccountCode[]) => {
    const categoryCodes = codes
      .filter(c => c.mainCategory === category)
      .map(c => c.code)
      .filter(Boolean);

    if (categoryCodes.length === 0) return '';

    const sortedCodes = categoryCodes.sort();
    const first = sortedCodes[0];
    const last = sortedCodes[sortedCodes.length - 1];
    let i = 0;
    while (i < first.length && first.charAt(i) === last.charAt(i)) {
      i++;
    }
    return first.substring(0, i);
  };

  const loadAccountCodes = async () => {
    setLoading(true);
    try {
      const codes = await getAccountCodes();
      setAccountCodes(codes);
    } catch (error) {
      console.error('Failed to load account codes', error);
      setNotification({ open: true, message: 'Failed to load account codes.', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccountCodes();
  }, []);

  const handleOpen = () => {
    setFormData({
      mainCategory: '',
      subCategory: '',
      code: ''
    });
    setIsEditing(false);
    setOpen(true);
  };

  const handleEdit = (code: AccountCode) => {
    setFormData({
      mainCategory: code.mainCategory,
      subCategory: code.subCategory,
      code: code.code
    });
    setCurrentId(code.id);
    setIsEditing(true);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const confirmDelete = (id: number) => {
    setItemToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (itemToDelete === null) return;
    
    setLoading(true);
    try {
      await deleteAccountCode(itemToDelete);
      await loadAccountCodes();
      setNotification({ open: true, message: 'Account code deleted successfully.', severity: 'success' });
    } catch (error) {
      console.error('Failed to delete', error);
      setNotification({ open: true, message: 'Failed to delete account code.', severity: 'error' });
    } finally {
      setLoading(false);
      setItemToDelete(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const id = isEditing && currentId !== null 
        ? currentId 
        : (accountCodes.length > 0 ? Math.max(...accountCodes.map(item => item.id)) + 1 : 1);
        
      const codeToSave: AccountCode = {
        id,
        ...formData
      };
      
      await saveAccountCode(codeToSave);
      await loadAccountCodes();
      handleClose();
      setNotification({ 
        open: true, 
        message: isEditing ? 'Account code updated successfully.' : 'Account code added successfully.', 
        severity: 'success' 
      });
    } catch (error) {
      console.error('Error saving account code:', error);
      setNotification({ open: true, message: 'Error saving account code.', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // EXCEL IMPORT & TEMPLATE DOWNLOAD
  // ============================================================================

  const handleDownloadTemplate = () => {
    const sampleData = [
      {
        'Main Category': 'Tax Revenue',
        'Sub Category': 'Community Tax - Individual',
        'Account Code': '4-01-01-050'
      },
      {
        'Main Category': 'Tax Revenue',
        'Sub Category': 'Community Tax - Corporation',
        'Account Code': '4-01-01-060'
      },
      {
        'Main Category': 'Tax Revenue',
        'Sub Category': 'Real Property Tax - Basic',
        'Account Code': '4-01-02-040'
      },
      {
        'Main Category': 'Tax Revenue',
        'Sub Category': 'Special Education Tax (SEF)',
        'Account Code': '4-01-02-050'
      },
      {
        'Main Category': 'Service and Business Income',
        'Sub Category': 'Permit Fees (Mayor\'s Permit)',
        'Account Code': '4-02-01-010'
      },
      {
        'Main Category': 'Service and Business Income',
        'Sub Category': 'Clearance and Certification Fees',
        'Account Code': '4-02-01-040'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Account Codes');
    XLSX.writeFile(wb, 'rcd_account_codes_template.xlsx');
  };

  // Helper to extract account codes from a specific worksheet
  const parseRowsFromSheet = (workbook: XLSX.WorkBook, sheetName: string) => {
    try {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) return [];
      const rawJson: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      const parsed: { mainCategory: string; subCategory: string; code: string }[] = [];

      for (const row of rawJson) {
        // Normalize matching column headers: Main Category, Sub Category, Account Code
        const mainCategory = (
          row['Main Category'] || 
          row['main category'] || 
          row['MainCategory'] || 
          row['Category'] || 
          row['main_category'] || 
          row['MAIN CATEGORY'] || 
          row['Main'] ||
          ''
        ).toString().trim();

        const subCategory = (
          row['Sub Category'] || 
          row['sub category'] || 
          row['SubCategory'] || 
          row['Particulars'] || 
          row['sub_category'] || 
          row['Description'] || 
          row['SUB CATEGORY'] || 
          row['Sub'] ||
          ''
        ).toString().trim();

        const code = (
          row['Account Code'] || 
          row['account code'] || 
          row['AccountCode'] || 
          row['Code'] || 
          row['account_code'] || 
          row['ACCOUNT CODE'] || 
          row['Acct Code'] ||
          ''
        ).toString().trim();

        if (subCategory || code) {
          parsed.push({
            mainCategory: mainCategory || 'General Revenue',
            subCategory: subCategory || '(No Sub Category)',
            code: code || '(No Code)'
          });
        }
      }

      return parsed;
    } catch (e) {
      console.error('Error parsing sheet:', e);
      return [];
    }
  };

  const handleTriggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setImportFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheets = workbook.SheetNames || [];
        if (sheets.length === 0) {
          setNotification({ 
            open: true, 
            message: 'No sheets found in the selected Excel file.', 
            severity: 'error' 
          });
          return;
        }

        setWorkbookState(workbook);
        setAvailableSheets(sheets);
        const defaultSheet = sheets[0];
        setSelectedSheet(defaultSheet);

        const parsed = parseRowsFromSheet(workbook, defaultSheet);
        setImportedRows(parsed);
        setReplaceMode(false);
        setImportDialogOpen(true);
      } catch (err) {
        console.error('Error parsing Excel file:', err);
        setNotification({ open: true, message: 'Failed to read Excel file. Please verify file format (.xlsx or .xls).', severity: 'error' });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSheetChange = (newSheet: string) => {
    setSelectedSheet(newSheet);
    if (workbookState) {
      const parsed = parseRowsFromSheet(workbookState, newSheet);
      setImportedRows(parsed);
    }
  };

  const handleConfirmImport = async () => {
    if (importedRows.length === 0) return;
    setIsImporting(true);
    try {
      const res = await importAccountCodes(importedRows, replaceMode);
      if (res.success) {
        setNotification({
          open: true,
          message: `Successfully imported ${res.count} account codes!`,
          severity: 'success'
        });
        setImportDialogOpen(false);
        setImportedRows([]);
        await loadAccountCodes();
      } else {
        setNotification({
          open: true,
          message: 'Failed to import account codes.',
          severity: 'error'
        });
      }
    } catch (err) {
      console.error('Import error:', err);
      setNotification({ open: true, message: 'Error importing account codes.', severity: 'error' });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Box sx={{ width: '100%', pb: 6 }}>
      <Backdrop open={loading} sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      {/* Hidden file input for Excel Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".xlsx, .xls, .csv"
        style={{ display: 'none' }}
      />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3.5, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" component="h1" fontWeight="800" sx={{ color: '#0f172a' }}>
            Account Codes
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Chart of revenue accounts, sub-categories, and general classifications.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Tooltip title="Download Excel Template (Main Category, Sub Category, Account Code)" arrow>
            <IconButton 
              onClick={handleDownloadTemplate}
              sx={{ 
                bgcolor: '#f0fdf4', 
                color: '#16a34a', 
                border: '1px solid #bbf7d0',
                borderRadius: 1,
                '&:hover': { bgcolor: '#dcfce7' } 
              }}
            >
              <FileDownload fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Import Account Codes from Excel (.xlsx / .xls)" arrow>
            <IconButton 
              onClick={handleTriggerFileInput}
              sx={{ 
                bgcolor: '#eff6ff', 
                color: '#2563eb', 
                border: '1px solid #bfdbfe',
                borderRadius: 1,
                '&:hover': { bgcolor: '#dbeafe' } 
              }}
            >
              <UploadFile fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Refresh Codes" arrow>
            <IconButton color="primary" onClick={loadAccountCodes} disabled={loading}>
              <Refresh />
            </IconButton>
          </Tooltip>

          <Tooltip title="Add Account Code" arrow>
            <IconButton 
              color="primary" 
              onClick={handleOpen}
              sx={{ 
                bgcolor: '#0284c7', 
                color: '#ffffff', 
                borderRadius: 1,
                '&:hover': { bgcolor: '#0369a1', color: '#ffffff' } 
              }}
            >
              <Add />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Paper elevation={0} sx={{ width: '100%', overflow: 'hidden', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
        <Box sx={{ p: 2, px: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0369a1' }}>
              Standard Chart of Accounts
            </Typography>
            <Chip 
              label="Universal Source" 
              size="small" 
              sx={{ fontSize: '0.72rem', height: 20, bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 700 }} 
            />
          </Box>
          <Typography variant="caption" color="text.secondary" fontWeight="700">
            {accountCodes.length} Codes Available
          </Typography>
        </Box>

        <TableContainer className="table-responsive">
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Main Category</TableCell>
                <TableCell>Sub Category</TableCell>
                <TableCell>Account Code</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {accountCodes.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell sx={{ color: '#64748b', fontWeight: 600 }}>#{row.id}</TableCell>
                  <TableCell>
                    <Chip 
                      label={row.mainCategory} 
                      size="small" 
                      sx={{
                        fontWeight: 700,
                        bgcolor: '#e0f2fe',
                        color: '#0369a1',
                        borderRadius: 1
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{row.subCategory}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>{row.code}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title="Edit Code" arrow>
                        <IconButton size="small" color="primary" onClick={() => handleEdit(row)}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Code" arrow>
                        <IconButton size="small" color="error" onClick={() => confirmDelete(row.id)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {accountCodes.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <ListAlt sx={{ color: '#94a3b8', fontSize: 40 }} />
                      <Typography color="text.secondary" variant="body1" fontWeight="600">
                        No account codes found. Add codes manually or import from an Excel sheet.
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 1.5, border: '1px solid #e2e8f0' } }}>
        <form onSubmit={handleSubmit}>
          <DialogTitle component="div" sx={{ bgcolor: '#f8fafc', color: '#0369a1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderBottom: '1px solid #e2e8f0' }}>
            <Typography component="div" variant="h6" fontWeight="800">
              {isEditing ? 'Edit Account Code' : 'Add Account Code'}
            </Typography>
            <Tooltip title="Close" arrow>
              <IconButton onClick={handleClose} size="small" sx={{ borderRadius: 1 }}>
                <Clear />
              </IconButton>
            </Tooltip>
          </DialogTitle>
          <DialogContent sx={{ p: 3, pt: 3 }}>
            <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
              <Grid size={{ xs: 12 }}>
                <Autocomplete
                  freeSolo
                  options={uniqueMainCategories}
                  value={formData.mainCategory}
                  onChange={(_, newValue) => {
                    const category = newValue || '';
                    const prefix = getCommonPrefix(category, accountCodes);
                    setFormData({ 
                      ...formData, 
                      mainCategory: category,
                      code: prefix
                    });
                  }}
                  onInputChange={(_, newInputValue) => {
                    setFormData({ ...formData, mainCategory: newInputValue });
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      fullWidth
                      size="small"
                      label="Main Category"
                      placeholder="e.g. Tax Revenue"
                      required
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Sub Category"
                  value={formData.subCategory}
                  onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                  placeholder="e.g. Community Tax - Individual"
                  required
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Account Code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g. 4-01-01-050"
                  required
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 2, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0', gap: 1.5 }}>
            <Tooltip title="Cancel" arrow>
              <IconButton onClick={handleClose} sx={{ bgcolor: '#e2e8f0', borderRadius: 1 }}>
                <Clear />
              </IconButton>
            </Tooltip>
            <Tooltip title={isEditing ? 'Save Changes' : 'Add Code'} arrow>
              <IconButton 
                type="submit" 
                color="primary" 
                disabled={loading}
                sx={{ 
                  bgcolor: '#0284c7', 
                  color: '#ffffff',
                  borderRadius: 1,
                  '&:hover': { bgcolor: '#0369a1', color: '#ffffff' }
                }}
              >
                <Save />
              </IconButton>
            </Tooltip>
          </DialogActions>
        </form>
      </Dialog>

      {/* Excel Import Preview Dialog */}
      <Dialog 
        open={importDialogOpen} 
        onClose={() => !isImporting && setImportDialogOpen(false)} 
        maxWidth="md" 
        fullWidth 
        PaperProps={{ sx: { borderRadius: 1.5, border: '1px solid #e2e8f0' } }}
      >
        <DialogTitle component="div" sx={{ bgcolor: '#f8fafc', color: '#0369a1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderBottom: '1px solid #e2e8f0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <TableChart sx={{ color: '#0284c7' }} />
            <Box>
              <Typography variant="h6" fontWeight="800">
                Import Account Codes from Excel
              </Typography>
              <Typography variant="caption" color="text.secondary">
                File: <strong>{importFileName}</strong> • {importedRows.length} rows recognized
              </Typography>
            </Box>
          </Box>
          <Tooltip title="Close" arrow>
            <IconButton onClick={() => !isImporting && setImportDialogOpen(false)} size="small" sx={{ borderRadius: 1 }}>
              <Clear />
            </IconButton>
          </Tooltip>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ mb: 2.5, p: 2, bgcolor: '#f0f9ff', borderRadius: 1.5, border: '1px solid #bae6fd' }}>
            <Typography variant="body2" sx={{ color: '#0369a1', fontWeight: 600 }}>
              Columns Detected: <strong>Main Category</strong>, <strong>Sub Category</strong>, and <strong>Account Code</strong>.
            </Typography>
            <Typography variant="caption" sx={{ color: '#0c4a6e', display: 'block', mt: 0.5 }}>
              Review the parsed data below before confirming the import into the shared chart of accounts.
            </Typography>
          </Box>

          {/* Controls: Sheet Selector & Import Action */}
          <Grid container spacing={2} sx={{ mb: 2.5, alignItems: 'center' }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="sheet-select-label">Select Excel Sheet / Tab</InputLabel>
                <Select
                  labelId="sheet-select-label"
                  value={selectedSheet}
                  label="Select Excel Sheet / Tab"
                  onChange={(e) => handleSheetChange(e.target.value)}
                  renderValue={(val) => (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TableChart sx={{ fontSize: 18, color: '#0284c7' }} />
                      <Typography variant="body2" fontWeight={700}>{val}</Typography>
                    </Box>
                  )}
                >
                  {availableSheets.map((sheetName) => (
                    <MenuItem key={sheetName} value={sheetName}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TableChart sx={{ fontSize: 18, color: '#0284c7' }} />
                          <Typography variant="body2" fontWeight={sheetName === selectedSheet ? 700 : 500}>
                            {sheetName}
                          </Typography>
                        </Box>
                        {sheetName === selectedSheet && (
                          <Chip label="Selected" size="small" sx={{ fontSize: '0.68rem', height: 18, bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 700 }} />
                        )}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl component="fieldset">
                <FormLabel component="legend" sx={{ fontSize: '0.80rem', fontWeight: 700, color: '#475569' }}>
                  Import Action
                </FormLabel>
                <RadioGroup
                  row
                  value={replaceMode ? 'replace' : 'append'}
                  onChange={(e) => setReplaceMode(e.target.value === 'replace')}
                >
                  <FormControlLabel 
                    value="append" 
                    control={<Radio size="small" />} 
                    label={<Typography variant="body2" fontWeight={600}>Append</Typography>} 
                  />
                  <FormControlLabel 
                    value="replace" 
                    control={<Radio size="small" color="error" />} 
                    label={<Typography variant="body2" fontWeight={600} color="error.main">Replace all</Typography>} 
                  />
                </RadioGroup>
              </FormControl>
            </Grid>
          </Grid>

          {/* Warning if no rows detected on selected sheet */}
          {importedRows.length === 0 ? (
            <Alert severity="warning" sx={{ mb: 2, borderRadius: 1.5 }}>
              No account codes found in sheet "<strong>{selectedSheet}</strong>". Please ensure this sheet has headers: <strong>Main Category</strong>, <strong>Sub Category</strong>, and <strong>Account Code</strong>, or select a different sheet from the dropdown above.
            </Alert>
          ) : (
            <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b' }}>
                Previewing <strong>{importedRows.length}</strong> codes from sheet "<strong>{selectedSheet}</strong>"
              </Typography>
            </Box>
          )}

          {/* Table Preview */}
          <TableContainer sx={{ maxHeight: 320, borderRadius: 1, border: '1px solid #e2e8f0' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 700 }}>#</TableCell>
                  <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 700 }}>Main Category</TableCell>
                  <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 700 }}>Sub Category</TableCell>
                  <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 700 }}>Account Code</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {importedRows.map((row, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell sx={{ color: '#64748b' }}>{idx + 1}</TableCell>
                    <TableCell>
                      <Chip label={row.mainCategory} size="small" sx={{ fontSize: '0.72rem', height: 20, bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 700 }} />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{row.subCategory}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>{row.code}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>

        <DialogActions sx={{ p: 2, px: 3, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0', justifyContent: 'space-between' }}>
          <Button
            size="small"
            startIcon={<FileDownload />}
            onClick={handleDownloadTemplate}
            sx={{ color: '#0369a1', textTransform: 'none', fontWeight: 600 }}
          >
            Download Template
          </Button>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              variant="outlined"
              onClick={() => setImportDialogOpen(false)}
              disabled={isImporting}
              sx={{ textTransform: 'none', borderRadius: 1, borderColor: '#cbd5e1', color: '#64748b' }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleConfirmImport}
              disabled={isImporting || importedRows.length === 0}
              startIcon={isImporting ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />}
              sx={{ 
                bgcolor: '#0284c7', 
                color: '#ffffff',
                textTransform: 'none', 
                fontWeight: 700, 
                borderRadius: 1,
                '&:hover': { bgcolor: '#0369a1' }
              }}
            >
              {isImporting ? 'Importing...' : `Import ${importedRows.length} Account Codes`}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete Account Code"
        message="Are you sure you want to delete this account code? This action cannot be undone."
        confirmText="Delete"
        severity="error"
      />

      {/* Notification Snackbar */}
      <Notification
        open={notification.open}
        onClose={() => setNotification({ ...notification, open: false })}
        message={notification.message}
        severity={notification.severity}
      />
    </Box>
  );
};
