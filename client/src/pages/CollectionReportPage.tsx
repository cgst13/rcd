import React, { useEffect, useMemo, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Stack,
  Autocomplete,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Card,
  CardHeader,
  CardContent,
  IconButton,
  InputAdornment,
  Tooltip,
  Backdrop,
  CircularProgress,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
  Button
} from '@mui/material';
import { 
  AddCircleOutline, 
  DeleteOutline, 
  ReceiptLong, 
  PersonOutline, 
  AttachMoney, 
  Event, 
  Notes, 
  Save, 
  Edit, 
  Search, 
  Clear,
  UploadFile,
  FileDownload,
  Check,
  TableChart,
  Layers,
  CloudDone,
  KeyboardArrowDown,
  KeyboardArrowUp,
  AdminPanelSettings,
  Visibility,
  Refresh,
  CloudSync
} from '@mui/icons-material';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Notification } from '../components/Notification';
import { useAuth } from '../context/useAuth';
import { 
  getAccountCodes, 
  getCollectionEntries, 
  saveCollectionEntryBulk, 
  deleteCollectionGroup,
  updateCollectionGroup,
  importCollectionsBatch,
  syncPendingLocalCollectionsToSupabase
} from '../services/supabaseService';
import type { AccountCode } from '../types/rcd';
import type { CollectionItem } from '../services/supabaseService';

export interface GroupedCollection {
  key: string;
  afNo: string;
  orNo: string;
  payor: string;
  date: string;
  remarks: string;
  totalAmount: number;
  items: CollectionItem[];
  itemIds: number[];
}

const getNextOrNo = (currentOrNo: string): string => {
  let nextOrNo = currentOrNo.trim();
  const matchNum = nextOrNo.match(/(\d+)$/);
  if (matchNum) {
    const numStr = matchNum[1];
    const nextNum = parseInt(numStr, 10) + 1;
    const nextNumStr = String(nextNum).padStart(8, '0');
    nextOrNo = nextOrNo.substring(0, matchNum.index) + nextNumStr;
  } else if (nextOrNo && !isNaN(Number(nextOrNo))) {
    nextOrNo = String(Number(nextOrNo) + 1).padStart(8, '0');
  }
  return nextOrNo;
};

const formatExcelDate = (val: any): string => {
  if (!val && val !== 0) return new Date().toISOString().split('T')[0];
  
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // Handle Excel numeric serial dates (e.g. 45653 = Dec 27, 2024)
  if (typeof val === 'number' || (!isNaN(Number(val)) && Number(val) > 25000 && Number(val) < 85000 && !String(val).includes('-') && !String(val).includes('/'))) {
    const num = Number(val);
    const utcDays = Math.floor(num - 25569);
    const dateInfo = new Date(utcDays * 86400 * 1000);
    if (!isNaN(dateInfo.getTime())) {
      const y = dateInfo.getUTCFullYear();
      const m = String(dateInfo.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dateInfo.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // Handles M/D/YYYY, MM/DD/YYYY, M-D-YYYY
  const slashParts = str.split(/[/-]/);
  if (slashParts.length === 3) {
    let [p1, p2, p3] = slashParts;
    if (p1.length === 4) {
      return `${p1}-${p2.padStart(2, '0')}-${p3.padStart(2, '0')}`;
    }
    if (p3.length === 2) p3 = `20${p3}`;
    const m = p1.padStart(2, '0');
    const d = p2.padStart(2, '0');
    return `${p3}-${m}-${d}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return new Date().toISOString().split('T')[0];
};

export const CollectionReportPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'administrator';

  const payorRef = useRef<HTMLInputElement>(null);
  const subCategoryRefs = useRef<(HTMLInputElement | null)[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showEntryForm, setShowEntryForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({ open: false, message: '', severity: 'info' });

  // Delete Dialog State for Grouped OR
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<GroupedCollection | null>(null);

  // Group Expand / Collapse State
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Workbook & Sheet Import State
  const [currentWorkbook, setCurrentWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importedRows, setImportedRows] = useState<Array<Omit<CollectionItem, 'id'>>>([]);
  
  // Animated Progress States
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [parseStatusText, setParseStatusText] = useState('');

  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatusText, setImportStatusText] = useState('');

  // Editing Group State (tracks IDs belonging to the edited OR No.)
  const [editingGroupIds, setEditingGroupIds] = useState<number[] | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterAfNo, setFilterAfNo] = useState<string | null>(null);
  const [filterSubCategory, setFilterSubCategory] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState('');

  const [accountCodes, setAccountCodes] = useState<AccountCode[]>([]);
  const [items, setItems] = useState<CollectionItem[]>([]);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [form, setForm] = useState({
    afNo: '',
    orNo: '',
    payor: '',
    date: new Date().toISOString().split('T')[0],
    remarks: ''
  });
  const [charges, setCharges] = useState<Array<{
    subCategory: string;
    mainCategory: string;
    accountCode: string;
    amount: string;
  }>>([{ subCategory: '', mainCategory: '', accountCode: '', amount: '' }]);

  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [codes, collectionEntries] = await Promise.all([
        getAccountCodes(),
        getCollectionEntries()
      ]);
      setAccountCodes(codes);
      setItems(collectionEntries);
      if (collectionEntries.length > 0) {
        const latestEntry = collectionEntries[0];
        setForm(prev => ({
          ...prev,
          afNo: latestEntry.afNo || prev.afNo,
          orNo: getNextOrNo(latestEntry.orNo || ''),
          date: latestEntry.date || prev.date
        }));
      }
    } catch (e) {
      console.error(e);
      setNotification({
        open: true,
        message: 'Failed to load initial data.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const toggleRow = (key: string) => {
    setExpandedRows(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ==========================================
  // EXCEL PARSER & SHEET SELECTOR LOGIC
  // ==========================================
  const parseSheetData = (worksheet: XLSX.WorkSheet): Array<Omit<CollectionItem, 'id'>> => {
    const rawMatrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    if (!rawMatrix || rawMatrix.length === 0) return [];

    const normCell = (cell: any): string => 
      String(cell || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    // 1. Locate Header Row Index
    let headerRowIdx = -1;
    let maxMatchCount = 0;

    for (let i = 0; i < Math.min(rawMatrix.length, 25); i++) {
      const row = rawMatrix[i];
      if (!Array.isArray(row)) continue;
      let matchCount = 0;
      row.forEach(cell => {
        const str = normCell(cell);
        if (
          str.includes('af') || 
          str.includes('or') || 
          str.includes('payor') || 
          str.includes('payer') || 
          str.includes('subcat') || 
          str.includes('maincat') || 
          str.includes('account') || 
          str.includes('code') || 
          str.includes('amount') || 
          str.includes('amt') || 
          str.includes('date') || 
          str.includes('remark')
        ) {
          matchCount++;
        }
      });
      if (matchCount > maxMatchCount && matchCount >= 2) {
        maxMatchCount = matchCount;
        headerRowIdx = i;
      }
    }

    // 2. Map Column Positions
    const colMap: {
      afNo?: number;
      orNo?: number;
      payor?: number;
      subCategory?: number;
      mainCategory?: number;
      accountCode?: number;
      amount?: number;
      date?: number;
      remarks?: number;
    } = {};

    let startDataRow = 0;

    if (headerRowIdx !== -1) {
      const headerRow = rawMatrix[headerRowIdx];
      headerRow.forEach((cell, idx) => {
        const n = normCell(cell);
        if (!n) return;
        if (colMap.afNo === undefined && (n === 'afno' || n === 'af' || n.includes('afnum') || n.includes('formno') || n.includes('accountableform'))) {
          colMap.afNo = idx;
        } else if (colMap.orNo === undefined && (n === 'orno' || n === 'or' || n.includes('ornum') || n.includes('receipt') || n.includes('serial'))) {
          colMap.orNo = idx;
        } else if (colMap.payor === undefined && (n.includes('payor') || n.includes('payer') || n.includes('taxpayer') || n === 'name' || n === 'customer')) {
          colMap.payor = idx;
        } else if (colMap.subCategory === undefined && (n.includes('subcat') || n.includes('nature') || n === 'subcategory' || n === 'sub')) {
          colMap.subCategory = idx;
        } else if (colMap.mainCategory === undefined && (n.includes('maincat') || n.includes('maincategory') || n === 'main' || n.includes('fund'))) {
          colMap.mainCategory = idx;
        } else if (colMap.accountCode === undefined && (n.includes('accountcode') || n.includes('acctcode') || n === 'code' || n.includes('glcode'))) {
          colMap.accountCode = idx;
        } else if (colMap.amount === undefined && (n.includes('amount') || n.includes('amt') || n === 'total' || n.includes('value') || n.includes('collected'))) {
          colMap.amount = idx;
        } else if (colMap.date === undefined && (n.includes('date') || n.includes('txdate'))) {
          colMap.date = idx;
        } else if (colMap.remarks === undefined && (n.includes('remark') || n.includes('note') || n.includes('memo') || n.includes('desc'))) {
          colMap.remarks = idx;
        }
      });
      startDataRow = headerRowIdx + 1;
    } else {
      // Positional Fallback
      colMap.afNo = 0;
      colMap.orNo = 1;
      colMap.payor = 2;
      colMap.subCategory = 3;
      colMap.mainCategory = 4;
      colMap.accountCode = 5;
      colMap.amount = 6;
      colMap.date = 7;
      colMap.remarks = 8;
      startDataRow = 0;
    }

    if (colMap.afNo === undefined) colMap.afNo = 0;
    if (colMap.orNo === undefined) colMap.orNo = 1;
    if (colMap.payor === undefined) colMap.payor = 2;
    if (colMap.subCategory === undefined) colMap.subCategory = 3;
    if (colMap.mainCategory === undefined) colMap.mainCategory = 4;
    if (colMap.accountCode === undefined) colMap.accountCode = 5;
    if (colMap.amount === undefined) colMap.amount = 6;
    if (colMap.date === undefined) colMap.date = 7;
    if (colMap.remarks === undefined) colMap.remarks = 8;

    // 3. Extract Valid Collection Rows
    const parsedRows: Array<Omit<CollectionItem, 'id'>> = [];

    for (let r = startDataRow; r < rawMatrix.length; r++) {
      const row = rawMatrix[r];
      if (!row || !Array.isArray(row) || row.length === 0) continue;

      const cell0 = String(row[0] || '').trim().toLowerCase();
      const cell1 = String(row[1] || '').trim().toLowerCase();
      if (cell0.startsWith('total') || cell1.startsWith('total') || cell0.startsWith('grand total') || cell0.startsWith('subtotal')) {
        continue;
      }

      const rawAfNo = colMap.afNo !== undefined ? row[colMap.afNo] : '';
      const rawOrNo = colMap.orNo !== undefined ? row[colMap.orNo] : '';
      const rawPayor = colMap.payor !== undefined ? row[colMap.payor] : '';
      const rawSubCategory = colMap.subCategory !== undefined ? row[colMap.subCategory] : '';
      const rawMainCategory = colMap.mainCategory !== undefined ? row[colMap.mainCategory] : '';
      const rawAccountCode = colMap.accountCode !== undefined ? row[colMap.accountCode] : '';
      const rawAmount = colMap.amount !== undefined ? row[colMap.amount] : '';
      const rawDate = colMap.date !== undefined ? row[colMap.date] : '';
      const rawRemarks = colMap.remarks !== undefined ? row[colMap.remarks] : '';

      let amount = 0;
      if (typeof rawAmount === 'number') {
        amount = rawAmount;
      } else if (rawAmount !== null && rawAmount !== undefined) {
        const cleanAmtStr = String(rawAmount).replace(/[^0-9.-]+/g, '').trim();
        if (cleanAmtStr) {
          amount = parseFloat(cleanAmtStr) || 0;
        }
      }

      const afNo = String(rawAfNo ?? '').trim() || '93C';
      let orNo = String(rawOrNo ?? '').trim();
      if (orNo && /^\d+$/.test(orNo)) {
        orNo = orNo.padStart(8, '0');
      }

      const payor = String(rawPayor ?? '').trim();
      const subCategory = String(rawSubCategory ?? '').trim();
      const mainCategory = String(rawMainCategory ?? '').trim();
      const accountCode = String(rawAccountCode ?? '').trim();
      const remarks = String(rawRemarks ?? '').trim();
      const dateStr = formatExcelDate(rawDate);

      if (orNo || payor || subCategory || amount > 0) {
        parsedRows.push({
          afNo,
          orNo,
          payor,
          subCategory,
          mainCategory,
          accountCode,
          amount,
          date: dateStr,
          remarks
        });
      }
    }

    return parsedRows;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setParseProgress(10);
    setParseStatusText('Reading Excel file binary data...');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        setParseProgress(40);
        setParseStatusText('Analyzing spreadsheet worksheets...');

        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          setIsParsing(false);
          setNotification({ open: true, message: 'No sheets found in this file.', severity: 'warning' });
          return;
        }

        setCurrentWorkbook(workbook);
        setSheetNames(workbook.SheetNames);

        // Find initial best sheet
        let initialSheet = workbook.SheetNames[0];
        for (const sName of workbook.SheetNames) {
          const testWs = workbook.Sheets[sName];
          const testRows: any[][] = XLSX.utils.sheet_to_json(testWs, { header: 1, defval: '' });
          if (testRows && testRows.length > 1) {
            initialSheet = sName;
            break;
          }
        }

        setSelectedSheet(initialSheet);
        setParseProgress(75);
        setParseStatusText(`Extracting collection rows from sheet "${initialSheet}"...`);

        setTimeout(() => {
          const rows = parseSheetData(workbook.Sheets[initialSheet]);
          setParseProgress(100);
          setParseStatusText('Extraction complete!');

          setTimeout(() => {
            setIsParsing(false);
            if (rows.length === 0) {
              setNotification({
                open: true,
                message: `No collection entries detected in sheet "${initialSheet}". You can choose another sheet in the dialog.`,
                severity: 'info'
              });
            }
            setImportedRows(rows);
            setImportPreviewOpen(true);
          }, 300);
        }, 300);

      } catch (err: any) {
        setIsParsing(false);
        console.error('Failed to parse Excel file', err);
        setNotification({ 
          open: true, 
          message: 'Failed to parse Excel file. Please ensure it is a valid .xlsx, .xls, or .csv file.', 
          severity: 'error' 
        });
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSheetChange = (newSheet: string) => {
    if (!currentWorkbook || !currentWorkbook.Sheets[newSheet]) return;

    setSelectedSheet(newSheet);
    setIsParsing(true);
    setParseProgress(30);
    setParseStatusText(`Reading worksheet "${newSheet}"...`);

    setTimeout(() => {
      setParseProgress(70);
      setParseStatusText('Parsing and mapping columns...');
      const rows = parseSheetData(currentWorkbook.Sheets[newSheet]);

      setTimeout(() => {
        setParseProgress(100);
        setImportedRows(rows);
        setIsParsing(false);
      }, 250);
    }, 200);
  };

  const handleConfirmImport = async () => {
    if (importedRows.length === 0) return;
    setIsImporting(true);
    setImportProgress(15);
    setImportStatusText('Preparing batch data for upload...');

    try {
      setTimeout(() => {
        setImportProgress(45);
        setImportStatusText(`Saving ${importedRows.length} collection entries to Supabase cloud...`);
      }, 300);

      const res = await importCollectionsBatch(importedRows);
      
      setImportProgress(90);
      setImportStatusText('Synchronizing collection table...');

      if (res.success) {
        setImportProgress(100);
        setImportStatusText('Import complete!');
        
        setTimeout(async () => {
          setIsImporting(false);
          setImportPreviewOpen(false);
          setNotification({ 
            open: true, 
            message: `Successfully imported ${res.count} collection entries from sheet "${selectedSheet}"!`, 
            severity: 'success' 
          });
          await loadData();
        }, 500);
      } else {
        setIsImporting(false);
        setNotification({ open: true, message: 'Failed to import collection entries.', severity: 'error' });
      }
    } catch (e) {
      setIsImporting(false);
      console.error(e);
      setNotification({ open: true, message: 'An error occurred during import.', severity: 'error' });
    }
  };

  const handleDownloadTemplate = () => {
    const sampleData = [
      {
        'AF No.': '93C',
        'OR No.': '02298751',
        'Payor': 'SDA',
        'Sub Category': 'Water-Surcharge',
        'Main Category': 'Fines and Penalties- Business Income',
        'Account Code': '4-02-02-980',
        'Amount': 10.85,
        'Date': '12/27/2024',
        'Remarks': ''
      },
      {
        'AF No.': '93C',
        'OR No.': '02298752',
        'Payor': 'Grace Fontanoza',
        'Sub Category': 'Water-Surcharge',
        'Main Category': 'Fines and Penalties- Business Income',
        'Account Code': '4-02-02-980',
        'Amount': 26.50,
        'Date': '12/27/2024',
        'Remarks': ''
      },
      {
        'AF No.': '93C',
        'OR No.': '02298755',
        'Payor': 'Cristina Rorios',
        'Sub Category': 'Water-Surcharge',
        'Main Category': 'Fines and Penalties- Business Income',
        'Account Code': '4-02-02-980',
        'Amount': 10.85,
        'Date': '01/06/2025',
        'Remarks': ''
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Collections');
    XLSX.writeFile(wb, 'RCD_Collections_Template.xlsx');
    setNotification({ open: true, message: 'Sample Excel template downloaded!', severity: 'info' });
  };

  // Autocomplete options
  const uniqueAfNos = useMemo(() => Array.from(new Set(items.map(i => i.afNo).filter(Boolean))).sort(), [items]);
  const subCategories = useMemo(() => Array.from(new Set(accountCodes.map(c => c.subCategory))).filter(Boolean).sort(), [accountCodes]);
  const mainCategories = useMemo(() => Array.from(new Set(accountCodes.map(c => c.mainCategory))).filter(Boolean).sort(), [accountCodes]);
  const uniquePayors = useMemo(() => Array.from(new Set(items.map(i => i.payor).filter(Boolean))).sort(), [items]);

  const accountCodeOptionsBySub = useMemo(() => {
    const map = new Map<string, string[]>();
    accountCodes.forEach(ac => {
      const existing = map.get(ac.subCategory) || [];
      if (ac.code && !existing.includes(ac.code)) {
        existing.push(ac.code);
      }
      map.set(ac.subCategory, existing);
    });
    return map;
  }, [accountCodes]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = 
        (item.payor?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (item.orNo?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (item.remarks?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (item.accountCode?.toLowerCase() || '').includes(searchTerm.toLowerCase());

      const matchesAfNo = !filterAfNo || item.afNo === filterAfNo;
      const matchesSubCategory = !filterSubCategory || item.subCategory === filterSubCategory;
      const matchesDate = !filterDate || (item.date && item.date.startsWith(filterDate));

      return matchesSearch && matchesAfNo && matchesSubCategory && matchesDate;
    });
  }, [items, searchTerm, filterAfNo, filterSubCategory, filterDate]);

  // Group items by OR Number (and AF No) and sort by Date & OR No
  const groupedCollections: GroupedCollection[] = useMemo(() => {
    const groups: { [key: string]: GroupedCollection } = {};

    filteredItems.forEach(item => {
      const key = `${item.afNo || '93C'}__${item.orNo || ''}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          afNo: item.afNo || '',
          orNo: item.orNo || '',
          payor: item.payor || '',
          date: item.date || '',
          remarks: item.remarks || '',
          totalAmount: 0,
          items: [],
          itemIds: []
        };
      }
      groups[key].items.push(item);
      groups[key].itemIds.push(item.id);
      groups[key].totalAmount += (item.amount || 0);
    });

    return Object.values(groups).sort((a, b) => {
      // 1. Sort by Date descending (newest first)
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }

      // 2. Sort by OR No. descending (highest receipt number first)
      const orA = a.orNo || '';
      const orB = b.orNo || '';
      const numA = parseInt(orA, 10);
      const numB = parseInt(orB, 10);
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
        return numB - numA;
      }
      return orB.localeCompare(orA);
    });
  }, [filteredItems]);

  const visibleGroups = useMemo(() => {
    return groupedCollections.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );
  }, [groupedCollections, page, rowsPerPage]);

  const handleEditGroup = (group: GroupedCollection) => {
    setEditingGroupIds(group.itemIds);
    setForm({
      afNo: group.afNo,
      orNo: group.orNo,
      payor: group.payor,
      date: group.date,
      remarks: group.remarks
    });
    setCharges(group.items.map(item => ({
      subCategory: item.subCategory,
      mainCategory: item.mainCategory,
      accountCode: item.accountCode,
      amount: String(item.amount)
    })));
    setShowEntryForm(true);
  };

  const handleCancelEdit = () => {
    setEditingGroupIds(null);
    setForm({
      afNo: '',
      orNo: '',
      payor: '',
      date: new Date().toISOString().split('T')[0],
      remarks: ''
    });
    setCharges([{ subCategory: '', mainCategory: '', accountCode: '', amount: '' }]);
    setShowEntryForm(false);
  };

  const confirmDeleteGroup = (group: GroupedCollection) => {
    setGroupToDelete(group);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!groupToDelete) return;
    setLoading(true);
    try {
      const success = await deleteCollectionGroup(groupToDelete.itemIds, groupToDelete.afNo, groupToDelete.orNo);
      if (success) {
        const deletedIdSet = new Set(groupToDelete.itemIds);
        setItems(items.filter(i => !deletedIdSet.has(i.id)));
        setNotification({
          open: true,
          message: `OR #${groupToDelete.orNo} with ${groupToDelete.items.length} charge line(s) deleted successfully`,
          severity: 'success'
        });
      } else {
        setNotification({
          open: true,
          message: 'Failed to delete entries',
          severity: 'error'
        });
      }
    } catch (error) {
      console.error(error);
      setNotification({
        open: true,
        message: 'An error occurred during delete',
        severity: 'error'
      });
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
      setGroupToDelete(null);
    }
  };

  const addItem = async () => {
    const header = form;

    if (!header.afNo || !header.orNo || !header.payor) {
      setNotification({
        open: true,
        message: 'Please fill in AF Number, OR Number, and Payor Name.',
        severity: 'warning'
      });
      return;
    }

    const preparedCharges = charges
      .map(c => ({
        subCategory: c.subCategory?.trim() || '',
        mainCategory: c.mainCategory?.trim() || '',
        accountCode: c.accountCode?.trim() || '',
        amount: isNaN(Number(c.amount)) ? 0 : Number(c.amount)
      }))
      .filter((c, _idx, arr) => {
        // If only one charge row exists, keep it to allow 0 amount / cancelled OR
        if (arr.length === 1) return true;
        // If multiple rows exist, keep rows that have subCategory or amount > 0
        return c.subCategory !== '' || c.amount > 0;
      });

    if (preparedCharges.length === 0) {
      setNotification({
        open: true,
        message: 'Please enter at least one charge line.',
        severity: 'warning'
      });
      return;
    }

    const hasNegativeAmount = preparedCharges.some(c => c.amount < 0);
    if (hasNegativeAmount) {
      setNotification({
        open: true,
        message: 'Charge amount cannot be negative.',
        severity: 'warning'
      });
      return;
    }

    // Editing an existing Grouped OR
    if (editingGroupIds && editingGroupIds.length > 0) {
      setLoading(true);
      try {
        const success = await updateCollectionGroup(editingGroupIds, header, preparedCharges);
        if (success) {
          await loadData();
          handleCancelEdit();
          setNotification({
            open: true,
            message: `OR #${header.orNo} updated successfully!`,
            severity: 'success'
          });
        } else {
          setNotification({
            open: true,
            message: 'Failed to update entries. Please try again.',
            severity: 'error'
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const nextIdStart = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
      const newRows = preparedCharges.map((c, idx) => ({
        id: nextIdStart + idx,
        afNo: header.afNo,
        orNo: header.orNo,
        payor: header.payor,
        subCategory: c.subCategory,
        mainCategory: c.mainCategory,
        accountCode: c.accountCode,
        amount: c.amount,
        date: header.date,
        remarks: header.remarks
      }));

      const success = await saveCollectionEntryBulk(header, preparedCharges);
      
      if (!success) {
        setNotification({
          open: true,
          message: 'Failed to save entry. Please try again.',
          severity: 'error'
        });
        return;
      }

      setItems([...newRows.reverse(), ...items]);
      const nextOrNo = getNextOrNo(header.orNo);

      setForm({
        afNo: header.afNo,
        orNo: nextOrNo,
        payor: '',
        date: header.date,
        remarks: ''
      });
      setCharges([{ subCategory: '', mainCategory: '', accountCode: '', amount: '' }]);
      
      setNotification({
        open: true,
        message: 'Entry saved successfully!',
        severity: 'success'
      });

      setTimeout(() => {
        if (payorRef.current) {
          payorRef.current.focus();
        }
      }, 100);
    } catch (error) {
      console.error("Error saving entry:", error);
      setNotification({
        open: true,
        message: 'An unexpected error occurred while saving.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem();
    }
  };

  const totalAmount = filteredItems.reduce((sum, i) => sum + (i.amount || 0), 0);
  const currentEntryTotal = charges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const importTotalSum = importedRows.reduce((sum, r) => sum + (r.amount || 0), 0);

  const clearFilters = () => {
    setSearchTerm('');
    setFilterAfNo(null);
    setFilterSubCategory(null);
    setFilterDate('');
  };

  return (
    <Box sx={{ width: '100%', pb: 4 }}>
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 2 }}
        open={loading}
      >
        <CircularProgress color="inherit" />
      </Backdrop>

      <Notification
        open={notification.open}
        onClose={handleCloseNotification}
        message={notification.message}
        severity={notification.severity}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete OR Group"
        message={groupToDelete ? `Are you sure you want to delete OR #${groupToDelete.orNo} with all ${groupToDelete.items.length} line charge(s)? This action cannot be undone.` : "Are you sure you want to delete this entry?"}
        confirmText="Delete All"
        severity="error"
      />

      {/* Hidden File Input for Excel Import */}
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
            <Typography variant="h4" component="h2" fontWeight="800" sx={{ color: '#0f172a' }}>
              Collections
            </Typography>
            <Chip 
              label="Accountable Form 51" 
              size="small" 
              sx={{ fontWeight: 700, bgcolor: '#e0f2fe', color: '#0284c7', border: '1px solid rgba(14, 165, 233, 0.3)' }} 
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {isAdmin 
              ? "Auditing and monitoring consolidated collection line items encoded across all revenue collectors." 
              : "Manage your daily revenue collection line items or import from Excel."}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Tooltip title="Refresh Collections" arrow>
            <IconButton 
              color="primary"
              onClick={loadData}
              sx={{ bgcolor: '#f0f9ff', p: 1.4, border: '1px solid rgba(14, 165, 233, 0.2)', color: '#0284c7' }}
            >
              <Refresh />
            </IconButton>
          </Tooltip>

          {!isAdmin && (
            <>
              {/* Download Excel Template */}
              <Tooltip title="Download Excel Format Template" arrow>
                <IconButton 
                  color="secondary"
                  onClick={handleDownloadTemplate}
                  sx={{ bgcolor: '#f0f9ff', p: 1.4, border: '1px solid rgba(14, 165, 233, 0.2)' }}
                >
                  <FileDownload />
                </IconButton>
              </Tooltip>

              {/* Upload Excel Button */}
              <Tooltip title="Import Collections from Excel / CSV" arrow>
                <IconButton 
                  color="primary"
                  onClick={() => fileInputRef.current?.click()}
                  sx={{ bgcolor: '#f0f9ff', p: 1.4, border: '1px solid rgba(14, 165, 233, 0.2)' }}
                >
                  <UploadFile />
                </IconButton>
              </Tooltip>

              {/* New Entry Button */}
              {!showEntryForm && (
                <Tooltip title="Create New Collection Entry" arrow>
                  <IconButton 
                    color="primary"
                    onClick={() => setShowEntryForm(true)}
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
            </>
          )}
        </Box>
      </Box>

      {/* Admin Executive Audit Notice Banner */}
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
              Consolidated Monitoring View (Read Only)
            </Typography>
            <Typography variant="body2" sx={{ color: '#475569', fontSize: '0.84rem' }}>
              As an Administrator, you have full audit access across all revenue collections. Direct editing or deletion is restricted to the respective collector/user who encoded the records to maintain official accountability.
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Parsing Backdrop with Animated Linear Progress */}
      {isParsing && (
        <Paper 
          elevation={0} 
          sx={{ 
            p: 2.5, 
            mb: 3, 
            borderRadius: 1.5, 
            border: '1px solid #e2e8f0', 
            bgcolor: '#f0f9ff' 
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="subtitle2" fontWeight="800" sx={{ color: '#0369a1' }}>
              {parseStatusText}
            </Typography>
            <Typography variant="caption" fontWeight="700" sx={{ color: '#0284c7' }}>
              {parseProgress}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={parseProgress} 
            sx={{ 
              height: 6, 
              borderRadius: 1, 
              bgcolor: '#e0f2fe',
              '& .MuiLinearProgress-bar': { bgcolor: '#0284c7', borderRadius: 1 } 
            }} 
          />
        </Paper>
      )}

      {/* Entry Form Card */}
      {showEntryForm && (
      <Card elevation={0} sx={{ mb: 3, borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
        <CardHeader 
          title={editingGroupIds ? `Edit Collection OR #${form.orNo}` : "New Collection Entry"}
          subheader={editingGroupIds ? "Update details and charges for this receipt." : "Fill in the details below to record a new transaction."}
          titleTypographyProps={{ variant: 'h6', fontWeight: '800', color: '#0f172a' }}
          action={
            <Tooltip title="Close Form" arrow>
              <IconButton 
                onClick={editingGroupIds ? handleCancelEdit : () => setShowEntryForm(false)}
                sx={{ bgcolor: '#f1f5f9', color: '#64748b', borderRadius: 1 }}
              >
                <Clear />
              </IconButton>
            </Tooltip>
          }
          sx={{ bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', p: 2.5 }}
        />
        <CardContent sx={{ p: 3 }}>
          <Grid container spacing={4}>
            {/* Left Column: Transaction Details */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="subtitle2" color="primary" sx={{ mb: 2, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>
                Transaction Details
              </Typography>
              
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    label="AF Number"
                    fullWidth
                    size="small"
                    value={form.afNo}
                    onChange={(e) => setForm({ ...form, afNo: e.target.value })}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <ReceiptLong fontSize="small" color="action" />
                          </InputAdornment>
                        ),
                      }
                    }}
                  />
                  <TextField
                    label="OR Number"
                    fullWidth
                    size="small"
                    value={form.orNo}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.length <= 8) {
                        setForm({ ...form, orNo: val });
                      }
                    }}
                    onBlur={() => {
                      if (form.orNo && /^\d+$/.test(form.orNo)) {
                        setForm({ ...form, orNo: form.orNo.padStart(8, '0') });
                      }
                    }}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <Typography variant="caption" color="text.secondary">#</Typography>
                          </InputAdornment>
                        ),
                      }
                    }}
                  />
                </Box>

                <Autocomplete
                  freeSolo
                  options={uniquePayors}
                  value={form.payor}
                  onChange={(_, newValue) => {
                    setForm({ ...form, payor: newValue || '' });
                  }}
                  onInputChange={(_, newInputValue) => {
                    setForm({ ...form, payor: newInputValue });
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Payor Name"
                      fullWidth
                      size="small"
                      name="payor-input"
                      inputRef={(node) => {
                        if (payorRef) {
                          (payorRef as React.MutableRefObject<any>).current = node;
                        }
                        const { ref } = params.InputProps as any || {};
                        if (ref) {
                          if (typeof ref === 'function') ref(node);
                          else ref.current = node;
                        }
                      }}
                      slotProps={{
                        input: {
                          ...params.InputProps,
                          startAdornment: (
                            <>
                              <InputAdornment position="start">
                                <PersonOutline fontSize="small" color="action" />
                              </InputAdornment>
                              {params.InputProps.startAdornment}
                            </>
                          ),
                        }
                      }}
                    />
                  )}
                />

                <TextField
                  type="date"
                  label="Transaction Date"
                  fullWidth
                  size="small"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ tabIndex: -1 }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Event fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                    }
                  }}
                />

                <TextField
                  label="Remarks"
                  fullWidth
                  multiline
                  rows={3}
                  size="small"
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  inputProps={{ tabIndex: -1 }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Notes fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                    }
                  }}
                />
                
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1.5 }}>
                  <Typography variant="body2" fontWeight="700" color="text.secondary">
                    {editingGroupIds ? 'Update All Charges' : 'Save Entry'}
                  </Typography>
                  <Tooltip title={editingGroupIds ? "Update All Charges" : "Save Entry"} arrow>
                    <IconButton 
                      color="primary"
                      onClick={addItem}
                      disabled={loading}
                      sx={{ 
                        width: 44, 
                        height: 44, 
                        bgcolor: '#0284c7', 
                        color: '#ffffff', 
                        borderRadius: 1,
                        '&:hover': { bgcolor: '#0369a1', color: '#ffffff' } 
                      }}
                    >
                      {loading ? <CircularProgress size={22} color="inherit" /> : (editingGroupIds ? <Edit /> : <Save />)}
                    </IconButton>
                  </Tooltip>
                </Box>
              </Stack>
            </Grid>

            {/* Right Column: Charges */}
            <Grid size={{ xs: 12, md: 8 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2" color="primary" sx={{ fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Charges Line Items
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight="600">
                    {charges.length} item{charges.length !== 1 ? 's' : ''}
                  </Typography>
                  <Typography variant="subtitle2" fontWeight="800" sx={{ color: '#0284c7' }}>
                    Total: ₱ {currentEntryTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </Typography>
                </Box>
              </Box>

              <Stack spacing={1.5}>
                {charges.map((c, idx) => {
                  const subVal = c.subCategory;
                  const codesForSub = accountCodeOptionsBySub.get(subVal) || [];
                  return (
                    <Paper 
                      key={idx} 
                      variant="outlined" 
                      sx={{ 
                        p: 1.5, 
                        bgcolor: '#f8fafc',
                        borderRadius: 1,
                        borderColor: '#e2e8f0',
                        position: 'relative',
                        transition: 'background-color 0.2s',
                        '&:hover': { bgcolor: '#f0f9ff' }
                      }}
                    >
                      <Grid container spacing={1} alignItems="center">
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <Autocomplete
                            freeSolo
                            options={subCategories}
                            value={c.subCategory}
                            onChange={(_, v) => {
                              const newVal = v || '';
                              const match = accountCodes.find(ac => ac.subCategory === newVal);
                              const next = [...charges];
                              next[idx] = {
                                subCategory: newVal,
                                mainCategory: match ? match.mainCategory : '',
                                accountCode: match ? match.code : '',
                                amount: c.amount
                              };
                              setCharges(next);
                            }}
                            onInputChange={(_, v) => {
                              const newVal = v;
                              const match = accountCodes.find(ac => ac.subCategory === newVal);
                              const next = [...charges];
                              next[idx] = {
                                subCategory: newVal,
                                mainCategory: match ? match.mainCategory : '',
                                accountCode: match ? match.code : '',
                                amount: c.amount
                              };
                              setCharges(next);
                            }}
                            renderInput={(params) => (
                              <TextField 
                                {...params} 
                                label="Sub Category" 
                                variant="outlined" 
                                size="small" 
                                fullWidth 
                                inputRef={(el) => (subCategoryRefs.current[idx] = el)}
                              />
                            )}
                          />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                          <Autocomplete
                            freeSolo
                            disabled
                            options={mainCategories}
                            value={c.mainCategory}
                            renderInput={(params) => (
                              <TextField 
                                {...params} 
                                label="Main Category" 
                                variant="outlined" 
                                size="small" 
                                fullWidth 
                              />
                            )}
                          />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 2 }}>
                          <Autocomplete
                            freeSolo
                            disabled
                            options={codesForSub}
                            value={c.accountCode}
                            renderInput={(params) => (
                              <TextField 
                                {...params} 
                                label="Code" 
                                variant="outlined" 
                                size="small" 
                                fullWidth 
                              />
                            )}
                          />
                        </Grid>
                        <Grid size={{ xs: 10, sm: 2 }}>
                          <TextField
                            label="Amount"
                            type="text"
                            fullWidth
                            size="small"
                            value={c.amount}
                            onChange={(e) => {
                              const next = [...charges];
                              next[idx] = { ...next[idx], amount: e.target.value };
                              setCharges(next);
                            }}
                            onBlur={() => {
                              const val = c.amount;
                              if (val && val.trim().startsWith('=')) {
                                try {
                                  const expression = val.trim().substring(1).replace(/\s+/g, '');
                                  const parts = expression.split(/([+\-])/);
                                  let sum = parseFloat(parts[0]) || 0;
                                  for (let i = 1; i < parts.length; i += 2) {
                                    const operator = parts[i];
                                    const operand = parseFloat(parts[i+1]) || 0;
                                    if (operator === '+') sum += operand;
                                    if (operator === '-') sum -= operand;
                                  }
                                  const next = [...charges];
                                  next[idx] = { ...next[idx], amount: String(sum) };
                                  setCharges(next);
                                } catch (e) {
                                  console.error(e);
                                }
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = c.amount;
                                if (val && val.trim().startsWith('=')) {
                                  e.preventDefault();
                                  try {
                                    const expression = val.trim().substring(1).replace(/\s+/g, '');
                                    const parts = expression.split(/([+\-])/);
                                    let sum = parseFloat(parts[0]) || 0;
                                    for (let i = 1; i < parts.length; i += 2) {
                                      const operator = parts[i];
                                      const operand = parseFloat(parts[i+1]) || 0;
                                      if (operator === '+') sum += operand;
                                      if (operator === '-') sum -= operand;
                                    }
                                    const next = [...charges];
                                    next[idx] = { ...next[idx], amount: String(sum) };
                                    setCharges(next);
                                  } catch (e) {
                                    console.error(e);
                                  }
                                } else {
                                  handleKeyDown(e);
                                }
                              }
                            }}
                            slotProps={{
                              input: {
                                startAdornment: (
                                  <InputAdornment position="start">
                                    <AttachMoney fontSize="small" />
                                  </InputAdornment>
                                ),
                              }
                            }}
                          />
                        </Grid>
                        <Grid size={{ xs: 2, sm: 1 }} sx={{ display: 'flex', justifyContent: 'center' }}>
                          <Tooltip title="Remove Charge">
                            <IconButton 
                              color="error" 
                              size="small"
                              tabIndex={-1}
                              onClick={() => {
                                const next = charges.filter((_, i) => i !== idx);
                                setCharges(next.length > 0 ? next : [{ subCategory: '', mainCategory: '', accountCode: '', amount: '' }]);
                              }}
                            >
                              <DeleteOutline fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Grid>
                      </Grid>
                    </Paper>
                  );
                })}
                
                <Tooltip title="Add Another Charge Line" arrow>
                  <IconButton
                    color="primary"
                    onClick={() => {
                      const newIdx = charges.length;
                      setCharges([...charges, { subCategory: '', mainCategory: '', accountCode: '', amount: '' }]);
                      setTimeout(() => {
                        const el = subCategoryRefs.current[newIdx];
                        if (el) {
                          el.focus();
                        }
                      }, 100);
                    }}
                    sx={{ 
                      width: '100%', 
                      border: '1px dashed #38bdf8', 
                      borderRadius: 1, 
                      bgcolor: '#f0f9ff', 
                      color: '#0284c7', 
                      py: 0.8, 
                      mt: 1,
                      '&:hover': { bgcolor: '#e0f2fe' } 
                    }}
                  >
                    <AddCircleOutline />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      )}

      {/* Main Table Card (Grouped by OR No) */}
      <Paper elevation={0} sx={{ overflow: 'hidden', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
        <Box sx={{ p: 2, px: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#0369a1', flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0369a1' }}>Recent Entries</Typography>
              <Typography variant="caption" color="text.secondary">Combined by OR Number ({groupedCollections.length} total receipts)</Typography>
            </Box>
            <Tooltip title="Upload any local offline entries directly to Supabase cloud">
              <Button
                size="small"
                variant="outlined"
                startIcon={<CloudSync fontSize="small" />}
                onClick={async () => {
                  setLoading(true);
                  const syncedCount = await syncPendingLocalCollectionsToSupabase();
                  await loadData();
                  setLoading(false);
                  setNotification({
                    open: true,
                    message: syncedCount > 0 
                      ? `Successfully synced ${syncedCount} local entries to Supabase!` 
                      : 'All local entries are already synced to Supabase.',
                    severity: 'success'
                  });
                }}
                sx={{ 
                  ml: { xs: 0, sm: 1 }, 
                  textTransform: 'none', 
                  fontSize: '0.75rem', 
                  py: 0.25,
                  px: 1.25,
                  borderRadius: 1.5,
                  borderColor: '#0284c7',
                  color: '#0284c7',
                  '&:hover': { borderColor: '#0369a1', bgcolor: '#f0f9ff' }
                }}
              >
                Sync to Cloud
              </Button>
            </Tooltip>
          </Box>
          <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0284c7' }}>Total: ₱ {totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</Typography>
        </Box>
        
        <Box sx={{ p: 2, bgcolor: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField 
                label="Search" 
                placeholder="OR No, Payor, Remarks..."
                fullWidth 
                size="small"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                  }
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
              <Autocomplete
                options={uniqueAfNos}
                value={filterAfNo}
                onChange={(_, v) => setFilterAfNo(v)}
                renderInput={(params) => <TextField {...params} label="AF No." size="small" />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Autocomplete
                options={subCategories}
                value={filterSubCategory}
                onChange={(_, v) => setFilterSubCategory(v)}
                renderInput={(params) => <TextField {...params} label="Sub Category" size="small" />}
              />
            </Grid>
            <Grid size={{ xs: 10, md: 2.5 }}>
              <TextField
                type="month"
                label="Month/Year"
                fullWidth
                size="small"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 2, md: 1 }} sx={{ display: 'flex', justifyContent: 'center' }}>
              <Tooltip title="Clear Filters" arrow>
                <IconButton 
                  onClick={clearFilters}
                  sx={{ bgcolor: '#f1f5f9', color: '#64748b', p: 1, borderRadius: 1, '&:hover': { bgcolor: '#fee2e2', color: '#ef4444' } }}
                >
                  <Clear />
                </IconButton>
              </Tooltip>
            </Grid>
          </Grid>
        </Box>

        <TableContainer className="table-responsive">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 48 }} />
                <TableCell>AF No.</TableCell>
                <TableCell>OR No.</TableCell>
                <TableCell>Payor</TableCell>
                <TableCell>Line Items</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Remarks</TableCell>
                <TableCell align="right">Total Amount</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleGroups.map((group) => {
                const isExpanded = !!expandedRows[group.key];
                return (
                  <React.Fragment key={group.key}>
                    <TableRow hover sx={{ '& > *': { borderBottom: isExpanded ? 'unset' : undefined } }}>
                      <TableCell sx={{ width: 48 }}>
                        <Tooltip title={isExpanded ? "Hide Details" : "Show Details"} arrow>
                          <IconButton
                            size="small"
                            onClick={() => toggleRow(group.key)}
                            sx={{ color: '#0284c7', bgcolor: isExpanded ? '#e0f2fe' : '#f0f9ff' }}
                          >
                            {isExpanded ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{group.afNo || '-'}</TableCell>
                      <TableCell sx={{ color: '#0284c7', fontWeight: 800, letterSpacing: 0.5 }}>{group.orNo}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{group.payor || '-'}</TableCell>
                      <TableCell>
                        <Chip 
                          label={`${group.items.length} charge line${group.items.length > 1 ? 's' : ''}`}
                          size="small"
                          sx={{ fontWeight: 700, bgcolor: '#e0f2fe', color: '#0369a1', fontSize: '0.75rem', borderRadius: 1 }}
                        />
                      </TableCell>
                      <TableCell>{group.date || '-'}</TableCell>
                      <TableCell sx={{ color: '#64748b' }}>{group.remarks || '-'}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                        ₱ {group.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell align="right">
                        {!isAdmin ? (
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title={`Edit OR #${group.orNo} (${group.items.length} charges)`} arrow>
                              <IconButton size="small" color="primary" onClick={() => handleEditGroup(group)}>
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={`Delete OR #${group.orNo}`} arrow>
                              <IconButton size="small" color="error" onClick={() => confirmDeleteGroup(group)}>
                                <DeleteOutline fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        ) : (
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title={isExpanded ? "Collapse Details" : "View Breakdown"} arrow>
                              <IconButton size="small" color="primary" onClick={() => toggleRow(group.key)} sx={{ bgcolor: '#f0f9ff' }}>
                                <Visibility fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        )}
                      </TableCell>
                    </TableRow>
                    
                    {/* Collapsible Sub-Table for Charges Breakdown */}
                    <TableRow>
                      <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={9}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ margin: 1.5, p: 2, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                              <Typography variant="subtitle2" fontWeight="800" sx={{ color: '#0369a1' }}>
                                Charge Line Breakdown for OR #{group.orNo}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Payor: <strong>{group.payor}</strong> • Date: <strong>{group.date}</strong>
                              </Typography>
                            </Box>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#ffffff' }}>#</TableCell>
                                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#ffffff' }}>Sub Category</TableCell>
                                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#ffffff' }}>Main Category</TableCell>
                                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#ffffff' }}>Account Code</TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#ffffff' }}>Amount</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {group.items.map((item, idx) => (
                                  <TableRow key={item.id || idx} hover>
                                    <TableCell sx={{ color: '#64748b' }}>{idx + 1}</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>{item.subCategory || '-'}</TableCell>
                                    <TableCell>{item.mainCategory || '-'}</TableCell>
                                    <TableCell sx={{ fontFamily: 'monospace', bgcolor: '#f0f9ff', color: '#0369a1', px: 1, borderRadius: 1 }}>
                                      {item.accountCode || '-'}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                                      ₱ {(item.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              })}
              {groupedCollections.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <TableChart sx={{ color: '#94a3b8', fontSize: 40 }} />
                      <Typography color="text.secondary" variant="body1" fontWeight="600">
                        {loading ? 'Loading entries...' : 'No collection entries added yet.'}
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50]}
          component="div"
          count={groupedCollections.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Receipts per page:"
        />
      </Paper>

      {/* Excel Import Preview & Sheet Selector Dialog */}
      <Dialog 
        open={importPreviewOpen} 
        onClose={() => !isImporting && setImportPreviewOpen(false)} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{
          sx: { borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(14, 165, 233, 0.2)' }
        }}
      >
        <DialogTitle component="div" sx={{ bgcolor: '#f0f9ff', color: '#0369a1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2.5, borderBottom: '1px solid rgba(14, 165, 233, 0.12)', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography component="div" variant="h6" fontWeight="800" sx={{ color: '#0f172a' }}>
              Excel Import & Worksheet Selection
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Review and select which sheet to import into your collection records.
            </Typography>
          </Box>

          {/* Worksheet Selector */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {sheetNames.length > 0 && (
              <FormControl size="small" sx={{ minWidth: 200, bgcolor: '#ffffff', borderRadius: 2 }}>
                <InputLabel id="select-sheet-label">Selected Sheet</InputLabel>
                <Select
                  labelId="select-sheet-label"
                  value={selectedSheet}
                  label="Selected Sheet"
                  disabled={isImporting || isParsing}
                  onChange={(e) => handleSheetChange(e.target.value)}
                  sx={{ borderRadius: 2 }}
                >
                  {sheetNames.map((name) => (
                    <MenuItem key={name} value={name}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Layers fontSize="small" sx={{ color: '#0284c7' }} />
                        <Typography variant="body2" fontWeight="600">{name}</Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <Tooltip title="Close Preview" arrow>
              <IconButton disabled={isImporting} onClick={() => setImportPreviewOpen(false)} size="small" sx={{ bgcolor: '#ffffff' }}>
                <Clear />
              </IconButton>
            </Tooltip>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ p: 3, pt: 3 }}>
          {/* Animated Upload / Import Progress Bar */}
          {isImporting && (
            <Box sx={{ mb: 3, p: 2, bgcolor: '#f0fdf4', borderRadius: 3, border: '1px solid #bbf7d0' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" fontWeight="700" sx={{ color: '#166534', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CloudDone fontSize="small" /> {importStatusText}
                </Typography>
                <Typography variant="body2" fontWeight="800" sx={{ color: '#16a34a' }}>
                  {importProgress}%
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={importProgress} 
                sx={{ 
                  height: 8, 
                  borderRadius: 4, 
                  bgcolor: '#dcfce7',
                  '& .MuiLinearProgress-bar': { bgcolor: '#16a34a', borderRadius: 4 } 
                }} 
              />
            </Box>
          )}

          {/* Animated Sheet Switcher Progress Bar */}
          {isParsing && (
            <Box sx={{ mb: 3, p: 2, bgcolor: '#f0f9ff', borderRadius: 3, border: '1px solid #bae6fd' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" fontWeight="700" sx={{ color: '#0369a1' }}>
                  {parseStatusText}
                </Typography>
                <Typography variant="body2" fontWeight="800" sx={{ color: '#0284c7' }}>
                  {parseProgress}%
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={parseProgress} 
                sx={{ 
                  height: 6, 
                  borderRadius: 3, 
                  bgcolor: '#e0f2fe',
                  '& .MuiLinearProgress-bar': { bgcolor: '#0284c7', borderRadius: 3 } 
                }} 
              />
            </Box>
          )}

          {/* Summary Badges */}
          <Box sx={{ mb: 2.5, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip 
              icon={<Layers fontSize="small" />}
              label={`Sheet: ${selectedSheet}`} 
              size="small" 
              sx={{ fontWeight: 700, bgcolor: '#f0f9ff', color: '#0369a1', border: '1px solid rgba(14, 165, 233, 0.2)' }} 
            />
            <Chip 
              label={`Records: ${importedRows.length}`} 
              size="small" 
              sx={{ fontWeight: 700, bgcolor: '#e0f2fe', color: '#0284c7' }} 
            />
            <Chip 
              label={`Total Amount: ₱ ${importTotalSum.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`} 
              size="small" 
              sx={{ fontWeight: 800, bgcolor: '#f0fdf4', color: '#16a34a' }} 
            />
          </Box>

          <TableContainer sx={{ maxHeight: 380, borderRadius: 2, border: '1px solid rgba(14, 165, 233, 0.15)' }} className="table-responsive">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 'bold' }}>#</TableCell>
                  <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 'bold' }}>AF No.</TableCell>
                  <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 'bold' }}>OR No.</TableCell>
                  <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 'bold' }}>Payor</TableCell>
                  <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 'bold' }}>Sub Category</TableCell>
                  <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 'bold' }}>Main Category</TableCell>
                  <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 'bold' }}>Account Code</TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#f8fafc', fontWeight: 'bold' }}>Amount</TableCell>
                  <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 'bold' }}>Date</TableCell>
                  <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 'bold' }}>Remarks</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {importedRows.slice(0, 50).map((r, i) => (
                  <TableRow key={i} hover>
                    <TableCell sx={{ color: '#64748b' }}>{i + 1}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{r.afNo || '-'}</TableCell>
                    <TableCell sx={{ color: '#0284c7', fontWeight: 700 }}>{r.orNo || '-'}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{r.payor || '-'}</TableCell>
                    <TableCell>{r.subCategory || '-'}</TableCell>
                    <TableCell>{r.mainCategory || '-'}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', bgcolor: '#f0f9ff' }}>{r.accountCode || '-'}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>₱ {Number(r.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>{r.date || '-'}</TableCell>
                    <TableCell sx={{ color: '#64748b' }}>{r.remarks || '-'}</TableCell>
                  </TableRow>
                ))}
                {importedRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 5 }}>
                      <Typography color="text.secondary">No valid collection records detected in this sheet.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {importedRows.length > 50 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5, textAlign: 'center' }}>
              Showing first 50 rows of {importedRows.length} total records to be imported.
            </Typography>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2.5, bgcolor: '#f8fafc', borderTop: '1px solid rgba(14, 165, 233, 0.08)', gap: 1.5 }}>
          <Tooltip title="Cancel Import" arrow>
            <IconButton disabled={isImporting} onClick={() => setImportPreviewOpen(false)} sx={{ bgcolor: '#e2e8f0' }}>
              <Clear />
            </IconButton>
          </Tooltip>
          <Tooltip title={`Confirm & Import ${importedRows.length} Entries`} arrow>
            <IconButton 
              onClick={handleConfirmImport} 
              color="primary"
              disabled={isImporting || isParsing || importedRows.length === 0}
              sx={{ 
                bgcolor: '#0284c7', 
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
                '&:hover': { bgcolor: '#0369a1', color: '#ffffff' }
              }}
            >
              <Check />
            </IconButton>
          </Tooltip>
        </DialogActions>
      </Dialog>
    </Box>
  );
};