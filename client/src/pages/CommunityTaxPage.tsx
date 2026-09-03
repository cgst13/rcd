import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
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
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  TextField, 
  Grid, 
  CircularProgress, 
  Backdrop, 
  Divider, 
  Card, 
  CardContent, 
  Stack, 
  TablePagination, 
  InputAdornment, 
  Autocomplete, 
  Tooltip, 
  Chip, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Button, 
  LinearProgress
} from '@mui/material';
import { 
  Edit, 
  DeleteOutline, 
  Refresh, 
  Search, 
  Clear, 
  Save, 
  AddCircleOutline, 
  UploadFile, 
  FileDownload, 
  Check, 
  AdminPanelSettings, 
  Badge,
  Business,
  Person,
  ReceiptLong
} from '@mui/icons-material';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Notification } from '../components/Notification';
import { useAuth } from '../context/useAuth';
import { 
  getCommunityTaxCollections, 
  saveCommunityTaxCollection, 
  deleteCommunityTaxCollection, 
  importCommunityTaxBatch 
} from '../services/supabaseService';
import type { CommunityTaxItem } from '../types/rcd';

const BARANGAYS = [
  'Agbatad',
  'Agmanic',
  'Bacong',
  'Bakhawan',
  'Calabasahan',
  'Dalajican',
  'Masudsud',
  'Poblacion',
  'Sampong',
  'San Pedro',
  'San Vicente'
];

const getNextCtcNo = (currentCtcNo: string): string => {
  let nextNo = currentCtcNo.trim();
  const matchNum = nextNo.match(/(\d+)$/);
  if (matchNum) {
    const digits = matchNum[1];
    const incremented = (parseInt(digits, 10) + 1).toString().padStart(digits.length, '0');
    return nextNo.slice(0, matchNum.index) + incremented;
  }
  return nextNo;
};

export const CommunityTaxPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'administrator';

  const [items, setItems] = useState<CommunityTaxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterBarangay, setFilterBarangay] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState('');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Modal Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<CommunityTaxItem | null>(null);

  // Form State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    afNo: 'AF 0016',
    ctcNo: '',
    taxpayerName: '',
    ctcType: 'Individual' as 'Individual' | 'Corporation',
    barangay: 'Poblacion',
    address: '',
    basicTax: '5',
    additionalTax: '0',
    penalty: '0',
    amount: '5',
    date: new Date().toISOString().split('T')[0],
    remarks: ''
  });

  // Notification Toast
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({ open: false, message: '', severity: 'info' });

  // Excel Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importedRows, setImportedRows] = useState<Array<Omit<CommunityTaxItem, 'id'>>>([]);
  const [isImporting, setIsImporting] = useState(false);

  const taxpayerRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getCommunityTaxCollections();
      setItems(data);
    } catch (err) {
      console.error('Failed to load Community Tax data:', err);
      setNotification({ open: true, message: 'Failed to load Community Tax entries.', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update total amount dynamically when basic, additional, or penalty change
  const handleTaxComponentChange = (field: 'basicTax' | 'additionalTax' | 'penalty', val: string) => {
    const updatedForm = { ...formData, [field]: val };
    const b = parseFloat(updatedForm.basicTax) || 0;
    const a = parseFloat(updatedForm.additionalTax) || 0;
    const p = parseFloat(updatedForm.penalty) || 0;
    updatedForm.amount = (b + a + p).toFixed(2);
    setFormData(updatedForm);
  };

  const handleTypeChange = (type: 'Individual' | 'Corporation') => {
    const defaultBasic = type === 'Corporation' ? '500' : '5';
    const a = parseFloat(formData.additionalTax) || 0;
    const p = parseFloat(formData.penalty) || 0;
    const total = (parseFloat(defaultBasic) + a + p).toFixed(2);
    setFormData({
      ...formData,
      ctcType: type,
      basicTax: defaultBasic,
      amount: total
    });
  };

  const handleOpenAddDialog = () => {
    let nextNo = '';
    if (items.length > 0) {
      const lastCtc = items[0].ctcNo;
      if (lastCtc) {
        nextNo = getNextCtcNo(lastCtc);
      }
    }

    setEditingId(null);
    setFormData({
      afNo: 'AF 0016',
      ctcNo: nextNo,
      taxpayerName: '',
      ctcType: 'Individual',
      barangay: 'Poblacion',
      address: '',
      basicTax: '5',
      additionalTax: '0',
      penalty: '0',
      amount: '5',
      date: new Date().toISOString().split('T')[0],
      remarks: ''
    });
    setDialogOpen(true);
  };

  const handleEdit = (item: CommunityTaxItem) => {
    setEditingId(item.id);
    setFormData({
      afNo: item.afNo || 'AF 0016',
      ctcNo: item.ctcNo || '',
      taxpayerName: item.taxpayerName || '',
      ctcType: item.ctcType || 'Individual',
      barangay: item.barangay || 'Poblacion',
      address: item.address || '',
      basicTax: String(item.basicTax ?? (item.ctcType === 'Corporation' ? 500 : 5)),
      additionalTax: String(item.additionalTax ?? 0),
      penalty: String(item.penalty ?? 0),
      amount: String(item.amount ?? 0),
      date: item.date || new Date().toISOString().split('T')[0],
      remarks: item.remarks || ''
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.ctcNo.trim()) {
      setNotification({ open: true, message: 'Please enter a CTC / Certificate Number.', severity: 'warning' });
      return;
    }
    if (!formData.taxpayerName.trim()) {
      setNotification({ open: true, message: 'Please enter Taxpayer / Entity Name.', severity: 'warning' });
      return;
    }

    const totalAmount = parseFloat(formData.amount) || 0;
    if (totalAmount < 0) {
      setNotification({ open: true, message: 'Total amount cannot be negative.', severity: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const itemToSave: CommunityTaxItem = {
        id: editingId || 0,
        afNo: formData.afNo || 'AF 0016',
        ctcNo: formData.ctcNo.trim(),
        taxpayerName: formData.taxpayerName.trim().toUpperCase(),
        ctcType: formData.ctcType,
        barangay: formData.barangay,
        address: formData.address.trim(),
        basicTax: parseFloat(formData.basicTax) || 0,
        additionalTax: parseFloat(formData.additionalTax) || 0,
        penalty: parseFloat(formData.penalty) || 0,
        amount: totalAmount,
        date: formData.date,
        remarks: formData.remarks.trim()
      };

      const success = await saveCommunityTaxCollection(itemToSave);
      if (success) {
        setNotification({
          open: true,
          message: editingId ? 'Community Tax entry updated!' : 'Community Tax entry saved!',
          severity: 'success'
        });
        setDialogOpen(false);
        await loadData();
      } else {
        setNotification({ open: true, message: 'Failed to save entry. Please try again.', severity: 'error' });
      }
    } catch (err) {
      console.error(err);
      setNotification({ open: true, message: 'An error occurred while saving.', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    setLoading(true);
    try {
      const success = await deleteCommunityTaxCollection(itemToDelete.id);
      if (success) {
        setItems(items.filter(i => i.id !== itemToDelete.id));
        setNotification({
          open: true,
          message: `CTC #${itemToDelete.ctcNo} deleted successfully.`,
          severity: 'success'
        });
      } else {
        setNotification({ open: true, message: 'Failed to delete entry.', severity: 'error' });
      }
    } catch (err) {
      console.error(err);
      setNotification({ open: true, message: 'Error deleting entry.', severity: 'error' });
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchSearch = 
        (item.taxpayerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.ctcNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.remarks || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.address || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchType = filterType === 'ALL' || item.ctcType === filterType;
      const matchBarangay = !filterBarangay || item.barangay === filterBarangay;
      const matchDate = !filterDate || (item.date && item.date.startsWith(filterDate));

      return matchSearch && matchType && matchBarangay && matchDate;
    });
  }, [items, searchTerm, filterType, filterBarangay, filterDate]);

  // Statistics
  const totalAmount = useMemo(() => items.reduce((s, i) => s + (i.amount || 0), 0), [items]);
  const individualCount = useMemo(() => items.filter(i => i.ctcType === 'Individual').length, [items]);
  const corporateCount = useMemo(() => items.filter(i => i.ctcType === 'Corporation').length, [items]);
  const individualAmount = useMemo(() => items.filter(i => i.ctcType === 'Individual').reduce((s, i) => s + (i.amount || 0), 0), [items]);
  const corporateAmount = useMemo(() => items.filter(i => i.ctcType === 'Corporation').reduce((s, i) => s + (i.amount || 0), 0), [items]);

  // Excel Template Download
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Form No': 'AF 0016',
        'CTC Number': 'CCI2026-00001',
        'Taxpayer Name': 'JUAN DELA CRUZ',
        'Type': 'Individual',
        'Barangay': 'Poblacion',
        'Address': 'Zone 1, Poblacion, Concepcion, Romblon',
        'Basic Tax': 5,
        'Additional Tax': 150,
        'Penalty': 0,
        'Total Amount': 155,
        'Date': new Date().toISOString().split('T')[0],
        'Remarks': 'Employed / Business'
      },
      {
        'Form No': 'AF 0016',
        'CTC Number': 'CCC2026-00001',
        'Taxpayer Name': 'CONCEPCION AGRI TRADING CORP',
        'Type': 'Corporation',
        'Barangay': 'San Pedro',
        'Address': 'San Pedro, Concepcion, Romblon',
        'Basic Tax': 500,
        'Additional Tax': 1200,
        'Penalty': 0,
        'Total Amount': 1700,
        'Date': new Date().toISOString().split('T')[0],
        'Remarks': 'Corporate Cedula'
      }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 12 },
      { wch: 16 },
      { wch: 30 },
      { wch: 14 },
      { wch: 16 },
      { wch: 35 },
      { wch: 12 },
      { wch: 15 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 25 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Community Tax Template');
    XLSX.writeFile(wb, 'Community_Tax_Template_AF0016.xlsx');
  };

  // Excel File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setParseProgress(30);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        setParseProgress(70);

        const parsed: Array<Omit<CommunityTaxItem, 'id'>> = jsonRows.map(row => {
          const rawType = String(row['Type'] || row['Classification'] || row['CTC Type'] || 'Individual').trim();
          const ctcType: 'Individual' | 'Corporation' = rawType.toLowerCase().includes('corp') ? 'Corporation' : 'Individual';
          const b = parseFloat(row['Basic Tax'] || row['Basic'] || (ctcType === 'Corporation' ? 500 : 5)) || 0;
          const a = parseFloat(row['Additional Tax'] || row['Additional'] || 0) || 0;
          const p = parseFloat(row['Penalty'] || row['Interest'] || 0) || 0;
          const total = parseFloat(row['Total Amount'] || row['Amount'] || (b + a + p)) || (b + a + p);

          let dateStr = new Date().toISOString().split('T')[0];
          if (row['Date']) {
            if (row['Date'] instanceof Date && !isNaN(row['Date'].getTime())) {
              dateStr = row['Date'].toISOString().split('T')[0];
            } else {
              dateStr = String(row['Date']).trim();
            }
          }

          return {
            afNo: String(row['Form No'] || row['AF No'] || 'AF 0016').trim(),
            ctcNo: String(row['CTC Number'] || row['CTC No'] || row['Certificate No'] || row['OR Number'] || '').trim(),
            taxpayerName: String(row['Taxpayer Name'] || row['Payor'] || row['Name'] || '').trim().toUpperCase(),
            ctcType,
            barangay: String(row['Barangay'] || 'Poblacion').trim(),
            address: String(row['Address'] || '').trim(),
            basicTax: b,
            additionalTax: a,
            penalty: p,
            amount: total,
            date: dateStr,
            remarks: String(row['Remarks'] || '').trim()
          };
        }).filter(r => r.ctcNo && r.taxpayerName);

        setParseProgress(100);
        setTimeout(() => {
          setIsParsing(false);
          if (parsed.length === 0) {
            setNotification({ open: true, message: 'No valid Community Tax records found in file.', severity: 'warning' });
          } else {
            setImportedRows(parsed);
            setImportPreviewOpen(true);
          }
        }, 300);
      } catch (err) {
        console.error(err);
        setIsParsing(false);
        setNotification({ open: true, message: 'Failed to parse Excel file.', severity: 'error' });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirmImport = async () => {
    if (importedRows.length === 0) return;
    setIsImporting(true);
    try {
      const res = await importCommunityTaxBatch(importedRows);
      if (res.success) {
        setNotification({
          open: true,
          message: `Successfully imported ${res.count} Community Tax entries!`,
          severity: 'success'
        });
        setImportPreviewOpen(false);
        setImportedRows([]);
        await loadData();
      } else {
        setNotification({ open: true, message: 'Failed to import records.', severity: 'error' });
      }
    } catch (err) {
      console.error(err);
      setNotification({ open: true, message: 'Error during batch import.', severity: 'error' });
    } finally {
      setIsImporting(false);
    }
  };

  // Export current filtered table to Excel
  const handleExportTable = () => {
    if (filteredItems.length === 0) {
      setNotification({ open: true, message: 'No entries to export.', severity: 'warning' });
      return;
    }

    const exportData = filteredItems.map((item, idx) => ({
      '#': idx + 1,
      'Date': item.date,
      'Form No': item.afNo,
      'CTC Number': item.ctcNo,
      'Taxpayer Name': item.taxpayerName,
      'Classification': item.ctcType,
      'Barangay': item.barangay,
      'Address': item.address || '',
      'Basic Tax': item.basicTax,
      'Additional Tax': item.additionalTax,
      'Penalty / Surcharge': item.penalty || 0,
      'Total Amount (PHP)': item.amount,
      'Remarks': item.remarks || ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 12 },
      { wch: 10 },
      { wch: 16 },
      { wch: 28 },
      { wch: 14 },
      { wch: 16 },
      { wch: 25 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
      { wch: 22 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Community Tax');
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Community_Tax_AF0016_${dateStr}.xlsx`);
    setNotification({ open: true, message: 'Community Tax exported to Excel!', severity: 'success' });
  };

  return (
    <Box sx={{ width: '100%', pb: 5 }}>
      <Backdrop sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 2 }} open={loading}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <Notification
        open={notification.open}
        onClose={() => setNotification({ ...notification, open: false })}
        message={notification.message}
        severity={notification.severity}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete Community Tax Certificate?"
        message={`Are you sure you want to delete CTC #${itemToDelete?.ctcNo} for ${itemToDelete?.taxpayerName}? This action cannot be undone.`}
        confirmText="Delete Certificate"
        severity="error"
      />

      <input
        type="file"
        ref={fileInputRef}
        accept=".xlsx, .xls, .csv"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* Top Header */}
      <Box sx={{ mb: 3.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h4" component="h1" fontWeight="800" sx={{ color: '#0f172a' }}>
              Community Tax
            </Typography>
            <Chip 
              label="Accountable Form No. 0016" 
              size="small" 
              sx={{ fontWeight: 700, bgcolor: '#e0f2fe', color: '#0284c7', border: '1px solid rgba(14, 165, 233, 0.3)' }} 
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {isAdmin 
              ? "Auditing and monitoring Community Tax Certificates (Cedula) encoded across all collectors."
              : "Encode, issue, and manage Community Tax Certificates (Individual & Corporate) under Accountable Form No. 0016."}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Tooltip title="Refresh Records" arrow>
            <IconButton 
              color="primary"
              onClick={loadData}
              sx={{ bgcolor: '#f0f9ff', p: 1.4, border: '1px solid rgba(14, 165, 233, 0.2)', color: '#0284c7' }}
            >
              <Refresh />
            </IconButton>
          </Tooltip>

          <Tooltip title="Download Excel Format Template" arrow>
            <IconButton 
              color="secondary"
              onClick={handleDownloadTemplate}
              sx={{ bgcolor: '#f0f9ff', p: 1.4, border: '1px solid rgba(14, 165, 233, 0.2)' }}
            >
              <FileDownload />
            </IconButton>
          </Tooltip>

          <Tooltip title="Import Community Tax from Excel" arrow>
            <IconButton 
              color="primary"
              onClick={() => fileInputRef.current?.click()}
              sx={{ bgcolor: '#f0f9ff', p: 1.4, border: '1px solid rgba(14, 165, 233, 0.2)' }}
            >
              <UploadFile />
            </IconButton>
          </Tooltip>

          <Tooltip title="Export Current Table to Excel" arrow>
            <IconButton 
              color="primary"
              onClick={handleExportTable}
              sx={{ bgcolor: '#f0f9ff', p: 1.4, border: '1px solid rgba(14, 165, 233, 0.2)' }}
            >
              <FileDownload />
            </IconButton>
          </Tooltip>

          {!isAdmin && (
            <Tooltip title="Issue New Community Tax Certificate" arrow>
              <IconButton 
                color="primary"
                onClick={handleOpenAddDialog}
                sx={{ 
                  bgcolor: '#0284c7', 
                  color: '#ffffff', 
                  p: 1.4,
                  borderRadius: 1,
                  '&:hover': { bgcolor: '#0369a1', color: '#ffffff' } 
                }}
              >
                <AddCircleOutline />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Admin Notice Banner */}
      {isAdmin && (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 3,
            borderRadius: 1.5,
            border: '1px solid #e2e8f0',
            bgcolor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Box sx={{ p: 1, bgcolor: '#e0f2fe', color: '#0284c7', borderRadius: 1, display: 'flex', flexShrink: 0 }}>
            <AdminPanelSettings sx={{ fontSize: 26 }} />
          </Box>
          <Box>
            <Typography variant="subtitle2" fontWeight="800" sx={{ color: '#0369a1' }}>
              Consolidated Audit View (Read Only)
            </Typography>
            <Typography variant="body2" sx={{ color: '#475569', fontSize: '0.84rem' }}>
              As an Administrator, you can monitor and audit all Community Tax records issued across all collectors. Editing is reserved for respective issuing collectors to maintain accountability.
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Summary KPI Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="caption" fontWeight="700" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                  Total CTC Collection
                </Typography>
                <Box sx={{ p: 0.8, bgcolor: '#f0fdf4', color: '#16a34a', borderRadius: 1 }}>
                  <ReceiptLong fontSize="small" />
                </Box>
              </Box>
              <Typography variant="h5" fontWeight="800" sx={{ color: '#0f172a' }}>
                ₱ {totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {items.length} total certificates issued
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="caption" fontWeight="700" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                  Individual (CCI)
                </Typography>
                <Box sx={{ p: 0.8, bgcolor: '#f0f9ff', color: '#0284c7', borderRadius: 1 }}>
                  <Person fontSize="small" />
                </Box>
              </Box>
              <Typography variant="h5" fontWeight="800" sx={{ color: '#0f172a' }}>
                ₱ {individualAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {individualCount} Individual cedulas
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="caption" fontWeight="700" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                  Corporation (CCC)
                </Typography>
                <Box sx={{ p: 0.8, bgcolor: '#faf5ff', color: '#9333ea', borderRadius: 1 }}>
                  <Business fontSize="small" />
                </Box>
              </Box>
              <Typography variant="h5" fontWeight="800" sx={{ color: '#0f172a' }}>
                ₱ {corporateAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {corporateCount} Corporate cedulas
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="caption" fontWeight="700" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                  Filter Matches
                </Typography>
                <Box sx={{ p: 0.8, bgcolor: '#fffbeb', color: '#d97706', borderRadius: 1 }}>
                  <Badge fontSize="small" />
                </Box>
              </Box>
              <Typography variant="h5" fontWeight="800" sx={{ color: '#0f172a' }}>
                ₱ {filteredItems.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {filteredItems.length} matching rows displayed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Parsing progress */}
      {isParsing && (
        <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: 1.5, border: '1px solid #e2e8f0', bgcolor: '#f0f9ff' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" fontWeight="800" sx={{ color: '#0369a1' }}>
              Reading Community Tax Excel file...
            </Typography>
            <Typography variant="caption" fontWeight="700" sx={{ color: '#0284c7' }}>
              {parseProgress}%
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={parseProgress} sx={{ height: 6, borderRadius: 1 }} />
        </Paper>
      )}

      {/* Filter and Search Bar */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: 1.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              placeholder="Search by Taxpayer, CTC No., or Remarks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              fullWidth
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" sx={{ color: '#94a3b8' }} />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchTerm('')}>
                      <Clear fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Grid>

          <Grid size={{ xs: 6, sm: 3, md: 2.5 }}>
            <FormControl fullWidth size="small">
              <InputLabel>CTC Classification</InputLabel>
              <Select
                value={filterType}
                label="CTC Classification"
                onChange={(e) => setFilterType(e.target.value)}
              >
                <MenuItem value="ALL">All Classifications</MenuItem>
                <MenuItem value="Individual">Individual (CCI)</MenuItem>
                <MenuItem value="Corporation">Corporation (CCC)</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 6, sm: 3, md: 2.5 }}>
            <Autocomplete
              options={BARANGAYS}
              value={filterBarangay}
              onChange={(_, val) => setFilterBarangay(val)}
              renderInput={(params) => <TextField {...params} label="Barangay" size="small" />}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 4, md: 2 }}>
            <TextField
              label="Date"
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 2, md: 1 }}>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              onClick={() => {
                setSearchTerm('');
                setFilterType('ALL');
                setFilterBarangay(null);
                setFilterDate('');
              }}
              sx={{ height: 40, borderColor: '#e2e8f0', color: '#64748b' }}
            >
              Reset
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Main Table */}
      <Paper elevation={0} sx={{ width: '100%', borderRadius: 1.5, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>Form No.</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>CTC Number</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>Taxpayer Name</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>Barangay</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>Basic</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>Additional</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>Penalty</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>Total (PHP)</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>Remarks</TableCell>
                {!isAdmin && (
                  <TableCell align="center" sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>Actions</TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 11 : 12} sx={{ py: 6, textAlign: 'center', color: '#94a3b8' }}>
                    <ReceiptLong sx={{ fontSize: 44, color: '#cbd5e1', mb: 1, display: 'block', mx: 'auto' }} />
                    <Typography variant="subtitle2" fontWeight="700">No Community Tax records found</Typography>
                    <Typography variant="caption">Encode a new certificate or adjust your search filters above.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((row) => (
                    <TableRow key={row.id} hover sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                      <TableCell sx={{ fontSize: '0.84rem', color: '#334155', fontWeight: 500 }}>
                        {row.date}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.84rem', color: '#64748b' }}>
                        {row.afNo || 'AF 0016'}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.86rem', fontWeight: 700, color: '#0284c7' }}>
                        {row.ctcNo}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.86rem', fontWeight: 600, color: '#0f172a' }}>
                        {row.taxpayerName}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={row.ctcType}
                          size="small"
                          sx={{ 
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            borderRadius: 1,
                            bgcolor: row.ctcType === 'Corporation' ? '#faf5ff' : '#f0f9ff',
                            color: row.ctcType === 'Corporation' ? '#9333ea' : '#0284c7',
                            border: '1px solid',
                            borderColor: row.ctcType === 'Corporation' ? '#e9d5ff' : '#bae6fd'
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.84rem', color: '#475569' }}>
                        {row.barangay}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.84rem', color: '#64748b' }}>
                        ₱ {Number(row.basicTax || 0).toFixed(2)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.84rem', color: '#64748b' }}>
                        ₱ {Number(row.additionalTax || 0).toFixed(2)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.84rem', color: row.penalty ? '#ef4444' : '#64748b' }}>
                        ₱ {Number(row.penalty || 0).toFixed(2)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                        ₱ {Number(row.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.80rem', color: '#64748b', maxWidth: 150 }}>
                        {row.remarks || '-'}
                      </TableCell>
                      {!isAdmin && (
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            <Tooltip title="Edit Certificate" arrow>
                              <IconButton size="small" color="primary" onClick={() => handleEdit(row)}>
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Certificate" arrow>
                              <IconButton 
                                size="small" 
                                color="error" 
                                onClick={() => {
                                  setItemToDelete(row);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <DeleteOutline fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={filteredItems.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          sx={{ borderTop: '1px solid #e2e8f0' }}
        />
      </Paper>

      {/* Entry Modal Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{ sx: { borderRadius: 1.5 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', borderBottom: '1px solid #e2e8f0', pb: 2 }}>
          {editingId ? 'Edit Community Tax Certificate' : 'Issue Community Tax Certificate (Cedula)'}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Accountable Form"
                value={formData.afNo}
                onChange={(e) => setFormData({ ...formData, afNo: e.target.value })}
                fullWidth
                size="small"
                helperText="Standard Cedula: AF 0016"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="CTC / Certificate Number"
                value={formData.ctcNo}
                onChange={(e) => setFormData({ ...formData, ctcNo: e.target.value })}
                fullWidth
                size="small"
                required
                placeholder="e.g. 0012345 or CCI2026-0001"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Date of Issue"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Classification</InputLabel>
                <Select
                  value={formData.ctcType}
                  label="Classification"
                  onChange={(e) => handleTypeChange(e.target.value as any)}
                >
                  <MenuItem value="Individual">Individual (CCI)</MenuItem>
                  <MenuItem value="Corporation">Corporation (CCC)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField
                inputRef={taxpayerRef}
                label="Taxpayer / Corporate Entity Name"
                value={formData.taxpayerName}
                onChange={(e) => setFormData({ ...formData, taxpayerName: e.target.value })}
                fullWidth
                size="small"
                required
                placeholder="Full Legal Name"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <Autocomplete
                options={BARANGAYS}
                value={formData.barangay}
                onChange={(_, val) => setFormData({ ...formData, barangay: val || 'Poblacion' })}
                renderInput={(params) => <TextField {...params} label="Barangay" size="small" required />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField
                label="Complete Address / Zone"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                fullWidth
                size="small"
                placeholder="Zone / Sitio / Street address"
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 1, borderColor: '#e2e8f0' }} />
              <Typography variant="subtitle2" fontWeight="800" sx={{ color: '#0369a1', mb: 1.5 }}>
                Tax Computations & Breakdown
              </Typography>
            </Grid>

            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                label="Basic Community Tax (₱)"
                type="number"
                value={formData.basicTax}
                onChange={(e) => handleTaxComponentChange('basicTax', e.target.value)}
                fullWidth
                size="small"
                helperText="₱5 (Ind.) or ₱500 (Corp.)"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                label="Additional Tax (₱)"
                type="number"
                value={formData.additionalTax}
                onChange={(e) => handleTaxComponentChange('additionalTax', e.target.value)}
                fullWidth
                size="small"
                helperText="Income / property earnings"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                label="Penalty / Surcharge (₱)"
                type="number"
                value={formData.penalty}
                onChange={(e) => handleTaxComponentChange('penalty', e.target.value)}
                fullWidth
                size="small"
                helperText="Delinquency interest if any"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                label="Total Amount (PHP)"
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                fullWidth
                size="small"
                sx={{
                  '& .MuiInputBase-input': { fontWeight: 800, color: '#0284c7' }
                }}
                helperText="Total remittance amount"
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                label="Remarks / Particulars"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                fullWidth
                size="small"
                placeholder="e.g. Employed at LGU, Sari-sari store owner, Tricycle operator"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: '#64748b' }}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSave}
            startIcon={<Save />}
            sx={{ bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' }, borderRadius: 1 }}
          >
            {editingId ? 'Save Changes' : 'Save Certificate'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Preview Dialog */}
      <Dialog 
        open={importPreviewOpen} 
        onClose={() => setImportPreviewOpen(false)} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{ sx: { borderRadius: 1.5 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', borderBottom: '1px solid #e2e8f0' }}>
          Preview Excel Import ({importedRows.length} records ready)
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Review parsed Community Tax certificates before uploading to database.
          </Typography>
          <TableContainer sx={{ maxHeight: 400 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>CTC Number</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Taxpayer Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Classification</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Barangay</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Amount (₱)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {importedRows.slice(0, 50).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.date}</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#0284c7' }}>{r.ctcNo}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{r.taxpayerName}</TableCell>
                    <TableCell>{r.ctcType}</TableCell>
                    <TableCell>{r.barangay}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>₱ {r.amount.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {importedRows.length > 50 && (
            <Typography variant="caption" sx={{ mt: 1, display: 'block', color: '#64748b' }}>
              Showing first 50 of {importedRows.length} rows.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={() => setImportPreviewOpen(false)} sx={{ color: '#64748b' }}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleConfirmImport}
            disabled={isImporting}
            startIcon={isImporting ? <CircularProgress size={16} color="inherit" /> : <Check />}
            sx={{ bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' }, borderRadius: 1 }}
          >
            {isImporting ? 'Uploading Records...' : `Confirm Upload (${importedRows.length} records)`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
