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
  TableFooter,
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
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  Checkbox
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
  AddCircleOutline,
  FileDownload,
  DeleteOutline,
  PlaylistAddCheck,
  Send,
  Layers,
  SelectAll,
  CalendarMonth,
  TableChart,
  ViewList,
  Summarize,
  AccountBalance
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
  getBankDeposits,
  type BankDepositRecord,
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
  reportNo?: string;
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

// 8 Barangay Keys for Water Charges
export type WaterBarangayKey = 
  | 'poblacion'
  | 'san_pedro'
  | 'calabasahan'
  | 'sampong'
  | 'bakhawan'
  | 'masudsud'
  | 'dalajican'
  | 'san_vicente';

// Detect whether a collection entry represents a barangay waterworks charge
export const detectWaterBarangay = (subCategory?: string, mainCategory?: string): WaterBarangayKey | null => {
  const s = `${subCategory || ''} ${mainCategory || ''}`.toLowerCase();
  if (!s.includes('water')) return null;

  // Exclude surcharge, installation, reconnection if they don't designate a specific barangay
  const hasBrgy = 
    s.includes('poblacion') || 
    s.includes('san pedro') || 
    s.includes('sanpedro') || 
    s.includes('calabasahan') || 
    s.includes('sampong') || 
    s.includes('bakhawan') || 
    s.includes('bachawan') || 
    s.includes('masudsud') || 
    s.includes('dalajican') || 
    s.includes('san vicente') || 
    s.includes('sanvicente');

  if (!hasBrgy) return null;

  if (s.includes('poblacion')) return 'poblacion';
  if (s.includes('san pedro') || s.includes('sanpedro')) return 'san_pedro';
  if (s.includes('calabasahan')) return 'calabasahan';
  if (s.includes('sampong')) return 'sampong';
  if (s.includes('bakhawan') || s.includes('bachawan')) return 'bakhawan';
  if (s.includes('masudsud')) return 'masudsud';
  if (s.includes('dalajican')) return 'dalajican';
  if (s.includes('san vicente') || s.includes('sanvicente')) return 'san_vicente';

  return null;
};

/**
 * Format booklet display with form type and number:
 * For collections: AF51(Booklet No.) [or AF51 if no specific booklet number]
 * For RPT collections: AF56(Booklet No.) [or AF56 if no specific booklet number]
 */
export const formatBookletDisplay = (bookletNo?: string | null, collectionType?: 'general' | 'rpt'): string => {
  if (!bookletNo) {
    return collectionType === 'rpt' ? 'AF56' : 'AF51';
  }
  const raw = String(bookletNo).trim();
  if (!raw) {
    return collectionType === 'rpt' ? 'AF56' : 'AF51';
  }

  // Determine prefix: AF56 for RPT collections, AF51 for general collections
  const isRpt = collectionType === 'rpt' || /56/i.test(raw) || /rpt/i.test(raw);
  const prefix = isRpt ? 'AF56' : 'AF51';

  // If already in AF51(...) or AF56(...) format, normalize prefix case
  const exactParenMatch = raw.match(/^AF5[16]\((.+)\)$/i);
  if (exactParenMatch) {
    return `${prefix}(${exactParenMatch[1].trim()})`;
  }

  // Extract clean number
  let cleanNo = raw;
  const parenMatch = raw.match(/\(([^)]+)\)/);
  if (parenMatch) {
    cleanNo = parenMatch[1].trim();
  } else {
    cleanNo = cleanNo
      .replace(/^A\.?F\.?\s*(?:NO\.?)?\s*5[16]\s*[:-]?\s*/i, '')
      .replace(/^AF\s*5[16]\s*[:-]?\s*/i, '')
      .replace(/^Booklet\s*(?:NO\.?)?\s*[:-]?\s*/i, '')
      .replace(/^No\.?\s*[:-]?\s*/i, '')
      .trim();
  }

  // If cleanNo is empty, just '51', '56', or original generic label, return just prefix
  const upper = raw.toUpperCase();
  if (!cleanNo || cleanNo === '51' || cleanNo === '56' || upper === 'A.F. NO. 51' || upper === 'A.F. NO. 56' || upper === 'AF51' || upper === 'AF56') {
    return prefix;
  }

  return `${prefix}(${cleanNo})`;
};

/**
 * Strip leading zeroes from an individual OR number:
 * e.g., "00010901" -> "10901", "0000" -> "0"
 */
export const stripLeadingZeroes = (orNo?: string | null): string => {
  if (!orNo) return '';
  const trimmed = String(orNo).trim();
  // Handle any alphanumeric prefix like "OR-00010901"
  const prefixMatch = trimmed.match(/^([A-Za-z]+[-#\s]*)0+(\d+.*)$/);
  if (prefixMatch) {
    return `${prefixMatch[1]}${prefixMatch[2]}`;
  }
  // Standard pure number or starting with zeroes: "00010901" -> "10901"
  const stripped = trimmed.replace(/^0+/, '');
  return stripped || '0';
};

/**
 * Clean any leading zeroes from an OR range or display string:
 * e.g., "00010901 — 00010910 (10 ORs)" -> "10901 — 10910 (10 ORs)"
 * e.g., "00010901 - 00010910" -> "10901 - 10910"
 * e.g., "00010901" -> "10901"
 */
export const cleanOrDisplay = (display?: string | null): string => {
  if (!display) return '';
  return String(display).replace(/\b0+(\d+)\b/g, '$1');
};

/** Round a number to exactly 2 decimal places using symmetric rounding */
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Format a number as Philippine Peso with exactly 2 decimal places */
export const formatPeso = (n: number): string => round2(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Identify if a charge item belongs to Real Property Tax (RPT)
export const isRptCharge = (row: { collectionType?: string; bookletNo?: string; subCategory?: string; mainCategory?: string }): boolean => {
  if (row.collectionType === 'rpt') return true;
  if (row.bookletNo && (row.bookletNo.includes('56') || row.bookletNo.includes('AF56'))) return true;
  const sub = (row.subCategory || '').toLowerCase();
  const main = (row.mainCategory || '').toLowerCase();
  if (sub.includes('real property') || sub.includes('rpt') || main.includes('property')) return true;
  return false;
};

// Real Property Tax is divided 50/50 between General Fund (Basic) and Special Education Fund (SEF).
// This returns the General Fund portion only with exact centavo precision.
export const getRptGeneralAmount = (amount: number): number => {
  const totalCents = Math.round((amount || 0) * 100);
  const basicCents = Math.ceil(totalCents / 2);
  return basicCents / 100;
};

// Compute the next sequential report number from a given report number string
export const computeNextReportNo = (prev?: string | null): string => {
  if (!prev || !prev.trim()) {
    const yy = new Date().getFullYear().toString().slice(-2);
    const mm = (new Date().getMonth() + 1).toString().padStart(2, '0');
    return `${yy}-${mm}-001`;
  }
  const trimmed = prev.trim();
  // Match trailing sequence of digits, e.g. "26-03-005" -> prefix "26-03-", digits "005"
  const match = trimmed.match(/^(.*?)(\d+)$/);
  if (match) {
    const prefix = match[1];
    const digits = match[2];
    const nextVal = parseInt(digits, 10) + 1;
    const nextDigits = String(nextVal).padStart(digits.length, '0');
    return `${prefix}${nextDigits}`;
  }
  // If no trailing digits, match any sequence of digits inside
  const anyMatch = trimmed.match(/^(.*?)(\d+)(.*?)$/);
  if (anyMatch) {
    const prefix = anyMatch[1];
    const digits = anyMatch[2];
    const suffix = anyMatch[3];
    const nextVal = parseInt(digits, 10) + 1;
    const nextDigits = String(nextVal).padStart(digits.length, '0');
    return `${prefix}${nextDigits}${suffix}`;
  }
  return `${trimmed}-1`;
};

// Row item for the Waterworks & RPT Matrix
export interface MatrixReportRow {
  key: string;
  batchId: string;
  rowNumber: number | string;
  collectorName: string;
  bookletNo: string;
  orNumbersDisplay: string;
  reportNo: string; // Report No. per Booklet
  poblacion: number | '';
  sanPedro: number | '';
  calabasahanSpring: number | '';
  calabasahanPump: number | '';
  sampongSpring: number | '';
  sampongPump: number | '';
  bakhawan: number | '';
  masudsud: number | '';
  dalajican: number | '';
  sanVicente: number | '';
  rpt: number | '';
  subCategory: string;
  mainCategory: string;
  accountCode: string;
  amount: number;
  isSubtotal?: boolean;
}

// Compute matrix rows and column totals with 50/50 Spring & Pump division for Calabasahan & Sampong
export const computeMatrixRows = (rows: StagedReportRow[]) => {
  const batchOrder: string[] = [];
  const batchMap = new Map<string, StagedReportRow[]>();
  rows.forEach(r => {
    if (!batchMap.has(r.batchId)) {
      batchOrder.push(r.batchId);
      batchMap.set(r.batchId, []);
    }
    batchMap.get(r.batchId)!.push(r);
  });

  const matrixRows: MatrixReportRow[] = [];
  let grandPoblacion = 0;
  let grandSanPedro = 0;
  let grandCalSpring = 0;
  let grandCalPump = 0;
  let grandSamSpring = 0;
  let grandSamPump = 0;
  let grandBakhawan = 0;
  let grandMasudsud = 0;
  let grandDalajican = 0;
  let grandSanVicente = 0;
  let grandRpt = 0;
  let grandTotal = 0;

  batchOrder.forEach((batchId, batchIdx) => {
    const bRows = batchMap.get(batchId)!;
    const primary = bRows[0];
    const formattedBooklet = formatBookletDisplay(primary.bookletNo, primary.collectionType);
    const cleanOrNumbers = cleanOrDisplay(primary.orNumbersDisplay);
    const bookletReportNo = primary.reportNo || '';

    const waterAmounts: Record<WaterBarangayKey, number> = {
      poblacion: 0,
      san_pedro: 0,
      calabasahan: 0,
      sampong: 0,
      bakhawan: 0,
      masudsud: 0,
      dalajican: 0,
      san_vicente: 0
    };
    let hasWaterCharges = false;
    let totalWaterAmount = 0;

    let totalRptGeneralAmount = 0;
    let hasRptCharges = false;
    let rptAccountCode = '01-01-02-01';

    const sundryRows: StagedReportRow[] = [];

    bRows.forEach(r => {
      const brgy = detectWaterBarangay(r.subCategory, r.mainCategory);
      if (brgy) {
        waterAmounts[brgy] += r.amount;
        totalWaterAmount += r.amount;
        hasWaterCharges = true;
      } else if (isRptCharge(r)) {
        const genAmt = getRptGeneralAmount(r.amount);
        totalRptGeneralAmount += genAmt;
        hasRptCharges = true;
        if (r.accountCode && r.accountCode !== '-') {
          rptAccountCode = r.accountCode;
        }
      } else {
        sundryRows.push(r);
      }
    });

    // Spring & Pump divisions (divide total barangay collection by 2 with centavo precision)
    const calTotal = waterAmounts.calabasahan;
    const calSpring = calTotal > 0 ? Math.round((calTotal / 2) * 100) / 100 : 0;
    const calPump = calTotal > 0 ? Math.round((calTotal - calSpring) * 100) / 100 : 0;

    const samTotal = waterAmounts.sampong;
    const samSpring = samTotal > 0 ? Math.round((samTotal / 2) * 100) / 100 : 0;
    const samPump = samTotal > 0 ? Math.round((samTotal - samSpring) * 100) / 100 : 0;

    // Accumulate grand totals
    grandPoblacion += waterAmounts.poblacion;
    grandSanPedro += waterAmounts.san_pedro;
    grandCalSpring += calSpring;
    grandCalPump += calPump;
    grandSamSpring += samSpring;
    grandSamPump += samPump;
    grandBakhawan += waterAmounts.bakhawan;
    grandMasudsud += waterAmounts.masudsud;
    grandDalajican += waterAmounts.dalajican;
    grandSanVicente += waterAmounts.san_vicente;
    grandRpt += totalRptGeneralAmount;

    let isFirstRowOfBooklet = true;

    // 1. Water Charges Row
    if (hasWaterCharges) {
      matrixRows.push({
        key: `matrix_${batchId}_water`,
        batchId,
        rowNumber: batchIdx + 1,
        collectorName: primary.collectorName,
        bookletNo: formattedBooklet,
        orNumbersDisplay: cleanOrNumbers,
        reportNo: bookletReportNo,
        poblacion: waterAmounts.poblacion || '',
        sanPedro: waterAmounts.san_pedro || '',
        calabasahanSpring: calSpring || '',
        calabasahanPump: calPump || '',
        sampongSpring: samSpring || '',
        sampongPump: samPump || '',
        bakhawan: waterAmounts.bakhawan || '',
        masudsud: waterAmounts.masudsud || '',
        dalajican: waterAmounts.dalajican || '',
        sanVicente: waterAmounts.san_vicente || '',
        rpt: '',
        subCategory: '',
        mainCategory: '',
        accountCode: '',
        amount: totalWaterAmount
      });
      grandTotal += totalWaterAmount;
      isFirstRowOfBooklet = false;
    }

    // 2. RPT Charges Row (General Amount only)
    if (hasRptCharges) {
      matrixRows.push({
        key: `matrix_${batchId}_rpt`,
        batchId,
        rowNumber: isFirstRowOfBooklet ? batchIdx + 1 : '',
        collectorName: isFirstRowOfBooklet ? primary.collectorName : '',
        bookletNo: isFirstRowOfBooklet ? formattedBooklet : '',
        orNumbersDisplay: isFirstRowOfBooklet ? cleanOrNumbers : '',
        reportNo: isFirstRowOfBooklet ? bookletReportNo : '',
        poblacion: '',
        sanPedro: '',
        calabasahanSpring: '',
        calabasahanPump: '',
        sampongSpring: '',
        sampongPump: '',
        bakhawan: '',
        masudsud: '',
        dalajican: '',
        sanVicente: '',
        rpt: totalRptGeneralAmount || '',
        subCategory: '',
        mainCategory: 'Tax Revenue - Property',
        accountCode: rptAccountCode,
        amount: totalRptGeneralAmount
      });
      grandTotal += totalRptGeneralAmount;
      isFirstRowOfBooklet = false;
    }

    // 3. Sundry charges in the same booklet
    sundryRows.forEach((sr, sIdx) => {
      matrixRows.push({
        key: `matrix_${batchId}_sundry_${sIdx}`,
        batchId,
        rowNumber: isFirstRowOfBooklet ? batchIdx + 1 : '',
        collectorName: isFirstRowOfBooklet ? primary.collectorName : '',
        bookletNo: isFirstRowOfBooklet ? formattedBooklet : '',
        orNumbersDisplay: isFirstRowOfBooklet ? cleanOrNumbers : '',
        reportNo: isFirstRowOfBooklet ? bookletReportNo : '',
        poblacion: '',
        sanPedro: '',
        calabasahanSpring: '',
        calabasahanPump: '',
        sampongSpring: '',
        sampongPump: '',
        bakhawan: '',
        masudsud: '',
        dalajican: '',
        sanVicente: '',
        rpt: '',
        subCategory: sr.subCategory,
        mainCategory: sr.mainCategory,
        accountCode: sr.accountCode,
        amount: sr.amount
      });
      grandTotal += sr.amount;
      isFirstRowOfBooklet = false;
    });
  });

  return {
    rows: matrixRows,
    totals: {
      poblacion: grandPoblacion,
      sanPedro: grandSanPedro,
      calSpring: grandCalSpring,
      calPump: grandCalPump,
      samSpring: grandSamSpring,
      samPump: grandSamPump,
      bakhawan: grandBakhawan,
      masudsud: grandMasudsud,
      dalajican: grandDalajican,
      sanVicente: grandSanVicente,
      rpt: grandRpt,
      grandTotal: grandTotal,
      bookletCount: batchOrder.length
    }
  };
};

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

  // Table View Mode: 'matrix' (Waterworks matrix layout) or 'standard' (Itemized list)
  const [tableViewMode, setTableViewMode] = useState<'matrix' | 'standard'>('matrix');
  const [printViewMode, setPrintViewMode] = useState<'matrix' | 'standard' | 'recap' | 'balances'>('matrix');
  const [recapLayoutMode, setRecapLayoutMode] = useState<'auto' | 'two-column' | 'single-column'>('auto');
  const [bankDeposits, setBankDeposits] = useState<BankDepositRecord[]>([]);

  // Archive Tab Filtering & Pagination State
  const [archiveCollectorFilter, setArchiveCollectorFilter] = useState<string | null>(null);
  const [archiveSearchTerm, setArchiveSearchTerm] = useState<string>('');
  const [archivePage, setArchivePage] = useState<number>(0);
  const [archiveRowsPerPage, setArchiveRowsPerPage] = useState<number>(10);

  // Submit Confirmation Dialog
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [beginningBalanceInput, setBeginningBalanceInput] = useState<number>(0);
  const [selectedDepositIds, setSelectedDepositIds] = useState<string[]>([]);


  // Print Preview Dialog State
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printingReport, setPrintingReport] = useState<AdminSubmittedReportRecord | null>(null);

  // Unmark Confirm State
  const [unmarkConfirmOpen, setUnmarkConfirmOpen] = useState(false);
  const [reportToUnmark, setReportToUnmark] = useState<AdminSubmittedReportRecord | null>(null);

  // Starting Report No Dialog State (asks for starting Report No. on first booklet added)
  const [startReportNoDialogOpen, setStartReportNoDialogOpen] = useState(false);
  const [startingReportNoInput, setStartingReportNoInput] = useState('');
  const [pendingAddType, setPendingAddType] = useState<'single' | 'all' | null>(null);

  // Inline Report No. editing state for table
  const [editingReportNoBatchId, setEditingReportNoBatchId] = useState<string | null>(null);
  const [editingReportNoValue, setEditingReportNoValue] = useState<string>('');

  // Find previous booklet report number across archives or localStorage
  const findPreviousReportNo = (): string => {
    // 1. Check local storage key
    const savedLast = localStorage.getItem('rcd_last_booklet_report_no');
    if (savedLast && savedLast.trim()) return savedLast.trim();

    // 2. Check submittedReports in archive
    for (const report of submittedReports) {
      if (report.stagedRows && Array.isArray(report.stagedRows)) {
        for (const sr of report.stagedRows) {
          if (sr.reportNo && sr.reportNo.trim()) {
            return sr.reportNo.trim();
          }
        }
      }
      if (report.reportNumber && !report.reportNumber.startsWith('ADM-CONSOL')) {
        const clean = report.reportNumber.replace(/^ADM-/, '');
        if (/\d+/.test(clean)) return clean;
      }
    }

    // 3. Fallback: formatted current year-month-000 so next is 001
    const yy = new Date().getFullYear().toString().slice(-2);
    const mm = (new Date().getMonth() + 1).toString().padStart(2, '0');
    return `${yy}-${mm}-000`;
  };

  // Helper to get the last report number currently in the staged table
  const getLastReportNoFromTable = (): string => {
    for (let i = stagedTableRows.length - 1; i >= 0; i--) {
      if (stagedTableRows[i].reportNo && stagedTableRows[i].reportNo?.trim()) {
        return stagedTableRows[i].reportNo!.trim();
      }
    }
    return findPreviousReportNo();
  };

  const handleStartEditReportNo = (batchId: string, currentReportNo: string) => {
    setEditingReportNoBatchId(batchId);
    setEditingReportNoValue(currentReportNo || '');
  };

  const handleSaveEditReportNo = (batchId: string) => {
    const trimmed = editingReportNoValue.trim();
    if (trimmed) {
      setStagedTableRows(prev => prev.map(r => r.batchId === batchId ? { ...r, reportNo: trimmed } : r));
      localStorage.setItem('rcd_last_booklet_report_no', trimmed);
    }
    setEditingReportNoBatchId(null);
  };

  // Find the previous report ending balance across archive or localStorage
  const previousReportEndingBalance = useMemo(() => {
    if (submittedReports.length > 0) {
      for (const r of submittedReports) {
        if (typeof r.endingBalance === 'number') {
          return r.endingBalance;
        }
      }
    }
    const saved = localStorage.getItem('rcd_last_ending_balance');
    return saved ? Number(saved) : 0;
  }, [submittedReports]);

  // Unreported bank deposits: exclude any that are flagged isReported, have a reportId,
  // OR whose ID appears in any already-submitted report's selectedDepositIds
  const unreportedDeposits = useMemo(() => {
    const alreadyUsedIds = new Set<string>();
    submittedReports.forEach(r => {
      if (Array.isArray(r.selectedDepositIds)) {
        r.selectedDepositIds.forEach(id => alreadyUsedIds.add(id));
      }
    });
    return bankDeposits.filter(d =>
      !d.isReported &&
      !d.reportId &&
      !alreadyUsedIds.has(d.id)
    );
  }, [bankDeposits, submittedReports]);

  // Open "Mark as Reported" modal with default Beginning Balance and all unreported deposits selected
  const handleOpenMarkAsReported = () => {
    if (stagedTableRows.length === 0) return;
    setBeginningBalanceInput(previousReportEndingBalance);
    setSelectedDepositIds(unreportedDeposits.map(d => d.id));
    setSubmitConfirmOpen(true);
  };

  // Save staged rows to localStorage whenever updated
  useEffect(() => {
    try {
      localStorage.setItem('rcd_admin_staged_rows', JSON.stringify(stagedTableRows));
    } catch {}
  }, [stagedTableRows]);

  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

  // Helper to retrieve or synthesize StagedReportRows for an archived report
  const getRowsForReport = (report: AdminSubmittedReportRecord): StagedReportRow[] => {
    if (report.stagedRows && Array.isArray(report.stagedRows) && report.stagedRows.length > 0) {
      return report.stagedRows;
    }

    // Check if other archived reports were submitted together at the same time / batch (for older reports split per booklet)
    const sameBatchReports = submittedReports.filter(r => 
      r.submittedAt === report.submittedAt && 
      r.submittedBy === report.submittedBy
    );
    if (sameBatchReports.length > 1) {
      const combinedRows: StagedReportRow[] = [];
      sameBatchReports.forEach(sb => {
        if (sb.stagedRows && Array.isArray(sb.stagedRows) && sb.stagedRows.length > 0) {
          combinedRows.push(...sb.stagedRows);
        } else {
          const batchId = `archived_batch_${sb.id}`;
          sb.subCategorySummary.forEach((sub, idx) => {
            combinedRows.push({
              id: `archived_row_${sb.id}_${idx}`,
              batchId,
              collectorKey: sb.collectorEmail || sb.userId || sb.collectorName,
              collectorName: sb.collectorName,
              collectorEmail: sb.collectorEmail,
              userId: sb.userId,
              bookletNo: formatBookletDisplay(sb.afNo, sb.collectionType),
              collectionType: sb.collectionType,
              orNumbers: sb.orNumbers,
              orNumbersDisplay: cleanOrDisplay(sb.orRange),
              subCategory: sub.subCategory,
              mainCategory: sub.mainCategory || 'Tax Revenue',
              accountCode: sub.accountCode,
              amount: sub.amount,
              itemCount: sub.itemCount,
              itemIds: [],
              dateFrom: sb.dateFrom,
              dateTo: sb.dateTo
            });
          });
        }
      });
      if (combinedRows.length > 0) return combinedRows;
    }

    // Synthesize structured staged rows from subCategorySummary
    const batchId = `archived_batch_${report.id}`;
    return report.subCategorySummary.map((sub, idx) => ({
      id: `archived_row_${report.id}_${idx}`,
      batchId,
      collectorKey: report.collectorEmail || report.userId || report.collectorName,
      collectorName: report.collectorName,
      collectorEmail: report.collectorEmail,
      userId: report.userId,
      bookletNo: formatBookletDisplay(report.afNo, report.collectionType),
      collectionType: report.collectionType,
      orNumbers: report.orNumbers,
      orNumbersDisplay: cleanOrDisplay(report.orRange),
      subCategory: sub.subCategory,
      mainCategory: sub.mainCategory || 'Tax Revenue',
      accountCode: sub.accountCode,
      amount: sub.amount,
      itemCount: sub.itemCount,
      itemIds: [],
      dateFrom: report.dateFrom,
      dateTo: report.dateTo
    }));
  };

  // Open Report Print Modal (Matrix layout)
  const handlePrintReport = (report?: AdminSubmittedReportRecord) => {
    setPrintingReport(report || null);
    setPrintViewMode('matrix');
    setPrintDialogOpen(true);
  };

  // Open Recapitulation Print Modal (RCD layout)
  const handlePrintRecap = (report?: AdminSubmittedReportRecord) => {
    setPrintingReport(report || null);
    setPrintViewMode('recap');
    setPrintDialogOpen(true);
  };

  // Open Balances, Deposits & Collections Print Modal
  const handlePrintBalances = (report?: AdminSubmittedReportRecord) => {
    setPrintingReport(report || null);
    setPrintViewMode('balances');
    setPrintDialogOpen(true);
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

  // Helper for computing OR Range display string without leading zeroes
  const formatOrRange = (orList: string[]): string => {
    if (orList.length === 0) return 'None';
    const cleaned = orList.map(stripLeadingZeroes).filter(Boolean);
    if (cleaned.length === 0) return 'None';
    if (cleaned.length === 1) return cleaned[0];
    const sorted = [...cleaned].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return `${sorted[0]} — ${sorted[sorted.length - 1]} (${sorted.length} ORs)`;
  };

  // Helper to test if an OR number falls within [from, to] range (handles leading zeroes flexibly)
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
    const cleanFrom = stripLeadingZeroes(from);
    const cleanTo = stripLeadingZeroes(to);
    const cleanOr = stripLeadingZeroes(or);
    const minStr = cleanFrom.localeCompare(cleanTo, undefined, { numeric: true }) <= 0 ? cleanFrom : cleanTo;
    const maxStr = cleanFrom.localeCompare(cleanTo, undefined, { numeric: true }) <= 0 ? cleanTo : cleanFrom;
    return cleanOr.localeCompare(minStr, undefined, { numeric: true }) >= 0 && cleanOr.localeCompare(maxStr, undefined, { numeric: true }) <= 0;
  };

  // Load all initial data from Supabase / local caches
  const loadData = async () => {
    setLoading(true);
    try {
      const [genData, rptData, managedUsers, submittedKeys, subReports, depositRecords] = await Promise.all([
        getCollectionEntries(),
        getRPTCollections(),
        getAllManagedUsers().catch(() => []),
        getSubmittedItemIds().catch(() => new Set<string>()),
        getAdminSubmittedReports().catch(() => []),
        getBankDeposits().catch(() => [])
      ]);

      setGeneralCollections(genData);
      setRptCollections(rptData);
      setSubmittedItemKeys(submittedKeys);
      setSubmittedReports(subReports);
      setBankDeposits(depositRecords);

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
      const bNo = formatBookletDisplay(item.afNo, 'general');

      list.push({
        id: item.id,
        type: 'general',
        collectorKey,
        collectorName: cName,
        collectorEmail: item.collectorEmail,
        userId: item.userId,
        bookletNo: bNo,
        orNo: stripLeadingZeroes(item.orNo || ''),
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
      const bNo = formatBookletDisplay(item.af56Id, 'rpt');

      list.push({
        id: item.id,
        type: 'rpt',
        collectorKey,
        collectorName: cName,
        collectorEmail: item.collectorEmail,
        userId: item.userId,
        bookletNo: bNo,
        orNo: stripLeadingZeroes(item.orNumber || ''),
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
          set.add(stripLeadingZeroes(item.orNo));
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
  const executeAddAllBooklets = (startingReportNo: string) => {
    const unstagedItems = filteredActiveItems.filter(item => !stagedItemKeys.has(`${item.type}_${item.id}`));
    if (unstagedItems.length === 0) return;

    const bookletGroups = new Map<string, {
      collectorName: string;
      collectorKey: string;
      collectorEmail?: string;
      userId?: string;
      bookletNo: string;
      collectionType: 'general' | 'rpt';
      items: UnifiedCollectionItem[];
    }>();

    unstagedItems.forEach(item => {
      const groupKey = `${item.collectorName}__${item.bookletNo}__${item.type}`;
      const existing = bookletGroups.get(groupKey) || {
        collectorName: item.collectorName,
        collectorKey: item.collectorKey,
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
    let currentReportNo = startingReportNo;

    Array.from(bookletGroups.values()).forEach((bg, index) => {
      const bookletReportNo = index === 0 ? startingReportNo : computeNextReportNo(currentReportNo);
      currentReportNo = bookletReportNo;

      const batchId = `batch_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`;
      const ors = Array.from(new Set(bg.items.map(i => stripLeadingZeroes(i.orNo)))).filter(Boolean);
      const orRangeDisplay = formatOrRange(ors);

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
          bookletNo: formatBookletDisplay(bg.bookletNo, bg.collectionType),
          reportNo: bookletReportNo,
          collectionType: bg.collectionType,
          orNumbers: ors,
          orNumbersDisplay: cleanOrDisplay(orRangeDisplay),
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
    localStorage.setItem('rcd_last_booklet_report_no', currentReportNo);

    setSelectedCollector(null);
    setSelectedBooklet(null);
    setOrFrom('');
    setOrTo('');

    setNotification({
      open: true,
      message: `Successfully added ALL ${bookletGroups.size} available booklets (${newStagedRows.length} charge lines) with Report Nos. starting at ${startingReportNo} to the table!`,
      severity: 'success'
    });
  };

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

    if (stagedTableRows.length === 0) {
      const defaultStart = computeNextReportNo(findPreviousReportNo());
      setStartingReportNoInput(defaultStart);
      setPendingAddType('all');
      setStartReportNoDialogOpen(true);
      return;
    }

    const lastReportNo = getLastReportNoFromTable();
    const nextStart = computeNextReportNo(lastReportNo);
    executeAddAllBooklets(nextStart);
  };

  const executeAddToTable = (reportNo: string) => {
    if (!selectedCollector || !selectedBooklet || !orFrom.trim() || !orTo.trim()) return;
    const matchingItems = filteredActiveItems.filter(item => item.collectorName === selectedCollector && item.bookletNo === selectedBooklet && isOrInRange(item.orNo, orFrom, orTo) && !stagedItemKeys.has(`${item.type}_${item.id}`));
    if (matchingItems.length === 0) return;
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const primary = matchingItems[0];
    const uniqueMatchingOrs = Array.from(new Set(matchingItems.map(i => stripLeadingZeroes(i.orNo)))).filter(Boolean);
    const cleanFrom = stripLeadingZeroes(orFrom);
    const cleanTo = stripLeadingZeroes(orTo);
    const orRangeDisplay = `${cleanFrom} — ${cleanTo} (${uniqueMatchingOrs.length} ORs)`;
    const subCatMap = new Map<string, any>();
    matchingItems.forEach(item => {
      const key = `${item.subCategory}__${item.accountCode}`;
      const existing = subCatMap.get(key) || { subCategory: item.subCategory, mainCategory: item.mainCategory, accountCode: item.accountCode, amount: 0, itemCount: 0, itemIds: [], dateFrom: item.date || '', dateTo: item.date || '' };
      existing.amount += item.amount; existing.itemCount += 1; existing.itemIds.push(item.id);
      if (item.date) { if (!existing.dateFrom || item.date < existing.dateFrom) existing.dateFrom = item.date; if (!existing.dateTo || item.date > existing.dateTo) existing.dateTo = item.date; }
      subCatMap.set(key, existing);
    });
    const newRows: StagedReportRow[] = Array.from(subCatMap.values()).map(sub => ({
      id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      batchId,
      collectorKey: primary.collectorKey,
      collectorName: primary.collectorName,
      collectorEmail: primary.collectorEmail,
      userId: primary.userId,
      bookletNo: formatBookletDisplay(primary.bookletNo, primary.type),
      reportNo: reportNo,
      collectionType: primary.type,
      orNumbers: uniqueMatchingOrs,
      orNumbersDisplay: cleanOrDisplay(orRangeDisplay),
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
    localStorage.setItem('rcd_last_booklet_report_no', reportNo);
    setSelectedBooklet(null);
    setOrFrom('');
    setOrTo('');
    setNotification({ open: true, message: `Added ${matchingItems.length} charge items for Booklet ${selectedBooklet} (Report No: ${reportNo}) to the table!`, severity: 'success' });
  };

  const handleAddToTable = () => {
    if (!selectedCollector || !selectedBooklet || !orFrom.trim() || !orTo.trim()) {
      setNotification({ open: true, message: 'Please select collector, booklet, and OR Range.', severity: 'warning' });
      return;
    }
    const matchingItems = filteredActiveItems.filter(item => item.collectorName === selectedCollector && item.bookletNo === selectedBooklet && isOrInRange(item.orNo, orFrom, orTo) && !stagedItemKeys.has(`${item.type}_${item.id}`));
    if (matchingItems.length === 0) {
      setNotification({ open: true, message: 'No items found in selected range.', severity: 'info' });
      return;
    }
    if (stagedTableRows.length === 0) {
      const defaultStart = computeNextReportNo(findPreviousReportNo());
      setStartingReportNoInput(defaultStart);
      setPendingAddType('single');
      setStartReportNoDialogOpen(true);
      return;
    }
    const lastReportNo = getLastReportNoFromTable();
    executeAddToTable(computeNextReportNo(lastReportNo));
  };

  const handleConfirmStartingReportNo = () => {
    const startNo = startingReportNoInput.trim() || computeNextReportNo(findPreviousReportNo());
    setStartReportNoDialogOpen(false);
    if (pendingAddType === 'single') executeAddToTable(startNo);
    else if (pendingAddType === 'all') executeAddAllBooklets(startNo);
    setPendingAddType(null);
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

  // Compute matrix data from filtered staged rows
  const matrixData = useMemo(() => {
    return computeMatrixRows(filteredStagedRows);
  }, [filteredStagedRows]);

  // Active Print Rows (either current staged table or an archived report being reprinted)
  const printRows = useMemo(() => {
    if (printingReport) {
      return getRowsForReport(printingReport);
    }
    return tableSearch.trim() ? filteredStagedRows : stagedTableRows;
  }, [printingReport, tableSearch, filteredStagedRows, stagedTableRows]);

  const printMatrixData = useMemo(() => {
    return computeMatrixRows(printRows);
  }, [printRows]);

  const printTotalAmount = useMemo(() => {
    if (printRows.length > 0) {
      return printRows.reduce((sum, r) => sum + r.amount, 0);
    }
    if (printingReport) return printingReport.totalAmount;
    return 0;
  }, [printingReport, printRows]);

  const printDatePeriodDisplay = useMemo(() => {
    if (printingReport) {
      if (printingReport.dateFrom && printingReport.dateTo) {
        return `${printingReport.dateFrom} to ${printingReport.dateTo}`;
      }
      return printingReport.dateFrom || printingReport.dateTo || 'Archived Period';
    }
    return dateFrom ? `${dateFrom} to ${dateTo || 'Present'}` : 'All Batches';
  }, [printingReport, dateFrom, dateTo]);

  const printBatchTotalsMap = useMemo(() => {
    const map = new Map<string, number>();
    printRows.forEach(r => {
      map.set(r.batchId, (map.get(r.batchId) || 0) + r.amount);
    });
    return map;
  }, [printRows]);

  // Compute Recapitulation Data (All subcategories with amount > 0, account code, aggregated amounts)
  const printRecapData = useMemo(() => {
    const map = new Map<string, { subCategory: string; accountCode: string; amount: number }>();

    printRows.forEach(r => {
      const isRpt = isRptCharge(r);
      const amt = isRpt ? getRptGeneralAmount(r.amount) : r.amount;
      if (amt <= 0) return;

      const subCatName = r.subCategory ? r.subCategory.trim() : 'Sundry';
      const accCode = r.accountCode ? r.accountCode.trim() : '-';
      const key = `${subCatName}____${accCode}`;

      const existing = map.get(key) || {
        subCategory: subCatName,
        accountCode: accCode,
        amount: 0
      };
      existing.amount += amt;
      map.set(key, existing);
    });

    const items = Array.from(map.values()).sort((a, b) => {
      if (a.accountCode && b.accountCode && a.accountCode !== '-' && b.accountCode !== '-') {
        const codeCmp = a.accountCode.localeCompare(b.accountCode, undefined, { numeric: true });
        if (codeCmp !== 0) return codeCmp;
      }
      return a.subCategory.localeCompare(b.subCategory);
    });

    const grandTotal = items.reduce((sum, i) => sum + i.amount, 0);

    return { items, grandTotal };
  }, [printRows]);

  // Section C: Accountability for Accountable Forms (Beginning, Issued, Ending Balances)
  // Section B: Summary of Collections (TOTAL ONLY OF EACH BOOKLET)
  const printBookletSummaryData = useMemo(() => {
    const map = new Map<string, {
      batchId: string;
      bookletNo: string;
      reportNo: string;
      collectorName: string;
      collectionType: 'general' | 'rpt';
      orNumbersDisplay: string;
      totalAmount: number;
    }>();

    printRows.forEach(r => {
      const key = r.batchId || `${r.collectionType}_${r.bookletNo}`;
      if (!map.has(key)) {
        map.set(key, {
          batchId: r.batchId,
          bookletNo: formatBookletDisplay(r.bookletNo, r.collectionType),
          reportNo: r.reportNo || '-',
          collectorName: r.collectorName,
          collectionType: r.collectionType,
          orNumbersDisplay: cleanOrDisplay(r.orNumbersDisplay),
          totalAmount: 0
        });
      }
      const existing = map.get(key)!;
      const isRpt = isRptCharge(r);
      const amt = isRpt ? getRptGeneralAmount(r.amount) : r.amount;
      existing.totalAmount += amt;
    });

    const booklets = Array.from(map.values());
    const grandTotal = booklets.reduce((sum, b) => sum + b.totalAmount, 0);
    return { booklets, grandTotal };
  }, [printRows]);

  // Section A: Selected Bank Deposits for Balances Report
  const printReportSelectedDeposits = useMemo(() => {
    if (printingReport) {
      if (printingReport.selectedDeposits && Array.isArray(printingReport.selectedDeposits) && printingReport.selectedDeposits.length > 0) {
        const total = printingReport.selectedDeposits.reduce((sum: number, d: any) => sum + (Number(d.amount) || 0), 0);
        return { deposits: printingReport.selectedDeposits, totalAmount: total };
      }
      if (printingReport.selectedDepositIds && Array.isArray(printingReport.selectedDepositIds) && printingReport.selectedDepositIds.length > 0) {
        const matched = bankDeposits.filter(d => printingReport.selectedDepositIds!.includes(d.id));
        const total = matched.reduce((sum, d) => sum + d.amount, 0);
        return { deposits: matched, totalAmount: total };
      }
      // Fallback to deposits linked by reportNumber
      const matched = bankDeposits.filter(d => d.reportId === printingReport.reportNumber);
      if (matched.length > 0) {
        const total = matched.reduce((sum, d) => sum + d.amount, 0);
        return { deposits: matched, totalAmount: total };
      }
      return { deposits: [], totalAmount: 0 };
    }

    // Active Staged Table: use selected deposits from state (or default to all unreported)
    const activeIds = selectedDepositIds.length > 0 ? selectedDepositIds : unreportedDeposits.map(d => d.id);
    const matched = bankDeposits.filter(d => activeIds.includes(d.id));
    const total = matched.reduce((sum, d) => sum + d.amount, 0);
    return { deposits: matched, totalAmount: total };
  }, [printingReport, bankDeposits, selectedDepositIds, unreportedDeposits]);

  // Beginning Balance for Balances Report
  const printReportBeginningBalance = useMemo(() => {
    if (printingReport && typeof printingReport.beginningBalance === 'number') {
      return printingReport.beginningBalance;
    }
    return beginningBalanceInput || previousReportEndingBalance;
  }, [printingReport, beginningBalanceInput, previousReportEndingBalance]);

  // Ending Balance for Balances Report
  const printReportEndingBalance = useMemo(() => {
    if (printingReport && typeof printingReport.endingBalance === 'number') {
      return printingReport.endingBalance;
    }
    const beg = printReportBeginningBalance;
    const collections = printBookletSummaryData.grandTotal;
    const deposits = printReportSelectedDeposits.totalAmount;
    return (beg + collections) - deposits;
  }, [printingReport, printReportBeginningBalance, printBookletSummaryData.grandTotal, printReportSelectedDeposits.totalAmount]);

  // Remove an entire booklet/batch
  const handleRemoveBatch = (batchId: string) => {
    setStagedTableRows(prev => prev.filter(r => r.batchId !== batchId));
  };

  // Export Staged Table to Excel (XLSX) in Waterworks Matrix Format
  const handleExportExcel = () => {
    const rowsToExport = tableSearch.trim() ? filteredStagedRows : stagedTableRows;
    if (rowsToExport.length === 0) return;

    const { rows: matrixRows, totals } = computeMatrixRows(rowsToExport);

    const headerRow1 = [
      '#',
      'Collector Name',
      'Booklet No.',
      'OR Numbers',
      'Report No.',
      'Poblacion',
      'San Pedro',
      'Calabasahan',
      '',
      'Sampong',
      '',
      'Bakhawan',
      'Masudsud',
      'Dalajican',
      'San Vicente',
      'RPT',
      'Sundry',
      'Account Code',
      'Amount (₱)'
    ];

    const headerRow2 = [
      '',
      '',
      '',
      '',
      '', // Report No.
      '', // Poblacion
      '', // San Pedro
      'Spring',
      'Pump',
      'Spring',
      'Pump',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    ];

    const aoaData: any[][] = [headerRow1, headerRow2];

    matrixRows.forEach(mr => {
      aoaData.push([
        mr.rowNumber,
        mr.collectorName,
        mr.bookletNo,
        mr.orNumbersDisplay,
        mr.reportNo,
        mr.poblacion,
        mr.sanPedro,
        mr.calabasahanSpring,
        mr.calabasahanPump,
        mr.sampongSpring,
        mr.sampongPump,
        mr.bakhawan,
        mr.masudsud,
        mr.dalajican,
        mr.sanVicente,
        mr.rpt || '',
        mr.subCategory,
        mr.accountCode,
        mr.amount
      ]);
    });

    // Grand Total Row
    aoaData.push([
      '',
      'GRAND TOTAL',
      '',
      `${totals.bookletCount} Booklets`,
      '', // Report No.
      totals.poblacion || 0,
      totals.sanPedro || 0,
      totals.calSpring || 0,
      totals.calPump || 0,
      totals.samSpring || 0,
      totals.samPump || 0,
      totals.bakhawan || 0,
      totals.masudsud || 0,
      totals.dalajican || 0,
      totals.sanVicente || 0,
      totals.rpt || 0,
      '',
      '',
      totals.grandTotal
    ]);

    const ws = XLSX.utils.aoa_to_sheet(aoaData);

    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // #
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // Collector Name
      { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }, // Booklet No.
      { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } }, // OR Numbers
      { s: { r: 0, c: 4 }, e: { r: 1, c: 4 } }, // Report No.
      { s: { r: 0, c: 5 }, e: { r: 1, c: 5 } }, // Poblacion
      { s: { r: 0, c: 6 }, e: { r: 1, c: 6 } }, // San Pedro
      { s: { r: 0, c: 7 }, e: { r: 0, c: 8 } }, // Calabasahan (spanning Spring & Pump)
      { s: { r: 0, c: 9 }, e: { r: 0, c: 10 } }, // Sampong (spanning Spring & Pump)
      { s: { r: 0, c: 11 }, e: { r: 1, c: 11 } }, // Bakhawan
      { s: { r: 0, c: 12 }, e: { r: 1, c: 12 } }, // Masudsud
      { s: { r: 0, c: 13 }, e: { r: 1, c: 13 } }, // Dalajican
      { s: { r: 0, c: 14 }, e: { r: 1, c: 14 } }, // San Vicente
      { s: { r: 0, c: 15 }, e: { r: 1, c: 15 } }, // RPT
      { s: { r: 0, c: 16 }, e: { r: 1, c: 16 } }, // Sundry
      { s: { r: 0, c: 17 }, e: { r: 1, c: 17 } }, // Account Code
      { s: { r: 0, c: 18 }, e: { r: 1, c: 18 } }  // Amount (₱)
    ];

    ws['!cols'] = [
      { wch: 6 },  // #
      { wch: 22 }, // Collector Name
      { wch: 14 }, // Booklet No.
      { wch: 30 }, // OR Numbers
      { wch: 14 }, // Report No.
      { wch: 12 }, // Poblacion
      { wch: 12 }, // San Pedro
      { wch: 11 }, // Calabasahan Spring
      { wch: 11 }, // Calabasahan Pump
      { wch: 11 }, // Sampong Spring
      { wch: 11 }, // Sampong Pump
      { wch: 12 }, // Bakhawan
      { wch: 12 }, // Masudsud
      { wch: 12 }, // Dalajican
      { wch: 12 }, // San Vicente
      { wch: 14 }, // RPT
      { wch: 24 }, // Sundry
      { wch: 15 }, // Account Code
      { wch: 14 }  // Amount (₱)
    ];

    // Format all number cells with 2 decimal places in Excel
    Object.keys(ws).forEach(cellRef => {
      if (cellRef.startsWith('!')) return;
      const cell = ws[cellRef];
      if (cell && typeof cell.v === 'number') {
        cell.z = '#,##0.00';
      }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Consolidated Report');
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Admin_Consolidated_Report_${dateStr}.xlsx`);

    setNotification({
      open: true,
      message: 'Consolidated report exported to Excel with Waterworks Matrix layout successfully!',
      severity: 'success'
    });
  };

  // Mark all currently staged booklet rows as ONE Generated Report
  const handleConfirmMarkAsReported = async () => {
    if (stagedTableRows.length === 0) return;
    setIsSubmitting(true);

    try {
      // 1. Gather all unique metadata across all staged rows
      const uniqueBooklets = Array.from(new Set(stagedTableRows.map(r => r.bookletNo).filter(Boolean)));
      const uniqueCollectors = Array.from(new Set(stagedTableRows.map(r => r.collectorName).filter(Boolean)));
      const uniqueCollectorEmails = Array.from(new Set(stagedTableRows.map(r => r.collectorEmail).filter(Boolean)));
      const allOrNumbers = Array.from(new Set(stagedTableRows.flatMap(r => r.orNumbers))).filter(Boolean);
      const allItemIds = Array.from(new Set(stagedTableRows.flatMap(r => r.itemIds))).filter(Boolean);

      // Date Period across all rows
      let minDate = '';
      let maxDate = '';
      stagedTableRows.forEach(r => {
        if (r.dateFrom) {
          if (!minDate || r.dateFrom < minDate) minDate = r.dateFrom;
        }
        if (r.dateTo) {
          if (!maxDate || r.dateTo > maxDate) maxDate = r.dateTo;
        }
      });

      // SubCategory Summary aggregation across all booklets
      const subCatMap = new Map<string, AdminSubCategoryCharge>();
      stagedTableRows.forEach(r => {
        const key = `${r.subCategory}__${r.accountCode}`;
        const existing = subCatMap.get(key) || {
          subCategory: r.subCategory,
          mainCategory: r.mainCategory,
          accountCode: r.accountCode,
          itemCount: 0,
          amount: 0
        };
        existing.itemCount += r.itemCount;
        existing.amount += r.amount;
        subCatMap.set(key, existing);
      });

      const totalAmount = stagedTableRows.reduce((sum, r) => sum + r.amount, 0);

      const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const timeCode = Date.now().toString().slice(-4);
      const primaryBooklet = uniqueBooklets[0] ? uniqueBooklets[0].replace(/[^A-Za-z0-9]/g, '') : 'CONSOL';
      const reportNum = uniqueBooklets.length === 1 
        ? `ADM-${primaryBooklet}-${timeCode}`
        : `ADM-CONSOL-${dateCode}-${timeCode}`;

      const bookletSummary = uniqueBooklets.length === 1
        ? uniqueBooklets[0]
        : `${uniqueBooklets.length} Booklets (${uniqueBooklets.join(', ')})`;

      const collectorSummary = uniqueCollectors.length === 1
        ? uniqueCollectors[0]
        : uniqueCollectors.join(', ');

      const orRangeSummary = uniqueBooklets.length === 1
        ? formatOrRange(allOrNumbers)
        : `${allOrNumbers.length} ORs across ${uniqueBooklets.length} Booklets`;

      const collectionType = stagedTableRows.every(r => r.collectionType === 'rpt') 
        ? 'rpt' 
        : 'general';

      const selectedDepositsList = bankDeposits.filter(d => selectedDepositIds.includes(d.id));
      const totalDepositsAmount = round2(selectedDepositsList.reduce((sum, d) => sum + d.amount, 0));
      const computedEndingBalance = round2(round2(Number(beginningBalanceInput)) + round2(totalAmount) - totalDepositsAmount);

      const newRecord: AdminSubmittedReportRecord = {
        id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        reportNumber: reportNum,
        collectorName: collectorSummary,
        collectorEmail: uniqueCollectorEmails.join(', '),
        userId: stagedTableRows[0]?.userId,
        afNo: bookletSummary,
        orRange: orRangeSummary,
        orCount: allOrNumbers.length,
        orNumbers: allOrNumbers,
        itemIds: allItemIds,
        collectionType,
        totalAmount: round2(totalAmount),
        subCategorySummary: Array.from(subCatMap.values()),
        submittedAt: new Date().toISOString(),
        submittedBy: user?.name || 'Administrator',
        status: 'Submitted',
        dateFrom: minDate,
        dateTo: maxDate,
        stagedRows: [...stagedTableRows], // Snapshot of ALL staged booklets!
        beginningBalance: round2(Number(beginningBalanceInput)),
        endingBalance: computedEndingBalance,
        selectedDepositIds: selectedDepositIds,
        selectedDeposits: selectedDepositsList
      };

      await saveAdminSubmittedReport(newRecord);
      localStorage.setItem('rcd_last_ending_balance', String(computedEndingBalance));

      // Clear the staged table
      handleClearStagedTable();
      await loadData();

      setSubmitConfirmOpen(false);
      setNotification({
        open: true,
        message: `Successfully generated Report ${reportNum} with ${uniqueBooklets.length} booklets (${stagedTableRows.length} charge lines)! You can reprint this entire report anytime with 1 click.`,
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
  // Accepts an optional targetReport so the call never relies on stale React state
  const handleConfirmUnmark = async (targetReport?: AdminSubmittedReportRecord | null) => {
    const report = targetReport ?? reportToUnmark;
    if (!report) return;
    try {
      await unmarkAdminSubmittedReport(
        report.id,
        report.itemIds,
        report.collectionType,
        report.afNo,
        report.orNumbers
      );
      await loadData();
      setUnmarkConfirmOpen(false);
      setReportToUnmark(null);
      // Use local `report` var — reportToUnmark state may already be null by here
      setNotification({
        open: true,
        message: `Report ${report.reportNumber} reopened and returned to available booklet selection pool.`,
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
            <Card elevation={0} sx={{ borderRadius: 2, border: '1px solid #bae6fd', bgcolor: '#f0f9ff', mb: 2 }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>

                {/* Header Row */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="body2" fontWeight="800" sx={{ color: '#0369a1', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Layers sx={{ fontSize: 16 }} />
                    Select Collector &amp; Booklet to Consolidate
                  </Typography>

                  {/* Date Range Filter — inline, compact */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                    <CalendarMonth sx={{ fontSize: 15, color: '#0284c7' }} />
                    <Typography variant="caption" fontWeight="700" sx={{ color: '#0369a1' }}>Date Filter:</Typography>
                    <TextField
                      type="date"
                      size="small"
                      label="From"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: 130, '& .MuiInputBase-input': { py: 0.4, fontSize: '0.75rem' } }}
                    />
                    <Typography variant="caption" color="text.secondary">to</Typography>
                    <TextField
                      type="date"
                      size="small"
                      label="To"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: 130, '& .MuiInputBase-input': { py: 0.4, fontSize: '0.75rem' } }}
                    />
                    {(dateFrom || dateTo) && (
                      <Tooltip title="Clear Date Filter" arrow>
                        <IconButton size="small" onClick={() => { setDateFrom(''); setDateTo(''); }} sx={{ p: 0.3, color: '#64748b' }}>
                          <Clear sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>

                {/* Option 2: Select All — single compact row */}
                <Box sx={{
                  mb: 1.5, px: 1.5, py: 0.8,
                  bgcolor: '#ffffff', borderRadius: 1.5,
                  border: '1px dashed #0284c7',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                    <SelectAll sx={{ color: '#0284c7', fontSize: 18, flexShrink: 0 }} />
                    <Typography variant="caption" fontWeight="700" sx={{ color: '#0f172a', whiteSpace: 'nowrap' }}>
                      Select All Available Booklets
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                      — adds all <strong>{totalAvailableUnstagedBooklets}</strong> booklets{dateFrom || dateTo ? ` within date range` : ''} to the table
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<SelectAll />}
                    onClick={handleAddAllAvailableBooklets}
                    disabled={totalAvailableUnstagedBooklets === 0}
                    sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', py: 0.4, px: 1.5, borderRadius: 1.5, bgcolor: '#0284c7', whiteSpace: 'nowrap', flexShrink: 0, '&:hover': { bgcolor: '#0369a1' } }}
                  >
                    Select All ({totalAvailableUnstagedBooklets})
                  </Button>
                </Box>

                <Divider sx={{ my: 1.2 }}>
                  <Chip label="OR — Select Specific Collector &amp; Booklet" size="small" sx={{ fontWeight: 700, fontSize: '0.68rem', bgcolor: '#e0f2fe', color: '#0369a1' }} />
                </Divider>

                <Grid container spacing={1.5} alignItems="flex-start">
                  {/* 1. Collector */}
                  <Grid size={{ xs: 12, md: 3.75 }}>
                    <Autocomplete
                      options={availableCollectors.map(c => c.name)}
                      value={selectedCollector}
                      onChange={(_, v) => { setSelectedCollector(v); setSelectedBooklet(null); setOrFrom(''); setOrTo(''); }}
                      renderInput={(params) => (
                        <TextField {...params} label="1. Collector Name" size="small"
                          sx={{ bgcolor: '#ffffff', borderRadius: 1 }} />
                      )}
                    />
                    {selectedCollector && (
                      <Typography variant="caption" sx={{ color: '#0284c7', display: 'block', mt: 0.3, fontWeight: 600 }}>
                        {availableBooklets.length} booklet(s) available
                      </Typography>
                    )}
                  </Grid>

                  {/* 2. Booklet No. */}
                  <Grid size={{ xs: 12, sm: 6, md: 3.75 }}>
                    <Autocomplete
                      options={availableBooklets.map(b => b.bookletNo)}
                      value={selectedBooklet}
                      disabled={!selectedCollector || availableBooklets.length === 0}
                      onChange={(_, v) => { setSelectedBooklet(v); setOrFrom(''); setOrTo(''); }}
                      renderInput={(params) => (
                        <TextField {...params} label="2. Booklet No. (AF No.)" size="small"
                          placeholder={!selectedCollector ? 'Select collector first' : 'Choose booklet...'}
                          sx={{ bgcolor: '#ffffff', borderRadius: 1 }} />
                      )}
                    />
                    {selectedBooklet && (
                      <Typography variant="caption" sx={{ color: '#0284c7', display: 'block', mt: 0.3, fontWeight: 600 }}>
                        Range: {availableBooklets.find(b => b.bookletNo === selectedBooklet)?.orRange}
                      </Typography>
                    )}
                  </Grid>

                  {/* 3. OR Range */}
                  <Grid size={{ xs: 12, sm: 6, md: 4.5 }}>
                    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                      <Autocomplete freeSolo options={availableOrs} value={orFrom}
                        disabled={!selectedBooklet || availableOrs.length === 0}
                        onInputChange={(_, v) => setOrFrom(v)} onChange={(_, v) => setOrFrom(v || '')}
                        sx={{ flex: 1 }}
                        renderInput={(params) => (
                          <TextField {...params} label="3. OR From" size="small"
                            sx={{ bgcolor: '#ffffff', borderRadius: 1 }} />
                        )}
                      />
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>to</Typography>
                      <Autocomplete freeSolo options={availableOrs} value={orTo}
                        disabled={!selectedBooklet || availableOrs.length === 0}
                        onInputChange={(_, v) => setOrTo(v)} onChange={(_, v) => setOrTo(v || '')}
                        sx={{ flex: 1 }}
                        renderInput={(params) => (
                          <TextField {...params} label="OR To" size="small"
                            sx={{ bgcolor: '#ffffff', borderRadius: 1 }} />
                        )}
                      />
                    </Box>
                    {selectedBooklet && availableOrs.length > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.3 }}>
                        <Typography variant="caption" sx={{ color: '#0284c7', fontWeight: 600 }}>
                          {availableOrs[0]} — {availableOrs[availableOrs.length - 1]} ({availableOrs.length} ORs)
                        </Typography>
                        <Chip label={`${includedOrsInRange.length} included`} size="small"
                          sx={{ height: 18, fontSize: '0.66rem', bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 700 }} />
                      </Box>
                    )}
                  </Grid>
                </Grid>

                {/* Add to Table Button */}
                <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<AddCircleOutline />}
                    onClick={handleAddToTable}
                    disabled={!selectedCollector || !selectedBooklet || !orFrom.trim() || !orTo.trim()}
                    sx={{ bgcolor: '#0284c7', color: '#ffffff', textTransform: 'none', fontWeight: 700, px: 2.5, py: 0.6, borderRadius: 1.5, boxShadow: '0 4px 12px rgba(2,132,199,0.25)', '&:hover': { bgcolor: '#0369a1' } }}
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0f172a' }}>
                      Consolidated Collections Table ({stagedTableRows.length} Line Items)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Review imported booklet records before exporting, printing, or marking as reported.
                    </Typography>
                  </Box>

                  {stagedTableRows.length > 0 && (
                    <ToggleButtonGroup
                      value={tableViewMode}
                      exclusive
                      size="small"
                      onChange={(_, v) => v && setTableViewMode(v)}
                      sx={{ bgcolor: '#ffffff', height: 32 }}
                    >
                      <ToggleButton value="matrix" sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', px: 1.5, py: 0.2 }}>
                        <TableChart sx={{ fontSize: 16, mr: 0.8, color: '#0284c7' }} />
                        Waterworks Matrix
                      </ToggleButton>
                      <ToggleButton value="standard" sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', px: 1.5, py: 0.2 }}>
                        <ViewList sx={{ fontSize: 16, mr: 0.8, color: '#64748b' }} />
                        Standard List
                      </ToggleButton>
                    </ToggleButtonGroup>
                  )}
                </Box>

                {/* Main Action Buttons */}
                <Stack direction="row" spacing={1.5} flexWrap="wrap" gap={1}>
                  <Tooltip title="Export current consolidated table to Excel (.xlsx) with Waterworks Matrix layout" arrow>
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

                  <Tooltip title="Print official consolidated summary report (Displays preview modal first)" arrow>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Print />}
                      onClick={() => handlePrintReport()}
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

                  <Tooltip title="Print Report of Collections and Deposits (Recapitulation preview modal)" arrow>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Summarize />}
                      onClick={() => handlePrintRecap()}
                      disabled={stagedTableRows.length === 0}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        borderRadius: 1.5,
                        borderColor: '#16a34a',
                        color: '#16a34a',
                        '&:hover': { borderColor: '#15803d', bgcolor: '#f0fdf4' }
                      }}
                    >
                      Print Recapitulation
                    </Button>
                  </Tooltip>

                  <Tooltip title="Print Report of Ending Balances, Deposits, and Collections (preview modal)" arrow>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AccountBalance />}
                      onClick={() => handlePrintBalances()}
                      disabled={stagedTableRows.length === 0}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        borderRadius: 1.5,
                        borderColor: '#7c3aed',
                        color: '#7c3aed',
                        '&:hover': { borderColor: '#6d28d9', bgcolor: '#f5f3ff' }
                      }}
                    >
                      Print Balances & Deposits
                    </Button>
                  </Tooltip>

                  <Tooltip title="Mark all table entries as Reported (they will be archived and excluded from future booklet selections)" arrow>
                    <Button
                      variant="contained"
                      size="small"
                      color="success"
                      startIcon={<Send />}
                      onClick={handleOpenMarkAsReported}
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
              {tableViewMode === 'matrix' ? (
                /* Waterworks Matrix View (Exact Excel Layout Preview) */
                <TableContainer sx={{ maxHeight: 520 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      {/* Row 1 Header */}
                      <TableRow sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 800, color: '#334155', fontSize: '0.75rem', borderBottom: '1px solid #cbd5e1', textAlign: 'center', verticalAlign: 'middle' } }}>
                        <TableCell rowSpan={2} align="center" sx={{ width: 36, borderRight: '1px solid #e2e8f0', textAlign: 'center', verticalAlign: 'middle' }}>#</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ minWidth: 140, borderRight: '1px solid #e2e8f0', textAlign: 'center', verticalAlign: 'middle' }}>Collector Name</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ minWidth: 80, borderRight: '1px solid #e2e8f0', textAlign: 'center', verticalAlign: 'middle' }}>Booklet No.</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ minWidth: 160, borderRight: '1px solid #e2e8f0', textAlign: 'center', verticalAlign: 'middle' }}>OR Numbers</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ minWidth: 105, borderRight: '1px solid #e2e8f0', textAlign: 'center', verticalAlign: 'middle', fontWeight: 800, bgcolor: '#f8fafc' }}>Report No.</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ minWidth: 85, bgcolor: '#f0f9ff !important', color: '#0369a1 !important', borderRight: '1px solid #bae6fd', textAlign: 'center', verticalAlign: 'middle' }}>Poblacion</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ minWidth: 85, bgcolor: '#f0f9ff !important', color: '#0369a1 !important', borderRight: '1px solid #bae6fd', textAlign: 'center', verticalAlign: 'middle' }}>San Pedro</TableCell>
                        <TableCell colSpan={2} align="center" sx={{ bgcolor: '#e0f2fe !important', color: '#0369a1 !important', borderRight: '1px solid #bae6fd', textAlign: 'center', verticalAlign: 'middle' }}>Calabasahan</TableCell>
                        <TableCell colSpan={2} align="center" sx={{ bgcolor: '#e0f2fe !important', color: '#0369a1 !important', borderRight: '1px solid #bae6fd', textAlign: 'center', verticalAlign: 'middle' }}>Sampong</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ minWidth: 85, bgcolor: '#f0f9ff !important', color: '#0369a1 !important', borderRight: '1px solid #bae6fd', textAlign: 'center', verticalAlign: 'middle' }}>Bakhawan</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ minWidth: 85, bgcolor: '#f0f9ff !important', color: '#0369a1 !important', borderRight: '1px solid #bae6fd', textAlign: 'center', verticalAlign: 'middle' }}>Masudsud</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ minWidth: 85, bgcolor: '#f0f9ff !important', color: '#0369a1 !important', borderRight: '1px solid #bae6fd', textAlign: 'center', verticalAlign: 'middle' }}>Dalajican</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ minWidth: 85, bgcolor: '#f0f9ff !important', color: '#0369a1 !important', borderRight: '1px solid #bae6fd', textAlign: 'center', verticalAlign: 'middle' }}>San Vicente</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ minWidth: 90, bgcolor: '#fef3c7 !important', color: '#92400e !important', borderRight: '1px solid #fde68a', textAlign: 'center', verticalAlign: 'middle', fontWeight: 800 }}>RPT</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ minWidth: 130, borderRight: '1px solid #e2e8f0', textAlign: 'center', verticalAlign: 'middle' }}>Sundry</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ minWidth: 100, borderRight: '1px solid #e2e8f0', textAlign: 'center', verticalAlign: 'middle' }}>Account Code</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ minWidth: 110, borderRight: '1px solid #e2e8f0', textAlign: 'center', verticalAlign: 'middle' }}>Amount (₱)</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ width: 50, textAlign: 'center', verticalAlign: 'middle' }}>Action</TableCell>
                      </TableRow>
                      {/* Row 2 Subheaders for Spring & Pump */}
                      <TableRow sx={{ '& th': { bgcolor: '#f0f9ff', fontWeight: 700, color: '#0284c7', fontSize: '0.72rem', borderBottom: '2px solid #cbd5e1', textAlign: 'center', verticalAlign: 'middle' } }}>
                        <TableCell align="center" sx={{ minWidth: 75, borderRight: '1px solid #bae6fd', textAlign: 'center', verticalAlign: 'middle' }}>Spring</TableCell>
                        <TableCell align="center" sx={{ minWidth: 75, borderRight: '1px solid #bae6fd', textAlign: 'center', verticalAlign: 'middle' }}>Pump</TableCell>
                        <TableCell align="center" sx={{ minWidth: 75, borderRight: '1px solid #bae6fd', textAlign: 'center', verticalAlign: 'middle' }}>Spring</TableCell>
                        <TableCell align="center" sx={{ minWidth: 75, borderRight: '1px solid #bae6fd', textAlign: 'center', verticalAlign: 'middle' }}>Pump</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {matrixData.rows.map((mr) => (
                        <TableRow 
                          key={mr.key} 
                          hover
                          sx={{ 
                            borderTop: mr.rowNumber ? '2px solid #cbd5e1' : '1px solid #f1f5f9',
                            bgcolor: mr.rowNumber ? '#ffffff' : '#fcfcfd'
                          }}
                        >
                            <TableCell sx={{ color: '#94a3b8', fontSize: '0.78rem' }}>{mr.rowNumber}</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: '#0f172a' }}>{mr.collectorName}</TableCell>
                            <TableCell>
                              {mr.bookletNo ? (
                                <Chip 
                                  label={mr.bookletNo} 
                                  size="small" 
                                  sx={{ fontWeight: 800, bgcolor: '#e0f2fe', color: '#0369a1', fontSize: '0.72rem' }} 
                                />
                              ) : null}
                            </TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', color: '#0284c7', fontWeight: 600, fontSize: '0.78rem' }}>
                              {cleanOrDisplay(mr.orNumbersDisplay)}
                            </TableCell>
                            <TableCell align="center" sx={{ borderRight: '1px solid #f1f5f9' }}>
                              {editingReportNoBatchId === mr.batchId && mr.rowNumber ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
                                  <TextField
                                    size="small"
                                    autoFocus
                                    value={editingReportNoValue}
                                    onChange={(e) => setEditingReportNoValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveEditReportNo(mr.batchId);
                                      if (e.key === 'Escape') setEditingReportNoBatchId(null);
                                    }}
                                    sx={{ width: 85, '& input': { fontSize: '0.74rem', py: 0.3, px: 0.5, textAlign: 'center', fontWeight: 700 } }}
                                  />
                                  <IconButton size="small" color="primary" onClick={() => handleSaveEditReportNo(mr.batchId)} sx={{ p: 0.2 }}>
                                    <CheckCircle sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Box>
                              ) : mr.reportNo ? (
                                <Tooltip title="Click to edit Report No. for this booklet" arrow>
                                  <Chip 
                                    label={mr.reportNo} 
                                    size="small" 
                                    onClick={() => handleStartEditReportNo(mr.batchId, mr.reportNo)}
                                    sx={{ 
                                      fontWeight: 800, 
                                      bgcolor: '#f0fdf4', 
                                      color: '#166534', 
                                      border: '1px solid #bbf7d0', 
                                      fontSize: '0.74rem',
                                      cursor: 'pointer',
                                      '&:hover': { bgcolor: '#dcfce7' }
                                    }} 
                                  />
                                </Tooltip>
                              ) : null}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.78rem', color: mr.poblacion ? '#0f172a' : '#cbd5e1' }}>
                              {mr.poblacion ? Number(mr.poblacion).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.78rem', color: mr.sanPedro ? '#0f172a' : '#cbd5e1' }}>
                              {mr.sanPedro ? Number(mr.sanPedro).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.78rem', color: mr.calabasahanSpring ? '#0f172a' : '#cbd5e1' }}>
                              {mr.calabasahanSpring ? Number(mr.calabasahanSpring).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.78rem', color: mr.calabasahanPump ? '#0f172a' : '#cbd5e1' }}>
                              {mr.calabasahanPump ? Number(mr.calabasahanPump).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.78rem', color: mr.sampongSpring ? '#0f172a' : '#cbd5e1' }}>
                              {mr.sampongSpring ? Number(mr.sampongSpring).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.78rem', color: mr.sampongPump ? '#0f172a' : '#cbd5e1' }}>
                              {mr.sampongPump ? Number(mr.sampongPump).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.78rem', color: mr.bakhawan ? '#0f172a' : '#cbd5e1' }}>
                              {mr.bakhawan ? Number(mr.bakhawan).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.78rem', color: mr.masudsud ? '#0f172a' : '#cbd5e1' }}>
                              {mr.masudsud ? Number(mr.masudsud).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.78rem', color: mr.dalajican ? '#0f172a' : '#cbd5e1' }}>
                              {mr.dalajican ? Number(mr.dalajican).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.78rem', color: mr.sanVicente ? '#0f172a' : '#cbd5e1' }}>
                              {mr.sanVicente ? Number(mr.sanVicente).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.78rem', fontWeight: mr.rpt ? 700 : 400, color: mr.rpt ? '#b45309' : '#cbd5e1', bgcolor: mr.rpt ? '#fffbeb' : 'inherit' }}>
                              {mr.rpt ? Number(mr.rpt).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, color: '#1e293b', fontSize: '0.78rem' }}>
                              {mr.subCategory}
                            </TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: mr.accountCode ? '#0369a1' : 'transparent' }}>
                              {mr.accountCode}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.85rem' }}>
                              ₱ {Number(mr.amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell align="center">
                              {mr.rowNumber ? (
                                <Tooltip title="Remove booklet from table" arrow>
                                  <IconButton size="small" color="error" onClick={() => handleRemoveBatch(mr.batchId)}>
                                    <DeleteOutline fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        ))
                      }

                      {stagedTableRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={20} align="center" sx={{ py: 6 }}>
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
                    {filteredStagedRows.length > 0 && (
                      <TableFooter sx={{ position: 'sticky', bottom: 0, zIndex: 2 }}>
                        <TableRow sx={{ bgcolor: '#f8fafc', borderTop: '2px solid #0284c7', '& td': { fontWeight: 800, py: 1.2 } }}>
                          <TableCell colSpan={5} align="center" sx={{ fontWeight: 800, color: '#0284c7', fontSize: '0.78rem', bgcolor: '#f1f5f9', letterSpacing: 0.5, borderRight: '1px solid #e2e8f0' }}>
                            TOTAL
                          </TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontSize: '0.76rem', borderRight: '1px solid #bae6fd' }}>
                            {matrixData.totals.poblacion > 0 ? Number(matrixData.totals.poblacion).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontSize: '0.76rem', borderRight: '1px solid #bae6fd' }}>
                            {matrixData.totals.sanPedro > 0 ? Number(matrixData.totals.sanPedro).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontSize: '0.76rem', borderRight: '1px solid #bae6fd' }}>
                            {matrixData.totals.calSpring > 0 ? Number(matrixData.totals.calSpring).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontSize: '0.76rem', borderRight: '1px solid #bae6fd' }}>
                            {matrixData.totals.calPump > 0 ? Number(matrixData.totals.calPump).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontSize: '0.76rem', borderRight: '1px solid #bae6fd' }}>
                            {matrixData.totals.samSpring > 0 ? Number(matrixData.totals.samSpring).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontSize: '0.76rem', borderRight: '1px solid #bae6fd' }}>
                            {matrixData.totals.samPump > 0 ? Number(matrixData.totals.samPump).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontSize: '0.76rem', borderRight: '1px solid #bae6fd' }}>
                            {matrixData.totals.bakhawan > 0 ? Number(matrixData.totals.bakhawan).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontSize: '0.76rem', borderRight: '1px solid #bae6fd' }}>
                            {matrixData.totals.masudsud > 0 ? Number(matrixData.totals.masudsud).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontSize: '0.76rem', borderRight: '1px solid #bae6fd' }}>
                            {matrixData.totals.dalajican > 0 ? Number(matrixData.totals.dalajican).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontSize: '0.76rem', borderRight: '1px solid #bae6fd' }}>
                            {matrixData.totals.sanVicente > 0 ? Number(matrixData.totals.sanVicente).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#fef3c7', color: '#92400e', fontSize: '0.76rem', borderRight: '1px solid #fde68a', fontWeight: 800 }}>
                            {matrixData.totals.rpt > 0 ? Number(matrixData.totals.rpt).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </TableCell>
                          <TableCell colSpan={2} sx={{ bgcolor: '#f1f5f9', borderRight: '1px solid #e2e8f0' }} />
                          <TableCell align="right" sx={{ bgcolor: '#0284c7', color: '#ffffff', fontSize: '0.85rem', borderRight: '1px solid #0284c7' }}>
                            ₱ {Number(matrixData.totals.grandTotal).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell sx={{ bgcolor: '#f1f5f9' }} />
                        </TableRow>
                      </TableFooter>
                    )}
                  </Table>
                </TableContainer>
              ) : (
                /* Standard List View */
                <TableContainer sx={{ maxHeight: 480 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 800, color: '#334155', fontSize: '0.78rem', textAlign: 'center', verticalAlign: 'middle' } }}>
                        <TableCell align="center" sx={{ width: 40, textAlign: 'center', verticalAlign: 'middle' }}>#</TableCell>
                        <TableCell align="center" sx={{ textAlign: 'center', verticalAlign: 'middle' }}>Collector Name</TableCell>
                        <TableCell align="center" sx={{ textAlign: 'center', verticalAlign: 'middle' }}>Booklet No.</TableCell>
                        <TableCell align="center" sx={{ textAlign: 'center', verticalAlign: 'middle' }}>OR Numbers</TableCell>
                        <TableCell align="center" sx={{ textAlign: 'center', verticalAlign: 'middle', fontWeight: 800 }}>Report No.</TableCell>
                        <TableCell align="center" sx={{ textAlign: 'center', verticalAlign: 'middle' }}>Sundry</TableCell>
                        <TableCell align="center" sx={{ textAlign: 'center', verticalAlign: 'middle' }}>Account Code</TableCell>
                        <TableCell align="center" sx={{ textAlign: 'center', verticalAlign: 'middle' }}>Amount</TableCell>
                        <TableCell align="center" sx={{ width: 60, textAlign: 'center', verticalAlign: 'middle' }}>Action</TableCell>
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
                                    label={formatBookletDisplay(row.bookletNo, row.collectionType)} 
                                    size="small" 
                                    sx={{ fontWeight: 800, bgcolor: '#e0f2fe', color: '#0369a1', fontSize: '0.72rem' }} 
                                  />
                                ) : null}
                              </TableCell>
                              <TableCell sx={{ fontFamily: 'monospace', color: '#0284c7', fontWeight: 600, fontSize: '0.8rem' }}>
                                {isFirstRowOfBatch ? cleanOrDisplay(row.orNumbersDisplay) : ''}
                              </TableCell>
                              <TableCell align="center">
                                {isFirstRowOfBatch && row.reportNo ? (
                                  <Chip 
                                    label={row.reportNo} 
                                    size="small" 
                                    sx={{ fontWeight: 800, bgcolor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', fontSize: '0.72rem' }} 
                                  />
                                ) : null}
                              </TableCell>
                              <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>
                                {row.subCategory}
                              </TableCell>
                              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#0369a1', bgcolor: '#f0f9ff', px: 0.8, py: 0.2, borderRadius: 0.5 }}>
                                {row.accountCode}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>
                                ₱ {row.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                                <TableCell colSpan={4} sx={{ fontWeight: 800, color: '#0369a1', fontSize: '0.8rem', bgcolor: '#f1f5f9' }}>
                                  Total Booklet ({formatBookletDisplay(row.bookletNo, row.collectionType)})
                                </TableCell>
                                <TableCell colSpan={2} sx={{ color: '#64748b', fontSize: '0.75rem', fontStyle: 'italic', bgcolor: '#f1f5f9' }}>
                                  Subtotal for {cleanOrDisplay(row.orNumbersDisplay)}
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 800, color: '#0369a1', fontSize: '0.9rem', bgcolor: '#f1f5f9' }}>
                                  ₱ {batchTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell sx={{ bgcolor: '#f1f5f9' }} />
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}

                      {stagedTableRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={10} align="center" sx={{ py: 6 }}>
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
              )}

              {/* Table Footer Summary */}
              {stagedTableRows.length > 0 && (
                <Box sx={{ p: 2, px: 3, bgcolor: '#f8fafc', borderTop: '2px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Total: <strong>{new Set(filteredStagedRows.map(r => r.bookletNo)).size} Booklets</strong> ({filteredStagedRows.length} Line Items across {new Set(filteredStagedRows.map(r => r.collectorName)).size} Collectors)
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography variant="subtitle1" fontWeight="700" color="text.secondary">
                      GRAND TOTAL:
                    </Typography>
                    <Typography variant="h5" fontWeight="800" sx={{ color: '#0284c7' }}>
                      ₱ {stagedTotalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                        <Tooltip title={report.afNo} arrow>
                          <Chip 
                            label={report.afNo} 
                            size="small" 
                            sx={{ 
                              fontWeight: 700, 
                              bgcolor: '#f0f9ff', 
                              color: '#0369a1', 
                              fontSize: '0.72rem',
                              maxWidth: 220,
                              textOverflow: 'ellipsis'
                            }} 
                          />
                        </Tooltip>
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
                        ₱ {report.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                          <Tooltip title="Print Report (Collections Preview)" arrow>
                            <IconButton 
                              size="small" 
                              color="primary"
                              onClick={() => handlePrintReport(report)}
                              sx={{ bgcolor: '#e0f2fe', color: '#0284c7', '&:hover': { bgcolor: '#bae6fd' } }}
                            >
                              <Print fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Print Recapitulation (RCD Preview)" arrow>
                            <IconButton 
                              size="small" 
                              color="success"
                              onClick={() => handlePrintRecap(report)}
                              sx={{ bgcolor: '#f0fdf4', color: '#16a34a', '&:hover': { bgcolor: '#dcfce7' } }}
                            >
                              <Summarize fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Print Balances, Deposits & Collections" arrow>
                            <IconButton 
                              size="small" 
                              onClick={() => handlePrintBalances(report)}
                              sx={{ bgcolor: '#f5f3ff', color: '#7c3aed', '&:hover': { bgcolor: '#ede9fe' } }}
                            >
                              <AccountBalance fontSize="small" />
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
      {/* STARTING REPORT NUMBER DIALOG                                             */}
      {/* ========================================================================= */}
      <Dialog
        open={startReportNoDialogOpen}
        onClose={() => {
          setStartReportNoDialogOpen(false);
          setPendingAddType(null);
        }}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2.5, p: 1 } }}
      >
        <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800, color: '#0f172a' }}>
          <ReceiptLong color="primary" />
          Set Starting Report No.
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5 }}>
          <Stack spacing={2}>
            <Alert severity="info" sx={{ borderRadius: 1.5, fontSize: '0.82rem' }}>
              This is the first booklet added to the table. Please confirm the <strong>Starting Report No.</strong> for this report. Subsequent booklets will automatically increment sequentially.
            </Alert>

            <TextField
              label="Starting Report No."
              value={startingReportNoInput}
              onChange={(e) => setStartingReportNoInput(e.target.value)}
              fullWidth
              autoFocus
              size="small"
              placeholder="e.g. 26-03-001 or 001"
              helperText="Defaulted from previous report number. You can customize this as needed."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirmStartingReportNo();
                }
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button 
            onClick={() => {
              setStartReportNoDialogOpen(false);
              setPendingAddType(null);
            }} 
            sx={{ textTransform: 'none', color: '#64748b' }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleConfirmStartingReportNo} 
            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#0284c7' }}
          >
            Confirm & Add to Table
          </Button>
        </DialogActions>
      </Dialog>

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
                    ₱ {stagedTotalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>

            {/* Beginning Balance */}
            <Box>
              <Typography variant="subtitle2" fontWeight="700" sx={{ mb: 1, color: '#0f172a' }}>
                Beginning Balance (Cash on Hand)
              </Typography>
              <TextField
                fullWidth
                size="small"
                label="Beginning Balance (₱)"
                type="number"
                value={beginningBalanceInput}
                onChange={(e) => setBeginningBalanceInput(Number(e.target.value) || 0)}
                inputProps={{ min: 0, step: '0.01' }}
                helperText={`Previous report ending balance: ₱ ${previousReportEndingBalance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
              />
            </Box>

            {/* Unreported Bank Deposits */}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" fontWeight="700" sx={{ color: '#0f172a' }}>
                  Select Bank Deposits to Apply ({selectedDepositIds.length}/{unreportedDeposits.length})
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" sx={{ fontSize: '0.7rem', textTransform: 'none' }}
                    onClick={() => setSelectedDepositIds(unreportedDeposits.map(d => d.id))}>
                    Select All
                  </Button>
                  <Button size="small" sx={{ fontSize: '0.7rem', textTransform: 'none' }}
                    onClick={() => setSelectedDepositIds([])}>
                    None
                  </Button>
                </Box>
              </Box>
              {unreportedDeposits.length === 0 ? (
                <Alert severity="warning" sx={{ borderRadius: 1.5, fontSize: '0.8rem' }}>
                  No unreported bank deposits available. You can add deposits in the Deposits management page.
                </Alert>
              ) : (
                <Paper elevation={0} variant="outlined" sx={{ maxHeight: 220, overflow: 'auto', borderRadius: 1.5 }}>
                  {unreportedDeposits.map((dep) => {
                    const isSelected = selectedDepositIds.includes(dep.id);
                    return (
                      <Box
                        key={dep.id}
                        sx={{
                          display: 'flex', alignItems: 'center', px: 1.5, py: 0.8,
                          borderBottom: '1px solid #f1f5f9',
                          bgcolor: isSelected ? '#f0fdf4' : 'transparent',
                          '&:hover': { bgcolor: '#f8fafc' },
                          cursor: 'pointer'
                        }}
                        onClick={() => setSelectedDepositIds(prev =>
                          isSelected ? prev.filter(id => id !== dep.id) : [...prev, dep.id]
                        )}
                      >
                        <Checkbox
                          size="small"
                          checked={isSelected}
                          sx={{ p: 0.3, mr: 1, color: '#16a34a', '&.Mui-checked': { color: '#16a34a' } }}
                          onChange={() => {}}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: '#0f172a' }}>
                            {dep.depositControlNumber}
                          </Typography>
                          <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>
                            {dep.depositDate} · {dep.depositorName}
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: isSelected ? '#16a34a' : '#475569', ml: 1 }}>
                          ₱ {dep.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Typography>
                      </Box>
                    );
                  })}
                </Paper>
              )}
            </Box>

            {/* Live Ending Balance Preview */}
            <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#f0fdf4', borderRadius: 1.5, border: '1px solid #bbf7d0' }}>
              <Typography variant="caption" sx={{ color: '#166534', fontWeight: 700, display: 'block', mb: 0.5 }}>
                Projected Ending Cash Balance
              </Typography>
              {(() => {
                const selDepsTotal = round2(bankDeposits.filter(d => selectedDepositIds.includes(d.id)).reduce((s, d) => s + d.amount, 0));
                const projEnding = round2(round2(Number(beginningBalanceInput)) + round2(stagedTotalAmount) - selDepsTotal);
                return (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                    <Typography sx={{ fontSize: '0.75rem', color: '#166534' }}>
                      ₱{formatPeso(Number(beginningBalanceInput))} + ₱{formatPeso(stagedTotalAmount)} − ₱{formatPeso(selDepsTotal)} ({selectedDepositIds.length} deposits)
                    </Typography>
                    <Typography variant="subtitle2" fontWeight="900" sx={{ color: projEnding >= 0 ? '#16a34a' : '#b91c1c' }}>
                      = ₱ {formatPeso(projEnding)}
                    </Typography>
                  </Box>
                );
              })()}
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
      {/* ========================================================================= */}
      {/* PRINT OFFICIAL REPORT PREVIEW DIALOG                                     */}
      {/* ========================================================================= */}
      {printDialogOpen && (
        <style>{`
          @page {
            size: 13in 8.5in;
            margin: 5mm 5mm 5mm 5mm;
          }
          @media print {
            /* Hide the underlying web application completely */
            #root {
              display: none !important;
            }
            /* Hide modal backdrop, dialog title bar, buttons, and divider */
            .no-print,
            .MuiBackdrop-root,
            .MuiDialogTitle-root,
            .MuiDivider-root {
              display: none !important;
            }
            /* Reset body for pure document printing */
            html, body {
              width: 100% !important;
              height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              font-family: Arial, Helvetica, sans-serif !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            /* Flatten Dialog and Paper so no modal borders or shadows appear */
            .MuiDialog-root {
              position: static !important;
              z-index: auto !important;
              overflow: visible !important;
              display: block !important;
            }
            .MuiDialog-container {
              position: static !important;
              display: block !important;
              padding: 0 !important;
              margin: 0 !important;
              width: 100% !important;
              height: auto !important;
              overflow: visible !important;
            }
            .MuiPaper-root.MuiDialog-paper,
            .print-dialog-paper {
              position: static !important;
              box-shadow: none !important;
              border: none !important;
              border-radius: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
              max-width: 100% !important;
              width: 100% !important;
              height: auto !important;
              overflow: visible !important;
              background: #ffffff !important;
            }
            .MuiDialogContent-root,
            .print-dialog-content {
              padding: 0 !important;
              margin: 0 !important;
              overflow: visible !important;
              width: 100% !important;
              height: auto !important;
            }
            /* High-density printable table styling */
            .print-table-container {
              border: none !important;
              box-shadow: none !important;
              overflow: visible !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .print-matrix-table {
              width: 100% !important;
              table-layout: fixed !important;
              border-collapse: collapse !important;
            }
            .print-matrix-table th,
            .print-matrix-table td {
              border: 0.5pt solid #334155 !important;
              padding: 1.5px 2px !important;
              line-height: 1.15 !important;
              color: #000000 !important;
            }
            .print-matrix-table th {
              background-color: #f1f5f9 !important;
              font-weight: 800 !important;
              font-size: 6.2pt !important;
              text-align: center !important;
              vertical-align: middle !important;
              text-transform: uppercase !important;
            }
            .print-matrix-table td {
              font-size: 6.5pt !important;
            }
            .print-matrix-table tfoot td {
              font-weight: 800 !important;
              background-color: #f8fafc !important;
              border-top: 1pt solid #000000 !important;
              border-bottom: 1.5pt double #000000 !important;
            }
            .print-matrix-table tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .print-two-col-container {
              display: flex !important;
              flex-direction: row !important;
              gap: 12px !important;
              width: 100% !important;
              align-items: flex-start !important;
            }
            .print-col-half {
              flex: 1 1 50% !important;
              max-width: 50% !important;
              width: 50% !important;
            }
            .recap-print-wrapper {
              padding-left: 1in !important;
              padding-right: 1in !important;
              box-sizing: border-box !important;
              width: 100% !important;
            }
          }
        `}</style>
      )}
      <Dialog
        open={printDialogOpen}
        onClose={() => {
          setPrintDialogOpen(false);
          setPrintingReport(null);
        }}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          className: 'print-dialog-paper',
          sx: {
            borderRadius: 2,
            p: { xs: 1.5, md: 2.5 },
            '@media print': {
              borderRadius: 0,
              p: 0,
              m: 0,
              boxShadow: 'none',
              border: 'none',
              maxWidth: '100%',
              width: '100%',
              background: '#ffffff'
            }
          }
        }}
      >
        <DialogTitle
          className="no-print"
          component="div"
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1.5,
            '@media print': { display: 'none !important' }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="h6" fontWeight="800">
              {printViewMode === 'balances'
                ? (printingReport ? `Balances & Deposits: ${printingReport.reportNumber}` : 'Ending Balances, Deposits & Collections')
                : printViewMode === 'recap'
                ? (printingReport ? `Recapitulation: ${printingReport.reportNumber}` : 'Recapitulation of Collections & Deposits')
                : (printingReport ? `Reprint Report: ${printingReport.reportNumber}` : 'Print Consolidated Report Preview')}
            </Typography>
            {printingReport && (
              <Chip 
                label={`Archived • ${printingReport.afNo}`} 
                size="small" 
                color="info" 
                sx={{ fontWeight: 700, fontSize: '0.72rem' }} 
              />
            )}
            <ToggleButtonGroup
              value={printViewMode}
              exclusive
              size="small"
              onChange={(_, v) => v && setPrintViewMode(v)}
              sx={{ bgcolor: '#ffffff', height: 32 }}
            >
              <ToggleButton value="matrix" sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', px: 1.5, py: 0.2 }}>
                <TableChart sx={{ fontSize: 16, mr: 0.8, color: '#0284c7' }} />
                Matrix View (Landscape)
              </ToggleButton>
              <ToggleButton value="standard" sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', px: 1.5, py: 0.2 }}>
                <ViewList sx={{ fontSize: 16, mr: 0.8, color: '#64748b' }} />
                Standard List
              </ToggleButton>
              <ToggleButton value="recap" sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', px: 1.5, py: 0.2 }}>
                <Summarize sx={{ fontSize: 16, mr: 0.8, color: '#16a34a' }} />
                Recapitulation (RCD)
              </ToggleButton>
              <ToggleButton value="balances" sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', px: 1.5, py: 0.2 }}>
                <AccountBalance sx={{ fontSize: 16, mr: 0.8, color: '#7c3aed' }} />
                Balances & Deposits
              </ToggleButton>
            </ToggleButtonGroup>

            {printViewMode === 'recap' && (
              <ToggleButtonGroup
                value={recapLayoutMode}
                exclusive
                size="small"
                onChange={(_, v) => v && setRecapLayoutMode(v)}
                sx={{ bgcolor: '#f8fafc', height: 28, ml: 0.5 }}
              >
                <ToggleButton value="auto" sx={{ textTransform: 'none', fontSize: '0.68rem', px: 1, py: 0.1, fontWeight: 700 }}>
                  Auto ({printRecapData.items.length > 14 ? '2 Cols' : '1 Col'})
                </ToggleButton>
                <ToggleButton value="two-column" sx={{ textTransform: 'none', fontSize: '0.68rem', px: 1, py: 0.1, fontWeight: 700 }}>
                  2 Columns
                </ToggleButton>
                <ToggleButton value="single-column" sx={{ textTransform: 'none', fontSize: '0.68rem', px: 1, py: 0.1, fontWeight: 700 }}>
                  1 Column
                </ToggleButton>
              </ToggleButtonGroup>
            )}
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              startIcon={<Print />}
              onClick={() => window.print()}
              sx={{ 
                bgcolor: printViewMode === 'balances' ? '#7c3aed' : printViewMode === 'recap' ? '#16a34a' : '#0284c7', 
                textTransform: 'none', 
                fontWeight: 700,
                '&:hover': { bgcolor: printViewMode === 'balances' ? '#6d28d9' : printViewMode === 'recap' ? '#15803d' : '#0369a1' }
              }}
            >
              {printViewMode === 'balances' ? 'Print Balances & Deposits' : printViewMode === 'recap' ? 'Print Recapitulation' : 'Print Report'}
            </Button>
            <IconButton onClick={() => {
              setPrintDialogOpen(false);
              setPrintingReport(null);
            }} sx={{ bgcolor: '#f1f5f9' }}>
              <Clear />
            </IconButton>
          </Stack>
        </DialogTitle>
        <Divider className="no-print" sx={{ '@media print': { display: 'none !important' } }} />
        <DialogContent
          className="print-dialog-content"
          sx={{
            p: { xs: 1.5, md: 2.5 },
            '@media print': {
              p: '0 !important',
              m: '0 !important',
              overflow: 'visible !important'
            }
          }}
        >
          <Box
            className={(printViewMode === 'recap' || printViewMode === 'balances') ? 'recap-print-wrapper' : ''}
            sx={{
              width: '100%',
              boxSizing: 'border-box',
              px: (printViewMode === 'recap' || printViewMode === 'balances') ? { xs: 2, sm: 3, md: '1in' } : 0,
              '@media print': {
                px: (printViewMode === 'recap' || printViewMode === 'balances') ? '1in !important' : '0 !important',
                boxSizing: 'border-box !important'
              }
            }}
          >
            {/* Printable Report Header */}
          <Box sx={{ textAlign: 'center', mb: { xs: 1.5, md: 2 }, '@media print': { mb: 0.8 } }}>
            <Typography sx={{ fontSize: '6.5pt', textTransform: 'uppercase', letterSpacing: 0.5, color: '#475569', fontWeight: 600, lineHeight: 1.2 }}>
              Republic of the Philippines • Province of Romblon
            </Typography>
            <Typography sx={{ fontSize: '9pt', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
              MUNICIPALITY OF CONCEPCION
            </Typography>
            <Typography sx={{ fontSize: '7.5pt', fontWeight: 700, color: '#0284c7', lineHeight: 1.2 }}>
              OFFICE OF THE MUNICIPAL TREASURER
            </Typography>
            <Typography sx={{ fontSize: '10pt', fontWeight: 900, mt: 0.3, color: '#0f172a', letterSpacing: 0.5, lineHeight: 1.2 }}>
              {printViewMode === 'balances'
                ? 'REPORT OF ENDING BALANCES, DEPOSITS, AND COLLECTIONS'
                : printViewMode === 'recap'
                ? 'REPORT OF COLLECTIONS AND DEPOSITS — RECAPITULATION'
                : (printingReport ? 'OFFICIAL REPORT OF COLLECTIONS' : 'CONSOLIDATED REPORT OF COLLECTIONS')}
            </Typography>
            <Typography sx={{ fontSize: '6.5pt', color: '#64748b', mt: 0.2, lineHeight: 1.2 }}>
              {printingReport ? `Report No: ${printingReport.reportNumber} • ` : ''}Period: {printDatePeriodDisplay} • {printingReport ? `Collector: ${printingReport.collectorName} • ` : ''}Printed: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </Typography>
          </Box>

          {/* Staged Table in Print View */}
          {printViewMode === 'matrix' ? (
            /* Waterworks Matrix Layout */
            <TableContainer
              component={Paper}
              elevation={0}
              className="print-table-container"
              sx={{
                border: '1px solid #cbd5e1',
                borderRadius: 1,
                overflowX: 'auto',
                '@media print': { border: 'none', borderRadius: 0, overflow: 'visible', width: '100%' }
              }}
            >
              <Table size="small" className="print-matrix-table" sx={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: '#f1f5f9', fontWeight: 800, fontSize: '6.2pt', border: '0.5pt solid #334155', py: 0.3, px: 0.3, color: '#0f172a', textAlign: 'center !important', verticalAlign: 'middle !important' } }}>
                    <TableCell rowSpan={2} align="center" sx={{ width: '2.5%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>#</TableCell>
                    <TableCell rowSpan={2} align="center" sx={{ width: '9.5%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Collector Name</TableCell>
                    <TableCell rowSpan={2} align="center" sx={{ width: '4.5%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Booklet</TableCell>
                    <TableCell rowSpan={2} align="center" sx={{ width: '8.5%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>OR Numbers</TableCell>
                    <TableCell rowSpan={2} align="center" sx={{ width: '6.5%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Report No.</TableCell>
                    <TableCell rowSpan={2} align="center" sx={{ width: '4.6%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Poblacion</TableCell>
                    <TableCell rowSpan={2} align="center" sx={{ width: '4.6%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>San Pedro</TableCell>
                    <TableCell colSpan={2} align="center" sx={{ width: '8.4%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Calabasahan</TableCell>
                    <TableCell colSpan={2} align="center" sx={{ width: '8.4%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Sampong</TableCell>
                    <TableCell rowSpan={2} align="center" sx={{ width: '4.6%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Bakhawan</TableCell>
                    <TableCell rowSpan={2} align="center" sx={{ width: '4.6%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Masudsud</TableCell>
                    <TableCell rowSpan={2} align="center" sx={{ width: '4.6%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Dalajican</TableCell>
                    <TableCell rowSpan={2} align="center" sx={{ width: '4.6%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>San Vicente</TableCell>
                    <TableCell rowSpan={2} align="center" sx={{ width: '4.8%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>RPT</TableCell>
                    <TableCell rowSpan={2} align="center" sx={{ width: '8.5%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Sundry</TableCell>
                    <TableCell rowSpan={2} align="center" sx={{ width: '5.5%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Account Code</TableCell>
                    <TableCell rowSpan={2} align="center" sx={{ width: '5.4%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Amount (₱)</TableCell>
                  </TableRow>
                  <TableRow sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 700, fontSize: '5.8pt', border: '0.5pt solid #334155', py: 0.2, px: 0.3, color: '#0f172a', textAlign: 'center !important', verticalAlign: 'middle !important' } }}>
                    <TableCell align="center" sx={{ width: '4.2%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Spring</TableCell>
                    <TableCell align="center" sx={{ width: '4.2%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Pump</TableCell>
                    <TableCell align="center" sx={{ width: '4.2%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Spring</TableCell>
                    <TableCell align="center" sx={{ width: '4.2%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Pump</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {printMatrixData.rows.map((mr) => (
                    <TableRow key={mr.key} sx={{ '& td': { py: 0.25, px: 0.3, fontSize: '6.5pt', border: '0.5pt solid #475569', color: '#000000', lineHeight: 1.15 } }}>
                        <TableCell align="center">{mr.rowNumber}</TableCell>
                        <TableCell sx={{ fontWeight: 600, wordBreak: 'break-word' }}>{mr.collectorName}</TableCell>
                        <TableCell align="center">{mr.bookletNo}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '5.8pt', wordBreak: 'break-all' }}>{cleanOrDisplay(mr.orNumbersDisplay)}</TableCell>
                        <TableCell align="center" sx={{ fontFamily: 'monospace', fontSize: '6pt', fontWeight: 700 }}>{mr.reportNo}</TableCell>
                        <TableCell align="right">{mr.poblacion ? Number(mr.poblacion).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                        <TableCell align="right">{mr.sanPedro ? Number(mr.sanPedro).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                        <TableCell align="right">{mr.calabasahanSpring ? Number(mr.calabasahanSpring).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                        <TableCell align="right">{mr.calabasahanPump ? Number(mr.calabasahanPump).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                        <TableCell align="right">{mr.sampongSpring ? Number(mr.sampongSpring).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                        <TableCell align="right">{mr.sampongPump ? Number(mr.sampongPump).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                        <TableCell align="right">{mr.bakhawan ? Number(mr.bakhawan).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                        <TableCell align="right">{mr.masudsud ? Number(mr.masudsud).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                        <TableCell align="right">{mr.dalajican ? Number(mr.dalajican).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                        <TableCell align="right">{mr.sanVicente ? Number(mr.sanVicente).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: mr.rpt ? 700 : 400 }}>{mr.rpt ? Number(mr.rpt).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                        <TableCell sx={{ fontWeight: 600, wordBreak: 'break-word' }}>{mr.subCategory}</TableCell>
                        <TableCell align="center" sx={{ fontFamily: 'monospace', fontSize: '6pt' }}>{mr.accountCode}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{Number(mr.amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    ))
                  }
                </TableBody>
                {printRows.length > 0 && (
                  <TableFooter>
                    <TableRow sx={{ bgcolor: '#f8fafc', '& td': { fontWeight: 800, py: 0.3, px: 0.3, fontSize: '6.5pt', border: '0.5pt solid #000000', color: '#000000' } }}>
                      <TableCell colSpan={5} align="center">
                        TOTAL
                      </TableCell>
                      <TableCell align="right">{printMatrixData.totals.poblacion > 0 ? Number(printMatrixData.totals.poblacion).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</TableCell>
                      <TableCell align="right">{printMatrixData.totals.sanPedro > 0 ? Number(printMatrixData.totals.sanPedro).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</TableCell>
                      <TableCell align="right">{printMatrixData.totals.calSpring > 0 ? Number(printMatrixData.totals.calSpring).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</TableCell>
                      <TableCell align="right">{printMatrixData.totals.calPump > 0 ? Number(printMatrixData.totals.calPump).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</TableCell>
                      <TableCell align="right">{printMatrixData.totals.samSpring > 0 ? Number(printMatrixData.totals.samSpring).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</TableCell>
                      <TableCell align="right">{printMatrixData.totals.samPump > 0 ? Number(printMatrixData.totals.samPump).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</TableCell>
                      <TableCell align="right">{printMatrixData.totals.bakhawan > 0 ? Number(printMatrixData.totals.bakhawan).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</TableCell>
                      <TableCell align="right">{printMatrixData.totals.masudsud > 0 ? Number(printMatrixData.totals.masudsud).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</TableCell>
                      <TableCell align="right">{printMatrixData.totals.dalajican > 0 ? Number(printMatrixData.totals.dalajican).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</TableCell>
                      <TableCell align="right">{printMatrixData.totals.sanVicente > 0 ? Number(printMatrixData.totals.sanVicente).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</TableCell>
                      <TableCell align="right">{printMatrixData.totals.rpt > 0 ? Number(printMatrixData.totals.rpt).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</TableCell>
                      <TableCell colSpan={2} />
                      <TableCell align="right" sx={{ fontWeight: 900, fontSize: '7pt' }}>
                        ₱ {Number(printMatrixData.totals.grandTotal).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </TableContainer>
          ) : printViewMode === 'standard' ? (
            /* Printable Standard List Table */
            <TableContainer
              component={Paper}
              elevation={0}
              className="print-table-container"
              sx={{
                border: '1px solid #cbd5e1',
                borderRadius: 1,
                overflowX: 'auto',
                '@media print': { border: 'none', borderRadius: 0, overflow: 'visible', width: '100%' }
              }}
            >
              <Table size="small" className="print-matrix-table" sx={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: '#f1f5f9', fontWeight: 800, fontSize: '6.5pt', border: '0.5pt solid #334155', py: 0.3, px: 0.4, textAlign: 'center !important', verticalAlign: 'middle !important' } }}>
                    <TableCell align="center" sx={{ width: '3.5%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>#</TableCell>
                    <TableCell align="center" sx={{ width: '20%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Collector Name</TableCell>
                    <TableCell align="center" sx={{ width: '9%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Booklet No.</TableCell>
                    <TableCell align="center" sx={{ width: '19%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>OR Numbers</TableCell>
                    <TableCell align="center" sx={{ width: '11%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Report No.</TableCell>
                    <TableCell align="center" sx={{ width: '19%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Sundry</TableCell>
                    <TableCell align="center" sx={{ width: '9.5%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Account Code</TableCell>
                    <TableCell align="center" sx={{ width: '9%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {printRows.map((r, idx) => {
                    const isFirstRowOfBatch = idx === 0 || r.batchId !== printRows[idx - 1].batchId;
                    const isLastRowOfBatch = idx === printRows.length - 1 || r.batchId !== printRows[idx + 1].batchId;
                    const batchTotal = printBatchTotalsMap.get(r.batchId) || r.amount;

                    return (
                      <React.Fragment key={idx}>
                        <TableRow sx={{ '& td': { py: 0.25, px: 0.4, fontSize: '6.5pt', border: '0.5pt solid #475569' } }}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>{isFirstRowOfBatch ? r.collectorName : ''}</TableCell>
                          <TableCell>{isFirstRowOfBatch ? formatBookletDisplay(r.bookletNo, r.collectionType) : ''}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '6pt' }}>{isFirstRowOfBatch ? cleanOrDisplay(r.orNumbersDisplay) : ''}</TableCell>
                          <TableCell align="center" sx={{ fontFamily: 'monospace', fontSize: '6pt', fontWeight: 700 }}>{isFirstRowOfBatch ? (r.reportNo || '') : ''}</TableCell>
                          <TableCell>{r.subCategory}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '6pt' }}>{r.accountCode}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>
                            ₱ {r.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>

                        {/* Booklet Total Row in Print Preview */}
                        {isLastRowOfBatch && (
                          <TableRow sx={{ bgcolor: '#f1f5f9', '& td': { py: 0.3, px: 0.4, fontSize: '6.8pt', fontWeight: 800, border: '0.5pt solid #334155' } }}>
                            <TableCell />
                            <TableCell colSpan={3}>
                              Total Booklet ({formatBookletDisplay(r.bookletNo, r.collectionType)})
                            </TableCell>
                            <TableCell colSpan={3} sx={{ fontSize: '6.2pt', color: '#475569', fontStyle: 'italic' }}>
                              Subtotal for {cleanOrDisplay(r.orNumbersDisplay)}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800 }}>
                              ₱ {batchTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          ) : printViewMode === 'recap' ? (
            /* Printable Recapitulation (RCD) - Minimal Layout, 8.5 x 13 Landscape, 2-Column Split Support */
            (() => {
              const isTwoColumn = recapLayoutMode === 'two-column' || (recapLayoutMode === 'auto' && printRecapData.items.length > 14);
              const mid = Math.ceil(printRecapData.items.length / 2);
              const col1Items = isTwoColumn ? printRecapData.items.slice(0, mid) : printRecapData.items;
              const col2Items = isTwoColumn ? printRecapData.items.slice(mid) : [];
              const subtotal1 = col1Items.reduce((sum, item) => sum + item.amount, 0);
              const subtotal2 = col2Items.reduce((sum, item) => sum + item.amount, 0);

              if (printRecapData.items.length === 0) {
                return (
                  <Box sx={{ py: 6, textAlign: 'center', color: '#94a3b8' }}>
                    <Typography variant="body2">No collections recorded for recapitulation.</Typography>
                  </Box>
                );
              }

              return (
                <Box sx={{ width: '100%' }}>
                  {isTwoColumn ? (
                    /* Two-Column Side-by-Side Recapitulation Layout */
                    <Box className="print-two-col-container" sx={{ display: 'flex', gap: 2, width: '100%', alignItems: 'stretch' }}>
                      {/* Left Column Table */}
                      <TableContainer
                        component={Paper}
                        elevation={0}
                        className="print-table-container print-col-half"
                        sx={{
                          flex: 1,
                          border: '1px solid #cbd5e1',
                          borderRadius: 1,
                          '@media print': { border: 'none', borderRadius: 0, overflow: 'visible' }
                        }}
                      >
                        <Table size="small" className="print-matrix-table" sx={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                          <TableHead>
                            <TableRow sx={{ '& th': { bgcolor: '#f1f5f9', fontWeight: 800, fontSize: '6.5pt', border: '0.5pt solid #334155', py: 0.35, px: 0.5, color: '#0f172a' } }}>
                              <TableCell sx={{ width: '56%', textAlign: 'left !important' }}>Sundry</TableCell>
                              <TableCell align="center" sx={{ width: '22%', textAlign: 'center !important' }}>Account Code</TableCell>
                              <TableCell align="right" sx={{ width: '22%', textAlign: 'right !important' }}>Amount (₱)</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {col1Items.map((item, idx) => (
                              <TableRow key={idx} sx={{ '& td': { py: 0.25, px: 0.5, fontSize: '6.5pt', border: '0.5pt solid #475569', lineHeight: 1.15 } }}>
                                <TableCell sx={{ fontWeight: 600, wordBreak: 'break-word' }}>{item.subCategory}</TableCell>
                                <TableCell align="center" sx={{ fontFamily: 'monospace', fontSize: '6pt' }}>{item.accountCode}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>
                                  {item.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                          <TableFooter>
                            <TableRow sx={{ bgcolor: '#f8fafc', '& td': { fontWeight: 800, py: 0.35, px: 0.5, fontSize: '6.5pt', border: '0.5pt solid #000000' } }}>
                              <TableCell colSpan={2} align="right">SUBTOTAL (COLUMN 1):</TableCell>
                              <TableCell align="right">₱ {subtotal1.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            </TableRow>
                          </TableFooter>
                        </Table>
                      </TableContainer>

                      {/* Right Column Table */}
                      <TableContainer
                        component={Paper}
                        elevation={0}
                        className="print-table-container print-col-half"
                        sx={{
                          flex: 1,
                          border: '1px solid #cbd5e1',
                          borderRadius: 1,
                          '@media print': { border: 'none', borderRadius: 0, overflow: 'visible' }
                        }}
                      >
                        <Table size="small" className="print-matrix-table" sx={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                          <TableHead>
                            <TableRow sx={{ '& th': { bgcolor: '#f1f5f9', fontWeight: 800, fontSize: '6.5pt', border: '0.5pt solid #334155', py: 0.35, px: 0.5, color: '#0f172a' } }}>
                              <TableCell sx={{ width: '56%', textAlign: 'left !important' }}>Sundry</TableCell>
                              <TableCell align="center" sx={{ width: '22%', textAlign: 'center !important' }}>Account Code</TableCell>
                              <TableCell align="right" sx={{ width: '22%', textAlign: 'right !important' }}>Amount (₱)</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {col2Items.map((item, idx) => (
                              <TableRow key={idx} sx={{ '& td': { py: 0.25, px: 0.5, fontSize: '6.5pt', border: '0.5pt solid #475569', lineHeight: 1.15 } }}>
                                <TableCell sx={{ fontWeight: 600, wordBreak: 'break-word' }}>{item.subCategory}</TableCell>
                                <TableCell align="center" sx={{ fontFamily: 'monospace', fontSize: '6pt' }}>{item.accountCode}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>
                                  {item.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                          <TableFooter>
                            <TableRow sx={{ bgcolor: '#f8fafc', '& td': { fontWeight: 800, py: 0.35, px: 0.5, fontSize: '6.5pt', border: '0.5pt solid #000000' } }}>
                              <TableCell colSpan={2} align="right">SUBTOTAL (COLUMN 2):</TableCell>
                              <TableCell align="right">₱ {subtotal2.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            </TableRow>
                          </TableFooter>
                        </Table>
                      </TableContainer>
                    </Box>
                  ) : (
                    /* Single-Column Centered Recapitulation Layout */
                    <TableContainer
                      component={Paper}
                      elevation={0}
                      className="print-table-container"
                      sx={{
                        maxWidth: '75%',
                        margin: '0 auto',
                        border: '1px solid #cbd5e1',
                        borderRadius: 1,
                        '@media print': { border: 'none', borderRadius: 0, overflow: 'visible', maxWidth: '80%' }
                      }}
                    >
                      <Table size="small" className="print-matrix-table" sx={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                        <TableHead>
                          <TableRow sx={{ '& th': { bgcolor: '#f1f5f9', fontWeight: 800, fontSize: '6.8pt', border: '0.5pt solid #334155', py: 0.35, px: 0.6, color: '#0f172a' } }}>
                            <TableCell sx={{ width: '55%', textAlign: 'left !important' }}>Sundry</TableCell>
                            <TableCell align="center" sx={{ width: '23%', textAlign: 'center !important' }}>Account Code</TableCell>
                            <TableCell align="right" sx={{ width: '22%', textAlign: 'right !important' }}>Amount (₱)</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {col1Items.map((item, idx) => (
                            <TableRow key={idx} sx={{ '& td': { py: 0.3, px: 0.6, fontSize: '6.8pt', border: '0.5pt solid #475569', lineHeight: 1.2 } }}>
                              <TableCell sx={{ fontWeight: 600, wordBreak: 'break-word' }}>{item.subCategory}</TableCell>
                              <TableCell align="center" sx={{ fontFamily: 'monospace', fontSize: '6.5pt' }}>{item.accountCode}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>
                                {item.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow sx={{ bgcolor: '#f8fafc', '& td': { fontWeight: 900, py: 0.4, px: 0.6, fontSize: '7.5pt', border: '0.5pt solid #000000' } }}>
                            <TableCell colSpan={2} align="right">TOTAL COLLECTIONS (RECAPITULATION):</TableCell>
                            <TableCell align="right">₱ {printRecapData.grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </TableContainer>
                  )}

                  {/* Summary Bar for 2-column mode */}
                  {isTwoColumn && (
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mt: 0.8,
                        py: 0.4,
                        px: 1.5,
                        bgcolor: '#f1f5f9',
                        border: '0.5pt solid #000000',
                        borderRadius: 0.5,
                        '@media print': {
                          bgcolor: '#f8fafc !important',
                          border: '0.5pt solid #000000 !important'
                        }
                      }}
                    >
                      <Typography sx={{ fontSize: '7pt', fontWeight: 800, color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        TOTAL COLLECTIONS (RECAPITULATION)
                      </Typography>
                      <Typography sx={{ fontSize: '8pt', fontWeight: 900, color: '#000000', fontFamily: 'monospace' }}>
                        ₱ {printRecapData.grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                  )}
                </Box>
              );
            })()
          ) : (
            /* Balances, Deposits & Collections View */
            <Box sx={{ width: '100%' }}>
              {/* Document Overview Strip */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  bgcolor: '#f8fafc',
                  border: '0.5pt solid #000000',
                  px: 1.5,
                  py: 0.6,
                  mb: 1.5,
                  fontSize: '7pt',
                  flexWrap: 'wrap',
                  gap: 1
                }}
              >
                <Box>
                  <Typography component="span" sx={{ fontWeight: 800, fontSize: '7pt' }}>Report Reference: </Typography>
                  <Typography component="span" sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '7pt' }}>
                    {printingReport ? printingReport.reportNumber : 'CONSOLIDATED REPORT'}
                  </Typography>
                </Box>
                <Box>
                  <Typography component="span" sx={{ fontWeight: 800, fontSize: '7pt' }}>Accountable Officer: </Typography>
                  <Typography component="span" sx={{ fontWeight: 700, fontSize: '7pt', textTransform: 'uppercase' }}>
                    {printingReport ? printingReport.collectorName : (user?.name || 'MUNICIPAL TREASURER')}
                  </Typography>
                </Box>
                <Box>
                  <Typography component="span" sx={{ fontWeight: 800, fontSize: '7pt' }}>Period Covered: </Typography>
                  <Typography component="span" sx={{ fontSize: '7pt' }}>{printDatePeriodDisplay}</Typography>
                </Box>
              </Box>

              {/* Two-Column Top Grid: A (Remittances & Deposits) and B (Summary of Collections) */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5, mb: 1.5, '@media print': { gridTemplateColumns: '1fr 1fr', gap: '8pt', mb: '8pt' } }}>
                {/* SECTION A: REMITTANCES & BANK DEPOSITS */}
                <Box sx={{ border: '0.5pt solid #000000', p: 0.8, bgcolor: '#ffffff' }}>
                  <Box sx={{ bgcolor: '#f1f5f9', py: 0.4, px: 0.8, borderBottom: '0.5pt solid #000000', mb: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontSize: '7pt', fontWeight: 900, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      A. REMITTANCES & BANK DEPOSITS
                    </Typography>
                    <Typography sx={{ fontSize: '6.5pt', color: '#64748b', fontWeight: 600 }}>
                      ({printReportSelectedDeposits.deposits.length} Records)
                    </Typography>
                  </Box>
                  <TableContainer component={Paper} elevation={0} sx={{ border: 'none', maxHeight: 260, '@media print': { maxHeight: 'none' } }}>
                    <Table size="small" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                      <TableHead>
                        <TableRow sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 800, fontSize: '6.5pt', border: '0.5pt solid #000000', py: 0.3, px: 0.5 } }}>
                          <TableCell sx={{ width: '22%' }}>Date</TableCell>
                          <TableCell sx={{ width: '28%' }}>Deposit Control No.</TableCell>
                          <TableCell sx={{ width: '28%' }}>Name of Depositor</TableCell>
                          <TableCell align="right" sx={{ width: '22%' }}>Amount (₱)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {printReportSelectedDeposits.deposits.length === 0 ? (
                          <TableRow sx={{ '& td': { py: 1, px: 0.5, fontSize: '6.5pt', border: '0.5pt solid #000000', textAlign: 'center', color: '#64748b' } }}>
                            <TableCell colSpan={4}>
                              No deposit records applied to this report.
                            </TableCell>
                          </TableRow>
                        ) : (
                          printReportSelectedDeposits.deposits.map((dep: any, idx: number) => (
                            <TableRow key={dep.id || idx} sx={{ '& td': { py: 0.25, px: 0.5, fontSize: '6.5pt', border: '0.5pt solid #000000' } }}>
                              <TableCell>{dep.depositDate}</TableCell>
                              <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{dep.depositControlNumber}</TableCell>
                              <TableCell sx={{ textTransform: 'uppercase' }}>{dep.depositorName}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>
                                {Number(dep.amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                      <TableFooter>
                        <TableRow sx={{ bgcolor: '#f1f5f9', '& td': { fontWeight: 900, py: 0.4, px: 0.5, fontSize: '7pt', border: '0.5pt solid #000000' } }}>
                          <TableCell colSpan={3} align="right">TOTAL REMITTANCES / DEPOSITS:</TableCell>
                          <TableCell align="right">₱ {printReportSelectedDeposits.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </TableContainer>
                </Box>

                {/* SECTION B: SUMMARY OF COLLECTIONS (TOTAL ONLY OF EACH BOOKLET) */}
                <Box sx={{ border: '0.5pt solid #000000', p: 0.8, bgcolor: '#ffffff' }}>
                  <Box sx={{ bgcolor: '#f1f5f9', py: 0.4, px: 0.8, borderBottom: '0.5pt solid #000000', mb: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontSize: '7pt', fontWeight: 900, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      B. SUMMARY OF COLLECTIONS (TOTAL ONLY OF EACH BOOKLET)
                    </Typography>
                    <Typography sx={{ fontSize: '6.5pt', color: '#64748b', fontWeight: 600 }}>
                      ({printBookletSummaryData.booklets.length} Booklets)
                    </Typography>
                  </Box>
                  <TableContainer component={Paper} elevation={0} sx={{ border: 'none', maxHeight: 260, '@media print': { maxHeight: 'none' } }}>
                    <Table size="small" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                      <TableHead>
                        <TableRow sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 800, fontSize: '6.5pt', border: '0.5pt solid #000000', py: 0.3, px: 0.5 } }}>
                          <TableCell sx={{ width: '22%' }}>Booklet No.</TableCell>
                          <TableCell sx={{ width: '18%' }}>Report No.</TableCell>
                          <TableCell sx={{ width: '22%' }}>Collector</TableCell>
                          <TableCell sx={{ width: '18%' }}>OR Range</TableCell>
                          <TableCell align="right" sx={{ width: '20%' }}>Amount (₱)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {printBookletSummaryData.booklets.length === 0 ? (
                          <TableRow sx={{ '& td': { py: 1, px: 0.5, fontSize: '6.5pt', border: '0.5pt solid #000000', textAlign: 'center', color: '#64748b' } }}>
                            <TableCell colSpan={5}>
                              No booklet collection records available.
                            </TableCell>
                          </TableRow>
                        ) : (
                          printBookletSummaryData.booklets.map((b, idx) => (
                            <TableRow key={b.batchId || idx} sx={{ '& td': { py: 0.25, px: 0.5, fontSize: '6.5pt', border: '0.5pt solid #000000' } }}>
                              <TableCell sx={{ fontWeight: 700 }}>{b.bookletNo}</TableCell>
                              <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{b.reportNo}</TableCell>
                              <TableCell sx={{ textTransform: 'uppercase' }}>{b.collectorName}</TableCell>
                              <TableCell sx={{ fontFamily: 'monospace' }}>{b.orNumbersDisplay}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>
                                {b.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                      <TableFooter>
                        <TableRow sx={{ bgcolor: '#f1f5f9', '& td': { fontWeight: 900, py: 0.4, px: 0.5, fontSize: '7pt', border: '0.5pt solid #000000' } }}>
                          <TableCell colSpan={4} align="right">TOTAL COLLECTIONS:</TableCell>
                          <TableCell align="right">₱ {printBookletSummaryData.grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </TableContainer>
                </Box>
              </Box>

              {/* SECTION C: SUMMARY OF CASH & ENDING BALANCE (ACCOUNTABILITY) */}
              <Box sx={{ border: '1pt solid #000000', p: 1.2, bgcolor: '#f8fafc', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                <Typography sx={{ fontSize: '7.5pt', fontWeight: 900, textTransform: 'uppercase', mb: 1, letterSpacing: 0.5, color: '#0f172a' }}>
                  C. SUMMARY OF CASH & ENDING BALANCE (ACCOUNTABILITY)
                </Typography>
                <Table size="small" sx={{ width: '100%', maxWidth: 650, borderCollapse: 'collapse', mx: 'auto' }}>
                  <TableBody>
                    <TableRow sx={{ '& td': { py: 0.25, fontSize: '7pt' } }}>
                      <TableCell sx={{ width: '60%', border: 'none' }}>Beginning Balance (Cash on Hand / Undeposited):</TableCell>
                      <TableCell align="right" sx={{ width: '10%', border: 'none', fontWeight: 700 }}>₱</TableCell>
                      <TableCell align="right" sx={{ width: '30%', border: 'none', fontWeight: 700, fontFamily: 'monospace' }}>
                        {printReportBeginningBalance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ '& td': { py: 0.25, fontSize: '7pt' } }}>
                      <TableCell sx={{ pl: 2, border: 'none' }}>Add: Total Collections (Total of each booklet):</TableCell>
                      <TableCell align="right" sx={{ border: 'none', fontWeight: 700 }}>₱</TableCell>
                      <TableCell align="right" sx={{ border: 'none', fontWeight: 700, fontFamily: 'monospace' }}>
                        {printBookletSummaryData.grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ '& td': { py: 0.25, fontSize: '7pt', bgcolor: '#f1f5f9' } }}>
                      <TableCell sx={{ fontWeight: 800, borderTop: '0.5pt solid #000000', borderBottom: '0.5pt solid #000000' }}>
                        Total Funds to be Accounted For:
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, borderTop: '0.5pt solid #000000', borderBottom: '0.5pt solid #000000' }}>₱</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, borderTop: '0.5pt solid #000000', borderBottom: '0.5pt solid #000000', fontFamily: 'monospace' }}>
                        {(printReportBeginningBalance + printBookletSummaryData.grandTotal).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ '& td': { py: 0.25, fontSize: '7pt' } }}>
                      <TableCell sx={{ pl: 2, border: 'none' }}>Less: Total Remittances / Deposits to Bank:</TableCell>
                      <TableCell align="right" sx={{ border: 'none', fontWeight: 700 }}>₱</TableCell>
                      <TableCell align="right" sx={{ border: 'none', fontWeight: 700, fontFamily: 'monospace', color: '#16a34a' }}>
                        {printReportSelectedDeposits.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ '& td': { py: 0.4, fontSize: '8pt', bgcolor: '#ffffff' } }}>
                      <TableCell sx={{ fontWeight: 900, borderTop: '1pt solid #000000', borderBottom: '2pt double #000000', color: '#0f172a' }}>
                        ENDING CASH BALANCE (Undeposited Collections):
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, borderTop: '1pt solid #000000', borderBottom: '2pt double #000000', color: printReportEndingBalance > 0 ? '#b91c1c' : '#16a34a' }}>₱</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, borderTop: '1pt solid #000000', borderBottom: '2pt double #000000', fontFamily: 'monospace', color: printReportEndingBalance > 0 ? '#b91c1c' : '#16a34a' }}>
                        {printReportEndingBalance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Box>
            </Box>
          )}

          <Box className="no-print" sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #bae6fd' }}>
            <Typography variant="h6" fontWeight="800" sx={{ color: '#0284c7' }}>
              GRAND TOTAL: ₱ {(printViewMode === 'recap' || printViewMode === 'balances' ? printRecapData.grandTotal : printTotalAmount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Typography>
          </Box>

          {/* Official Signatures for Printed 8.5 x 13 Document */}
          <Box
            sx={{
              display: (printViewMode === 'recap' || printViewMode === 'balances') ? 'flex' : 'none',
              '@media print': { display: 'flex !important' },
              justifyContent: 'space-between',
              mt: 2.5,
              pt: 1,
              px: 3,
              pageBreakInside: 'avoid',
              breakInside: 'avoid'
            }}
          >
            <Box sx={{ textAlign: 'center', width: 220 }}>
              <Typography sx={{ fontSize: '6.5pt', color: '#475569', mb: 2.5 }}>Prepared by:</Typography>
              <Box sx={{ borderBottom: '1px solid #000000', mb: 0.3 }} />
              <Typography sx={{ fontSize: '7.5pt', fontWeight: 700, textTransform: 'uppercase' }}>
                {printingReport ? printingReport.collectorName : (user?.name || 'Collecting Officer')}
              </Typography>
              <Typography sx={{ fontSize: '6pt', color: '#64748b' }}>Designation / Revenue Collector</Typography>
            </Box>
            <Box sx={{ textAlign: 'center', width: 220 }}>
              <Typography sx={{ fontSize: '6.5pt', color: '#475569', mb: 2.5 }}>Certified Correct:</Typography>
              <Box sx={{ borderBottom: '1px solid #000000', mb: 0.3 }} />
              <Typography sx={{ fontSize: '7.5pt', fontWeight: 700, textTransform: 'uppercase' }}>
                MENARD A. HERRERA
              </Typography>
              <Typography sx={{ fontSize: '6pt', color: '#64748b' }}>Municipal Treasurer</Typography>
            </Box>
          </Box>
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
        onConfirm={() => handleConfirmUnmark(reportToUnmark)}
        onClose={() => {
          setUnmarkConfirmOpen(false);
          // Note: do NOT null out reportToUnmark here — ConfirmDialog calls onClose()
          // immediately after onConfirm(), and the async handler still needs this value.
          // The handler clears reportToUnmark itself after completion.
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
