import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid,
  Chip,
  Container,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Button,
  Tabs,
  Tab,
  Card,
  CardContent,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  CircularProgress,
  Stack,
  Autocomplete,
  Alert
} from '@mui/material';
import { 
  AdminPanelSettings,
  AssessmentOutlined,
  Search,
  Clear,
  Refresh,
  CheckCircle,
  ReceiptLong,
  Print,
  History,
  CheckCircleOutline,
  Unarchive,
  Visibility,
  AddCircleOutline,
  FileDownload,
  DeleteOutline,
  PlaylistAddCheck,
  Send,
  Layers,
  SelectAll,
  CalendarMonth
} from '@mui/icons-material';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Notification } from '../components/Notification';
import { useAuth } from '../context/useAuth';
import { 
  getCollectionEntries,
  getRPTCollections,
  getAllManagedUsers,
  getAdminSubmittedReports,
  getSubmittedItemIds,
  saveAdminSubmittedReport,
  unmarkAdminSubmittedReport,
  type CollectionItem,
  type AdminSubmittedReportRecord,
  type AdminSubCategoryCharge
} from '../services/supabaseService';
import type { RPTCollectionItem } from '../types/rcd';

// Unified Collection Item structure
export interface UnifiedCollectionItem {
  id: number;
  type: 'general' | 'rpt';
  collectorKey: string;
  collectorName: string;
  collectorEmail?: string;
  userId?: string;
  bookletNo: string;
  orNo: string;
  payor: string;
  subCategory: string;
  mainCategory: string;
  accountCode: string;
  amount: number;
  date: string;
  remarks?: string;
}

// Staged Row in the Consolidated Table
export interface StagedReportRow {
  id: string; // unique row id
  batchId: string;
  collectorKey: string;
  collectorName: string;
  collectorEmail?: string;
  userId?: string;
  bookletNo: string;
  collectionType: 'general' | 'rpt';
  orNumbers: string[];
  orNumbersDisplay: string;
  subCategory: string;
  mainCategory: string;
  accountCode: string;
  amount: number;
  itemCount: number;
  itemIds: number[];
  dateFrom: string;
  dateTo: string;
}

export const AdminReportsPage: React.FC = () => {
  const { user } = useAuth();

  // Loading & Notification State
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({ open: false, message: '', severity: 'info' });

  // Tab State: 0 = Active Collections Builder, 1 = Submitted Reports Archive
  const [activeTab, setActiveTab] = useState(0);

  // Raw Database Data
  const [generalCollections, setGeneralCollections] = useState<CollectionItem[]>([]);
  const [rptCollections, setRptCollections] = useState<RPTCollectionItem[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [submittedItemKeys, setSubmittedItemKeys] = useState<Set<string>>(new Set());
  const [submittedReports, setSubmittedReports] = useState<AdminSubmittedReportRecord[]>([]);

  // Selection Panel State (Active Collections Tab)
  const [selectedCollector, setSelectedCollector] = useState<string | null>(null);
  const [selectedBooklet, setSelectedBooklet] = useState<string | null>(null);
  const [orFrom, setOrFrom] = useState<string>('');
  const [orTo, setOrTo] = useState<string>('');

  // Date Range Filter State for Builder
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Staged Consolidated Table Rows
  const [stagedTableRows, setStagedTableRows] = useState<StagedReportRow[]>(() => {
    try {
      const saved = localStorage.getItem('rcd_admin_staged_rows');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Table Search / Filter
  const [tableSearch, setTableSearch] = useState('');

  // Archive Tab Filtering & Pagination State
  const [archiveCollectorFilter, setArchiveCollectorFilter] = useState<string | null>(null);
  const [archiveSearchTerm, setArchiveSearchTerm] = useState<string>('');
  const [archivePage, setArchivePage] = useState<number>(0);
  const [archiveRowsPerPage, setArchiveRowsPerPage] = useState<number>(10);

  // Submit Confirmation Dialog
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Archive Details View Dialog
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedArchiveReport, setSelectedArchiveReport] = useState<AdminSubmittedReportRecord | null>(null);

  // Print Preview Dialog State
  const [printDialogOpen, setPrintDialogOpen] = useState(false);

  // Unmark Confirm State
  const [unmarkConfirmOpen, setUnmarkConfirmOpen] = useState(false);
  const [reportToUnmark, setReportToUnmark] = useState<AdminSubmittedReportRecord | null>(null);

  // Save staged rows to localStorage whenever updated
  useEffect(() => {
    try {
      localStorage.setItem('rcd_admin_staged_rows', JSON.stringify(stagedTableRows));
    } catch {}
  }, [stagedTableRows]);

  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

  // Helper to resolve collector full name
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

  // Helper for computing OR Range display string
  const formatOrRange = (orList: string[]): string => {
    if (orList.length === 0) return 'None';
    if (orList.length === 1) return orList[0];
    const sorted = [...orList].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return `${sorted[0]} — ${sorted[sorted.length - 1]} (${sorted.length} ORs)`;
  };

  // Helper to test if an OR number falls within [from, to] range
  const isOrInRange = (or: string, from: string, to: string): boolean => {
    if (!or || !from || !to) return false;
    const numOr = parseInt(or.replace(/\D/g, ''), 10);
    const numFrom = parseInt(from.replace(/\D/g, ''), 10);
    const numTo = parseInt(to.replace(/\D/g, ''), 10);
    if (!isNaN(numOr) && !isNaN(numFrom) && !isNaN(numTo)) {
      const min = Math.min(numFrom, numTo);
      const max = Math.max(numFrom, numTo);
      return numOr >= min && numOr <= max;
    }
    const minStr = from.localeCompare(to, undefined, { numeric: true }) <= 0 ? from : to;
    const maxStr = from.localeCompare(to, undefined, { numeric: true }) <= 0 ? to : from;
    return or.localeCompare(minStr, undefined, { numeric: true }) >= 0 && or.localeCompare(maxStr, undefined, { numeric: true }) <= 0;
  };

  // Load all initial data from Supabase / local caches
  const loadData = async () => {
    setLoading(true);
    try {
      const [genData, rptData, managedUsers, submittedKeys, subReports] = await Promise.all([
        getCollectionEntries(),
        getRPTCollections(),
        getAllManagedUsers().catch(() => []),
        getSubmittedItemIds().catch(() => new Set<string>()),
        getAdminSubmittedReports().catch(() => [])
      ]);

      setGeneralCollections(genData);
      setRptCollections(rptData);
      setSubmittedItemKeys(submittedKeys);
      setSubmittedReports(subReports);

      if (managedUsers && managedUsers.length > 0) {
        const map: Record<string, string> = {};
        managedUsers.forEach(u => {
          const name = u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
          if (u.email) map[u.email.toLowerCase().trim()] = name;
          if (u.id) map[u.id.toLowerCase().trim()] = name;
        });
        setUsersMap(map);
      }
    } catch (err) {
      console.error('Failed to load admin reports data', err);
      setNotification({
        open: true,
        message: 'Failed to load consolidated data.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute set of Item IDs and OR numbers currently staged in the table
  const stagedItemKeys = useMemo(() => {
    const set = new Set<string>();
    stagedTableRows.forEach(row => {
      row.itemIds.forEach(id => {
        set.add(`${row.collectionType}_${id}`);
      });
      row.orNumbers.forEach(or => {
        set.add(`or_${row.bookletNo}_${or}`);
      });
    });
    return set;
  }, [stagedTableRows]);

  // Convert raw General & RPT entries to Unified Active (Un-reported) Items
  const unifiedActiveItems = useMemo<UnifiedCollectionItem[]>(() => {
    const list: UnifiedCollectionItem[] = [];

    // 1. General Collections
    generalCollections.forEach(item => {
      if (item.id && submittedItemKeys.has(`general_${item.id}`)) return;
      if (item.orNo && item.afNo && submittedItemKeys.has(`or_${item.afNo}_${item.orNo}`)) return;

      const email = item.collectorEmail?.toLowerCase().trim() || '';
      const uid = item.userId || '';
      const collectorKey = email || uid || 'unassigned_collector';
      const cName = getCollectorName(item.collectorEmail, item.userId);
      const bNo = (item.afNo || 'A.F. NO. 51').trim();

      list.push({
        id: item.id,
        type: 'general',
        collectorKey,
        collectorName: cName,
        collectorEmail: item.collectorEmail,
        userId: item.userId,
        bookletNo: bNo,
        orNo: item.orNo || '',
        payor: item.payor || '-',
        subCategory: item.subCategory || 'General Fee',
        mainCategory: item.mainCategory || 'Tax Revenue',
        accountCode: item.accountCode || '-',
        amount: item.amount || 0,
        date: item.date || '',
        remarks: item.remarks || ''
      });
    });

    // 2. RPT Collections
    rptCollections.forEach(item => {
      if (item.id && submittedItemKeys.has(`rpt_${item.id}`)) return;
      if (item.orNumber && submittedItemKeys.has(`or_A.F. NO. 56_${item.orNumber}`)) return;
      if (item.orNumber && item.af56Id && submittedItemKeys.has(`or_${item.af56Id}_${item.orNumber}`)) return;

      const email = item.collectorEmail?.toLowerCase().trim() || '';
      const uid = item.userId || '';
      const collectorKey = email || uid || 'unassigned_collector';
      const cName = getCollectorName(item.collectorEmail, item.userId);
      const bNo = (item.af56Id || 'A.F. NO. 56').trim();

      list.push({
        id: item.id,
        type: 'rpt',
        collectorKey,
        collectorName: cName,
        collectorEmail: item.collectorEmail,
        userId: item.userId,
        bookletNo: bNo,
        orNo: item.orNumber || '',
        payor: item.payor || '-',
        subCategory: item.remarks ? `Real Property Tax (${item.remarks})` : 'Real Property Tax - Basic',
        mainCategory: 'Tax Revenue - Property',
        accountCode: '01-01-02-01',
        amount: item.amount || 0,
        date: item.date || '',
        remarks: item.remarks || ''
      });
    });

    return list;
  }, [generalCollections, rptCollections, submittedItemKeys, usersMap]);

  // Filter active items by date range if provided
  const filteredActiveItems = useMemo<UnifiedCollectionItem[]>(() => {
    return unifiedActiveItems.filter(item => {
      if (dateFrom && item.date && item.date < dateFrom) return false;
      if (dateTo && item.date && item.date > dateTo) return false;
      return true;
    });
  }, [unifiedActiveItems, dateFrom, dateTo]);

  // Step 1: Available Collectors List (filtered by date)
  const availableCollectors = useMemo(() => {
    const map = new Map<string, { key: string; name: string; count: number; total: number }>();
    filteredActiveItems.forEach(item => {
      if (stagedItemKeys.has(`${item.type}_${item.id}`)) return;

      const existing = map.get(item.collectorName) || { key: item.collectorKey, name: item.collectorName, count: 0, total: 0 };
      existing.count += 1;
      existing.total += item.amount;
      map.set(item.collectorName, existing);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredActiveItems, stagedItemKeys]);

  // Step 2: Available Booklet Numbers (based on selectedCollector and date)
  const availableBooklets = useMemo(() => {
    if (!selectedCollector) return [];
    const map = new Map<string, { bookletNo: string; count: number; total: number; orRange: string; ors: string[] }>();
    
    filteredActiveItems
      .filter(item => item.collectorName === selectedCollector)
      .forEach(item => {
        if (stagedItemKeys.has(`${item.type}_${item.id}`)) return;

        const existing = map.get(item.bookletNo) || { bookletNo: item.bookletNo, count: 0, total: 0, orRange: '', ors: [] };
        existing.count += 1;
        existing.total += item.amount;
        if (item.orNo && !existing.ors.includes(item.orNo)) {
          existing.ors.push(item.orNo);
        }
        map.set(item.bookletNo, existing);
      });

    return Array.from(map.values()).map(b => ({
      ...b,
      orRange: formatOrRange(b.ors)
    })).sort((a, b) => a.bookletNo.localeCompare(b.bookletNo, undefined, { numeric: true }));
  }, [filteredActiveItems, selectedCollector, stagedItemKeys]);

  // Step 3: Available OR Numbers in this booklet (sorted and date-filtered)
  const availableOrs = useMemo(() => {
    if (!selectedCollector || !selectedBooklet) return [];
    const set = new Set<string>();
    filteredActiveItems
      .filter(item => item.collectorName === selectedCollector && item.bookletNo === selectedBooklet)
      .forEach(item => {
        if (!stagedItemKeys.has(`${item.type}_${item.id}`) && item.orNo) {
          set.add(item.orNo);
        }
      });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [filteredActiveItems, selectedCollector, selectedBooklet, stagedItemKeys]);

  // Auto-fill OR Range (From and To) when booklet changes
  useEffect(() => {
    if (availableOrs.length > 0) {
      setOrFrom(availableOrs[0]);
      setOrTo(availableOrs[availableOrs.length - 1]);
    } else {
      setOrFrom('');
      setOrTo('');
    }
  }, [selectedBooklet, availableOrs]);

  // ORs currently matching the [orFrom, orTo] range
  const includedOrsInRange = useMemo(() => {
    if (!orFrom || !orTo || availableOrs.length === 0) return [];
    return availableOrs.filter(or => isOrInRange(or, orFrom, orTo));
  }, [availableOrs, orFrom, orTo]);

  // Total Available Unstaged Booklets Count (for Select All option)
  const totalAvailableUnstagedBooklets = useMemo(() => {
    const unstaged = filteredActiveItems.filter(item => !stagedItemKeys.has(`${item.type}_${item.id}`));
    const set = new Set<string>();
    unstaged.forEach(i => set.add(`${i.collectorKey}__${i.bookletNo}__${i.type}`));
    return set.size;
  }, [filteredActiveItems, stagedItemKeys]);

  // Option 2: Add ALL Available Booklets to Table in one click
  const handleAddAllAvailableBooklets = () => {
    const unstagedItems = filteredActiveItems.filter(item => !stagedItemKeys.has(`${item.type}_${item.id}`));

    if (unstagedItems.length === 0) {
      setNotification({
        open: true,
        message: 'No available booklets found to add (or all matching booklets are already in the table).',
        severity: 'info'
      });
      return;
    }

    // Group items by (collectorKey + bookletNo + collectionType)
    const bookletGroups = new Map<string, {
      collectorKey: string;
      collectorName: string;
      collectorEmail?: string;
      userId?: string;
      bookletNo: string;
      collectionType: 'general' | 'rpt';
      items: UnifiedCollectionItem[];
    }>();

    unstagedItems.forEach(item => {
      const groupKey = `${item.collectorKey}__${item.bookletNo}__${item.type}`;
      const existing = bookletGroups.get(groupKey) || {
        collectorKey: item.collectorKey,
        collectorName: item.collectorName,
        collectorEmail: item.collectorEmail,
        userId: item.userId,
        bookletNo: item.bookletNo,
        collectionType: item.type,
        items: []
      };
      existing.items.push(item);
      bookletGroups.set(groupKey, existing);
    });

    const newStagedRows: StagedReportRow[] = [];

    bookletGroups.forEach((bg, index) => {
      const batchId = `batch_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`;
      const ors = Array.from(new Set(bg.items.map(i => i.orNo))).filter(Boolean);
      const orRangeDisplay = formatOrRange(ors);

      // Group by subcategory + account code
      const subCatMap = new Map<string, {
        subCategory: string;
        mainCategory: string;
        accountCode: string;
        amount: number;
        itemCount: number;
        itemIds: number[];
        dateFrom: string;
        dateTo: string;
      }>();

      bg.items.forEach(item => {
        const key = `${item.subCategory}__${item.accountCode}`;
        const existing = subCatMap.get(key) || {
          subCategory: item.subCategory,
          mainCategory: item.mainCategory,
          accountCode: item.accountCode,
          amount: 0,
          itemCount: 0,
          itemIds: [],
          dateFrom: item.date || '',
          dateTo: item.date || ''
        };
        existing.amount += item.amount;
        existing.itemCount += 1;
        existing.itemIds.push(item.id);
        if (item.date) {
          if (!existing.dateFrom || item.date < existing.dateFrom) existing.dateFrom = item.date;
          if (!existing.dateTo || item.date > existing.dateTo) existing.dateTo = item.date;
        }
        subCatMap.set(key, existing);
      });

      subCatMap.forEach(sub => {
        newStagedRows.push({
          id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          batchId,
          collectorKey: bg.collectorKey,
          collectorName: bg.collectorName,
          collectorEmail: bg.collectorEmail,
          userId: bg.userId,
          bookletNo: bg.bookletNo,
          collectionType: bg.collectionType,
          orNumbers: ors,
          orNumbersDisplay: orRangeDisplay,
          subCategory: sub.subCategory,
          mainCategory: sub.mainCategory,
          accountCode: sub.accountCode,
          amount: sub.amount,
          itemCount: sub.itemCount,
          itemIds: sub.itemIds,
          dateFrom: sub.dateFrom,
          dateTo: sub.dateTo
        });
      });
    });

    setStagedTableRows(prev => [...prev, ...newStagedRows]);

    // Reset selection inputs
    setSelectedCollector(null);
    setSelectedBooklet(null);
    setOrFrom('');
    setOrTo('');

    setNotification({
      open: true,
      message: `Successfully added ALL ${bookletGroups.size} available booklets (${newStagedRows.length} charge lines) across ${new Set(unstagedItems.map(i => i.collectorName)).size} collectors to the table!`,
      severity: 'success'
    });
  };

  // Add Selected Booklet Data to Consolidated Table via OR Range (Option 1)
  const handleAddToTable = () => {
    if (!selectedCollector || !selectedBooklet || !orFrom.trim() || !orTo.trim()) {
      setNotification({
        open: true,
        message: 'Please select a collector, booklet number, and valid OR Range (From and To).',
        severity: 'warning'
      });
      return;
    }

    // Filter items matching the selection and OR range
    const matchingItems = filteredActiveItems.filter(item => 
      item.collectorName === selectedCollector &&
      item.bookletNo === selectedBooklet &&
      isOrInRange(item.orNo, orFrom, orTo) &&
      !stagedItemKeys.has(`${item.type}_${item.id}`)
    );

    if (matchingItems.length === 0) {
      setNotification({
        open: true,
        message: `No available items found in range ${orFrom} to ${orTo} (they may already be in the table).`,
        severity: 'info'
      });
      return;
    }

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const primary = matchingItems[0];
    const uniqueMatchingOrs = Array.from(new Set(matchingItems.map(i => i.orNo))).filter(Boolean);
    const orRangeDisplay = `${orFrom} — ${orTo} (${uniqueMatchingOrs.length} ORs)`;

    // Group items by Sub Category + Account Code
    const subCatMap = new Map<string, {
      subCategory: string;
      mainCategory: string;
      accountCode: string;
      amount: number;
      itemCount: number;
      itemIds: number[];
      dateFrom: string;
      dateTo: string;
    }>();

    matchingItems.forEach(item => {
      const key = `${item.subCategory}__${item.accountCode}`;
      const existing = subCatMap.get(key) || {
        subCategory: item.subCategory,
        mainCategory: item.mainCategory,
        accountCode: item.accountCode,
        amount: 0,
        itemCount: 0,
        itemIds: [],
        dateFrom: item.date || '',
        dateTo: item.date || ''
      };
      existing.amount += item.amount;
      existing.itemCount += 1;
      existing.itemIds.push(item.id);
      if (item.date) {
        if (!existing.dateFrom || item.date < existing.dateFrom) existing.dateFrom = item.date;
        if (!existing.dateTo || item.date > existing.dateTo) existing.dateTo = item.date;
      }
      subCatMap.set(key, existing);
    });

    const newRows: StagedReportRow[] = Array.from(subCatMap.values()).map(sub => ({
      id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      batchId,
      collectorKey: primary.collectorKey,
      collectorName: primary.collectorName,
      collectorEmail: primary.collectorEmail,
      userId: primary.userId,
      bookletNo: primary.bookletNo,
      collectionType: primary.type,
      orNumbers: uniqueMatchingOrs,
      orNumbersDisplay: orRangeDisplay,
      subCategory: sub.subCategory,
      mainCategory: sub.mainCategory,
      accountCode: sub.accountCode,
      amount: sub.amount,
      itemCount: sub.itemCount,
      itemIds: sub.itemIds,
      dateFrom: sub.dateFrom,
      dateTo: sub.dateTo
    }));

    setStagedTableRows(prev => [...prev, ...newRows]);

    // Reset selection so the user can immediately add another booklet / collector
    setSelectedBooklet(null);
    setOrFrom('');
    setOrTo('');

    setNotification({
      open: true,
      message: `Added ${matchingItems.length} charge items for Booklet ${selectedBooklet} (OR Range: ${orFrom} to ${orTo}) to the table!`,
      severity: 'success'
    });
  };

  // Remove a row from the table
  const handleRemoveStagedRow = (rowId: string) => {
    setStagedTableRows(prev => prev.filter(r => r.id !== rowId));
  };

  // Clear all staged rows
  const handleClearStagedTable = () => {
    setStagedTableRows([]);
    localStorage.removeItem('rcd_admin_staged_rows');
  };

  // Filtered Staged Table Rows based on search query
  const filteredStagedRows = useMemo(() => {
    if (!tableSearch.trim()) return stagedTableRows;
    const q = tableSearch.toLowerCase();
    return stagedTableRows.filter(r => 
      r.collectorName.toLowerCase().includes(q) ||
      r.bookletNo.toLowerCase().includes(q) ||
      r.orNumbersDisplay.toLowerCase().includes(q) ||
      r.subCategory.toLowerCase().includes(q) ||
      r.mainCategory.toLowerCase().includes(q) ||
      r.accountCode.toLowerCase().includes(q)
    );
  }, [stagedTableRows, tableSearch]);

  // Batch / Booklet Totals Map
  const batchTotalsMap = useMemo(() => {
    const map = new Map<string, number>();
    stagedTableRows.forEach(r => {
      map.set(r.batchId, (map.get(r.batchId) || 0) + r.amount);
    });
    return map;
  }, [stagedTableRows]);

  // Grand Total of Staged Table
  const stagedTotalAmount = useMemo(() => {
    return filteredStagedRows.reduce((sum, r) => sum + r.amount, 0);
  }, [filteredStagedRows]);

  // Export Staged Table to Excel (XLSX)
  const handleExportExcel = () => {
    if (stagedTableRows.length === 0) return;

    const exportRows: any[] = [];
    stagedTableRows.forEach((r, idx) => {
      const isFirstRowOfBatch = idx === 0 || r.batchId !== stagedTableRows[idx - 1].batchId;
      const isLastRowOfBatch = idx === stagedTableRows.length - 1 || r.batchId !== stagedTableRows[idx + 1].batchId;
      const batchTotal = batchTotalsMap.get(r.batchId) || r.amount;

      exportRows.push({
        '#': idx + 1,
        'Collector Name': isFirstRowOfBatch ? r.collectorName : '',
        'Booklet No.': isFirstRowOfBatch ? r.bookletNo : '',
        'OR Numbers': isFirstRowOfBatch ? r.orNumbersDisplay : '',
        'Sub Category': r.subCategory,
        'Main Category': r.mainCategory,
        'Account Code': r.accountCode,
        'Amount (₱)': r.amount
      });

      // Insert Booklet Total Row
      if (isLastRowOfBatch) {
        exportRows.push({
          '#': '' as any,
          'Collector Name': '',
          'Booklet No.': `Total Booklet (${r.bookletNo})`,
          'OR Numbers': r.orNumbersDisplay,
          'Sub Category': 'Subtotal',
          'Main Category': '',
          'Account Code': '',
          'Amount (₱)': batchTotal
        });
      }
    });

    // Append Summary Row
    exportRows.push({
      '#': '' as any,
      'Collector Name': 'GRAND TOTAL',
      'Booklet No.': '',
      'OR Numbers': `${stagedTableRows.length} Line Items`,
      'Sub Category': '',
      'Main Category': '',
      'Account Code': '',
      'Amount (₱)': stagedTotalAmount
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Consolidated Report');
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Admin_Consolidated_Report_${dateStr}.xlsx`);

    setNotification({
      open: true,
      message: 'Consolidated report exported to Excel successfully!',
      severity: 'success'
    });
  };

  // Mark all currently staged booklet rows as Reported
  const handleConfirmMarkAsReported = async () => {
    if (stagedTableRows.length === 0) return;
    setIsSubmitting(true);

    try {
      // Group staged rows by (collectorKey + bookletNo + collectionType) to save clean batch reports
      const batchGroups = new Map<string, {
        collectorName: string;
        collectorEmail?: string;
        userId?: string;
        bookletNo: string;
        collectionType: 'general' | 'rpt';
        orNumbers: Set<string>;
        itemIds: Set<number>;
        subCategories: Map<string, AdminSubCategoryCharge>;
        totalAmount: number;
        dateFrom: string;
        dateTo: string;
      }>();

      stagedTableRows.forEach(row => {
        const groupKey = `${row.collectorKey}__${row.bookletNo}__${row.collectionType}`;
        const existing = batchGroups.get(groupKey) || {
          collectorName: row.collectorName,
          collectorEmail: row.collectorEmail,
          userId: row.userId,
          bookletNo: row.bookletNo,
          collectionType: row.collectionType,
          orNumbers: new Set<string>(),
          itemIds: new Set<number>(),
          subCategories: new Map<string, AdminSubCategoryCharge>(),
          totalAmount: 0,
          dateFrom: row.dateFrom || '',
          dateTo: row.dateTo || ''
        };

        row.orNumbers.forEach(or => existing.orNumbers.add(or));
        row.itemIds.forEach(id => existing.itemIds.add(id));
        existing.totalAmount += row.amount;

        const subKey = `${row.subCategory}__${row.accountCode}`;
        const subExisting = existing.subCategories.get(subKey) || {
          subCategory: row.subCategory,
          mainCategory: row.mainCategory,
          accountCode: row.accountCode,
          itemCount: 0,
          amount: 0
        };
        subExisting.itemCount += row.itemCount;
        subExisting.amount += row.amount;
        existing.subCategories.set(subKey, subExisting);

        if (row.dateFrom && (!existing.dateFrom || row.dateFrom < existing.dateFrom)) existing.dateFrom = row.dateFrom;
        if (row.dateTo && (!existing.dateTo || row.dateTo > existing.dateTo)) existing.dateTo = row.dateTo;

        batchGroups.set(groupKey, existing);
      });

      // Save each report batch
      for (const bg of Array.from(batchGroups.values())) {
        const orList = Array.from(bg.orNumbers);
        const reportNum = `ADM-${bg.bookletNo.replace(/[^A-Za-z0-9]/g, '')}-${Date.now().toString().slice(-6)}`;
        
        const newRecord: AdminSubmittedReportRecord = {
          id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          reportNumber: reportNum,
          collectorName: bg.collectorName,
          collectorEmail: bg.collectorEmail,
          userId: bg.userId,
          afNo: bg.bookletNo,
          orRange: formatOrRange(orList),
          orCount: orList.length,
          orNumbers: orList,
          itemIds: Array.from(bg.itemIds),
          collectionType: bg.collectionType,
          totalAmount: bg.totalAmount,
          subCategorySummary: Array.from(bg.subCategories.values()),
          submittedAt: new Date().toISOString(),
          submittedBy: user?.name || 'Administrator',
          status: 'Submitted',
          dateFrom: bg.dateFrom,
          dateTo: bg.dateTo
        };

        await saveAdminSubmittedReport(newRecord);
      }

      // Clear the staged table
      handleClearStagedTable();
      await loadData();

      setSubmitConfirmOpen(false);
      setNotification({
        open: true,
        message: `Successfully marked ${stagedTableRows.length} line items as Reported! These booklets are now archived and will no longer appear in the selection.`,
        severity: 'success'
      });
    } catch (err) {
      console.error('Error marking as reported', err);
      setNotification({
        open: true,
        message: 'Failed to mark records as reported.',
        severity: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Unmark / Reopen Submitted Report
  const handleConfirmUnmark = async () => {
    if (!reportToUnmark) return;
    try {
      await unmarkAdminSubmittedReport(
        reportToUnmark.id,
        reportToUnmark.itemIds,
        reportToUnmark.collectionType,
        reportToUnmark.afNo,
        reportToUnmark.orNumbers
      );
      await loadData();
      setUnmarkConfirmOpen(false);
      setReportToUnmark(null);
      setNotification({
        open: true,
        message: `Report ${reportToUnmark.reportNumber} reopened and returned to available booklet selection pool.`,
        severity: 'info'
      });
    } catch (err) {
      console.error('Error unmarking report:', err);
      setNotification({
        open: true,
        message: 'Failed to reopen report.',
        severity: 'error'
      });
    }
  };

  // Unique Collectors in Archive
  const uniqueArchiveCollectors = useMemo(() => {
    const set = new Set<string>();
    submittedReports.forEach(r => {
      if (r.collectorName) set.add(r.collectorName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [submittedReports]);

  // Filtered Submitted Reports (by Collector & Search Query)
  const filteredSubmittedReports = useMemo(() => {
    return submittedReports.filter(r => {
      if (archiveCollectorFilter && r.collectorName !== archiveCollectorFilter) {
        return false;
      }
      if (archiveSearchTerm.trim()) {
        const q = archiveSearchTerm.toLowerCase();
        const matchNo = r.reportNumber.toLowerCase().includes(q);
        const matchCollector = r.collectorName.toLowerCase().includes(q) || (r.collectorEmail || '').toLowerCase().includes(q);
        const matchAf = r.afNo.toLowerCase().includes(q);
        const matchOr = r.orRange.toLowerCase().includes(q);
        if (!matchNo && !matchCollector && !matchAf && !matchOr) return false;
      }
      return true;
    });
  }, [submittedReports, archiveCollectorFilter, archiveSearchTerm]);

  // Paginated Submitted Reports for Table Display
  const paginatedSubmittedReports = useMemo(() => {
    const start = archivePage * archiveRowsPerPage;
    return filteredSubmittedReports.slice(start, start + archiveRowsPerPage);
  }, [filteredSubmittedReports, archivePage, archiveRowsPerPage]);

  // Reset pagination page to 0 when filters change
  useEffect(() => {
    setArchivePage(0);
  }, [archiveCollectorFilter, archiveSearchTerm]);

  return (
    <Container maxWidth="xl" disableGutters>
      {/* Page Header Banner */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Typography variant="h5" fontWeight="800" sx={{ color: '#0f172a', letterSpacing: '-0.5px' }}>
              Admin Consolidated Reports
            </Typography>
            <Chip 
              icon={<AdminPanelSettings sx={{ fontSize: '15px !important' }} />}
              label="Admin Only" 
              size="small" 
              sx={{ bgcolor: '#e0f2fe', color: '#0284c7', fontWeight: 700, fontSize: '0.75rem', border: '1px solid #bae6fd' }} 
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            Select collectors, booklet numbers, and OR inclusions to compile consolidated reports, export to Excel, print, and mark as reported.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Tooltip title="Refresh and sync data from Supabase cloud" arrow>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Refresh />}
              onClick={loadData}
              disabled={loading}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 1.5,
                borderColor: '#cbd5e1',
                color: '#475569',
                '&:hover': { borderColor: '#0284c7', color: '#0284c7', bgcolor: '#f0f9ff' }
              }}
            >
              Refresh Data
            </Button>
          </Tooltip>
        </Stack>
      </Box>

      {/* Main Tabs: Active Collections Builder vs Submitted Reports Archive */}
      <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid #e2e8f0', overflow: 'hidden', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{
            bgcolor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            px: 2,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 48, fontSize: '0.9rem' }
          }}
        >
          <Tab 
            icon={<AssessmentOutlined sx={{ fontSize: 18 }} />} 
            iconPosition="start" 
            label={`Active Collections Builder (${availableCollectors.length} Collectors Available)`} 
          />
          <Tab 
            icon={<History sx={{ fontSize: 18 }} />} 
            iconPosition="start" 
            label={`Reported / Submitted Archive (${submittedReports.length})`} 
          />
        </Tabs>

        {/* ========================================================================= */}
        {/* TAB 0: ACTIVE COLLECTIONS BUILDER & INTERACTIVE TABLE                    */}
        {/* ========================================================================= */}
        {activeTab === 0 && (
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            {/* Step-by-Step Selection & Import Builder Panel */}
            <Card elevation={0} sx={{ borderRadius: 2, border: '1px solid #bae6fd', bgcolor: '#f0f9ff', mb: 3 }}>
              <CardContent sx={{ p: 2.5 }}>
                {/* Header & Date Range Filter Toolbar */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0369a1', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Layers sx={{ fontSize: 20 }} />
                      Select Collector & Booklet to Consolidate
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Filter collections by date range, or choose between individual booklet selection or Select All available booklets.
                    </Typography>
                  </Box>

                  {/* Date Range Filter */}
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      p: 1, 
                      px: 1.5, 
                      bgcolor: '#ffffff', 
                      borderRadius: 1.5, 
                      border: '1px solid #bae6fd', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1, 
                      flexWrap: 'wrap' 
                    }}
                  >
                    <CalendarMonth sx={{ fontSize: 18, color: '#0284c7' }} />
                    <Typography variant="caption" fontWeight="700" sx={{ color: '#0369a1' }}>
                      Date Filter:
                    </Typography>
                    <TextField
                      type="date"
                      size="small"
                      label="Date From"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: 140, '& .MuiInputBase-input': { py: 0.6, fontSize: '0.78rem' } }}
                    />
                    <Typography variant="caption" color="text.secondary">to</Typography>
                    <TextField
                      type="date"
                      size="small"
                      label="Date To"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: 140, '& .MuiInputBase-input': { py: 0.6, fontSize: '0.78rem' } }}
                    />
                    {(dateFrom || dateTo) && (
                      <Tooltip title="Clear Date Filter" arrow>
                        <IconButton 
                          size="small" 
                          onClick={() => { setDateFrom(''); setDateTo(''); }}
                          sx={{ bgcolor: '#f1f5f9', color: '#64748b', p: 0.5 }}
                        >
                          <Clear fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Paper>
                </Box>

                {/* Option 2 Banner: Select All Available Booklets */}
                <Box 
                  sx={{ 
                    mb: 2.5, 
                    p: 1.5, 
                    px: 2, 
                    bgcolor: '#ffffff', 
                    borderRadius: 1.5, 
                    border: '1px dashed #0284c7', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 1.5
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <SelectAll sx={{ color: '#0284c7', fontSize: 24 }} />
                    <Box>
                      <Typography variant="body2" fontWeight="800" sx={{ color: '#0f172a' }}>
                        Option 2: Select All Available Booklets
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Automatically adds all <strong>{totalAvailableUnstagedBooklets} available booklets</strong> {dateFrom || dateTo ? `within date range (${dateFrom || 'start'} to ${dateTo || 'present'})` : ''} to the table in one click.
                      </Typography>
                    </Box>
                  </Box>

                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<SelectAll />}
                    onClick={handleAddAllAvailableBooklets}
                    disabled={totalAvailableUnstagedBooklets === 0}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      py: 0.7,
                      px: 2,
                      borderRadius: 1.5,
                      bgcolor: '#0284c7',
                      '&:hover': { bgcolor: '#0369a1' }
                    }}
                  >
                    Select All ({totalAvailableUnstagedBooklets} Booklets)
                  </Button>
                </Box>

                <Divider sx={{ my: 2 }}>
                  <Chip label="OR Option 1: Select Specific Collector & Booklet" size="small" sx={{ fontWeight: 700, fontSize: '0.72rem', bgcolor: '#e0f2fe', color: '#0369a1' }} />
                </Divider>

                <Grid container spacing={2} alignItems="flex-start">
                  {/* 1. Collector Name Selector */}
                  <Grid size={{ xs: 12, md: 3.75 }}>
                    <Autocomplete
                      options={availableCollectors.map(c => c.name)}
                      value={selectedCollector}
                      onChange={(_, v) => {
                        setSelectedCollector(v);
                        setSelectedBooklet(null);
                        setOrFrom('');
                        setOrTo('');
                      }}
                      renderInput={(params) => (
                        <TextField 
                          {...params} 
                          label="1. Select Collector Name" 
                          size="small" 
                          placeholder="Choose collector..."
                          sx={{ bgcolor: '#ffffff', borderRadius: 1 }}
                        />
                      )}
                    />
                    {selectedCollector && (
                      <Typography variant="caption" sx={{ color: '#0284c7', display: 'block', mt: 0.5, fontWeight: 600 }}>
                        {availableBooklets.length} available booklets for {selectedCollector}
                      </Typography>
                    )}
                  </Grid>

                  {/* 2. Booklet No. (AF No.) Selector */}
                  <Grid size={{ xs: 12, sm: 6, md: 3.75 }}>
                    <Autocomplete
                      options={availableBooklets.map(b => b.bookletNo)}
                      value={selectedBooklet}
                      disabled={!selectedCollector || availableBooklets.length === 0}
                      onChange={(_, v) => {
                        setSelectedBooklet(v);
                        setOrFrom('');
                        setOrTo('');
                      }}
                      renderInput={(params) => (
                        <TextField 
                          {...params} 
                          label="2. Select Booklet No. (AF No.)" 
                          size="small" 
                          placeholder={!selectedCollector ? "Select collector first" : "Choose booklet..."}
                          sx={{ bgcolor: '#ffffff', borderRadius: 1 }}
                        />
                      )}
                    />
                    {selectedBooklet && (
                      <Typography variant="caption" sx={{ color: '#0284c7', display: 'block', mt: 0.5, fontWeight: 600 }}>
                        Booklet Range: {availableBooklets.find(b => b.bookletNo === selectedBooklet)?.orRange}
                      </Typography>
                    )}
                  </Grid>

                  {/* 3. OR Range Input Only (From & To) */}
                  <Grid size={{ xs: 12, sm: 6, md: 4.5 }}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Autocomplete
                        freeSolo
                        options={availableOrs}
                        value={orFrom}
                        disabled={!selectedBooklet || availableOrs.length === 0}
                        onInputChange={(_, v) => setOrFrom(v)}
                        onChange={(_, v) => setOrFrom(v || '')}
                        sx={{ flex: 1 }}
                        renderInput={(params) => (
                          <TextField 
                            {...params} 
                            label="3. OR Range: From" 
                            size="small" 
                            placeholder="From OR..."
                            sx={{ bgcolor: '#ffffff', borderRadius: 1 }}
                          />
                        )}
                      />

                      <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 700 }}>
                        to
                      </Typography>

                      <Autocomplete
                        freeSolo
                        options={availableOrs}
                        value={orTo}
                        disabled={!selectedBooklet || availableOrs.length === 0}
                        onInputChange={(_, v) => setOrTo(v)}
                        onChange={(_, v) => setOrTo(v || '')}
                        sx={{ flex: 1 }}
                        renderInput={(params) => (
                          <TextField 
                            {...params} 
                            label="OR Range: To" 
                            size="small" 
                            placeholder="To OR..."
                            sx={{ bgcolor: '#ffffff', borderRadius: 1 }}
                          />
                        )}
                      />
                    </Box>

                    {selectedBooklet && availableOrs.length > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
                        <Typography variant="caption" sx={{ color: '#0284c7', fontWeight: 600 }}>
                          Available: {availableOrs[0]} — {availableOrs[availableOrs.length - 1]} ({availableOrs.length} ORs)
                        </Typography>
                        <Chip 
                          label={`${includedOrsInRange.length} ORs Included`}
                          size="small"
                          sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 700 }}
                        />
                      </Box>
                    )}
                  </Grid>
                </Grid>

                {/* Add to Table Action Button */}
                <Box sx={{ mt: 2.5, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    startIcon={<AddCircleOutline />}
                    onClick={handleAddToTable}
                    disabled={!selectedCollector || !selectedBooklet || !orFrom.trim() || !orTo.trim()}
                    sx={{
                      bgcolor: '#0284c7',
                      color: '#ffffff',
                      textTransform: 'none',
                      fontWeight: 700,
                      px: 3,
                      py: 0.9,
                      borderRadius: 1.5,
                      boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
                      '&:hover': { bgcolor: '#0369a1' }
                    }}
                  >
                    Add Booklet Data to Table
                  </Button>
                </Box>
              </CardContent>
            </Card>

            {/* Consolidated Staged Table & Summary */}
            <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
              {/* Table Toolbar Header */}
              <Box sx={{ p: 2, px: 2.5, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0f172a' }}>
                    Consolidated Collections Table ({stagedTableRows.length} Line Items)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Review imported booklet records before exporting, printing, or marking as reported.
                  </Typography>
                </Box>

                {/* Main Action Buttons */}
                <Stack direction="row" spacing={1.5} flexWrap="wrap" gap={1}>
                  <Tooltip title="Export current consolidated table to Excel (.xlsx)" arrow>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<FileDownload />}
                      onClick={handleExportExcel}
                      disabled={stagedTableRows.length === 0}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        borderRadius: 1.5,
                        borderColor: '#0284c7',
                        color: '#0284c7',
                        '&:hover': { borderColor: '#0369a1', bgcolor: '#f0f9ff' }
                      }}
                    >
                      Export to Excel
                    </Button>
                  </Tooltip>

                  <Tooltip title="Print official consolidated summary report" arrow>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Print />}
                      onClick={() => setPrintDialogOpen(true)}
                      disabled={stagedTableRows.length === 0}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        borderRadius: 1.5,
                        borderColor: '#475569',
                        color: '#475569',
                        '&:hover': { borderColor: '#0f172a', bgcolor: '#f8fafc' }
                      }}
                    >
                      Print Report
                    </Button>
                  </Tooltip>

                  <Tooltip title="Mark all table entries as Reported (they will be archived and excluded from future booklet selections)" arrow>
                    <Button
                      variant="contained"
                      size="small"
                      color="success"
                      startIcon={<Send />}
                      onClick={() => setSubmitConfirmOpen(true)}
                      disabled={stagedTableRows.length === 0}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        borderRadius: 1.5,
                        bgcolor: '#16a34a',
                        '&:hover': { bgcolor: '#15803d' }
                      }}
                    >
                      Mark as Reported
                    </Button>
                  </Tooltip>

                  {stagedTableRows.length > 0 && (
                    <Tooltip title="Clear all staged rows from table" arrow>
                      <IconButton size="small" onClick={handleClearStagedTable} sx={{ bgcolor: '#fee2e2', color: '#ef4444' }}>
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </Box>

              {/* Table Search Filter */}
              {stagedTableRows.length > 0 && (
                <Box sx={{ p: 1.5, px: 2.5, bgcolor: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
                  <TextField
                    placeholder="Search in table (Collector, Booklet, OR, Sub Category...)"
                    size="small"
                    fullWidth
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search fontSize="small" color="action" />
                        </InputAdornment>
                      )
                    }}
                  />
                </Box>
              )}

              {/* Data Table */}
              <TableContainer sx={{ maxHeight: 480 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 800, color: '#334155', fontSize: '0.78rem' } }}>
                      <TableCell sx={{ width: 40 }}>#</TableCell>
                      <TableCell>Collector Name</TableCell>
                      <TableCell>Booklet No.</TableCell>
                      <TableCell>OR Numbers</TableCell>
                      <TableCell>Sub Category</TableCell>
                      <TableCell>Main Category</TableCell>
                      <TableCell>Account Code</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="center" sx={{ width: 60 }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredStagedRows.map((row, idx) => {
                      const isFirstRowOfBatch = idx === 0 || row.batchId !== filteredStagedRows[idx - 1].batchId;
                      const isLastRowOfBatch = idx === filteredStagedRows.length - 1 || row.batchId !== filteredStagedRows[idx + 1].batchId;
                      const batchTotal = batchTotalsMap.get(row.batchId) || row.amount;

                      return (
                        <React.Fragment key={row.id}>
                          <TableRow 
                            hover
                            sx={{ 
                              borderTop: isFirstRowOfBatch ? '2px solid #cbd5e1' : '1px solid #f1f5f9',
                              bgcolor: isFirstRowOfBatch ? '#ffffff' : '#fcfcfd'
                            }}
                          >
                            <TableCell sx={{ color: '#94a3b8', fontSize: '0.78rem' }}>{idx + 1}</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: '#0f172a' }}>
                              {isFirstRowOfBatch ? row.collectorName : ''}
                            </TableCell>
                            <TableCell>
                              {isFirstRowOfBatch ? (
                                <Chip 
                                  label={row.bookletNo} 
                                  size="small" 
                                  sx={{ fontWeight: 800, bgcolor: '#e0f2fe', color: '#0369a1', fontSize: '0.72rem' }} 
                                />
                              ) : null}
                            </TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', color: '#0284c7', fontWeight: 600, fontSize: '0.8rem' }}>
                              {isFirstRowOfBatch ? row.orNumbersDisplay : ''}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>
                              {row.subCategory}
                            </TableCell>
                            <TableCell sx={{ color: '#64748b', fontSize: '0.78rem' }}>
                              {row.mainCategory}
                            </TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#0369a1', bgcolor: '#f0f9ff', px: 0.8, py: 0.2, borderRadius: 0.5 }}>
                              {row.accountCode}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>
                              ₱ {row.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell align="center">
                              <Tooltip title="Remove row" arrow>
                                <IconButton size="small" color="error" onClick={() => handleRemoveStagedRow(row.id)}>
                                  <DeleteOutline fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>

                          {/* Total Row for Every Booklet */}
                          {isLastRowOfBatch && (
                            <TableRow sx={{ bgcolor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                              <TableCell sx={{ bgcolor: '#f1f5f9' }} />
                              <TableCell colSpan={3} sx={{ fontWeight: 800, color: '#0369a1', fontSize: '0.8rem', bgcolor: '#f1f5f9' }}>
                                Total Booklet ({row.bookletNo})
                              </TableCell>
                              <TableCell colSpan={3} sx={{ color: '#64748b', fontSize: '0.75rem', fontStyle: 'italic', bgcolor: '#f1f5f9' }}>
                                Subtotal for {row.orNumbersDisplay}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 800, color: '#0369a1', fontSize: '0.9rem', bgcolor: '#f1f5f9' }}>
                                ₱ {batchTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell sx={{ bgcolor: '#f1f5f9' }} />
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}

                    {stagedTableRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                            <PlaylistAddCheck sx={{ fontSize: 44, color: '#cbd5e1' }} />
                            <Typography variant="body1" fontWeight="700" color="text.secondary">
                              No booklet data imported into the table yet.
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 440 }}>
                              Use Step 1 above to select a collector, booklet number, and OR numbers, then click "Add Booklet Data to Table".
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Table Footer Summary */}
              {stagedTableRows.length > 0 && (
                <Box sx={{ p: 2, px: 3, bgcolor: '#f8fafc', borderTop: '2px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Total Rows: <strong>{filteredStagedRows.length}</strong> ({new Set(filteredStagedRows.map(r => r.collectorName)).size} Collectors, {new Set(filteredStagedRows.map(r => r.bookletNo)).size} Booklets)
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography variant="subtitle1" fontWeight="700" color="text.secondary">
                      GRAND TOTAL:
                    </Typography>
                    <Typography variant="h5" fontWeight="800" sx={{ color: '#0284c7' }}>
                      ₱ {stagedTotalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Paper>
          </Box>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: REPORTED / SUBMITTED ARCHIVE                                      */}
        {/* ========================================================================= */}
        {activeTab === 1 && (
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            {/* Archive Toolbar: Title, Collector Filter, Search */}
            <Box sx={{ mb: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0f172a' }}>
                  Reported / Submitted Archives ({filteredSubmittedReports.length} of {submittedReports.length})
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  These records have been marked as reported and are excluded from active booklet selections.
                </Typography>
              </Box>

              {/* Filters */}
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                {/* Search Bar */}
                <TextField
                  placeholder="Search archive (Report #, Collector, Booklet, OR...)"
                  size="small"
                  value={archiveSearchTerm}
                  onChange={(e) => setArchiveSearchTerm(e.target.value)}
                  sx={{ width: { xs: '100%', sm: 260 }, bgcolor: '#ffffff', borderRadius: 1 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: archiveSearchTerm ? (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setArchiveSearchTerm('')}>
                          <Clear fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ) : null
                  }}
                />

                {/* Collector Filter */}
                <Autocomplete
                  options={uniqueArchiveCollectors}
                  value={archiveCollectorFilter}
                  onChange={(_, v) => setArchiveCollectorFilter(v)}
                  sx={{ width: { xs: '100%', sm: 220 }, bgcolor: '#ffffff', borderRadius: 1 }}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="Filter by Collector" 
                      size="small" 
                      placeholder="All Collectors" 
                    />
                  )}
                />

                {/* Clear Filters Button */}
                {(archiveCollectorFilter || archiveSearchTerm) && (
                  <Button
                    variant="text"
                    size="small"
                    startIcon={<Clear />}
                    onClick={() => {
                      setArchiveCollectorFilter(null);
                      setArchiveSearchTerm('');
                    }}
                    sx={{ textTransform: 'none', color: '#64748b', fontWeight: 600 }}
                  >
                    Clear Filter
                  </Button>
                )}
              </Stack>
            </Box>

            {/* Archive Table */}
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 700, color: '#334155' } }}>
                    <TableCell>Report Number</TableCell>
                    <TableCell>Collector Name</TableCell>
                    <TableCell>Booklet No.</TableCell>
                    <TableCell>OR Range</TableCell>
                    <TableCell>Receipts</TableCell>
                    <TableCell>Date Period</TableCell>
                    <TableCell align="right">Total Collection</TableCell>
                    <TableCell>Reported Date</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedSubmittedReports.map((report) => (
                    <TableRow key={report.id} hover>
                      <TableCell sx={{ fontWeight: 800, color: '#0284c7', fontFamily: 'monospace' }}>
                        {report.reportNumber}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="700">
                          {report.collectorName}
                        </Typography>
                        {report.collectorEmail && (
                          <Typography variant="caption" color="text.secondary">
                            {report.collectorEmail}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={report.afNo} 
                          size="small" 
                          sx={{ fontWeight: 700, bgcolor: '#f0f9ff', color: '#0369a1', fontSize: '0.72rem' }} 
                        />
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                        {report.orRange}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={`${report.orCount} ORs`} 
                          size="small" 
                          sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#f1f5f9', fontWeight: 600 }} 
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', color: '#475569' }}>
                        {report.dateFrom || report.dateTo ? `${report.dateFrom} to ${report.dateTo}` : '-'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a' }}>
                        ₱ {report.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {new Date(report.submittedAt).toLocaleDateString()} {new Date(report.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          icon={<CheckCircleOutline sx={{ fontSize: '14px !important' }} />}
                          label={report.status}
                          size="small"
                          color="success"
                          sx={{ fontWeight: 700, fontSize: '0.72rem' }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="View Breakdown" arrow>
                            <IconButton 
                              size="small" 
                              color="primary"
                              onClick={() => {
                                setSelectedArchiveReport(report);
                                setViewDialogOpen(true);
                              }}
                              sx={{ bgcolor: '#f0f9ff' }}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Reopen / Return to Available Booklet Selection" arrow>
                            <IconButton 
                              size="small" 
                              color="warning"
                              onClick={() => {
                                setReportToUnmark(report);
                                setUnmarkConfirmOpen(true);
                              }}
                              sx={{ bgcolor: '#fffbeb' }}
                            >
                              <Unarchive fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}

                  {filteredSubmittedReports.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 5, color: '#94a3b8' }}>
                        {submittedReports.length === 0 
                          ? 'No reported/submitted batches archived yet.' 
                          : 'No archived reports match the current filter criteria.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Table Pagination */}
              <TablePagination
                rowsPerPageOptions={[10, 25, 50, 100]}
                component="div"
                count={filteredSubmittedReports.length}
                rowsPerPage={archiveRowsPerPage}
                page={archivePage}
                onPageChange={(_, newPage) => setArchivePage(newPage)}
                onRowsPerPageChange={(e) => {
                  setArchiveRowsPerPage(parseInt(e.target.value, 10));
                  setArchivePage(0);
                }}
                sx={{
                  borderTop: '1px solid #e2e8f0',
                  bgcolor: '#f8fafc',
                  '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }
                }}
              />
            </TableContainer>
          </Box>
        )}
      </Paper>

      {/* ========================================================================= */}
      {/* MARK AS REPORTED CONFIRMATION DIALOG                                     */}
      {/* ========================================================================= */}
      <Dialog
        open={submitConfirmOpen}
        onClose={() => !isSubmitting && setSubmitConfirmOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, p: 1 } }}
      >
        <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800, color: '#0f172a' }}>
          <CheckCircle color="success" />
          Mark Consolidated Table as Reported?
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5 }}>
          <Stack spacing={2}>
            <Alert severity="info" sx={{ borderRadius: 1.5 }}>
              Once marked as reported, all <strong>{stagedTableRows.length} line items</strong> will be archived and will <strong>no longer appear in the booklet / OR selection pool</strong> next time.
            </Alert>

            <Paper elevation={0} sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">Total Line Items</Typography>
                  <Typography variant="body2" fontWeight="700">{stagedTableRows.length} charges</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">Total Collectors</Typography>
                  <Typography variant="body2" fontWeight="700">{new Set(stagedTableRows.map(r => r.collectorName)).size}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">Total Booklets Included</Typography>
                  <Typography variant="body2" fontWeight="700">{new Set(stagedTableRows.map(r => r.bookletNo)).size}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">Total Amount to Report</Typography>
                  <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#16a34a' }}>
                    ₱ {stagedTotalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button 
            onClick={() => setSubmitConfirmOpen(false)} 
            disabled={isSubmitting}
            sx={{ textTransform: 'none', color: '#64748b' }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color="success"
            onClick={handleConfirmMarkAsReported} 
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {isSubmitting ? 'Processing...' : 'Confirm & Mark as Reported'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========================================================================= */}
      {/* ARCHIVE REPORT VIEW BREAKDOWN DIALOG                                     */}
      {/* ========================================================================= */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, p: 1 } }}
      >
        <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ReceiptLong color="primary" />
            <Box>
              <Typography variant="h6" fontWeight="800" sx={{ color: '#0f172a' }}>
                Archived Report Breakdown
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Report No: {selectedArchiveReport?.reportNumber} • Booklet: {selectedArchiveReport?.afNo}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setViewDialogOpen(false)} size="small" sx={{ bgcolor: '#f1f5f9' }}>
            <Clear fontSize="small" />
          </IconButton>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5 }}>
          {selectedArchiveReport && (
            <Stack spacing={2.5}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 4 }}>
                  <Typography variant="caption" color="text.secondary">Collector</Typography>
                  <Typography variant="body2" fontWeight="700">{selectedArchiveReport.collectorName}</Typography>
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <Typography variant="caption" color="text.secondary">OR Range</Typography>
                  <Typography variant="body2" fontWeight="700" color="primary.main">{selectedArchiveReport.orRange}</Typography>
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <Typography variant="caption" color="text.secondary">Total Collection</Typography>
                  <Typography variant="h6" fontWeight="800" sx={{ color: '#0284c7' }}>
                    ₱ {selectedArchiveReport.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </Typography>
                </Grid>
              </Grid>

              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 700 } }}>
                      <TableCell>#</TableCell>
                      <TableCell>Sub Category</TableCell>
                      <TableCell>Main Category</TableCell>
                      <TableCell>Account Code</TableCell>
                      <TableCell align="center">Items</TableCell>
                      <TableCell align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedArchiveReport.subCategorySummary.map((sub, i) => (
                      <TableRow key={i}>
                        <TableCell sx={{ color: '#94a3b8' }}>{i + 1}</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{sub.subCategory}</TableCell>
                        <TableCell>{sub.mainCategory}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', color: '#0369a1' }}>{sub.accountCode}</TableCell>
                        <TableCell align="center">{sub.itemCount}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          ₱ {(sub.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* PRINT OFFICIAL REPORT PREVIEW DIALOG                                     */}
      {/* ========================================================================= */}
      <Dialog
        open={printDialogOpen}
        onClose={() => setPrintDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, p: 2 } }}
      >
        <DialogTitle component="div" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight="800">
            Print Consolidated Report Preview
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              startIcon={<Print />}
              onClick={() => window.print()}
              sx={{ bgcolor: '#0284c7', textTransform: 'none', fontWeight: 700 }}
            >
              Print Report
            </Button>
            <IconButton onClick={() => setPrintDialogOpen(false)} sx={{ bgcolor: '#f1f5f9' }}>
              <Clear />
            </IconButton>
          </Stack>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ p: 4 }}>
          {/* Printable Report Header */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              Republic of the Philippines • Province of Romblon
            </Typography>
            <Typography variant="h6" fontWeight="800" sx={{ color: '#0f172a' }}>
              MUNICIPALITY OF CONCEPCION
            </Typography>
            <Typography variant="subtitle2" fontWeight="700" sx={{ color: '#0284c7' }}>
              OFFICE OF THE MUNICIPAL TREASURER
            </Typography>
            <Typography variant="h5" fontWeight="800" sx={{ mt: 2, color: '#0f172a' }}>
              CONSOLIDATED REPORT OF COLLECTIONS
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Generated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </Typography>
          </Box>

          {/* Staged Table in Print View */}
          <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #cbd5e1', borderRadius: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { bgcolor: '#f1f5f9', fontWeight: 800 } }}>
                  <TableCell>#</TableCell>
                  <TableCell>Collector Name</TableCell>
                  <TableCell>Booklet No.</TableCell>
                  <TableCell>OR Numbers</TableCell>
                  <TableCell>Sub Category</TableCell>
                  <TableCell>Main Category</TableCell>
                  <TableCell>Account Code</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stagedTableRows.map((r, idx) => {
                  const isFirstRowOfBatch = idx === 0 || r.batchId !== stagedTableRows[idx - 1].batchId;
                  const isLastRowOfBatch = idx === stagedTableRows.length - 1 || r.batchId !== stagedTableRows[idx + 1].batchId;
                  const batchTotal = batchTotalsMap.get(r.batchId) || r.amount;

                  return (
                    <React.Fragment key={idx}>
                      <TableRow sx={{ borderTop: isFirstRowOfBatch ? '1.5px solid #94a3b8' : '1px solid #e2e8f0' }}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{isFirstRowOfBatch ? r.collectorName : ''}</TableCell>
                        <TableCell>{isFirstRowOfBatch ? r.bookletNo : ''}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{isFirstRowOfBatch ? r.orNumbersDisplay : ''}</TableCell>
                        <TableCell>{r.subCategory}</TableCell>
                        <TableCell>{r.mainCategory}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{r.accountCode}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          ₱ {r.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>

                      {/* Booklet Total Row in Print Preview */}
                      {isLastRowOfBatch && (
                        <TableRow sx={{ bgcolor: '#f1f5f9', borderBottom: '2px solid #94a3b8' }}>
                          <TableCell />
                          <TableCell colSpan={3} sx={{ fontWeight: 800, fontSize: '0.82rem' }}>
                            Total Booklet ({r.bookletNo})
                          </TableCell>
                          <TableCell colSpan={3} sx={{ fontSize: '0.78rem', color: '#64748b' }}>
                            Subtotal for {r.orNumbersDisplay}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>
                            ₱ {batchTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #bae6fd' }}>
            <Typography variant="h6" fontWeight="800" sx={{ color: '#0284c7' }}>
              GRAND TOTAL: ₱ {stagedTotalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Unmark / Reopen */}
      <ConfirmDialog
        open={unmarkConfirmOpen}
        title="Reopen Submitted Report?"
        message={`Are you sure you want to reopen report ${reportToUnmark?.reportNumber} for ${reportToUnmark?.collectorName}? It will return to the active available booklet selection pool.`}
        confirmText="Reopen Report"
        severity="warning"
        onConfirm={handleConfirmUnmark}
        onClose={() => {
          setUnmarkConfirmOpen(false);
          setReportToUnmark(null);
        }}
      />

      <Notification
        open={notification.open}
        message={notification.message}
        severity={notification.severity}
        onClose={handleCloseNotification}
      />
    </Container>
  );
};
