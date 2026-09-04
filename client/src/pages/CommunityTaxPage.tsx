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
  ReceiptLong,
  Close
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
  'Bakhawan',
  'Calabasahan',
  'Dalajican',
  'Masadya',
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
    const prefix = nextNo.slice(0, matchNum.index);
    const digits = matchNum[1];
    const incremented = (parseInt(digits, 10) + 1).toString().padStart(digits.length, '0');
    return prefix + incremented;
  } else if (nextNo && !isNaN(Number(nextNo))) {
    return String(Number(nextNo) + 1).padStart(8, '0');
  }
  return nextNo;
};

const getAutoCtcNo = (records: CommunityTaxItem[]): string => {
  if (!records || records.length === 0) return '00000001';
  const validRecords = records.filter(r => r.ctcNo && r.ctcNo.trim());
  if (validRecords.length === 0) return '00000001';

  let bestCtcNo = validRecords[0].ctcNo.trim();
  let maxNum = -1;

  for (const rec of validRecords) {
    const raw = rec.ctcNo.trim();
    const match = raw.match(/(\d+)$/);
    if (match) {
      const val = parseInt(match[1], 10);
      if (val > maxNum) {
        maxNum = val;
        bestCtcNo = raw;
      }
    }
  }

  return getNextCtcNo(bestCtcNo);
};

export const getPenaltyRate = (dateStr: string): number => {
  if (!dateStr) return 0;
  const parts = dateStr.split('-');
  let month = 0;
  if (parts.length >= 2) {
    month = parseInt(parts[1], 10);
  } else {
    month = new Date(dateStr).getMonth() + 1;
  }

  // January (1) and February (2): No penalty (0%)
  if (isNaN(month) || month <= 2) {
    return 0;
  }

  // Penalty is 2% per month of (Basic Community Tax + Additional Community Tax),
  // starting in March (3 months * 2% = 6% penalty).
  return (month * 2) / 100;
};

export const calculatePenalty = (dateStr: string, basicTax: number, additionalTax: number): number => {
  const rate = getPenaltyRate(dateStr);
  if (rate <= 0) return 0;
  const base = Math.max(0, basicTax) + Math.max(0, additionalTax);
  return parseFloat((base * rate).toFixed(2));
};

export const CommunityTaxPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'administrator';

  const [items, setItems] = useState<CommunityTaxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGender, setFilterGender] = useState<string>('ALL');
  const [filterBarangay, setFilterBarangay] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState('');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Delete Confirmation Modal State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<CommunityTaxItem | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<CommunityTaxItem | null>(null);

  const handleDeleteClick = (item: CommunityTaxItem) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    const target = itemToDelete;
    setDeleteDialogOpen(false);
    setLoading(true);
    try {
      const success = await deleteCommunityTaxCollection(target.id);
      if (success) {
        setItems(prev => prev.filter(i => i.id !== target.id));
        setNotification({
          open: true,
          message: `CTC #${target.ctcNo} deleted successfully.`,
          severity: 'success'
        });
        if (selectedRecord?.id === target.id) {
          setDetailsDialogOpen(false);
        }
      } else {
        setNotification({ open: true, message: 'Failed to delete entry.', severity: 'error' });
      }
    } catch (err) {
      console.error(err);
      setNotification({ open: true, message: 'Error deleting entry.', severity: 'error' });
    } finally {
      setLoading(false);
      setItemToDelete(null);
    }
  };

  const handleViewDetails = (item: CommunityTaxItem) => {
    setSelectedRecord(item);
    setDetailsDialogOpen(true);
  };

  // Form State
  const formCardRef = useRef<HTMLDivElement>(null);
  const taxpayerRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    afNo: 'BRF 0016',
    bookletNo: '',
    ctcNo: '',
    taxpayerName: '',
    ctcType: 'Individual' as 'Individual' | 'Corporation',
    gender: 'Male' as 'Male' | 'Female',
    barangay: 'Poblacion',
    address: '',
    basicSalary: '0',
    basicTax: '5',
    additionalTax: '20',
    penalty: '0',
    amount: '25',
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

  const loadData = async (): Promise<CommunityTaxItem[]> => {
    setLoading(true);
    try {
      const data = await getCommunityTaxCollections();
      setItems(data);
      return data;
    } catch (err) {
      console.error('Failed to load Community Tax data:', err);
      setNotification({ open: true, message: 'Failed to load Community Tax entries.', severity: 'error' });
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update initial CTC number and Booklet number when items load
  useEffect(() => {
    if (!editingId && !formData.taxpayerName && items.length > 0) {
      const nextNo = getAutoCtcNo(items);
      const latestBooklet = items[0]?.bookletNo || '';
      setFormData(prev => ({ 
        ...prev, 
        ctcNo: nextNo,
        bookletNo: prev.bookletNo || latestBooklet
      }));
    }
  }, [items, editingId]);

  // Update calculations for Gender, Basic Salary, Basic Tax, Penalty, and Total Amount
  const updateFormCalculations = (partial: Partial<typeof formData>) => {
    setFormData(prev => {
      const merged = { ...prev, ...partial };
      
      const bTax = parseFloat(merged.basicTax) || 0;
      const bSalary = parseFloat(merged.basicSalary) || 0;

      // Additional Tax:
      // If basicSalary > 0: (basicSalary * 12) / 1000
      // If basicSalary === 0: Male = 20, Female = 10 (or keep manually entered additional tax)
      let addTax: number;
      if (partial.additionalTax !== undefined && bSalary === 0) {
        addTax = parseFloat(partial.additionalTax) || 0;
      } else if (bSalary > 0) {
        addTax = parseFloat(((bSalary * 12) / 1000).toFixed(2));
      } else {
        addTax = merged.gender === 'Female' ? 10 : 20;
      }

      // Penalty:
      // 2% per month of (Basic Community Tax + Additional Community Tax),
      // starting March with 6% (no penalty on Jan and Feb)
      let pen: number;
      if (partial.penalty !== undefined) {
        pen = parseFloat(partial.penalty) || 0;
      } else {
        pen = calculatePenalty(merged.date, bTax, addTax);
      }

      const total = parseFloat((bTax + addTax + pen).toFixed(2));

      return {
        ...merged,
        additionalTax: addTax.toString(),
        penalty: pen.toString(),
        amount: total.toString()
      };
    });
  };

  const handleResetForm = () => {
    const nextNo = getAutoCtcNo(items);
    const latestBooklet = items[0]?.bookletNo || formData.bookletNo || '';
    const currentDate = new Date().toISOString().split('T')[0];
    const defaultBasic = '5';
    const defaultGender = 'Male' as const;
    const defaultSalary = '0';
    const defaultAdditional = '20';
    const pen = calculatePenalty(currentDate, parseFloat(defaultBasic), parseFloat(defaultAdditional));
    const total = (parseFloat(defaultBasic) + parseFloat(defaultAdditional) + pen).toFixed(2);

    setEditingId(null);
    setFormData({
      afNo: 'BRF 0016',
      bookletNo: latestBooklet,
      ctcNo: nextNo,
      taxpayerName: '',
      ctcType: 'Individual',
      gender: defaultGender,
      barangay: 'Poblacion',
      address: '',
      basicSalary: defaultSalary,
      basicTax: defaultBasic,
      additionalTax: defaultAdditional,
      penalty: pen.toString(),
      amount: total,
      date: currentDate,
      remarks: ''
    });
  };

  const handleOpenAddDialog = () => {
    if (!showForm) {
      handleResetForm();
      setShowForm(true);
      setTimeout(() => {
        formCardRef.current?.scrollIntoView({ behavior: 'smooth' });
        taxpayerRef.current?.focus();
      }, 50);
    } else {
      setShowForm(false);
    }
  };

  const handleEdit = (item: CommunityTaxItem) => {
    setShowForm(true);
    setEditingId(item.id);
    let g: 'Male' | 'Female' = item.gender || 'Male';
    if (!item.gender && item.remarks) {
      if (item.remarks.includes('[Gender: Female]') || item.remarks.includes('Gender: Female')) g = 'Female';
      else if (item.remarks.includes('[Gender: Male]') || item.remarks.includes('Gender: Male')) g = 'Male';
    }

    let sal = item.basicSalary !== undefined ? String(item.basicSalary) : '0';
    if (sal === '0' && item.remarks) {
      const matchSal = item.remarks.match(/\[Salary:\s*([\d,.]+)\]/);
      if (matchSal) sal = matchSal[1];
    }

    const cleanRemarks = (item.remarks || '')
      .replace(/\[Gender:[^\]]+\]/g, '')
      .replace(/\[Salary:[^\]]+\]/g, '')
      .trim();

    setFormData({
      afNo: item.afNo || 'BRF 0016',
      bookletNo: item.bookletNo || '',
      ctcNo: item.ctcNo || '',
      taxpayerName: item.taxpayerName || '',
      ctcType: item.ctcType || 'Individual',
      gender: g,
      barangay: item.barangay || 'Poblacion',
      address: item.address || '',
      basicSalary: sal,
      basicTax: String(item.basicTax ?? (item.ctcType === 'Corporation' ? 500 : 5)),
      additionalTax: String(item.additionalTax ?? (g === 'Female' ? 10 : 20)),
      penalty: String(item.penalty ?? 0),
      amount: String(item.amount ?? 0),
      date: item.date || new Date().toISOString().split('T')[0],
      remarks: cleanRemarks
    });
    setTimeout(() => {
      formCardRef.current?.scrollIntoView({ behavior: 'smooth' });
      taxpayerRef.current?.focus();
    }, 50);
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

    const metaRemarks = [
      formData.remarks.trim(),
      formData.ctcType === 'Individual' ? `[Gender: ${formData.gender}]` : '',
      parseFloat(formData.basicSalary) > 0 ? `[Salary: ${formData.basicSalary}]` : ''
    ].filter(Boolean).join(' ');

    const duplicate = items.find(
      i => i.ctcNo.trim().toLowerCase() === formData.ctcNo.trim().toLowerCase() && i.id !== editingId
    );
    if (duplicate) {
      setNotification({
        open: true,
        message: `CTC Number "${formData.ctcNo.trim()}" is already assigned to "${duplicate.taxpayerName}". Please specify a unique CTC Number.`,
        severity: 'error'
      });
      return;
    }

    setLoading(true);
    try {
      const itemToSave: CommunityTaxItem = {
        id: editingId || 0,
        afNo: formData.afNo || 'BRF 0016',
        bookletNo: formData.bookletNo.trim(),
        ctcNo: formData.ctcNo.trim(),
        taxpayerName: formData.taxpayerName.trim().toUpperCase(),
        ctcType: formData.ctcType,
        gender: formData.gender,
        barangay: formData.barangay,
        address: '',
        basicSalary: parseFloat(formData.basicSalary) || 0,
        basicTax: parseFloat(formData.basicTax) || 0,
        additionalTax: parseFloat(formData.additionalTax) || 0,
        penalty: parseFloat(formData.penalty) || 0,
        amount: totalAmount,
        date: formData.date,
        remarks: metaRemarks
      };

      const success = await saveCommunityTaxCollection(itemToSave);
      if (success) {
        setNotification({
          open: true,
          message: editingId ? 'Community Tax entry updated!' : 'Community Tax entry saved!',
          severity: 'success'
        });
        const updatedItems = await loadData();
        const nextCtc = getAutoCtcNo(updatedItems);
        const preservedBooklet = formData.bookletNo.trim();
        const currentDate = new Date().toISOString().split('T')[0];
        const defaultBasic = '5';
        const defaultGender = 'Male' as const;
        const defaultSalary = '0';
        const defaultAdditional = '20';
        const pen = calculatePenalty(currentDate, parseFloat(defaultBasic), parseFloat(defaultAdditional));
        const total = (parseFloat(defaultBasic) + parseFloat(defaultAdditional) + pen).toFixed(2);

        setEditingId(null);
        setFormData({
          afNo: 'BRF 0016',
          bookletNo: preservedBooklet,
          ctcNo: nextCtc,
          taxpayerName: '',
          ctcType: 'Individual',
          gender: defaultGender,
          barangay: 'Poblacion',
          address: '',
          basicSalary: defaultSalary,
          basicTax: defaultBasic,
          additionalTax: defaultAdditional,
          penalty: pen.toString(),
          amount: total,
          date: currentDate,
          remarks: ''
        });

        setShowForm(true);

        setTimeout(() => {
          taxpayerRef.current?.focus();
        }, 100);
      } else {
        setNotification({ open: true, message: 'Failed to save entry. Please try again.', severity: 'error' });
      }
    } catch (err: any) {
      console.error(err);
      setNotification({ 
        open: true, 
        message: err?.message || 'An error occurred while saving.', 
        severity: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchSearch = 
        (item.taxpayerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.ctcNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.bookletNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.remarks || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.address || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchGender = filterGender === 'ALL' || (item.gender || 'Male') === filterGender;
      const matchBarangay = !filterBarangay || item.barangay === filterBarangay;
      const matchDate = !filterDate || (item.date && item.date.startsWith(filterDate));

      return matchSearch && matchGender && matchBarangay && matchDate;
    });
  }, [items, searchTerm, filterGender, filterBarangay, filterDate]);

  // Excel Template Download
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Form No': 'BRF 0016',
        'Booklet No': '01',
        'CTC Number': 'CCI2026-00001',
        'Taxpayer Name': 'JUAN DELA CRUZ',
        'Gender': 'Male',
        'Barangay': 'Poblacion',
        'Basic Salary': 0,
        'Basic Tax': 5,
        'Additional Tax': 20,
        'Penalty': 0,
        'Total Amount': 25,
        'Date': new Date().toISOString().split('T')[0],
        'Remarks': 'Self-employed / Farmer'
      },
      {
        'Form No': 'BRF 0016',
        'Booklet No': '01',
        'CTC Number': 'CCI2026-00002',
        'Taxpayer Name': 'MARIA SANTOS',
        'Gender': 'Female',
        'Barangay': 'Bakhawan',
        'Basic Salary': 15000,
        'Basic Tax': 5,
        'Additional Tax': 180,
        'Penalty': 0,
        'Total Amount': 185,
        'Date': new Date().toISOString().split('T')[0],
        'Remarks': 'Employed at School'
      }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 12 },
      { wch: 12 },
      { wch: 16 },
      { wch: 30 },
      { wch: 10 },
      { wch: 16 },
      { wch: 14 },
      { wch: 12 },
      { wch: 15 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 25 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Community Tax Template');
    XLSX.writeFile(wb, 'Community_Tax_Template_BRF0016.xlsx');
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
          const rawGender = String(row['Gender'] || row['Sex'] || '').trim();
          const gender: 'Male' | 'Female' = rawGender.toLowerCase().startsWith('f') ? 'Female' : 'Male';
          const basicSalary = parseFloat(row['Basic Salary'] || row['Salary'] || 0) || 0;
          const b = parseFloat(row['Basic Tax'] || row['Basic'] || (ctcType === 'Corporation' ? 500 : 5)) || 0;
          const a = parseFloat(row['Additional Tax'] || row['Additional'] || (gender === 'Female' ? 10 : 20)) || 0;
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
            afNo: String(row['Form No'] || row['AF No'] || 'BRF 0016').trim(),
            bookletNo: String(row['Booklet No'] || row['Booklet Number'] || row['Booklet'] || row['Bk No'] || '').trim(),
            ctcNo: String(row['CTC Number'] || row['CTC No'] || row['Certificate No'] || row['OR Number'] || '').trim(),
            taxpayerName: String(row['Taxpayer Name'] || row['Payor'] || row['Name'] || '').trim().toUpperCase(),
            ctcType,
            gender,
            basicSalary,
            barangay: String(row['Barangay'] || 'Poblacion').trim(),
            address: '',
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
      'Booklet No': item.bookletNo || '',
      'CTC Number': item.ctcNo,
      'Taxpayer Name': item.taxpayerName,
      'Gender': item.gender || 'Male',
      'Barangay': item.barangay,
      'Basic Salary': item.basicSalary || 0,
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
      { wch: 12 },
      { wch: 16 },
      { wch: 28 },
      { wch: 14 },
      { wch: 16 },
      { wch: 15 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
      { wch: 22 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Community Tax');
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Community_Tax_BRF0016_${dateStr}.xlsx`);
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
        onClose={() => {
          setDeleteDialogOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Community Tax Certificate"
        message={itemToDelete ? `Are you sure you want to delete CTC #${itemToDelete.ctcNo} for ${itemToDelete.taxpayerName}? This action cannot be undone.` : "Are you sure you want to delete this certificate?"}
        confirmText="Delete"
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
              label="BRF No. 0016" 
              size="small" 
              sx={{ fontWeight: 700, bgcolor: '#e0f2fe', color: '#0284c7', border: '1px solid rgba(14, 165, 233, 0.3)' }} 
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {isAdmin 
              ? "Auditing and monitoring Community Tax Certificates (Cedula) encoded across all collectors."
              : "Encode, issue, and manage Community Tax Certificates (Individual & Corporate) under Accountable Form BRF No. 0016."}
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
            <Tooltip title={showForm ? "Hide Form" : "Issue New Community Tax Certificate"} arrow>
              <IconButton 
                color="primary"
                onClick={handleOpenAddDialog}
                sx={{ 
                  bgcolor: showForm ? '#0369a1' : '#0284c7', 
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

      {/* On-Page Issue / Edit Community Tax Certificate Form (Hidden by default) */}
      {showForm && (
        <Paper 
          ref={formCardRef} 
          elevation={0} 
          sx={{ 
            p: 3, 
            mb: 3, 
            borderRadius: 1.5, 
            border: '1px solid #e2e8f0', 
            bgcolor: '#ffffff' 
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, pb: 1.5, borderBottom: '1px solid #f1f5f9' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ p: 1, bgcolor: '#e0f2fe', color: '#0284c7', borderRadius: 1, display: 'flex' }}>
                <ReceiptLong fontSize="small" />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight="800" sx={{ color: '#0f172a', fontSize: '1.05rem' }}>
                  {editingId ? 'Edit Community Tax Certificate' : 'Issue Community Tax Certificate (Cedula)'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {editingId ? `Editing details for CTC #${formData.ctcNo}` : 'BRF No. 0016 — Encode taxpayer details and community tax breakdown'}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {editingId ? (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    handleResetForm();
                    setShowForm(false);
                  }}
                  sx={{ borderColor: '#e2e8f0', color: '#64748b' }}
                >
                  Cancel Edit
                </Button>
              ) : (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setShowForm(false)}
                  sx={{ borderColor: '#e2e8f0', color: '#64748b' }}
                >
                  Close Form
                </Button>
              )}
            </Box>
          </Box>

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                label="Booklet No."
                value={formData.bookletNo}
                onChange={(e) => setFormData({ ...formData, bookletNo: e.target.value })}
                fullWidth
                size="small"
                placeholder="e.g. 01 or B-01"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                label="CTC / Certificate Number *"
                value={formData.ctcNo}
                onChange={(e) => setFormData({ ...formData, ctcNo: e.target.value })}
                fullWidth
                size="small"
                required
                placeholder="e.g. 0012345 or CCI2026-0001"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                label="Date of Issue *"
                type="date"
                value={formData.date}
                onChange={(e) => updateFormCalculations({ date: e.target.value })}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Gender *</InputLabel>
                <Select
                  value={formData.gender}
                  label="Gender *"
                  onChange={(e) => updateFormCalculations({ gender: e.target.value as 'Male' | 'Female' })}
                >
                  <MenuItem value="Male">Male (₱20 Additional Tax)</MenuItem>
                  <MenuItem value="Female">Female (₱10 Additional Tax)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 7 }}>
              <TextField
                inputRef={taxpayerRef}
                label="Taxpayer Name *"
                value={formData.taxpayerName}
                onChange={(e) => setFormData({ ...formData, taxpayerName: e.target.value })}
                fullWidth
                size="small"
                required
                placeholder="Full Legal Name"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 5 }}>
              <Autocomplete
                options={BARANGAYS}
                value={formData.barangay}
                onChange={(_, val) => setFormData({ ...formData, barangay: val || 'Poblacion' })}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    label="Barangay (Concepcion, Romblon) *" 
                    size="small" 
                    required 
                  />
                )}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 1, borderColor: '#f1f5f9' }} />
              <Typography variant="subtitle2" fontWeight="800" sx={{ color: '#0369a1', mb: 1.5 }}>
                Tax Computations & Breakdown
              </Typography>
            </Grid>

            <Grid size={{ xs: 12, sm: 2.4 }}>
              <TextField
                label="Basic Salary (₱)"
                type="number"
                value={formData.basicSalary}
                onChange={(e) => updateFormCalculations({ basicSalary: e.target.value })}
                fullWidth
                size="small"
                helperText="If changed: (Salary * 12)/1000"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 2.4 }}>
              <TextField
                label="Basic Community Tax (₱)"
                type="number"
                value={formData.basicTax}
                onChange={(e) => updateFormCalculations({ basicTax: e.target.value })}
                fullWidth
                size="small"
                helperText="₱5 Basic Tax"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 2.4 }}>
              <TextField
                label="Additional Tax (₱)"
                type="number"
                value={formData.additionalTax}
                onChange={(e) => updateFormCalculations({ additionalTax: e.target.value })}
                fullWidth
                size="small"
                helperText="Gender base or Salary/1000"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 2.4 }}>
              <TextField
                label="Penalty / Surcharge (₱)"
                type="number"
                value={formData.penalty}
                onChange={(e) => updateFormCalculations({ penalty: e.target.value })}
                fullWidth
                size="small"
                helperText={
                  getPenaltyRate(formData.date) > 0
                    ? `${(getPenaltyRate(formData.date) * 100).toFixed(0)}% (2%/mo starts Mar @ 6%)`
                    : '0% (No penalty Jan-Feb)'
                }
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 2.4 }}>
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
                helperText="Basic + Additional + Penalty"
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                label="Remarks / Particulars"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                fullWidth
                size="small"
                placeholder="e.g. Employed at LGU, Business owner, Farmer"
              />
            </Grid>

            <Grid size={{ xs: 12 }} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 1 }}>
              <Button 
                variant="outlined" 
                onClick={() => {
                  handleResetForm();
                  setShowForm(false);
                }} 
                sx={{ borderColor: '#e2e8f0', color: '#64748b' }}
              >
                {editingId ? 'Cancel Edit' : 'Close Form'}
              </Button>
              <Button 
                variant="contained" 
                onClick={handleSave}
                startIcon={<Save />}
                sx={{ bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' }, borderRadius: 1, px: 3 }}
              >
                {editingId ? 'Save Changes' : 'Save Certificate'}
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}

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
              <InputLabel>Gender</InputLabel>
              <Select
                value={filterGender}
                label="Gender"
                onChange={(e) => setFilterGender(e.target.value)}
              >
                <MenuItem value="ALL">All Genders</MenuItem>
                <MenuItem value="Male">Male</MenuItem>
                <MenuItem value="Female">Female</MenuItem>
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
                setFilterGender('ALL');
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
                <TableCell sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>CTC Number</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>Taxpayer Name</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>Gender</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>Barangay</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>Total</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ py: 6, textAlign: 'center', color: '#94a3b8' }}>
                    <ReceiptLong sx={{ fontSize: 44, color: '#cbd5e1', mb: 1, display: 'block', mx: 'auto' }} />
                    <Typography variant="subtitle2" fontWeight="700">No Community Tax records found</Typography>
                    <Typography variant="caption">Encode a new certificate or adjust your search filters above.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((row) => (
                    <TableRow 
                      key={row.id} 
                      hover 
                      onClick={() => handleViewDetails(row)}
                      sx={{ 
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                        '&:hover': { bgcolor: '#f1f5f9' } 
                      }}
                    >
                      <TableCell sx={{ fontSize: '0.84rem', color: '#334155', fontWeight: 500 }}>
                        {row.date}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.86rem', fontWeight: 700, color: '#0284c7' }}>
                        {row.ctcNo}
                        {row.bookletNo && (
                          <Typography variant="caption" display="block" sx={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 500 }}>
                            Bk #{row.bookletNo}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.86rem', fontWeight: 600, color: '#0f172a' }}>
                        {row.taxpayerName}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={row.gender || 'Male'}
                          size="small"
                          sx={{ 
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            borderRadius: 1,
                            bgcolor: (row.gender || 'Male') === 'Female' ? '#fdf2f8' : '#f0f9ff',
                            color: (row.gender || 'Male') === 'Female' ? '#db2777' : '#0284c7',
                            border: '1px solid',
                            borderColor: (row.gender || 'Male') === 'Female' ? '#fbcfe8' : '#bae6fd'
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.84rem', color: '#475569' }}>
                        {row.barangay}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                        ₱ {Number(row.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title={`Edit CTC #${row.ctcNo}`} arrow>
                            <IconButton
                              color="primary"
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(row);
                              }}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={`Delete CTC #${row.ctcNo}`} arrow>
                            <IconButton
                              color="error"
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(row);
                              }}
                            >
                              <DeleteOutline fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
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

      {/* Complete Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        {selectedRecord && (
          <>
            <DialogTitle sx={{ pb: 1.5, borderBottom: '1px solid #f1f5f9' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ p: 1, bgcolor: '#e0f2fe', color: '#0284c7', borderRadius: 1.5, display: 'flex' }}>
                    <ReceiptLong fontSize="small" />
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight="800" sx={{ color: '#0f172a', fontSize: '1.1rem', lineHeight: 1.2 }}>
                      Community Tax Details
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      CTC No. {selectedRecord.ctcNo} • {selectedRecord.afNo || 'BRF 0016'}
                    </Typography>
                  </Box>
                </Box>
                <IconButton size="small" onClick={() => setDetailsDialogOpen(false)} sx={{ color: '#94a3b8' }}>
                  <Close fontSize="small" />
                </IconButton>
              </Box>
            </DialogTitle>

            <DialogContent sx={{ pt: 2.5, pb: 2 }}>
              {/* Primary Info Card */}
              <Box sx={{ p: 2, mb: 2.5, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 4 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Date of Issue
                    </Typography>
                    <Typography variant="body2" fontWeight="700" color="#0f172a">
                      {selectedRecord.date || '-'}
                    </Typography>
                  </Grid>

                  <Grid size={{ xs: 4 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Accountable Form
                    </Typography>
                    <Typography variant="body2" fontWeight="700" color="#0284c7">
                      {selectedRecord.afNo || 'BRF 0016'}
                    </Typography>
                  </Grid>

                  <Grid size={{ xs: 4 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Booklet No.
                    </Typography>
                    <Typography variant="body2" fontWeight="700" color="#0f172a">
                      {selectedRecord.bookletNo || '-'}
                    </Typography>
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <Divider sx={{ my: 0.5, borderColor: '#e2e8f0' }} />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Taxpayer Name
                    </Typography>
                    <Typography variant="subtitle1" fontWeight="800" color="#0f172a">
                      {selectedRecord.taxpayerName}
                    </Typography>
                  </Grid>

                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Gender
                    </Typography>
                    <Chip 
                      label={selectedRecord.gender || 'Male'}
                      size="small"
                      sx={{ 
                        mt: 0.3,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        borderRadius: 1,
                        bgcolor: (selectedRecord.gender || 'Male') === 'Female' ? '#fdf2f8' : '#f0f9ff',
                        color: (selectedRecord.gender || 'Male') === 'Female' ? '#db2777' : '#0284c7',
                        border: '1px solid',
                        borderColor: (selectedRecord.gender || 'Male') === 'Female' ? '#fbcfe8' : '#bae6fd'
                      }}
                    />
                  </Grid>

                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Barangay
                    </Typography>
                    <Typography variant="body2" fontWeight="700" color="#334155">
                      {selectedRecord.barangay}, Concepcion, Romblon
                    </Typography>
                  </Grid>

                  {selectedRecord.remarks && (
                    <Grid size={{ xs: 12 }}>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Remarks / Notes
                      </Typography>
                      <Typography variant="body2" color="#475569" sx={{ fontStyle: 'italic' }}>
                        {selectedRecord.remarks}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Box>

              {/* Financial Computation Breakdown */}
              <Box sx={{ p: 2, bgcolor: '#ffffff', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                <Typography variant="subtitle2" fontWeight="800" sx={{ color: '#0369a1', mb: 1.5 }}>
                  Tax Computations & Breakdown
                </Typography>

                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      Basic Monthly Salary
                    </Typography>
                    <Typography variant="body2" fontWeight="600">
                      ₱ {Number(selectedRecord.basicSalary || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      Basic Community Tax
                    </Typography>
                    <Typography variant="body2" fontWeight="600">
                      ₱ {Number(selectedRecord.basicTax || 0).toFixed(2)}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      Additional Community Tax
                    </Typography>
                    <Typography variant="body2" fontWeight="600">
                      ₱ {Number(selectedRecord.additionalTax || 0).toFixed(2)}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color={selectedRecord.penalty ? 'error.main' : 'text.secondary'}>
                      Penalty / Surcharge
                    </Typography>
                    <Typography variant="body2" fontWeight="600" color={selectedRecord.penalty ? 'error.main' : 'inherit'}>
                      ₱ {Number(selectedRecord.penalty || 0).toFixed(2)}
                    </Typography>
                  </Box>

                  <Divider sx={{ my: 1, borderColor: '#cbd5e1' }} />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 0.5 }}>
                    <Typography variant="subtitle1" fontWeight="800" color="#0f172a">
                      Total Amount Paid
                    </Typography>
                    <Typography variant="h6" fontWeight="800" color="#0284c7">
                      ₱ {Number(selectedRecord.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #f1f5f9', justifyContent: 'space-between' }}>
              <Box>
                {!isAdmin && (
                  <Button
                    color="error"
                    variant="outlined"
                    size="small"
                    startIcon={<DeleteOutline />}
                    onClick={() => {
                      if (selectedRecord) {
                        handleDeleteClick(selectedRecord);
                      }
                    }}
                    sx={{ textTransform: 'none' }}
                  >
                    Delete
                  </Button>
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {!isAdmin && (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<Edit />}
                    onClick={() => {
                      setDetailsDialogOpen(false);
                      handleEdit(selectedRecord);
                    }}
                    sx={{ 
                      bgcolor: '#0284c7', 
                      '&:hover': { bgcolor: '#0369a1' },
                      textTransform: 'none'
                    }}
                  >
                    Edit Certificate
                  </Button>
                )}
                <Button 
                  onClick={() => setDetailsDialogOpen(false)} 
                  variant="outlined" 
                  size="small"
                  sx={{ borderColor: '#e2e8f0', color: '#64748b', textTransform: 'none' }}
                >
                  Close
                </Button>
              </Box>
            </DialogActions>
          </>
        )}
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
                  <TableCell sx={{ fontWeight: 700 }}>Booklet</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>CTC Number</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Taxpayer Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Gender</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Barangay</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Amount (₱)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {importedRows.slice(0, 50).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.date}</TableCell>
                    <TableCell sx={{ color: '#64748b' }}>{r.bookletNo || '-'}</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#0284c7' }}>{r.ctcNo}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{r.taxpayerName}</TableCell>
                    <TableCell>{r.gender || 'Male'}</TableCell>
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
