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
  CardHeader, 
  Stack, 
  TablePagination, 
  InputAdornment, 
  Autocomplete, 
  Tooltip,
  Chip,
  Collapse,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Avatar
} from '@mui/material';
import { 
  Edit, 
  DeleteOutline, 
  Refresh, 
  Search, 
  Clear, 
  Save, 
  HomeWork,
  KeyboardArrowDown,
  KeyboardArrowUp,
  TableChart,
  UploadFile,
  FileDownload,
  Check,
  Layers,
  AdminPanelSettings,
  Visibility,
  AddCircleOutline,
  CloudSync,
  Person,
  ReceiptLong,
  Event,
  Notes,
  PersonOutline,
  AttachMoney
} from '@mui/icons-material';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Notification } from '../components/Notification';
import { useAuth } from '../context/useAuth';
import { 
  getRPTCollections, 
  saveRPTCollectionBulk,
  updateRPTCollectionGroup,
  deleteRPTCollectionGroup, 
  importRPTCollectionsBatch,
  syncPendingLocalRPTCollectionsToSupabase,
  getAllManagedUsers
} from '../services/supabaseService';
import type { RPTCollectionItem } from '../types/rcd';

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

export interface GroupedRPTCollection {
  key: string;
  af56Id: string;
  orNumber: string;
  payor: string;
  barangay: string;
  landName: string;
  tdNumber: string;
  yearsPaid: string;
  date: string;
  remarks: string;
  totalAmount: number;
  items: RPTCollectionItem[];
  itemIds: number[];
}

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

const getNextOrNumber = (currentOrNo?: string): string => {
  if (!currentOrNo) return '';
  let nextOrNo = currentOrNo.trim();
  const matchNum = nextOrNo.match(/(\d+)$/);
  if (matchNum) {
    const numStr = matchNum[1];
    const nextNum = parseInt(numStr, 10) + 1;
    const targetLength = Math.max(numStr.length, 8);
    const nextNumStr = String(nextNum).padStart(targetLength, '0');
    nextOrNo = nextOrNo.substring(0, matchNum.index) + nextNumStr;
  } else if (nextOrNo && !isNaN(Number(nextOrNo))) {
    nextOrNo = String(Number(nextOrNo) + 1).padStart(8, '0');
  }
  return nextOrNo;
};

const getLatestRptRecord = (items: RPTCollectionItem[]): RPTCollectionItem | null => {
  if (!items || items.length === 0) return null;
  const sorted = [...items].sort((a, b) => {
    if (a.id && b.id && a.id !== b.id) return b.id - a.id;
    if (a.date && b.date && a.date !== b.date) return b.date.localeCompare(a.date);
    return (b.orNumber || '').localeCompare(a.orNumber || '', undefined, { numeric: true });
  });
  return sorted[0] || null;
};

export const RPTCollectionPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'administrator';

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [collections, setCollections] = useState<RPTCollectionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEntryForm, setShowEntryForm] = useState(false);

  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({ open: false, message: '', severity: 'info' });

  // User Map State (for resolving collector names)
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});

  // Pagination State
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Expand / Collapse State
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterAF56Id, setFilterAF56Id] = useState<string | null>(null);

  // Derived State for Filters
  const uniqueAF56Ids = Array.from(new Set(collections.map(c => c.af56Id).filter(Boolean))).sort();

  // Delete Dialog State for Group
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<GroupedRPTCollection | null>(null);

  // Details Dialog State
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<RPTCollectionItem | null>(null);

  // Workbook & Sheet Import State
  const [currentWorkbook, setCurrentWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importedRows, setImportedRows] = useState<Array<Omit<RPTCollectionItem, 'id'>>>([]);
  const [previewPage, setPreviewPage] = useState(0);
  const [previewRowsPerPage, setPreviewRowsPerPage] = useState(10);

  // Progress States
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [parseStatusText, setParseStatusText] = useState('');

  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatusText, setImportStatusText] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    af56Id: '',
    orNumber: '',
    payor: '',
    date: new Date().toISOString().split('T')[0],
    remarks: ''
  });

  // Charges Line Items State
  const [charges, setCharges] = useState<Array<{
    landName: string;
    barangay: string;
    tdNumber: string;
    yearsPaid: string;
    amount: number | string;
    parcel: string;
  }>>([
    { landName: '', barangay: '', tdNumber: '', yearsPaid: '', amount: '', parcel: '1/1' }
  ]);

  const [editingGroupIds, setEditingGroupIds] = useState<number[] | null>(null);
  const landNameRefs = useRef<(HTMLInputElement | null)[]>([]);
  const payorRef = useRef<HTMLInputElement | null>(null);
  const [saveAttempted, setSaveAttempted] = useState(false);

  const uniquePayors = useMemo(() => {
    return Array.from(new Set(collections.map(c => c.payor).filter(Boolean))).sort();
  }, [collections]);

  const currentEntryTotal = useMemo(() => {
    return charges.reduce((sum, c) => {
      const val = parseFloat(String(c.amount || '0')) || 0;
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [charges]);

  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

  const loadCollections = async () => {
    setLoading(true);
    try {
      const [data, managedUsers] = await Promise.all([
        getRPTCollections(),
        getAllManagedUsers().catch(() => [])
      ]);
      setCollections(data);

      if (managedUsers && managedUsers.length > 0) {
        const map: Record<string, string> = {};
        managedUsers.forEach(u => {
          const name = u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
          if (u.email) map[u.email.toLowerCase().trim()] = name;
          if (u.id) map[u.id.toLowerCase().trim()] = name;
        });
        setUsersMap(map);
      }

      if (data && data.length > 0) {
        const latestEntry = getLatestRptRecord(data);
        if (latestEntry) {
          const nextOr = getNextOrNumber(latestEntry.orNumber);
          setFormData(prev => ({
            ...prev,
            af56Id: latestEntry.af56Id || prev.af56Id,
            orNumber: prev.orNumber ? prev.orNumber : nextOr,
            date: latestEntry.date || prev.date
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load collections', error);
      setNotification({
        open: true,
        message: 'Failed to load RPT collections.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const getCollectorName = (email?: string, userId?: string): string => {
    if (email && usersMap[email.toLowerCase().trim()]) {
      return usersMap[email.toLowerCase().trim()];
    }
    if (userId && usersMap[userId.toLowerCase().trim()]) {
      return usersMap[userId.toLowerCase().trim()];
    }
    if (email) {
      const namePart = email.split('@')[0];
      return namePart.replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    return 'Municipal Collector';
  };

  useEffect(() => {
    loadCollections();
  }, []);

  const toggleRow = (key: string) => {
    setExpandedRows(prev => (prev[key] ? {} : { [key]: true }));
  };

  const handleOpen = () => {
    const latestEntry = getLatestRptRecord(collections);
    const latestAf56 = latestEntry?.af56Id || formData.af56Id || '';
    const nextOr = latestEntry ? getNextOrNumber(latestEntry.orNumber) : '';
    const prevDate = latestEntry?.date || new Date().toISOString().split('T')[0];

    setFormData({
      af56Id: latestAf56,
      orNumber: nextOr,
      payor: '',
      date: prevDate,
      remarks: ''
    });
    setCharges([
      { landName: '', barangay: '', tdNumber: '', yearsPaid: '', amount: '', parcel: '1/1' }
    ]);
    setEditingGroupIds(null);
    setSaveAttempted(false);
    setShowEntryForm(true);
    setTimeout(() => {
      payorRef.current?.focus();
    }, 150);
  };

  const handleEditGroup = (group: GroupedRPTCollection) => {
    setFormData({
      af56Id: group.af56Id || '',
      orNumber: group.orNumber || '',
      payor: group.payor || '',
      date: group.date || new Date().toISOString().split('T')[0],
      remarks: group.remarks || ''
    });

    const groupCharges = group.items.map(item => ({
      landName: item.landName || '',
      barangay: item.barangay || group.barangay || '',
      tdNumber: item.tdNumber || '',
      yearsPaid: item.yearsPaid || '',
      amount: item.amount !== undefined ? item.amount : '',
      parcel: item.parcel || '1/1'
    }));

    setCharges(
      groupCharges.length > 0
        ? groupCharges
        : [{ landName: '', barangay: '', tdNumber: '', yearsPaid: '', amount: '', parcel: '1/1' }]
    );
    setEditingGroupIds(group.itemIds);
    setSaveAttempted(false);
    setShowEntryForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    const latestEntry = getLatestRptRecord(collections);
    const latestAf56 = latestEntry?.af56Id || formData.af56Id || '';
    const nextOr = latestEntry ? getNextOrNumber(latestEntry.orNumber) : '';
    const prevDate = latestEntry?.date || new Date().toISOString().split('T')[0];

    setFormData({
      af56Id: latestAf56,
      orNumber: nextOr,
      payor: '',
      date: prevDate,
      remarks: ''
    });
    setCharges([
      { landName: '', barangay: '', tdNumber: '', yearsPaid: '', amount: '', parcel: '1/1' }
    ]);
    setShowEntryForm(false);
    setEditingGroupIds(null);
    setSaveAttempted(false);
  };

  const handleSave = async () => {
    setSaveAttempted(true);

    if (!formData.orNumber?.trim() || !formData.payor?.trim()) {
      setNotification({
        open: true,
        message: 'Please fill in Official Receipt No. and Payor Name.',
        severity: 'warning'
      });
      return;
    }

    if (charges.length === 0) {
      setNotification({
        open: true,
        message: 'Please enter at least one charge line.',
        severity: 'warning'
      });
      return;
    }

    // All fields in Charges Line Items are strictly required
    const hasMissingField = charges.some(c => 
      !c.landName?.trim() || 
      !c.barangay?.trim() || 
      !c.tdNumber?.trim() || 
      !c.yearsPaid?.trim() || 
      !c.parcel?.trim() || 
      c.amount === '' || 
      isNaN(Number(c.amount)) || 
      Number(c.amount) <= 0
    );

    if (hasMissingField) {
      setNotification({
        open: true,
        message: 'All fields in Charges Line Items are required (Land Name, Barangay, TD #, Years Paid, Parcel, and positive Amount).',
        severity: 'warning'
      });
      return;
    }

    const preparedCharges = charges.map(c => ({
      landName: c.landName.trim(),
      barangay: c.barangay.trim(),
      tdNumber: c.tdNumber.trim(),
      yearsPaid: c.yearsPaid.trim(),
      amount: Number(c.amount),
      parcel: c.parcel.trim() || '1/1'
    }));

    setLoading(true);
    try {
      if (editingGroupIds && editingGroupIds.length > 0) {
        const success = await updateRPTCollectionGroup(editingGroupIds, formData, preparedCharges);
        if (success) {
          await loadCollections();
          handleCancelEdit();
          setNotification({
            open: true,
            message: `OR #${formData.orNumber} updated successfully!`,
            severity: 'success'
          });
        } else {
          setNotification({
            open: true,
            message: 'Failed to update RPT entries.',
            severity: 'error'
          });
        }
      } else {
        const success = await saveRPTCollectionBulk(formData, preparedCharges);
        if (success) {
          await loadCollections();
          const nextOr = getNextOrNumber(formData.orNumber);
          setSaveAttempted(false);
          setFormData(prev => ({
            ...prev,
            orNumber: nextOr,
            payor: '',
            remarks: ''
          }));
          setCharges([
            { landName: '', barangay: '', tdNumber: '', yearsPaid: '', amount: '', parcel: '1/1' }
          ]);
          setNotification({
            open: true,
            message: `OR #${formData.orNumber} with ${preparedCharges.length} charge line(s) saved successfully.`,
            severity: 'success'
          });
          setTimeout(() => {
            payorRef.current?.focus();
          }, 100);
        } else {
          setNotification({
            open: true,
            message: 'Failed to save RPT entries.',
            severity: 'error'
          });
        }
      }
    } catch (error) {
      console.error('Failed to save collection', error);
      setNotification({
        open: true,
        message: 'Failed to save collection.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteGroup = (group: GroupedRPTCollection) => {
    setGroupToDelete(group);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (groupToDelete) {
      setLoading(true);
      try {
        await deleteRPTCollectionGroup(groupToDelete.itemIds, groupToDelete.af56Id, groupToDelete.orNumber);
        await loadCollections();
        setNotification({
          open: true,
          message: `Deleted OR #${groupToDelete.orNumber} successfully.`,
          severity: 'success'
        });
      } catch (error) {
        console.error('Failed to delete collection group', error);
        setNotification({
          open: true,
          message: 'Failed to delete collection group.',
          severity: 'error'
        });
      } finally {
        setLoading(false);
        setDeleteDialogOpen(false);
        setGroupToDelete(null);
      }
    }
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // =========================================================================
  // EXCEL PARSER & TEMPLATE DOWNLOADER
  // =========================================================================
  const parseRptSheetData = (worksheet: XLSX.WorkSheet): Array<Omit<RPTCollectionItem, 'id'>> => {
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
          str.includes('af56') || 
          str.includes('af') || 
          str.includes('or') || 
          str.includes('payor') || 
          str.includes('payer') || 
          str.includes('barangay') || 
          str.includes('brgy') || 
          str.includes('land') || 
          str.includes('td') || 
          str.includes('year') || 
          str.includes('amount') || 
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
      af56Id?: number;
      orNumber?: number;
      payor?: number;
      barangay?: number;
      landName?: number;
      tdNumber?: number;
      yearsPaid?: number;
      amount?: number;
      parcel?: number;
      date?: number;
      remarks?: number;
    } = {};

    let startDataRow = 0;

    if (headerRowIdx !== -1) {
      const headerRow = rawMatrix[headerRowIdx];
      headerRow.forEach((cell, idx) => {
        const n = normCell(cell);
        if (!n) return;
        if (colMap.af56Id === undefined && (n.includes('af56') || n === 'af' || n === 'af56id' || n === 'batch' || n.includes('form56'))) {
          colMap.af56Id = idx;
        } else if (colMap.orNumber === undefined && (n.includes('ornum') || n === 'orno' || n === 'or' || n.includes('receipt') || n.includes('serial'))) {
          colMap.orNumber = idx;
        } else if (colMap.payor === undefined && (n.includes('payor') || n.includes('payer') || n.includes('taxpayer') || n === 'name' || n === 'customer')) {
          colMap.payor = idx;
        } else if (colMap.barangay === undefined && (n.includes('barangay') || n.includes('brgy') || n === 'location')) {
          colMap.barangay = idx;
        } else if (colMap.landName === undefined && (n.includes('land') || n.includes('property') || n.includes('declaredowner') || n.includes('owner'))) {
          colMap.landName = idx;
        } else if (colMap.tdNumber === undefined && (n.includes('tdnum') || n === 'tdno' || n.includes('taxdec') || n === 'td' || n.includes('taxdeclaration'))) {
          colMap.tdNumber = idx;
        } else if (colMap.yearsPaid === undefined && (n.includes('year') || n.includes('period') || n.includes('yearspaid') || n.includes('taxyear'))) {
          colMap.yearsPaid = idx;
        } else if (colMap.amount === undefined && (n.includes('amount') || n.includes('amt') || n === 'total' || n.includes('value') || n.includes('collected') || n.includes('taxpaid'))) {
          colMap.amount = idx;
        } else if (colMap.parcel === undefined && (n.includes('parcel') || n.includes('fraction') || n.includes('portion') || n.includes('lot'))) {
          colMap.parcel = idx;
        } else if (colMap.date === undefined && (n.includes('date') || n.includes('txdate') || n.includes('paymentdate'))) {
          colMap.date = idx;
        } else if (colMap.remarks === undefined && (n.includes('remark') || n.includes('note') || n.includes('memo') || n.includes('desc'))) {
          colMap.remarks = idx;
        }
      });
      startDataRow = headerRowIdx + 1;
    } else {
      // Default Fallback
      colMap.af56Id = 0;
      colMap.orNumber = 1;
      colMap.payor = 2;
      colMap.barangay = 3;
      colMap.landName = 4;
      colMap.tdNumber = 5;
      colMap.yearsPaid = 6;
      colMap.parcel = 7;
      colMap.amount = 8;
      colMap.date = 9;
      colMap.remarks = 10;
      startDataRow = 0;
    }

    const results: Array<Omit<RPTCollectionItem, 'id'>> = [];

    for (let r = startDataRow; r < rawMatrix.length; r++) {
      const row = rawMatrix[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      const rawAf56 = colMap.af56Id !== undefined ? String(row[colMap.af56Id] || '').trim() : '';
      const rawOr = colMap.orNumber !== undefined ? String(row[colMap.orNumber] || '').trim() : '';
      const rawPayor = colMap.payor !== undefined ? String(row[colMap.payor] || '').trim() : '';
      const rawBrgy = colMap.barangay !== undefined ? String(row[colMap.barangay] || '').trim() : '';
      const rawLand = colMap.landName !== undefined ? String(row[colMap.landName] || '').trim() : '';
      const rawTd = colMap.tdNumber !== undefined ? String(row[colMap.tdNumber] || '').trim() : '';
      const rawYears = colMap.yearsPaid !== undefined ? String(row[colMap.yearsPaid] || '').trim() : '';
      const rawAmount = colMap.amount !== undefined ? row[colMap.amount] : 0;
      const rawParcel = colMap.parcel !== undefined ? String(row[colMap.parcel] || '').trim() : '';
      const rawDate = colMap.date !== undefined ? row[colMap.date] : '';
      const rawRemarks = colMap.remarks !== undefined ? String(row[colMap.remarks] || '').trim() : '';

      // Skip empty rows
      if (!rawOr && !rawPayor && !rawAmount && !rawTd) continue;

      // Clean numeric amount
      const cleanAmtStr = String(rawAmount || '').replace(/[₱,$\s]/g, '');
      const parsedAmount = parseFloat(cleanAmtStr) || 0;

      const cleanDate = formatExcelDate(rawDate);

      results.push({
        af56Id: rawAf56 || 'AF56',
        orNumber: rawOr || 'OR-PENDING',
        payor: rawPayor || 'UNKNOWN',
        barangay: rawBrgy,
        landName: rawLand,
        tdNumber: rawTd,
        yearsPaid: rawYears || new Date().getFullYear().toString(),
        amount: parsedAmount,
        parcel: rawParcel,
        date: cleanDate,
        remarks: rawRemarks
      });
    }

    return results;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setParseProgress(20);
    setParseStatusText('Reading Excel file...');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        setParseProgress(50);
        setParseStatusText('Analyzing sheets and columns...');

        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetList = workbook.SheetNames;
        setCurrentWorkbook(workbook);
        setSheetNames(sheetList);
        setSelectedSheet(sheetList[0]);

        const firstSheet = workbook.Sheets[sheetList[0]];
        const parsedRows = parseRptSheetData(firstSheet);
        setImportedRows(parsedRows);
        setPreviewPage(0);

        setParseProgress(100);
        setParseStatusText('Done parsing!');
        setTimeout(() => {
          setIsParsing(false);
          setImportPreviewOpen(true);
        }, 300);
      } catch (err) {
        console.error('Error reading workbook', err);
        setIsParsing(false);
        setNotification({
          open: true,
          message: 'Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.',
          severity: 'error'
        });
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSheetChange = (sheetName: string) => {
    if (!currentWorkbook) return;
    setSelectedSheet(sheetName);
    const worksheet = currentWorkbook.Sheets[sheetName];
    const parsedRows = parseRptSheetData(worksheet);
    setImportedRows(parsedRows);
    setPreviewPage(0);
  };

  const handleConfirmImport = async () => {
    if (importedRows.length === 0) return;
    setIsImporting(true);
    setImportProgress(25);
    setImportStatusText('Saving records to database...');

    try {
      const result = await importRPTCollectionsBatch(importedRows);

      setImportProgress(80);
      setImportStatusText('Finalizing import...');

      await loadCollections();

      setImportProgress(100);
      setTimeout(() => {
        setIsImporting(false);
        setImportPreviewOpen(false);
        setImportedRows([]);
        const totalImportedAmt = importedRows.reduce((s, r) => s + (r.amount || 0), 0);
        setNotification({
          open: true,
          message: `Successfully imported ${result.count} RPT collection records totaling ₱${totalImportedAmt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}!`,
          severity: 'success'
        });
      }, 400);
    } catch (err) {
      console.error('Failed to import rows', err);
      setIsImporting(false);
      setNotification({
        open: true,
        message: 'Failed to import records to database.',
        severity: 'error'
      });
    }
  };

  const downloadRptExcelTemplate = () => {
    const templateData = [
      {
        'AF56 ID': 'AF56-2024-001',
        'OR Number': '84729101',
        'Payor': 'JUAN DELA CRUZ',
        'Barangay': 'POBLACION',
        'Land Name': 'LOT 123-A RESIDENTIAL',
        'TD Number': 'TD-04-001-00234',
        'Years Paid': '2024',
        'Parcel (Fraction)': '1/2',
        'Amount': 1500.00,
        'Date': new Date().toISOString().split('T')[0],
        'Remarks': 'Full Payment (50% Basic / 50% SEF)'
      },
      {
        'AF56 ID': 'AF56-2024-001',
        'OR Number': '84729102',
        'Payor': 'MARIA SANTOS',
        'Barangay': 'SAN ROQUE',
        'Land Name': 'COMMERCIAL BLDG 2',
        'TD Number': 'TD-04-002-00567',
        'Years Paid': '2023-2024',
        'Parcel (Fraction)': 'Whole',
        'Amount': 3200.50,
        'Date': new Date().toISOString().split('T')[0],
        'Remarks': 'With 10% Early Discount'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'RPT Collections');

    // Auto column widths
    worksheet['!cols'] = [
      { wch: 15 }, // AF56 ID
      { wch: 14 }, // OR Number
      { wch: 25 }, // Payor
      { wch: 18 }, // Barangay
      { wch: 25 }, // Land Name
      { wch: 20 }, // TD Number
      { wch: 14 }, // Years Paid
      { wch: 18 }, // Parcel (Fraction)
      { wch: 14 }, // Amount
      { wch: 14 }, // Date
      { wch: 35 }  // Remarks
    ];

    XLSX.writeFile(workbook, 'RPT_AF56_Collection_Template.xlsx');
  };

  // =========================================================================
  // FILTER & GROUPING LOGIC
  // =========================================================================
  const filteredCollections = useMemo(() => {
    return collections.filter(item => {
      const matchesSearch = 
        (item.payor?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (item.orNumber?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (item.barangay?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (item.landName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (item.tdNumber?.toLowerCase() || '').includes(searchTerm.toLowerCase());

      const matchesDate = !filterDate || (item.date && item.date.startsWith(filterDate));
      const matchesAF56 = !filterAF56Id || item.af56Id === filterAF56Id;

      return matchesSearch && matchesDate && matchesAF56;
    });
  }, [collections, searchTerm, filterDate, filterAF56Id]);

  // Group RPT entries by OR Number (and AF56 Id) and sort by Date & OR No
  const groupedRPTCollections: GroupedRPTCollection[] = useMemo(() => {
    const groups: { [key: string]: GroupedRPTCollection } = {};

    filteredCollections.forEach(item => {
      const key = `${item.af56Id || 'AF56'}__${item.orNumber || ''}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          af56Id: item.af56Id || '',
          orNumber: item.orNumber || '',
          payor: item.payor || '',
          barangay: item.barangay || '',
          landName: item.landName || '',
          tdNumber: item.tdNumber || '',
          yearsPaid: item.yearsPaid || '',
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
      const orA = a.orNumber || '';
      const orB = b.orNumber || '';
      const numA = parseInt(orA, 10);
      const numB = parseInt(orB, 10);
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
        return numB - numA;
      }
      return orB.localeCompare(orA);
    });
  }, [filteredCollections]);

  const visibleGroups = useMemo(() => {
    return groupedRPTCollections.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );
  }, [groupedRPTCollections, page, rowsPerPage]);

  const totalAmount = filteredCollections.reduce((sum, item) => sum + (item.amount || 0), 0);

  const clearFilters = () => {
    setSearchTerm('');
    setFilterDate('');
    setFilterAF56Id(null);
  };

  return (
    <Box sx={{ pb: 6 }}>
      {/* Hidden File Input for Excel Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".xlsx, .xls, .csv"
        style={{ display: 'none' }}
      />

      <Notification
        open={notification.open}
        message={notification.message}
        severity={notification.severity}
        onClose={handleCloseNotification}
      />

      <Backdrop open={loading || isParsing} sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1, flexDirection: 'column', gap: 2 }}>
        <CircularProgress color="inherit" />
        {isParsing && (
          <Box sx={{ width: '300px', textAlign: 'center' }}>
            <Typography variant="body2" sx={{ mb: 1, color: '#fff', fontWeight: 600 }}>{parseStatusText}</Typography>
            <LinearProgress variant="determinate" value={parseProgress} sx={{ height: 6, borderRadius: 1 }} />
          </Box>
        )}
      </Backdrop>

      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete RPT Collection"
        message={groupToDelete ? `Are you sure you want to delete OR #${groupToDelete.orNumber} with all ${groupToDelete.items.length} item(s)? This action cannot be undone.` : "Are you sure you want to delete this collection entry?"}
        confirmText="Delete All"
        severity="error"
      />

      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h4" component="h1" fontWeight="800" sx={{ color: '#0f172a' }}>
              RPT Collection
            </Typography>
            <Chip 
              label="Accountable Form 56" 
              size="small" 
              sx={{ fontWeight: 700, bgcolor: '#e0f2fe', color: '#0284c7', border: '1px solid rgba(14, 165, 233, 0.3)', borderRadius: 1 }} 
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {isAdmin
              ? "Auditing and monitoring consolidated Real Property Tax (AF 56) receipts across all revenue collectors."
              : "Manage and track Real Property Tax (AF 56) receipts, land payments & bulk Excel imports."}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Tooltip title="Refresh Data" arrow>
            <IconButton 
              color="primary" 
              onClick={loadCollections} 
              sx={{ bgcolor: '#f0f9ff', p: 1.4, border: '1px solid rgba(14, 165, 233, 0.2)', color: '#0284c7' }}
            >
              <Refresh />
            </IconButton>
          </Tooltip>

          {!isAdmin && (
            <>
              {/* Download Template Button */}
              <Tooltip title="Download Excel Template" arrow>
                <IconButton
                  color="secondary"
                  onClick={downloadRptExcelTemplate}
                  sx={{ bgcolor: '#f0f9ff', p: 1.4, border: '1px solid rgba(14, 165, 233, 0.2)' }}
                >
                  <FileDownload />
                </IconButton>
              </Tooltip>

              {/* Upload Excel Button */}
              <Tooltip title="Import RPT Collections from Excel (.xlsx, .xls)" arrow>
                <IconButton
                  color="primary"
                  onClick={() => fileInputRef.current?.click()}
                  sx={{ bgcolor: '#f0f9ff', p: 1.4, border: '1px solid rgba(14, 165, 233, 0.2)' }}
                >
                  <UploadFile />
                </IconButton>
              </Tooltip>

              {!showEntryForm && (
                <Tooltip title="New RPT Entry" arrow>
                  <IconButton
                    color="primary"
                    onClick={handleOpen}
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
              As an Administrator, you have full audit access across all Real Property Tax (AF 56) collections. Direct editing or deletion is restricted to the respective collector/user who encoded the records to maintain official accountability.
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Form Card */}
      {showEntryForm && (
        <Card elevation={0} sx={{ mb: 3, borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
          <CardHeader
            title={editingGroupIds ? `Edit RPT Collection OR #${formData.orNumber}` : "New RPT Collection Entry"}
            subheader={editingGroupIds ? "Update details and charge line items for this receipt." : "Enter the Real Property Tax (AF 56) payment details below."}
            titleTypographyProps={{ variant: 'h6', fontWeight: '800', color: '#0f172a' }}
            action={
              <Tooltip title="Close Form" arrow>
                <IconButton onClick={editingGroupIds ? handleCancelEdit : () => setShowEntryForm(false)} sx={{ bgcolor: '#f1f5f9', color: '#64748b', borderRadius: 1 }}>
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
                      label="AF56 ID / Batch"
                      fullWidth
                      size="small"
                      value={formData.af56Id}
                      onChange={(e) => setFormData({ ...formData, af56Id: e.target.value })}
                      placeholder="e.g. AF56-2024-001"
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
                      label="Official Receipt No. *"
                      fullWidth
                      size="small"
                      value={formData.orNumber}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.length <= 8) {
                          setFormData({ ...formData, orNumber: val });
                        }
                      }}
                      onBlur={() => {
                        if (formData.orNumber && /^\d+$/.test(formData.orNumber)) {
                          setFormData({ ...formData, orNumber: formData.orNumber.padStart(8, '0') });
                        }
                      }}
                      placeholder="e.g. 02079482"
                      required
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
                    value={formData.payor}
                    onChange={(_, newValue) => {
                      setFormData({ ...formData, payor: newValue || '' });
                    }}
                    onInputChange={(_, newInputValue) => {
                      setFormData({ ...formData, payor: newInputValue });
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Payor Name *"
                        fullWidth
                        size="small"
                        placeholder="Taxpayer Full Name"
                        required
                        error={saveAttempted && !formData.payor?.trim()}
                        helperText={saveAttempted && !formData.payor?.trim() ? 'Required' : undefined}
                        inputRef={(node) => {
                          if (payorRef) {
                            payorRef.current = node;
                          }
                          const { ref } = (params.InputProps as any) || {};
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
                    label="Transaction Date *"
                    fullWidth
                    size="small"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                    required
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
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    placeholder="Additional transaction notes..."
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
                </Stack>
              </Grid>

              {/* Right Column: Charges Line Items */}
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
                  {charges.map((c, idx) => (
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
                        {/* Row 1: Land Name & Barangay */}
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Land Name / Declared Owner *"
                            required
                            error={saveAttempted && !c.landName?.trim()}
                            helperText={saveAttempted && !c.landName?.trim() ? 'Required' : undefined}
                            value={c.landName}
                            inputRef={(el) => (landNameRefs.current[idx] = el)}
                            onChange={(e) => {
                              const next = [...charges];
                              next[idx] = { ...next[idx], landName: e.target.value };
                              setCharges(next);
                            }}
                            placeholder="e.g. Lot 123-A / Owner Name"
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Autocomplete
                            freeSolo
                            options={BARANGAYS}
                            value={c.barangay}
                            onChange={(_, v) => {
                              const next = [...charges];
                              next[idx] = { ...next[idx], barangay: v || '' };
                              setCharges(next);
                            }}
                            onInputChange={(_, v) => {
                              const next = [...charges];
                              next[idx] = { ...next[idx], barangay: v };
                              setCharges(next);
                            }}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Barangay *"
                                required
                                error={saveAttempted && !c.barangay?.trim()}
                                helperText={saveAttempted && !c.barangay?.trim() ? 'Required' : undefined}
                                size="small"
                                fullWidth
                                placeholder="Select or type barangay"
                              />
                            )}
                          />
                        </Grid>

                        {/* Row 2: TD #, Years Paid, Parcel (Fraction), Amount, Remove */}
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Tax Declaration (TD) No. *"
                            required
                            error={saveAttempted && !c.tdNumber?.trim()}
                            helperText={saveAttempted && !c.tdNumber?.trim() ? 'Required' : undefined}
                            value={c.tdNumber}
                            onChange={(e) => {
                              const next = [...charges];
                              next[idx] = { ...next[idx], tdNumber: e.target.value };
                              setCharges(next);
                            }}
                            placeholder="e.g. TD-2024-001"
                          />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 2 }}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Years Paid *"
                            required
                            error={saveAttempted && !c.yearsPaid?.trim()}
                            helperText={saveAttempted && !c.yearsPaid?.trim() ? 'Required' : undefined}
                            value={c.yearsPaid}
                            onChange={(e) => {
                              const next = [...charges];
                              next[idx] = { ...next[idx], yearsPaid: e.target.value };
                              setCharges(next);
                            }}
                            placeholder="e.g. 2024"
                          />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 2 }}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Parcel (Fraction) *"
                            required
                            error={saveAttempted && !c.parcel?.trim()}
                            helperText={saveAttempted && !c.parcel?.trim() ? 'Required' : undefined}
                            value={c.parcel}
                            onChange={(e) => {
                              const next = [...charges];
                              next[idx] = { ...next[idx], parcel: e.target.value };
                              setCharges(next);
                            }}
                            placeholder="e.g. 1/1, 1/2"
                          />
                        </Grid>
                        <Grid size={{ xs: 10, sm: 3 }}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Amount (PHP) *"
                            required
                            error={saveAttempted && (c.amount === '' || isNaN(Number(c.amount)) || Number(c.amount) <= 0)}
                            helperText={saveAttempted && (c.amount === '' || isNaN(Number(c.amount)) || Number(c.amount) <= 0) ? 'Required (>0)' : undefined}
                            value={c.amount}
                            onChange={(e) => {
                              const next = [...charges];
                              next[idx] = { ...next[idx], amount: e.target.value };
                              setCharges(next);
                            }}
                            onBlur={() => {
                              const val = String(c.amount || '');
                              if (val && val.trim().startsWith('=')) {
                                try {
                                  const expression = val.trim().substring(1).replace(/\s+/g, '');
                                  const parts = expression.split(/([+\-])/);
                                  let sum = parseFloat(parts[0]) || 0;
                                  for (let i = 1; i < parts.length; i += 2) {
                                    const operator = parts[i];
                                    const operand = parseFloat(parts[i + 1]) || 0;
                                    if (operator === '+') sum += operand;
                                    if (operator === '-') sum -= operand;
                                  }
                                  const next = [...charges];
                                  next[idx] = { ...next[idx], amount: String(sum) };
                                  setCharges(next);
                                } catch (err) {
                                  console.error(err);
                                }
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = String(c.amount || '');
                                if (val && val.trim().startsWith('=')) {
                                  e.preventDefault();
                                  try {
                                    const expression = val.trim().substring(1).replace(/\s+/g, '');
                                    const parts = expression.split(/([+\-])/);
                                    let sum = parseFloat(parts[0]) || 0;
                                    for (let i = 1; i < parts.length; i += 2) {
                                      const operator = parts[i];
                                      const operand = parseFloat(parts[i + 1]) || 0;
                                      if (operator === '+') sum += operand;
                                      if (operator === '-') sum -= operand;
                                    }
                                    const next = [...charges];
                                    next[idx] = { ...next[idx], amount: String(sum) };
                                    setCharges(next);
                                  } catch (err) {
                                    console.error(err);
                                  }
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
                          <Tooltip title="Remove Charge Line">
                            <IconButton
                              color="error"
                              size="small"
                              tabIndex={-1}
                              onClick={() => {
                                const next = charges.filter((_, i) => i !== idx);
                                setCharges(next.length > 0 ? next : [{ landName: '', barangay: '', tdNumber: '', yearsPaid: '', amount: '', parcel: '1/1' }]);
                              }}
                            >
                              <DeleteOutline fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Grid>
                      </Grid>
                    </Paper>
                  ))}

                  {/* Add Another Charge Line Button */}
                  <Tooltip title="Add Another Charge Line" arrow>
                    <IconButton
                      color="primary"
                      onClick={() => {
                        const newIdx = charges.length;
                        setCharges([...charges, { landName: '', barangay: '', tdNumber: '', yearsPaid: '', amount: '', parcel: '1/1' }]);
                        setTimeout(() => {
                          const el = landNameRefs.current[newIdx];
                          if (el) el.focus();
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

                  {/* Save Entry Button (directly below add charge line button, identical size) */}
                  <Tooltip
                    title={
                      !formData.orNumber || !formData.payor
                        ? "Official Receipt No. and Payor Name are required"
                        : (editingGroupIds ? "Update All Charges" : "Save Entry")
                    }
                    arrow
                  >
                    <Box sx={{ width: '100%', mt: 1 }}>
                      <Button
                        fullWidth
                        variant="contained"
                        onClick={handleSave}
                        disabled={loading || !formData.orNumber || !formData.payor}
                        startIcon={loading ? <CircularProgress size={18} color="inherit" /> : (editingGroupIds ? <Edit /> : <Save />)}
                        sx={{
                          width: '100%',
                          py: 0.8,
                          borderRadius: 1,
                          bgcolor: '#0284c7',
                          color: '#ffffff',
                          fontWeight: 'bold',
                          fontSize: '0.95rem',
                          textTransform: 'none',
                          boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
                          '&:hover': { bgcolor: '#0369a1' }
                        }}
                      >
                        {editingGroupIds ? "Update Entry" : "Save Entry"}
                      </Button>
                    </Box>
                  </Tooltip>
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Main Table Paper (Combined by OR No) */}
      <Paper elevation={0} sx={{ overflow: 'hidden', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
        <Box sx={{ p: 2, px: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#0369a1', flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0369a1' }}>
                RPT Collection Entries
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Combined by OR Number ({groupedRPTCollections.length} total receipts)
              </Typography>
            </Box>
            <Tooltip title="Upload any local offline RPT entries directly to Supabase cloud">
              <Button
                size="small"
                variant="outlined"
                startIcon={<CloudSync fontSize="small" />}
                onClick={async () => {
                  setLoading(true);
                  const syncedCount = await syncPendingLocalRPTCollectionsToSupabase();
                  await loadCollections();
                  setLoading(false);
                  setNotification({
                    open: true,
                    message: syncedCount > 0 
                      ? `Successfully synced ${syncedCount} local RPT entries to Supabase!` 
                      : 'All local RPT entries are already synced to Supabase.',
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
          <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0284c7' }}>
            Total: ₱ {totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </Typography>
        </Box>

        {/* Filters */}
        <Box sx={{ p: 2, bgcolor: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField 
                label="Search" 
                placeholder="Payor, OR No, Barangay, TD No..."
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
            <Grid size={{ xs: 12, sm: 6, md: 3.5 }}>
              <Autocomplete
                size="small"
                options={uniqueAF56Ids}
                value={filterAF56Id}
                onChange={(_, newValue) => setFilterAF56Id(newValue)}
                renderInput={(params) => <TextField {...params} label="AF56 ID / Batch" />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3.5 }}>
              <TextField
                label="Date"
                type="date"
                fullWidth
                size="small"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            {(searchTerm || filterDate || filterAF56Id) && (
              <Grid size={{ xs: 12, md: 1 }} sx={{ display: 'flex', justifyContent: 'center' }}>
                <Tooltip title="Clear Filters" arrow>
                  <IconButton 
                    onClick={clearFilters}
                    sx={{ bgcolor: '#f1f5f9', color: '#64748b', p: 1, borderRadius: 1, '&:hover': { bgcolor: '#fee2e2', color: '#ef4444' } }}
                  >
                    <Clear />
                  </IconButton>
                </Tooltip>
              </Grid>
            )}
          </Grid>
        </Box>

        <TableContainer sx={{ maxHeight: 650 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 48 }} />
                <TableCell>AF56 ID</TableCell>
                <TableCell>OR No.</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Payor</TableCell>
                <TableCell>Breakdown</TableCell>
                <TableCell>Barangay</TableCell>
                <TableCell align="right">Total Amount</TableCell>
                <TableCell>Remarks</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleGroups.map((group) => {
                const isExpanded = !!expandedRows[group.key];
                return (
                  <React.Fragment key={group.key}>
                    <TableRow 
                      hover 
                      onClick={() => toggleRow(group.key)}
                      sx={{ 
                        cursor: 'pointer',
                        bgcolor: isExpanded ? '#f0f9ff' : undefined,
                        '& > *': { borderBottom: isExpanded ? 'unset' : undefined },
                        '&:hover': { bgcolor: isExpanded ? '#e0f2fe !important' : '#f8fafc' }
                      }}
                    >
                      <TableCell sx={{ width: 48 }}>
                        <Tooltip title={isExpanded ? "Hide Breakdown" : "Show Breakdown"} arrow>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRow(group.key);
                            }}
                            sx={{ color: '#0284c7', bgcolor: isExpanded ? '#e0f2fe' : '#f0f9ff' }}
                          >
                            {isExpanded ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{group.af56Id || '-'}</TableCell>
                      <TableCell sx={{ color: '#0284c7', fontWeight: 800, letterSpacing: 0.5 }}>{group.orNumber}</TableCell>
                      <TableCell>{group.date || '-'}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{group.payor || '-'}</TableCell>
                      <TableCell>
                        <Chip 
                          label={`${group.items.length} parcel${group.items.length > 1 ? 's' : ''}`}
                          size="small"
                          sx={{ fontWeight: 700, bgcolor: '#e0f2fe', color: '#0369a1', fontSize: '0.75rem', borderRadius: 1 }}
                        />
                      </TableCell>
                      <TableCell>{group.barangay || '-'}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                        ₱ {group.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell sx={{ color: '#64748b' }}>{group.remarks || '-'}</TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        {!isAdmin ? (
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title={`Edit OR #${group.orNumber} (${group.items.length} items)`} arrow>
                              <IconButton 
                                color="primary" 
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditGroup(group);
                                }}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={`Delete OR #${group.orNumber}`} arrow>
                              <IconButton 
                                color="error" 
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  confirmDeleteGroup(group);
                                }}
                              >
                                <DeleteOutline fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        ) : (
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="View Receipt Details (with Collector Name)" arrow>
                              <IconButton 
                                size="small" 
                                color="primary" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedItem(group.items[0]);
                                  setViewDialogOpen(true);
                                }} 
                                sx={{ bgcolor: '#f0f9ff', '&:hover': { bgcolor: '#e0f2fe' } }}
                              >
                                <Visibility fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={isExpanded ? "Collapse Breakdown" : "Expand Breakdown"} arrow>
                              <IconButton 
                                size="small" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRow(group.key);
                                }} 
                                sx={{ bgcolor: '#f8fafc', color: '#64748b', '&:hover': { bgcolor: '#e2e8f0' } }}
                              >
                                {isExpanded ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Collapsible Details for RPT Group */}
                    <TableRow>
                      <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={10}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ margin: 1.5, p: 2, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                              <Box>
                                <Typography variant="subtitle2" fontWeight="800" sx={{ color: '#0369a1' }}>
                                  Real Property Payment Breakdown for OR #{group.orNumber}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Payor: <strong>{group.payor}</strong> • Date: <strong>{group.date}</strong>
                                  {isAdmin && (
                                    <> • Collector: <strong style={{ color: '#0284c7' }}>{getCollectorName(group.items[0]?.collectorEmail, group.items[0]?.userId)}</strong></>
                                  )}
                                </Typography>
                              </Box>
                              {isAdmin && (
                                <Chip
                                  icon={<Person sx={{ fontSize: '15px !important' }} />}
                                  label={`Collector: ${getCollectorName(group.items[0]?.collectorEmail, group.items[0]?.userId)}`}
                                  size="small"
                                  sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 700, fontSize: '0.75rem', border: '1px solid #bae6fd' }}
                                />
                              )}
                            </Box>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#ffffff' }}>#</TableCell>
                                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#ffffff' }}>Barangay</TableCell>
                                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#ffffff' }}>Land Name / Owner</TableCell>
                                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#ffffff' }}>TD Number</TableCell>
                                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#ffffff' }}>Years Paid</TableCell>
                                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#ffffff' }}>Parcel (Fraction)</TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#ffffff' }}>Amount</TableCell>
                                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#ffffff' }}>Remarks</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {group.items.map((item, idx) => (
                                  <TableRow 
                                    key={item.id || idx} 
                                    hover
                                    onClick={() => { setSelectedItem(item); setViewDialogOpen(true); }}
                                    sx={{ cursor: 'pointer' }}
                                  >
                                    <TableCell sx={{ color: '#64748b' }}>{idx + 1}</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>{item.barangay || '-'}</TableCell>
                                    <TableCell>{item.landName || '-'}</TableCell>
                                    <TableCell sx={{ fontFamily: 'monospace', bgcolor: '#f0f9ff', color: '#0369a1', px: 1, borderRadius: 1 }}>
                                      {item.tdNumber || '-'}
                                    </TableCell>
                                    <TableCell>{item.yearsPaid || '-'}</TableCell>
                                    <TableCell>{item.parcel || '-'}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                                      ₱ {(item.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell sx={{ color: '#64748b' }}>{item.remarks || '-'}</TableCell>
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
              {groupedRPTCollections.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 6 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <TableChart sx={{ color: '#94a3b8', fontSize: 40 }} />
                      <Typography color="text.secondary" variant="body1" fontWeight="600">
                        {loading ? 'Loading collections...' : 'No RPT collection entries found.'}
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
          count={groupedRPTCollections.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Receipts per page:"
        />
      </Paper>

      {/* ========================================================================= */}
      {/* EXCEL IMPORT PREVIEW DIALOG                                              */}
      {/* ========================================================================= */}
      <Dialog
        open={importPreviewOpen}
        onClose={() => !isImporting && setImportPreviewOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { borderRadius: 1.5, p: 1, border: '1px solid #e2e8f0' } }}
      >
        <DialogTitle component="div" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UploadFile />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight="800" sx={{ color: '#0f172a' }}>
                Preview RPT Excel Import
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Verify the detected columns and records before batch inserting into the database.
              </Typography>
            </Box>
          </Box>

          {sheetNames.length > 1 && (
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="sheet-select-label">Worksheet</InputLabel>
              <Select
                labelId="sheet-select-label"
                value={selectedSheet}
                label="Worksheet"
                onChange={(e) => handleSheetChange(e.target.value)}
                sx={{ borderRadius: 1 }}
              >
                {sheetNames.map((s) => (
                  <MenuItem key={s} value={s}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Layers fontSize="small" sx={{ color: '#0284c7' }} />
                      {s}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ pt: 2.5 }}>
          {isImporting ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <CircularProgress size={48} sx={{ color: '#0284c7', mb: 2 }} />
              <Typography variant="h6" fontWeight="700" sx={{ color: '#0f172a' }}>
                Importing RPT Collections...
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {importStatusText}
              </Typography>
              <Box sx={{ width: '60%', mx: 'auto' }}>
                <LinearProgress variant="determinate" value={importProgress} sx={{ height: 6, borderRadius: 1 }} />
              </Box>
            </Box>
          ) : (
            <>
              {/* Import Summary Badges */}
              <Grid container spacing={2} sx={{ mb: 2.5 }}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#f0f9ff', borderRadius: 1, border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="600">TOTAL RECORDS</Typography>
                    <Typography variant="h6" fontWeight="800" sx={{ color: '#0284c7' }}>
                      {importedRows.length.toLocaleString()}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#f0fdf4', borderRadius: 1, border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="600">TOTAL AMOUNT</Typography>
                    <Typography variant="h6" fontWeight="800" sx={{ color: '#16a34a' }}>
                      ₱ {importedRows.reduce((sum, r) => sum + (r.amount || 0), 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#fef3c7', borderRadius: 1, border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="600">UNIQUE RECEIPTS (ORs)</Typography>
                    <Typography variant="h6" fontWeight="800" sx={{ color: '#d97706' }}>
                      {new Set(importedRows.map(r => r.orNumber)).size}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#faf5ff', borderRadius: 1, border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="600">UNIQUE PAYORS</Typography>
                    <Typography variant="h6" fontWeight="800" sx={{ color: '#7c3aed' }}>
                      {new Set(importedRows.map(r => r.payor)).size}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Preview Table */}
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 1, maxHeight: 380 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 700, color: '#334155' } }}>
                      <TableCell>AF56 ID</TableCell>
                      <TableCell>OR Number</TableCell>
                      <TableCell>Payor</TableCell>
                      <TableCell>Barangay</TableCell>
                      <TableCell>Land Name</TableCell>
                      <TableCell>TD Number</TableCell>
                      <TableCell>Years Paid</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Remarks</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {importedRows
                      .slice(previewPage * previewRowsPerPage, previewPage * previewRowsPerPage + previewRowsPerPage)
                      .map((row, idx) => (
                        <TableRow key={idx} hover>
                          <TableCell sx={{ fontWeight: 600 }}>{row.af56Id || '-'}</TableCell>
                          <TableCell sx={{ color: '#0284c7', fontWeight: 700 }}>{row.orNumber}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{row.payor}</TableCell>
                          <TableCell>{row.barangay || '-'}</TableCell>
                          <TableCell>{row.landName || '-'}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace' }}>{row.tdNumber || '-'}</TableCell>
                          <TableCell>{row.yearsPaid || '-'}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: '#0f172a' }}>
                            ₱ {(row.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>{row.date}</TableCell>
                          <TableCell sx={{ color: '#64748b' }}>{row.remarks || '-'}</TableCell>
                        </TableRow>
                      ))}
                    {importedRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} align="center" sx={{ py: 4, color: '#94a3b8' }}>
                          No valid records parsed from this worksheet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                rowsPerPageOptions={[10, 25, 50]}
                component="div"
                count={importedRows.length}
                rowsPerPage={previewRowsPerPage}
                page={previewPage}
                onPageChange={(_, p) => setPreviewPage(p)}
                onRowsPerPageChange={(e) => {
                  setPreviewRowsPerPage(parseInt(e.target.value, 10));
                  setPreviewPage(0);
                }}
                labelRowsPerPage="Rows per page:"
              />
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, px: 3, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0', justifyContent: 'space-between' }}>
          <Tooltip title="Cancel Import" arrow>
            <IconButton
              onClick={() => setImportPreviewOpen(false)}
              disabled={isImporting}
              sx={{ bgcolor: '#f1f5f9', color: '#64748b', borderRadius: 1 }}
            >
              <Clear />
            </IconButton>
          </Tooltip>

          <Tooltip title={`Confirm & Import ${importedRows.length} Records`} arrow>
            <IconButton
              onClick={handleConfirmImport}
              disabled={isImporting || importedRows.length === 0}
              sx={{
                bgcolor: '#0284c7',
                color: '#ffffff',
                borderRadius: 1,
                '&:hover': { bgcolor: '#0369a1', color: '#ffffff' }
              }}
            >
              <Check />
            </IconButton>
          </Tooltip>
        </DialogActions>
      </Dialog>

      {/* Details View Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 1.5, p: 1, border: '1px solid #e2e8f0' } }}
      >
        <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: '800', color: '#0f172a' }}>
          <HomeWork sx={{ color: '#0284c7' }} />
          RPT Payment Details
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5 }}>
          {selectedItem && (
            <Grid container spacing={2}>
              {/* Collector Information Card (Highlighted for Admins) */}
              <Grid size={{ xs: 12 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    bgcolor: '#f0f9ff',
                    borderRadius: 1.5,
                    border: '1px solid #bae6fd',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5
                  }}
                >
                  <Avatar sx={{ bgcolor: '#0284c7', color: '#ffffff', width: 40, height: 40, fontSize: '0.95rem', fontWeight: 'bold' }}>
                    {getCollectorName(selectedItem.collectorEmail, selectedItem.userId).charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Recorded By (Collector)
                    </Typography>
                    <Typography variant="subtitle2" fontWeight="800" sx={{ color: '#0f172a' }}>
                      {getCollectorName(selectedItem.collectorEmail, selectedItem.userId)}
                    </Typography>
                    {selectedItem.collectorEmail && (
                      <Typography variant="caption" color="text.secondary">
                        {selectedItem.collectorEmail}
                      </Typography>
                    )}
                  </Box>
                  <Chip
                    label="Collector"
                    size="small"
                    sx={{ bgcolor: '#bae6fd', color: '#0369a1', fontWeight: 700, fontSize: '0.75rem' }}
                  />
                </Paper>
              </Grid>

              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">AF56 ID</Typography>
                <Typography variant="body1" fontWeight="600">{selectedItem.af56Id || '-'}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">Official Receipt No.</Typography>
                <Typography variant="body1" fontWeight="800" color="primary.main">{selectedItem.orNumber}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">Date</Typography>
                <Typography variant="body1" fontWeight="600">{selectedItem.date}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">Amount Paid</Typography>
                <Typography variant="h6" fontWeight="800" sx={{ color: '#0284c7' }}>
                  ₱ {(selectedItem.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Divider sx={{ my: 1 }} />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant="caption" color="text.secondary">Payor Name</Typography>
                <Typography variant="body1" fontWeight="700">{selectedItem.payor}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">Barangay</Typography>
                <Typography variant="body1">{selectedItem.barangay || '-'}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">Land Name / Declared Owner</Typography>
                <Typography variant="body1">{selectedItem.landName || '-'}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">Tax Declaration (TD) No.</Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>{selectedItem.tdNumber || '-'}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">Years Paid</Typography>
                <Typography variant="body1">{selectedItem.yearsPaid || '-'}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">Parcel (Fraction)</Typography>
                <Typography variant="body1">{selectedItem.parcel || '-'}</Typography>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant="caption" color="text.secondary">Remarks</Typography>
                <Typography variant="body2" color="text.secondary">{selectedItem.remarks || 'No remarks entered.'}</Typography>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Tooltip title="Close Details" arrow>
            <IconButton onClick={() => setViewDialogOpen(false)} sx={{ bgcolor: '#f1f5f9' }}>
              <Clear />
            </IconButton>
          </Tooltip>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
