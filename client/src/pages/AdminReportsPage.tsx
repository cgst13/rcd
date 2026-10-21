import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
  LinearProgress,
  Backdrop,
  Stack,
  Autocomplete,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  Checkbox,
  Avatar,
  FormControl,
  InputLabel,
  Select,
  MenuItem
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
  FileDownload,
  DeleteOutline,
  PlaylistAddCheck,
  Send,
  SelectAll,
  CalendarMonth,
  CalendarToday,
  TableChart,
  Summarize,
  AccountBalance,
  LockClock,
  Cancel,
  FilterListOff,
  LockReset,
  Close
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
  markCollectorReportsAsConsolidated,
  revertCollectorReportsFromConsolidation,
  markWeeklyReportsAsConsolidatedInMonthly,
  revertWeeklyReportsFromMonthly,
  approveUnarchiveReport,
  rejectUnarchiveReport,
  getBankDeposits,
  getSignatories,
  type BankDepositRecord,
  type CollectionItem,
  type AdminSubmittedReportRecord,
  type AdminSubCategoryCharge
} from '../services/supabaseService';
import type { RPTCollectionItem, Signatory } from '../types/rcd';

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

export const getDisplaySubmissionDate = (report?: { submittedAt?: string; dateFrom?: string; dateTo?: string; reportDate?: string } | null): string => {
  if (!report) return '-';
  if (report.reportDate) return report.reportDate;
  if (report.submittedAt) {
    try {
      const d = new Date(report.submittedAt);
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
    } catch {}
  }
  return report.dateFrom || report.dateTo || '-';
};

/**
 * Sort deposit records chronologically from oldest to newest by deposit date / creation time.
 */
export const sortDepositsOldestToLatest = <T extends { depositDate?: string; createdAt?: string; depositControlNumber?: string }>(deposits: T[]): T[] => {
  return [...deposits].sort((a, b) => {
    const dateA = a.depositDate || a.createdAt || '';
    const dateB = b.depositDate || b.createdAt || '';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const ctrlA = a.depositControlNumber || '';
    const ctrlB = b.depositControlNumber || '';
    return ctrlA.localeCompare(ctrlB, undefined, { numeric: true, sensitivity: 'base' });
  });
};

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
  submissionDate?: string;
  collectionType: 'general' | 'rpt' | 'ctc' | 'consol' | string;
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

/**
 * Detect whether a collection entry represents a Water Surcharge (Fines and Penalties - Water / Business Income).
 * Surcharges are the ONLY water charges that should be included in sundry amounts.
 */
export const isWaterSurcharge = (item?: { subCategory?: string; mainCategory?: string; accountCode?: string; remarks?: string } | null): boolean => {
  if (!item) return false;
  const sub = (item.subCategory || '').trim().toLowerCase();
  const main = (item.mainCategory || '').trim().toLowerCase();
  const rem = (item.remarks || '').trim().toLowerCase();
  const code = (item.accountCode || '').trim();

  // Philippine Standard Chart of Accounts code for Fines and Penalties - Business Income (Water Surcharge)
  if (code === '4-02-02-980' || code === '40202980') return true;

  // Check explicit water surcharge naming
  const isSurchargeTerm = sub.includes('surcharge') || rem.includes('surcharge') || sub.includes('penalty') || rem.includes('penalty') || sub.includes('penalties');
  const isWaterTerm = sub.includes('water') || main.includes('water') || rem.includes('water');

  if (isSurchargeTerm && isWaterTerm) return true;
  if (sub === 'water-surcharge' || sub === 'water surcharge' || sub === 'waterworks surcharge' || sub === 'surcharge - water' || sub === 'surcharge-water') return true;

  return false;
};

/**
 * Detect whether a collection entry represents a Basic Water Charge.
 * Basic water charges must NOT be included in sundry amounts.
 * All basic water charges per barangay will be included in the total amount and distributed to the 8 barangay columns.
 */
export const isWaterBasicCharge = (item?: { subCategory?: string; mainCategory?: string; accountCode?: string; remarks?: string; collectionType?: string } | null): boolean => {
  if (!item) return false;
  if (isWaterSurcharge(item)) return false;

  const sub = (item.subCategory || '').trim().toLowerCase();
  const main = (item.mainCategory || '').trim().toLowerCase();
  const rem = (item.remarks || '').trim().toLowerCase();
  const colType = (item.collectionType || '').trim().toLowerCase();

  if (colType === 'water') return true;
  if (sub.includes('water') || main.includes('water') || rem.includes('water')) return true;

  // Check if any barangay matches in combination with water-related context
  if (detectWaterBarangay(item.subCategory, item.mainCategory, item.remarks)) return true;

  return false;
};

// Detect which of the 8 barangays a waterworks charge belongs to.
// Surcharges NEVER return a barangay (they belong strictly to Sundry).
export const detectWaterBarangay = (subCategory?: string, mainCategory?: string, remarks?: string, payor?: string): WaterBarangayKey | null => {
  if (isWaterSurcharge({ subCategory, mainCategory, remarks })) return null;

  const s = `${subCategory || ''} ${mainCategory || ''} ${remarks || ''} ${payor || ''}`.toLowerCase();
  if (!s.includes('water') && !s.includes('spring') && !s.includes('pump') && !s.includes('bukal') && !s.includes('guiob')) return null;

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
export const formatBookletDisplay = (bookletNo?: string | null, collectionType?: 'general' | 'rpt' | 'ctc' | 'consol' | string): string => {
  if (!bookletNo) {
    if (collectionType === 'rpt') return 'AF56';
    if (collectionType === 'ctc' || collectionType === 'community_tax') return 'BRF0016';
    return 'AF51';
  }
  const raw = String(bookletNo).trim();
  if (!raw) {
    if (collectionType === 'rpt') return 'AF56';
    if (collectionType === 'ctc' || collectionType === 'community_tax') return 'BRF0016';
    return 'AF51';
  }

  // Determine prefix: AF56 for RPT collections, BRF0016 for CTC, AF51 for general collections
  const isRpt = collectionType === 'rpt' || /56/i.test(raw) || /rpt/i.test(raw);
  const isCtc = collectionType === 'ctc' || collectionType === 'community_tax' || /BRF|0016|ctc/i.test(raw);
  
  let prefix = 'AF51';
  if (isRpt) {
    prefix = 'AF56';
  } else if (isCtc) {
    prefix = 'BRF0016';
  } else if (/52/i.test(raw)) {
    prefix = 'AF52';
  } else if (/53/i.test(raw)) {
    prefix = 'AF53';
  } else if (/54/i.test(raw)) {
    prefix = 'AF54';
  } else if (/55/i.test(raw)) {
    prefix = 'AF55';
  }

  // If already in AF51(...) or AF56(...) or BRF0016(...) format, normalize prefix case
  const exactParenMatch = raw.match(/^(AF\d+|BRF\d+)\((.+)\)$/i);
  if (exactParenMatch) {
    return `${prefix}(${exactParenMatch[2].trim()})`;
  }

  // Extract clean booklet number
  let cleanNo = raw;
  const parenMatch = raw.match(/\(([^)]+)\)/);
  if (parenMatch) {
    cleanNo = parenMatch[1].trim();
  } else {
    cleanNo = cleanNo
      .replace(/^A\.?F\.?\s*(?:NO\.?)?\s*5[1-6]\s*[:-]?\s*/i, '')
      .replace(/^AF\s*5[1-6]\s*[:-]?\s*/i, '')
      .replace(/^BRF\s*(?:NO\.?)?\s*(?:00)?16\s*[:-]?\s*/i, '')
      .replace(/^Booklet\s*(?:NO\.?)?\s*[:-]?\s*/i, '')
      .replace(/^No\.?\s*[:-]?\s*/i, '')
      .trim();
  }

  // If cleanNo is empty, just '51', '56', '0016', or original generic label, return just prefix
  const upper = raw.toUpperCase();
  if (
    !cleanNo || 
    cleanNo === '51' || cleanNo === '56' || cleanNo === '0016' || cleanNo === '16' ||
    upper === 'A.F. NO. 51' || upper === 'A.F. NO. 56' || upper === 'BRF NO. 0016' ||
    upper === 'AF51' || upper === 'AF56' || upper === 'BRF0016'
  ) {
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

/**
 * Infer booklet number from OR range string or array of ORs.
 * Each booklet contains 50 ORs (e.g., OR 11136-11150 => Booklet 223, OR 11301-11330 => Booklet 227).
 * Excludes CTC / BRF 0016 collections as CTC does not use 50-OR modulo math.
 */
export const inferBookletFromOr = (orInput?: string | string[] | null, collectionType?: string): string | null => {
  if (!orInput) return null;
  const colTypeUpper = (collectionType || '').toUpperCase();
  if (colTypeUpper === 'CTC' || colTypeUpper === 'COMMUNITY_TAX' || colTypeUpper.includes('BRF') || colTypeUpper.includes('0016')) {
    return null;
  }
  let str = '';
  if (Array.isArray(orInput)) {
    if (orInput.length === 0) return null;
    str = orInput.join(' ');
  } else {
    str = String(orInput);
  }
  if (/BRF|0016|CEDULA/i.test(str)) {
    return null;
  }

  // Strip out anything in parentheses, e.g. "(30 ORs)" or "(15 OR s)"
  const cleanStr = str.replace(/\([^)]*\)/g, '').trim();
  const matches = cleanStr.match(/\b\d+\b/g);
  if (!matches || matches.length === 0) return null;

  const nums = matches.map(m => parseInt(m, 10)).filter(n => !isNaN(n) && n > 0);
  if (nums.length === 0) return null;

  const minOr = Math.min(...nums);
  // Every booklet contains 50 ORs
  const bookletNum = Math.floor((minOr - 1) / 50) + 1;
  return bookletNum > 0 ? String(bookletNum) : null;
};

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
  submissionDate: string;
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
  fullCollectorName?: string;
  fullBookletNo?: string;
}

// Compute matrix rows and column totals with 50/50 Spring & Pump division for Calabasahan & Sampong
export const computeMatrixRows = (rows: StagedReportRow[]) => {
  const batchOrder: string[] = [];
  const batchMap = new Map<string, StagedReportRow[]>();
  rows.forEach(r => {
    const rawBatch = r.batchId || 'batch';
    const repNo = (r.reportNo || '').trim();
    const booklet = (r.bookletNo || '').trim();
    const colType = (r.collectionType || '').trim();
    const collector = (r.collectorName || '').trim();
    const batchKey = `${rawBatch}___${repNo}___${booklet}___${colType}___${collector}`;

    if (!batchMap.has(batchKey)) {
      batchOrder.push(batchKey);
      batchMap.set(batchKey, []);
    }
    batchMap.get(batchKey)!.push(r);
  });

  // Sort booklet batches by Report No. (natural alphanumeric sorting)
  batchOrder.sort((a, b) => {
    const rA = batchMap.get(a)?.[0]?.reportNo || '';
    const rB = batchMap.get(b)?.[0]?.reportNo || '';
    if (!rA && !rB) return 0;
    if (!rA) return 1;
    if (!rB) return -1;
    return rA.localeCompare(rB, undefined, { numeric: true, sensitivity: 'base' });
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
  let grandSundry = 0;
  let grandTotal = 0;

  batchOrder.forEach((batchId, batchIdx) => {
    const bRows = batchMap.get(batchId)!;
    const primary = bRows[0];
    const isGenericBk = (val?: string) => !val || ['51', '56', 'AF51', 'AF56', 'A.F. NO. 51', 'A.F. NO. 56', 'BRF0016', 'BRF NO. 0016'].includes(val.trim().toUpperCase());

    let rawBooklet = primary.bookletNo || (primary as any).afNo || '';
    if (isGenericBk(rawBooklet)) {
      const rowWithBk = bRows.find(r => !isGenericBk(r.bookletNo));
      if (rowWithBk) {
        rawBooklet = rowWithBk.bookletNo;
      } else {
        const rowWithAf = bRows.find(r => !isGenericBk((r as any).afNo));
        if (rowWithAf) {
          rawBooklet = (rowWithAf as any).afNo;
        } else {
          const inferred = inferBookletFromOr(primary.orNumbersDisplay || primary.orNumbers);
          if (inferred) rawBooklet = inferred;
        }
      }
    }
    const formattedBooklet = formatBookletDisplay(rawBooklet, primary.collectionType);
    const cleanOrNumbers = cleanOrDisplay(primary.orNumbersDisplay);
    const bookletReportNo = primary.reportNo || '';
    const submissionDate = primary.submissionDate || (primary.dateFrom ? primary.dateFrom : '-');

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

    // Find any detected water barangay in this booklet as fallback for basic water entries
    let bookletWaterBrgy: WaterBarangayKey | null = null;
    for (const r of bRows) {
      const b = detectWaterBarangay(r.subCategory, r.mainCategory, (r as any).remarks, (r as any).payor);
      if (b) {
        bookletWaterBrgy = b;
        break;
      }
    }

    bRows.forEach(r => {
      if (isWaterSurcharge(r)) {
        // Water surcharge: The ONLY water charge included in sundry amounts
        sundryRows.push({
          ...r,
          subCategory: r.subCategory && r.subCategory.toLowerCase().includes('surcharge') ? r.subCategory : 'Water-Surcharge',
          accountCode: r.accountCode && r.accountCode !== '-' ? r.accountCode : '4-02-02-980'
        });
      } else if (isWaterBasicCharge(r)) {
        // Basic water charge: NEVER included in sundry amounts!
        // Distributed to the corresponding barangay column and included in total water amount
        const brgy = detectWaterBarangay(r.subCategory, r.mainCategory, (r as any).remarks, (r as any).payor) || bookletWaterBrgy || 'poblacion';
        waterAmounts[brgy] += r.amount;
        totalWaterAmount += r.amount;
        hasWaterCharges = true;
      } else if (isRptCharge(r)) {
        totalRptGeneralAmount += r.amount;
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
        submissionDate,
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
        amount: 0,
        fullCollectorName: primary.collectorName,
        fullBookletNo: formattedBooklet
      });
      grandTotal += totalWaterAmount;
      isFirstRowOfBooklet = false;
    }

    // 2. RPT Charges Row (General Amount only - displayed under Sundry column)
    if (hasRptCharges) {
      matrixRows.push({
        key: `matrix_${batchId}_rpt`,
        batchId,
        rowNumber: isFirstRowOfBooklet ? batchIdx + 1 : '',
        submissionDate: isFirstRowOfBooklet ? submissionDate : '',
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
        subCategory: 'Real Property Tax',
        mainCategory: 'Tax Revenue - Property',
        accountCode: rptAccountCode,
        amount: totalRptGeneralAmount,
        fullCollectorName: primary.collectorName,
        fullBookletNo: formattedBooklet
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
        submissionDate: isFirstRowOfBooklet ? submissionDate : '',
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
        amount: sr.amount,
        fullCollectorName: primary.collectorName,
        fullBookletNo: formattedBooklet
      });
      grandTotal += sr.amount;
      grandSundry += sr.amount;
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
      sundry: grandSundry,
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
  const [userPositionsMap, setUserPositionsMap] = useState<Record<string, string>>({});
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [managedUsersList, setManagedUsersList] = useState<any[]>([]);
  const [_submittedItemKeys, setSubmittedItemKeys] = useState<Set<string>>(new Set());
  const [submittedReports, setSubmittedReports] = useState<AdminSubmittedReportRecord[]>([]);

  // Consolidation Builder State (Tab 0)
  const [selectedSubmittedReportIds, setSelectedSubmittedReportIds] = useState<string[]>([]);
  const [builderDateFrom, setBuilderDateFrom] = useState<string>('');
  const [builderDateTo, setBuilderDateTo] = useState<string>('');
  const [builderSearchTerm, setBuilderSearchTerm] = useState<string>('');
  const [builderCollectorFilter, setBuilderCollectorFilter] = useState<string | null>(null);

  // Staged Consolidated Table Rows (Populated by selecting submitted reports)
  const [stagedTableRows, setStagedTableRows] = useState<StagedReportRow[]>([]);

  // Table Search / Filter
  const [tableSearch, setTableSearch] = useState('');

  // Print View Mode: 'matrix' | 'recap' | 'balances'
  const [printViewMode, setPrintViewMode] = useState<'matrix' | 'recap' | 'balances'>('matrix');
  const [recapLayoutMode, setRecapLayoutMode] = useState<'auto' | 'two-column' | 'single-column'>('auto');
  const [matrixRowsPerPage, setMatrixRowsPerPage] = useState<number>(30);
  const [bankDeposits, setBankDeposits] = useState<BankDepositRecord[]>([]);

  // Weekly Reports Tab Filtering, Selection & Pagination State
  const [weeklyCollectorFilter, setWeeklyCollectorFilter] = useState<string | null>(null);
  const [weeklyMonthFilter, setWeeklyMonthFilter] = useState<string | null>(null);
  const [weeklySearchTerm, setWeeklySearchTerm] = useState<string>('');
  const [weeklyShowFilter, setWeeklyShowFilter] = useState<'all' | 'unsubmitted' | 'submitted'>('all');
  const [selectedWeeklyReportIds, setSelectedWeeklyReportIds] = useState<string[]>([]);
  const [weeklyPage, setWeeklyPage] = useState<number>(0);
  const [weeklyRowsPerPage, setWeeklyRowsPerPage] = useState<number>(10);

  // Monthly Reports Tab Filtering & Pagination State
  const [monthlyCollectorFilter, setMonthlyCollectorFilter] = useState<string | null>(null);
  const [monthlyMonthFilter, setMonthlyMonthFilter] = useState<string | null>(null);
  const [monthlySearchTerm, setMonthlySearchTerm] = useState<string>('');
  const [monthlyPage, setMonthlyPage] = useState<number>(0);
  const [monthlyRowsPerPage, setMonthlyRowsPerPage] = useState<number>(10);

  // Submit Selected Weekly Reports as Monthly Report Dialog State
  const [submitMonthlyConfirmOpen, setSubmitMonthlyConfirmOpen] = useState(false);
  const [isSubmittingMonthly, setIsSubmittingMonthly] = useState(false);
  const [monthlyBeginningBalanceInput, setMonthlyBeginningBalanceInput] = useState<number>(0);
  const [monthlySelectedDepositIds, setMonthlySelectedDepositIds] = useState<string[]>([]);
  const [monthlyTaggedMonthInput, setMonthlyTaggedMonthInput] = useState<string>('');
  const [quickMonthSelectValue, setQuickMonthSelectValue] = useState<string>('');

  // Helper to get local date as YYYY-MM-DD
  const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Submit Confirmation Dialog
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [beginningBalanceInput, setBeginningBalanceInput] = useState<number>(0);
  const [selectedDepositIds, setSelectedDepositIds] = useState<string[]>([]);
  const [weekLabelInput, setWeekLabelInput] = useState<string>('');
  const [reportDateInput, setReportDateInput] = useState<string>(getTodayDateString());
  const [reportDatesMap, setReportDatesMap] = useState<Record<string, string>>({});

  // Print Preview Dialog State
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printingReport, setPrintingReport] = useState<AdminSubmittedReportRecord | null>(null);

  // Weekly Report Inclusions Details Modal State
  const [viewingWeeklyReport, setViewingWeeklyReport] = useState<AdminSubmittedReportRecord | null>(null);

  // Unmark Confirm State
  const [unmarkConfirmOpen, setUnmarkConfirmOpen] = useState(false);
  const [reportToUnmark, setReportToUnmark] = useState<AdminSubmittedReportRecord | null>(null);

  // Inline Report No. editing state for table
  const [editingReportNoBatchId, setEditingReportNoBatchId] = useState<string | null>(null);
  const [editingReportNoValue, setEditingReportNoValue] = useState<string>('');

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

  // Helper to extract numeric week number from a report record
  const extractWeekNumberFromRecord = (r: AdminSubmittedReportRecord): number => {
    if (r.weekLabel) {
      const match = r.weekLabel.match(/Week\s*(\d+)/i);
      if (match) return parseInt(match[1], 10);
    }
    if (r.reportNumber) {
      const match = r.reportNumber.match(/WEEK-?(\d+)/i);
      if (match) return parseInt(match[1], 10);
    }
    return 0;
  };

  // Find the previous report ending balance from the most recent WEEKLY admin report.
  // Falls back to localStorage (set after every weekly report save) or 0.
  const previousReportEndingBalance = useMemo(() => {
    // Filter to weekly admin reports only, then sort highest week number first
    const weeklyAdminReports = submittedReports
      .filter(r =>
        (r.reportType === 'admin_weekly' || r.reportLevel === 'weekly' || r.reportType === 'admin_consolidation' || r.reportNumber?.startsWith('ADM-')) &&
        r.reportType !== 'admin_monthly' &&
        r.reportLevel !== 'monthly' &&
        !r.reportNumber?.includes('MONTHLY') &&
        typeof r.endingBalance === 'number'
      )
      .sort((a, b) => {
        const wA = extractWeekNumberFromRecord(a);
        const wB = extractWeekNumberFromRecord(b);
        if (wA !== wB) return wB - wA; // Highest week number first (e.g. Week 2 before Week 1)
        const da = a.dateTo || a.submittedAt || '';
        const db = b.dateTo || b.submittedAt || '';
        return db.localeCompare(da); // Newest date first
      });

    if (weeklyAdminReports.length > 0) {
      return weeklyAdminReports[0].endingBalance as number;
    }

    // Fallback: any admin report with an ending balance
    for (const r of submittedReports) {
      if (
        (r.reportType === 'admin_consolidation' || r.reportType === 'admin_weekly' || r.reportNumber?.startsWith('ADM-')) &&
        typeof r.endingBalance === 'number'
      ) {
        return r.endingBalance;
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
    const filtered = bankDeposits.filter(d =>
      !d.isReported &&
      !d.reportId &&
      !alreadyUsedIds.has(d.id)
    );
    return sortDepositsOldestToLatest(filtered);
  }, [bankDeposits, submittedReports]);

  // Helper to determine the target month & year for week designation from staged rows
  const getStagedTargetMonthYear = (): string => {
    if (stagedTableRows.length > 0) {
      const dates = stagedTableRows.map(r => r.dateTo || r.dateFrom || (r as any).submissionDate || (r as any).date).filter(Boolean);
      if (dates.length > 0) {
        const sortedDates = [...dates].sort();
        const latestDate = sortedDates[sortedDates.length - 1];
        if (latestDate) {
          const parts = String(latestDate).split('-');
          if (parts.length >= 2) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            if (!isNaN(y) && !isNaN(m)) {
              return new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            }
          }
          const d = new Date(latestDate as string);
          if (!isNaN(d.getTime())) {
            return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          }
        }
      }
    }
    return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Suggested Week Labels for Weekly Report creation
  const suggestedWeekLabels = useMemo(() => {
    const targetMonthYear = getStagedTargetMonthYear();
    const weeklyAdminReports = submittedReports.filter(r =>
      (r.reportType === 'admin_weekly' || r.reportLevel === 'weekly' || r.reportType === 'admin_consolidation' || r.reportNumber?.startsWith('ADM-')) &&
      r.reportType !== 'admin_monthly' &&
      r.reportLevel !== 'monthly' &&
      !r.reportNumber?.includes('MONTHLY')
    );

    let maxWeek = 0;
    weeklyAdminReports.forEach(r => {
      const wNum = extractWeekNumberFromRecord(r);
      if (wNum > maxWeek) maxWeek = wNum;
    });

    const startWeek = maxWeek > 0 ? maxWeek + 1 : 1;
    return [0, 1, 2, 3, 4].map(i => `Week ${startWeek + i} of ${targetMonthYear}`);
  }, [submittedReports, stagedTableRows]);

  // Group staged rows by booklet / report for individual date assignment
  const includedReportBatches = useMemo(() => {
    const map = new Map<string, {
      key: string;
      reportId: string;
      reportNo: string;
      collectorName: string;
      bookletNo: string;
      totalAmount: number;
    }>();

    stagedTableRows.forEach(r => {
      const key = r.batchId || r.reportNo || 'default';
      if (!map.has(key)) {
        map.set(key, {
          key,
          reportId: r.batchId?.startsWith('report_') ? r.batchId.replace('report_', '') : '',
          reportNo: r.reportNo || '-',
          collectorName: r.collectorName,
          bookletNo: r.bookletNo,
          totalAmount: 0
        });
      }
      map.get(key)!.totalAmount += r.amount;
    });

    return Array.from(map.values());
  }, [stagedTableRows]);

  // Open "Mark as Reported" modal with default Beginning Balance, auto Week Label, and all unreported deposits selected
  const handleOpenMarkAsReported = () => {
    if (stagedTableRows.length === 0) return;

    const todayStr = getTodayDateString();
    setReportDateInput(todayStr);

    const initialDates: Record<string, string> = {};
    const uniqueBatches = Array.from(new Set(stagedTableRows.map(r => r.batchId || r.reportNo || 'default')));
    uniqueBatches.forEach(bId => {
      initialDates[bId] = todayStr;
    });
    selectedSubmittedReportIds.forEach(id => {
      initialDates[id] = todayStr;
    });
    setReportDatesMap(initialDates);

    const targetMonthYear = getStagedTargetMonthYear();

    const weeklyAdminReports = submittedReports.filter(r =>
      (r.reportType === 'admin_weekly' || r.reportLevel === 'weekly' || r.reportType === 'admin_consolidation' || r.reportNumber?.startsWith('ADM-')) &&
      r.reportType !== 'admin_monthly' &&
      r.reportLevel !== 'monthly' &&
      !r.reportNumber?.includes('MONTHLY')
    );

    let maxWeek = 0;
    weeklyAdminReports.forEach(r => {
      const wNum = extractWeekNumberFromRecord(r);
      if (wNum > maxWeek) maxWeek = wNum;
    });

    const nextWeek = maxWeek > 0 ? maxWeek + 1 : (weeklyAdminReports.length > 0 ? weeklyAdminReports.length + 1 : 1);
    const defaultLabel = `Week ${nextWeek} of ${targetMonthYear}`;

    setWeekLabelInput(defaultLabel);
    setBeginningBalanceInput(previousReportEndingBalance);
    setSelectedDepositIds(unreportedDeposits.map(d => d.id));
    setSubmitConfirmOpen(true);
  };

  // Quick submit a single report directly from Submitted Collector Reports table
  const handleQuickSubmitReportAsWeekly = (report: AdminSubmittedReportRecord) => {
    setSelectedSubmittedReportIds([report.id]);
    const reportRows = getRowsForReport(report);
    setStagedTableRows(reportRows);
    setTableSearch('');

    const todayStr = getTodayDateString();
    setReportDateInput(todayStr);

    const initialDates: Record<string, string> = {
      [report.id]: todayStr
    };
    reportRows.forEach(r => {
      const key = r.batchId || r.reportNo || 'default';
      initialDates[key] = todayStr;
    });
    setReportDatesMap(initialDates);

    const targetMonthYear = getStagedTargetMonthYear();
    const weeklyAdminReports = submittedReports.filter(r =>
      (r.reportType === 'admin_weekly' || r.reportLevel === 'weekly' || r.reportType === 'admin_consolidation' || r.reportNumber?.startsWith('ADM-')) &&
      r.reportType !== 'admin_monthly' &&
      r.reportLevel !== 'monthly' &&
      !r.reportNumber?.includes('MONTHLY')
    );

    let maxWeek = 0;
    weeklyAdminReports.forEach(r => {
      const wNum = extractWeekNumberFromRecord(r);
      if (wNum > maxWeek) maxWeek = wNum;
    });

    const nextWeek = maxWeek > 0 ? maxWeek + 1 : (weeklyAdminReports.length > 0 ? weeklyAdminReports.length + 1 : 1);
    setWeekLabelInput(`Week ${nextWeek} of ${targetMonthYear}`);
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

  const extractBestBookletNo = (
    report: AdminSubmittedReportRecord, 
    fallbackBooklet?: string, 
    matchedItems: any[] = [],
    currentRow?: any
  ): string => {
    const isGeneric = (val?: string | null) => {
      if (!val || !val.trim()) return true;
      const v = val.trim().toUpperCase();
      return v === '51' || v === '56' || v === 'AF51' || v === 'AF56' || v === 'A.F. NO. 51' || v === 'A.F. NO. 56' || v === 'BRF0016' || v === 'BRF NO. 0016' || v === '0016' || v === '16';
    };

    const colType = (currentRow?.collectionType || report.collectionType || '').toLowerCase();
    const isCtc = colType === 'ctc' || colType === 'community_tax' || /BRF|0016/i.test(report.afNo || '') || /BRF|0016/i.test(currentRow?.afNo || '');

    if (fallbackBooklet && !isGeneric(fallbackBooklet)) {
      return fallbackBooklet;
    }

    if (currentRow) {
      if (!isCtc) {
        const bFromCurrentOr = inferBookletFromOr(currentRow.orNumbersDisplay || currentRow.orNumbers || currentRow.orNo || currentRow.orRange, colType);
        if (bFromCurrentOr) return bFromCurrentOr;
      }
      const bFromCurrent = currentRow.bookletNo || currentRow.afNo;
      if (bFromCurrent && !isGeneric(bFromCurrent)) return bFromCurrent;
    }

    const repBooklet = (report as any).bookletNo || (report as any).filterBookletNo || (report as any).rptFilterBookletNo || (report as any).ctcFilterBookletNo || (report as any).ctcFilterAfNo;
    if (repBooklet && !isGeneric(repBooklet)) {
      return repBooklet;
    }

    for (const item of matchedItems) {
      const b = item.bookletNo || item.afNo;
      if (b && !isGeneric(b)) return b;
      if (!isCtc) {
        const bFromOr = inferBookletFromOr(item.orNo || item.orNumber || item.ctcNo, colType);
        if (bFromOr) return bFromOr;
      }
    }

    if (report.reportData) {
      const snapCols = [
        ...(report.reportData.filteredCollections || []),
        ...(report.reportData.filteredRptCollections || []),
        ...(report.reportData.filteredCtcCollections || [])
      ];
      for (const c of snapCols) {
        const b = c.bookletNo || c.afNo;
        if (b && !isGeneric(b)) return b;
        if (!isCtc) {
          const bFromOr = inferBookletFromOr(c.orNo || c.orNumber || c.ctcNo, colType);
          if (bFromOr) return bFromOr;
        }
      }
    }

    if (!isCtc) {
      const bFromReportOr = inferBookletFromOr(report.orRange || report.orNumbers, colType);
      if (bFromReportOr) return bFromReportOr;
    }

    if (report.afNo && !isGeneric(report.afNo)) {
      return report.afNo;
    }

    if (report.reportNumber && !isCtc) {
      const parts = report.reportNumber.split('-');
      if (parts.length >= 3 && /^\d+$/.test(parts[1]) && parts[1] !== '51' && parts[1] !== '56' && parts[1] !== '16') {
        return parts[1];
      }
    }

    if (isCtc) return 'BRF NO. 0016';
    return report.afNo || '51';
  };

  // Helper to get underlying collector reports for a weekly or monthly report
  const getUnderlyingCollectorReports = (wRep: AdminSubmittedReportRecord): AdminSubmittedReportRecord[] => {
    const collectorIds = new Set(wRep.consolidatedReportIds || []);
    
    if (wRep.stagedRows && Array.isArray(wRep.stagedRows)) {
      wRep.stagedRows.forEach((sr: any) => {
        if (sr.batchId) {
          const match = sr.batchId.match(/report_batch_(.+)/);
          if (match) collectorIds.add(match[1]);
        }
        if (sr.id) {
          const match = sr.id.match(/rep_row_(.+?)_\d+/);
          if (match) collectorIds.add(match[1]);
        }
      });
    }

    return submittedReports.filter(r => 
      (collectorIds.size > 0 && (collectorIds.has(r.id) || collectorIds.has(r.reportNumber))) ||
      r.consolidatedInReportId === wRep.id ||
      r.consolidatedInReportId === wRep.reportNumber
    );
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

  // Helper to test if position is a Job Order position
  const isJobOrderPosition = (position?: string | null): boolean => {
    if (!position) return false;
    const pos = position.toLowerCase().trim();
    return pos.includes('job order') || pos.includes('j.o') || pos.includes('job-order') || pos === 'jo' || /\bjo\b/i.test(pos);
  };

  // Helper to retrieve the active Municipal Treasurer's full name
  const getMunicipalTreasurerName = (): string => {
    const treasurerUser = managedUsersList.find(u => 
      u.position && u.position.toLowerCase().includes('municipal treasurer')
    ) || managedUsersList.find(u => 
      u.position && u.position.toLowerCase().includes('treasurer') && !u.position.toLowerCase().includes('staff') && !u.position.toLowerCase().includes('clerk')
    );
    if (treasurerUser) {
      const name = treasurerUser.fullName || `${treasurerUser.firstName || ''} ${treasurerUser.lastName || ''}`.trim();
      if (name) return name;
    }

    const treasurerSig = signatories.find(s => 
      s.position && (s.position.toLowerCase() === 'municipal treasurer' || (s.position.toLowerCase().includes('treasurer') && !s.position.toLowerCase().includes('staff') && !s.position.toLowerCase().includes('clerk')))
    ) || signatories.find(s => s.remarks && (s.remarks.toLowerCase().includes('verification') || s.remarks.toLowerCase().includes('acknowledgment')));
    if (treasurerSig && treasurerSig.fullName) {
      return treasurerSig.fullName;
    }

    return 'MENARD A. HERRERA';
  };

  // Helper to get effective collector name (uses Municipal Treasurer's Full Name if collector has Job Order position)
  const getEffectiveCollectorName = (email?: string, userId?: string, rawName?: string, position?: string): string => {
    const baseName = getCollectorName(email, userId) || rawName || '';
    const emailKey = email?.toLowerCase().trim() || '';
    const uidKey = userId?.toLowerCase().trim() || '';
    const nameKey = baseName.toLowerCase().trim();
    const rawNameKey = (rawName || '').toLowerCase().trim();

    let pos = position || userPositionsMap[emailKey] || userPositionsMap[uidKey] || userPositionsMap[nameKey] || userPositionsMap[rawNameKey] || '';
    
    if (!pos && managedUsersList.length > 0) {
      const u = managedUsersList.find(user => 
        (emailKey && user.email?.toLowerCase().trim() === emailKey) ||
        (uidKey && user.id?.toLowerCase().trim() === uidKey) ||
        (nameKey && user.fullName?.toLowerCase().trim() === nameKey) ||
        (rawNameKey && user.fullName?.toLowerCase().trim() === rawNameKey)
      );
      if (u && u.position) {
        pos = u.position;
      }
    }

    if (isJobOrderPosition(pos) || isJobOrderPosition(rawName) || isJobOrderPosition(baseName) || isJobOrderPosition(position)) {
      return getMunicipalTreasurerName();
    }
    return baseName;
  };

  // Helper to get submitted collector name (the name used in submitting the report by collector)
  const getSubmittedCollectorNameForReport = (report: AdminSubmittedReportRecord): string => {
    if (!report) return 'Revenue Collector';

    // If this is an admin weekly or monthly report, resolve submitted names from underlying reports
    const isWeeklyOrMonthly = report.reportType === 'admin_weekly' || report.reportType === 'admin_monthly' || report.reportType === 'admin_consolidation' || report.reportLevel === 'weekly' || report.reportLevel === 'monthly' || report.reportNumber?.startsWith('ADM-');
    if (isWeeklyOrMonthly) {
      const underlying = getUnderlyingCollectorReports(report);
      if (underlying.length > 0) {
        const names = Array.from(new Set(underlying.map(c => getSubmittedCollectorNameForReport(c)).filter(Boolean)));
        if (names.length > 0) {
          return names.join(', ');
        }
      }
      if (report.stagedRows && Array.isArray(report.stagedRows) && report.stagedRows.length > 0) {
        const names = Array.from(new Set(report.stagedRows.map((sr: any) => 
          getEffectiveCollectorName(sr.collectorEmail, sr.userId, sr.collectorName)
        ).filter((n: any) => Boolean(n) && n !== 'Collector')));
        if (names.length > 0) {
          return names.join(', ');
        }
      }
    }

    const nameFromRep = report.collectorName?.trim();
    const nameFromData = report.reportData?.certAccountableName?.trim();
    let rawName = '';
    if (nameFromRep && nameFromRep.toUpperCase() !== 'COLLECTOR' && nameFromRep.toUpperCase() !== 'REVENUE COLLECTOR') {
      rawName = nameFromRep;
    } else if (nameFromData && nameFromData.toUpperCase() !== 'COLLECTOR' && nameFromData.toUpperCase() !== 'REVENUE COLLECTOR') {
      rawName = nameFromData;
    } else if (nameFromRep && nameFromRep !== '') {
      rawName = nameFromRep;
    } else {
      rawName = getCollectorName(report.collectorEmail, report.userId);
    }

    return getEffectiveCollectorName(
      report.collectorEmail,
      report.userId,
      rawName,
      (report as any).collectorPosition || report.reportData?.certPosition
    );
  };

  // Helper to retrieve or synthesize StagedReportRows for an archived report
  const getRowsForReport = (report: AdminSubmittedReportRecord): StagedReportRow[] => {
    // 0. A: Consolidated Monthly Report resolution from underlying Weekly / Collector reports
    if (report.reportType === 'admin_monthly' || report.reportLevel === 'monthly') {
      if (report.stagedRows && Array.isArray(report.stagedRows) && report.stagedRows.length > 0) {
        return report.stagedRows.map((sr, idx) => {
          const isRpt = sr.collectionType === 'rpt' || isRptCharge({ subCategory: sr.subCategory, bookletNo: sr.bookletNo || report.afNo });
          let rowAmount = sr.amount;
          if (isRpt && Math.abs(sr.amount - (report.totalAmount || 0)) < 0.01 && sr.amount > 0) {
            rowAmount = getRptGeneralAmount(sr.amount);
          }
          return {
            ...sr,
            amount: rowAmount,
            bookletNo: formatBookletDisplay(extractBestBookletNo(report, sr.bookletNo || sr.afNo, [], sr), sr.collectionType || report.collectionType),
            batchId: sr.batchId || `monthly_row_${report.id}_${sr.reportNo || sr.bookletNo || idx}`,
            collectorName: getEffectiveCollectorName(
              sr.collectorEmail || report.collectorEmail,
              sr.userId || report.userId,
              (sr.collectorName && sr.collectorName !== 'Collector') ? sr.collectorName : (report.collectorName || getSubmittedCollectorNameForReport(report))
            )
          };
        });
      }

      const weeklyIds = new Set(report.consolidatedWeeklyReportIds || []);
      const underlyingWeekly = submittedReports.filter(r => 
        (weeklyIds.size > 0 && (weeklyIds.has(r.id) || weeklyIds.has(r.reportNumber))) ||
        r.consolidatedInMonthlyReportId === report.id ||
        r.consolidatedInMonthlyReportId === report.reportNumber
      );

      if (underlyingWeekly.length > 0) {
        const allRows: StagedReportRow[] = [];
        underlyingWeekly.forEach(wRep => {
          allRows.push(...getRowsForReport(wRep));
        });
        if (allRows.length > 0) return allRows;
      }

      const collectorIds = new Set(report.consolidatedReportIds || []);
      const underlyingCollectors = submittedReports.filter(r => 
        (collectorIds.size > 0 && (collectorIds.has(r.id) || collectorIds.has(r.reportNumber))) ||
        r.consolidatedInReportId === report.id ||
        r.consolidatedInReportId === report.reportNumber
      );

      if (underlyingCollectors.length > 0) {
        const allRows: StagedReportRow[] = [];
        underlyingCollectors.forEach(cRep => {
          allRows.push(...getRowsForReport(cRep));
        });
        if (allRows.length > 0) return allRows;
      }
    }

    // 0. B: Consolidated Weekly Report resolution from underlying Collector reports
    if (report.reportType === 'admin_weekly' || report.reportType === 'admin_consolidation') {
      if (report.stagedRows && Array.isArray(report.stagedRows) && report.stagedRows.length > 0) {
        return report.stagedRows.map((sr, idx) => {
          const isRpt = sr.collectionType === 'rpt' || isRptCharge({ subCategory: sr.subCategory, bookletNo: sr.bookletNo || report.afNo });
          let rowAmount = sr.amount;
          if (isRpt && Math.abs(sr.amount - (report.totalAmount || 0)) < 0.01 && sr.amount > 0) {
            rowAmount = getRptGeneralAmount(sr.amount);
          }
          return {
            ...sr,
            amount: rowAmount,
            bookletNo: formatBookletDisplay(extractBestBookletNo(report, sr.bookletNo || sr.afNo, [], sr), sr.collectionType || report.collectionType),
            batchId: sr.batchId || `weekly_row_${report.id}_${sr.reportNo || sr.bookletNo || idx}`,
            collectorName: getEffectiveCollectorName(
              sr.collectorEmail || report.collectorEmail,
              sr.userId || report.userId,
              (sr.collectorName && sr.collectorName !== 'Collector') ? sr.collectorName : (report.collectorName || getSubmittedCollectorNameForReport(report))
            )
          };
        });
      }

      const collectorIds = new Set(report.consolidatedReportIds || []);
      const underlyingCollectors = submittedReports.filter(r => 
        (collectorIds.size > 0 && (collectorIds.has(r.id) || collectorIds.has(r.reportNumber))) ||
        r.consolidatedInReportId === report.id ||
        r.consolidatedInReportId === report.reportNumber
      );

      if (underlyingCollectors.length > 0) {
        const allRows: StagedReportRow[] = [];
        underlyingCollectors.forEach(cRep => {
          allRows.push(...getRowsForReport(cRep));
        });
        if (allRows.length > 0) return allRows;
      }
    }

    // 1. Check if reportData contains exact submitted collections snapshot (highest precision for basic & surcharge split)
    const repData = report.reportData;
    if (repData) {
      const cols = (repData.filteredCollections || []) as CollectionItem[];
      const rpts = (repData.filteredRptCollections || []) as RPTCollectionItem[];
      const ctcs = (repData.filteredCtcCollections || []) as any[];

      if (cols.length > 0 || rpts.length > 0 || ctcs.length > 0) {
        const batchId = `report_batch_${report.id}`;
        const subCatMap: Record<string, { subCategory: string; mainCategory: string; accountCode: string; amount: number; itemCount: number }> = {};

        cols.forEach(c => {
          const sub = c.subCategory || 'Unspecified';
          const main = c.mainCategory || 'Tax Revenue';
          const acc = c.accountCode || '';
          const key = `${sub}____${acc}`;
          if (!subCatMap[key]) {
            subCatMap[key] = { subCategory: sub, mainCategory: main, accountCode: acc, amount: 0, itemCount: 0 };
          }
          subCatMap[key].amount += (c.amount || 0);
          subCatMap[key].itemCount += 1;
        });

        rpts.forEach(r => {
          const sub = 'Real Property Tax';
          const main = 'Tax Revenue';
          const acc = '01-01-02-01';
          const key = `${sub}____${acc}`;
          if (!subCatMap[key]) {
            subCatMap[key] = { subCategory: sub, mainCategory: main, accountCode: acc, amount: 0, itemCount: 0 };
          }
          subCatMap[key].amount += getRptGeneralAmount(r.amount || 0);
          subCatMap[key].itemCount += 1;
        });

        ctcs.forEach(c => {
          const penalty = c.penalty || 0;
          const basic = Math.max(0, (c.amount || 0) - penalty);

          if (basic > 0 || penalty === 0) {
            const sub = 'Community Tax';
            const main = 'Tax Revenue';
            const acc = '4-01-01-050';
            const key = `${sub}____${acc}`;
            if (!subCatMap[key]) {
              subCatMap[key] = { subCategory: sub, mainCategory: main, accountCode: acc, amount: 0, itemCount: 0 };
            }
            subCatMap[key].amount += basic;
            subCatMap[key].itemCount += 1;
          }

          if (penalty > 0) {
            const sub = 'Surcharge-CTC';
            const main = 'Tax Revenue';
            const acc = '4-01-05-010';
            const key = `${sub}____${acc}`;
            if (!subCatMap[key]) {
              subCatMap[key] = { subCategory: sub, mainCategory: main, accountCode: acc, amount: 0, itemCount: 0 };
            }
            subCatMap[key].amount += penalty;
            subCatMap[key].itemCount += 1;
          }
        });

        const synthesized: StagedReportRow[] = Object.values(subCatMap).map((sub, idx) => ({
          id: `rep_row_${report.id}_${idx}`,
          batchId,
          collectorKey: report.collectorEmail || report.userId || report.collectorName,
          collectorName: getSubmittedCollectorNameForReport(report),
          collectorEmail: report.collectorEmail,
          userId: report.userId,
          bookletNo: formatBookletDisplay(extractBestBookletNo(report), report.collectionType),
          collectionType: report.collectionType,
          orNumbers: report.orNumbers,
          orNumbersDisplay: cleanOrDisplay(report.orRange),
          reportNo: report.reportNumber || '',
          submissionDate: getDisplaySubmissionDate(report),
          subCategory: sub.subCategory,
          mainCategory: sub.mainCategory,
          accountCode: sub.accountCode,
          amount: sub.amount,
          itemCount: sub.itemCount,
          itemIds: [],
          dateFrom: report.dateFrom,
          dateTo: report.dateTo
        }));

        if (synthesized.length > 0) {
          return synthesized;
        }
      }
    }

    // 2. Check raw database collections matched by itemIds or orNumbers
    const idSet = new Set((report.itemIds || []).map(Number));
    const orSet = new Set((report.orNumbers || []).map(o => String(o).trim().toLowerCase()));

    if (idSet.size > 0 || orSet.size > 0) {
      let matchedCols: CollectionItem[] = [];
      let matchedRpts: RPTCollectionItem[] = [];

      if (report.collectionType === 'rpt') {
        matchedRpts = rptCollections.filter(r => 
          (idSet.size > 0 && idSet.has(Number(r.id))) || 
          (orSet.size > 0 && orSet.has(String(r.orNumber).trim().toLowerCase()))
        );
      } else {
        matchedCols = generalCollections.filter(c => 
          (idSet.size > 0 && idSet.has(Number(c.id))) || 
          (orSet.size > 0 && orSet.has(String(c.orNo).trim().toLowerCase()))
        );
      }

      if (matchedCols.length > 0 || matchedRpts.length > 0) {
        const batchId = `report_batch_${report.id}`;
        const subCatMap: Record<string, { subCategory: string; mainCategory: string; accountCode: string; amount: number; itemCount: number }> = {};

        matchedCols.forEach(c => {
          const sub = c.subCategory || 'Unspecified';
          const main = c.mainCategory || 'Tax Revenue';
          const acc = c.accountCode || '';
          const key = `${sub}____${acc}`;
          if (!subCatMap[key]) {
            subCatMap[key] = { subCategory: sub, mainCategory: main, accountCode: acc, amount: 0, itemCount: 0 };
          }
          subCatMap[key].amount += (c.amount || 0);
          subCatMap[key].itemCount += 1;
        });

        matchedRpts.forEach(r => {
          const sub = 'Real Property Tax';
          const main = 'Tax Revenue';
          const acc = '01-01-02-01';
          const key = `${sub}____${acc}`;
          if (!subCatMap[key]) {
            subCatMap[key] = { subCategory: sub, mainCategory: main, accountCode: acc, amount: 0, itemCount: 0 };
          }
          subCatMap[key].amount += getRptGeneralAmount(r.amount || 0);
          subCatMap[key].itemCount += 1;
        });

        const synthesized: StagedReportRow[] = Object.values(subCatMap).map((sub, idx) => ({
          id: `rep_row_${report.id}_${idx}`,
          batchId,
          collectorKey: report.collectorEmail || report.userId || report.collectorName,
          collectorName: getSubmittedCollectorNameForReport(report),
          collectorEmail: report.collectorEmail,
          userId: report.userId,
          bookletNo: formatBookletDisplay(extractBestBookletNo(report, undefined, [...matchedCols, ...matchedRpts]), report.collectionType),
          collectionType: report.collectionType,
          orNumbers: report.orNumbers,
          orNumbersDisplay: cleanOrDisplay(report.orRange),
          reportNo: report.reportNumber || '',
          submissionDate: getDisplaySubmissionDate(report),
          subCategory: sub.subCategory,
          mainCategory: sub.mainCategory,
          accountCode: sub.accountCode,
          amount: sub.amount,
          itemCount: sub.itemCount,
          itemIds: [],
          dateFrom: report.dateFrom,
          dateTo: report.dateTo
        }));

        if (synthesized.length > 0) {
          return synthesized;
        }
      }
    }

    // 3. Fallback to stagedRows (normalized for Community Tax if stored previously)
    if (report.stagedRows && Array.isArray(report.stagedRows) && report.stagedRows.length > 0) {
      return report.stagedRows.map(sr => {
        let subCatName = sr.subCategory ? sr.subCategory.trim() : 'Sundry';
        let accCode = sr.accountCode ? sr.accountCode.trim() : '';

        if (subCatName === 'Community Tax - Individual' || subCatName === 'Community Tax - Corporation' || subCatName === 'Community Tax') {
          subCatName = 'Community Tax';
          if (!accCode) accCode = '4-01-01-050';
        } else if (subCatName === 'Surcharge-CTC' || subCatName === 'Surcharge - CTC') {
          subCatName = 'Surcharge-CTC';
          if (!accCode) accCode = '4-01-05-010';
        } else if (isWaterSurcharge({ subCategory: subCatName, accountCode: accCode })) {
          subCatName = 'Water-Surcharge';
          if (!accCode) accCode = '4-02-02-980';
        }

        const isRpt = sr.collectionType === 'rpt' || isRptCharge({ subCategory: subCatName, bookletNo: sr.bookletNo || report.afNo });
        let rowAmount = sr.amount;
        if (isRpt && Math.abs(sr.amount - (report.totalAmount || 0)) < 0.01 && sr.amount > 0) {
          rowAmount = getRptGeneralAmount(sr.amount);
        }

        return {
          ...sr,
          amount: rowAmount,
          bookletNo: formatBookletDisplay(extractBestBookletNo(report, sr.bookletNo || sr.afNo, [], sr), sr.collectionType || report.collectionType),
          subCategory: subCatName,
          accountCode: accCode,
          collectorName: getEffectiveCollectorName(
            sr.collectorEmail || report.collectorEmail,
            sr.userId || report.userId,
            (sr.collectorName && sr.collectorName !== 'Collector') ? sr.collectorName : getSubmittedCollectorNameForReport(report)
          )
        };
      });
    }

    // 4. Fallback: Synthesize from subCategorySummary (only if summary sum matches totalAmount or single item)
    const summary = report.subCategorySummary || [];
    const summarySum = summary.reduce((sum, s) => sum + (s.amount || 0), 0);
    const batchId = `archived_batch_${report.id}`;

    // If summary accurately matches report total or has only few matching items
    if (Math.abs(summarySum - report.totalAmount) < 0.01 || summary.length <= 1) {
      return summary.map((sub, idx) => {
        let subCatName = sub.subCategory ? sub.subCategory.trim() : 'Sundry';
        let accCode = sub.accountCode ? sub.accountCode.trim() : '';
        if (subCatName === 'Community Tax - Individual' || subCatName === 'Community Tax - Corporation' || subCatName === 'Community Tax') {
          subCatName = 'Community Tax';
          if (!accCode) accCode = '4-01-01-050';
        } else if (subCatName === 'Surcharge-CTC' || subCatName === 'Surcharge - CTC') {
          subCatName = 'Surcharge-CTC';
          if (!accCode) accCode = '4-01-05-010';
        } else if (isWaterSurcharge({ subCategory: subCatName, accountCode: accCode })) {
          subCatName = 'Water-Surcharge';
          if (!accCode) accCode = '4-02-02-980';
        }

        const isRpt = report.collectionType === 'rpt' || isRptCharge({ subCategory: subCatName, bookletNo: report.afNo });
        const finalAmount = isRpt ? getRptGeneralAmount(sub.amount) : sub.amount;

        return {
          id: `archived_row_${report.id}_${idx}`,
          batchId,
          collectorKey: report.collectorEmail || report.userId || report.collectorName,
          collectorName: getSubmittedCollectorNameForReport(report),
          collectorEmail: report.collectorEmail,
          userId: report.userId,
          bookletNo: formatBookletDisplay(extractBestBookletNo(report), report.collectionType),
          collectionType: report.collectionType,
          orNumbers: report.orNumbers,
          orNumbersDisplay: cleanOrDisplay(report.orRange),
          reportNo: report.reportNumber || '',
          submissionDate: getDisplaySubmissionDate(report),
          subCategory: subCatName,
          mainCategory: sub.mainCategory || 'Tax Revenue',
          accountCode: accCode,
          amount: finalAmount,
          itemCount: sub.itemCount,
          itemIds: [],
          dateFrom: report.dateFrom,
          dateTo: report.dateTo
        };
      });
    }

    // 5. If summary has too many items from historical all-collections bug, output single exact matching row for the booklet
    const isRptFallback = report.collectionType === 'rpt' || isRptCharge({ bookletNo: report.afNo });
    return [{
      id: `archived_row_${report.id}_0`,
      batchId,
      collectorKey: report.collectorEmail || report.userId || report.collectorName,
      collectorName: getSubmittedCollectorNameForReport(report),
      collectorEmail: report.collectorEmail,
      userId: report.userId,
      bookletNo: formatBookletDisplay(extractBestBookletNo(report), report.collectionType),
      collectionType: report.collectionType,
      orNumbers: report.orNumbers,
      orNumbersDisplay: cleanOrDisplay(report.orRange),
      reportNo: report.reportNumber || '',
      submissionDate: getDisplaySubmissionDate(report),
      subCategory: isRptFallback ? 'Real Property Tax' : (summary[0]?.subCategory || 'General Collections'),
      mainCategory: 'Tax Revenue',
      accountCode: isRptFallback ? '01-01-02-01' : (summary[0]?.accountCode || ''),
      amount: isRptFallback ? getRptGeneralAmount(report.totalAmount) : report.totalAmount,
      itemCount: report.orCount || report.orNumbers.length || 1,
      itemIds: report.itemIds || [],
      dateFrom: report.dateFrom,
      dateTo: report.dateTo
    }];
  };

  // Underlying collector reports included in the viewed weekly report
  const viewingUnderlyingCollectorReports = useMemo(() => {
    if (!viewingWeeklyReport) return [];
    const rep = viewingWeeklyReport;
    return submittedReports.filter(cr => 
      (rep.consolidatedReportIds && rep.consolidatedReportIds.includes(cr.id)) ||
      (cr.consolidatedInReportId && (cr.consolidatedInReportId === rep.id || cr.consolidatedInReportId === rep.reportNumber))
    );
  }, [viewingWeeklyReport, submittedReports]);

  // SubCategory / Account Code charges included in viewed weekly report
  const viewingWeeklySubCats = useMemo(() => {
    if (!viewingWeeklyReport) return [];
    if (viewingWeeklyReport.subCategorySummary && viewingWeeklyReport.subCategorySummary.length > 0) {
      return viewingWeeklyReport.subCategorySummary;
    }
    const rows = getRowsForReport(viewingWeeklyReport);
    return rows.map(r => ({
      subCategory: r.subCategory,
      mainCategory: r.mainCategory,
      accountCode: r.accountCode,
      itemCount: r.itemCount,
      amount: r.amount
    }));
  }, [viewingWeeklyReport, submittedReports, generalCollections, rptCollections]);

  // Remitted bank deposits included in viewed weekly or monthly report
  const viewingWeeklyDeposits = useMemo(() => {
    if (!viewingWeeklyReport) return [];

    const depositsMap = new Map<string, BankDepositRecord>();

    if (viewingWeeklyReport.selectedDeposits && Array.isArray(viewingWeeklyReport.selectedDeposits)) {
      viewingWeeklyReport.selectedDeposits.forEach(d => depositsMap.set(d.id, d));
    }
    if (viewingWeeklyReport.selectedDepositIds && Array.isArray(viewingWeeklyReport.selectedDepositIds)) {
      const matched = bankDeposits.filter(d => viewingWeeklyReport.selectedDepositIds!.includes(d.id));
      matched.forEach(d => depositsMap.set(d.id, d));
    }

    if (viewingWeeklyReport.reportType === 'admin_monthly' || viewingWeeklyReport.reportLevel === 'monthly') {
      const weeklyIds = new Set(viewingWeeklyReport.consolidatedWeeklyReportIds || []);
      const underlyingWeekly = submittedReports.filter(r => 
        (weeklyIds.size > 0 && (weeklyIds.has(r.id) || weeklyIds.has(r.reportNumber))) ||
        r.consolidatedInMonthlyReportId === viewingWeeklyReport.id ||
        r.consolidatedInMonthlyReportId === viewingWeeklyReport.reportNumber
      );

      underlyingWeekly.forEach(wRep => {
        if (wRep.selectedDeposits && Array.isArray(wRep.selectedDeposits)) {
          wRep.selectedDeposits.forEach(d => depositsMap.set(d.id, d));
        } else if (wRep.selectedDepositIds && Array.isArray(wRep.selectedDepositIds)) {
          const matched = bankDeposits.filter(d => wRep.selectedDepositIds!.includes(d.id));
          matched.forEach(d => depositsMap.set(d.id, d));
        }
      });
    }

    return sortDepositsOldestToLatest(Array.from(depositsMap.values()));
  }, [viewingWeeklyReport, bankDeposits, submittedReports]);

  // Open Report Print Modal (Matrix layout)
  const handlePrintReport = (report?: AdminSubmittedReportRecord) => {
    setPrintingReport(report || null);
    setPrintViewMode('matrix');
    setPrintDialogOpen(true);
  };

  const handlePrintMatrix = (report: AdminSubmittedReportRecord) => {
    handlePrintReport(report);
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

  // Helper to render standard header for printable sheets
  const renderPrintHeader = (pageIndex?: number, totalPages?: number) => {
    const isMonthly = printingReport?.reportLevel === 'monthly' || printingReport?.reportType === 'admin_monthly';
    const monthLabel = printingReport ? getReportMonthLabel(printingReport).toUpperCase() : '';
    let subtitle = '';
    if (printingReport) {
      if (isMonthly) {
        subtitle = `FOR THE MONTH OF ${monthLabel}`;
      } else {
        const resolvedWeekStr = resolveWeekLabel(printingReport, weeklyReports).toUpperCase();
        const weekLabelRaw = (printingReport.weekLabel && printingReport.weekLabel.trim()) ? printingReport.weekLabel.trim().toUpperCase() : resolvedWeekStr;
        if (/of\s+/i.test(weekLabelRaw)) {
          subtitle = `WEEKLY REPORT — ${weekLabelRaw}`;
        } else {
          const weekTag = weekLabelRaw.includes('WEEK') ? weekLabelRaw : `WEEK ${weekLabelRaw}`;
          subtitle = `WEEKLY REPORT — ${weekTag}, ${monthLabel}`;
        }
      }
    }

    const title = printViewMode === 'balances'
      ? (isMonthly
          ? 'OFFICIAL MONTHLY REPORT OF ENDING BALANCES, DEPOSITS, AND COLLECTIONS'
          : 'OFFICIAL WEEKLY REPORT OF ENDING BALANCES, DEPOSITS, AND COLLECTIONS')
      : printViewMode === 'recap'
      ? (isMonthly
          ? 'OFFICIAL MONTHLY REPORT OF COLLECTIONS AND DEPOSITS — RECAPITULATION'
          : 'OFFICIAL WEEKLY REPORT OF COLLECTIONS AND DEPOSITS — RECAPITULATION')
      : (printingReport
          ? (isMonthly
              ? 'OFFICIAL MONTHLY REPORT OF COLLECTIONS'
              : 'OFFICIAL WEEKLY REPORT OF COLLECTIONS')
          : 'CONSOLIDATED REPORT OF COLLECTIONS');

    return (
      <Box sx={{ textAlign: 'center', mb: { xs: 1.2, md: 1.5 }, '@media print': { mb: '2mm' } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', px: { xs: 0, sm: 1 } }}>
          <Box sx={{ width: { xs: 50, sm: 80 } }} />
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '6.5pt', textTransform: 'uppercase', letterSpacing: 0.5, color: '#475569', fontWeight: 600, lineHeight: 1.2 }}>
              Republic of the Philippines • Province of Romblon
            </Typography>
            <Typography sx={{ fontSize: '9pt', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
              MUNICIPALITY OF CONCEPCION
            </Typography>
            <Typography sx={{ fontSize: '7.5pt', fontWeight: 700, color: '#0284c7', lineHeight: 1.2 }}>
              OFFICE OF THE MUNICIPAL TREASURER
            </Typography>
            <Typography sx={{ fontSize: '10.5pt', fontWeight: 900, mt: 0.3, color: '#0f172a', letterSpacing: 0.5, lineHeight: 1.2 }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography sx={{ fontSize: '8.5pt', fontWeight: 800, mt: 0.3, color: '#0284c7', letterSpacing: 0.4, textTransform: 'uppercase' }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box sx={{ width: { xs: 50, sm: 80 }, textAlign: 'right' }}>
            {totalPages !== undefined && (
              <Typography sx={{ fontSize: '7.5pt', fontWeight: 700, color: '#475569', border: '1px solid #cbd5e1', px: 0.8, py: 0.2, borderRadius: 0.5, display: 'inline-block', '@media print': { border: '0.5pt solid #000000', color: '#000000' } }}>
                Page {(pageIndex ?? 0) + 1} of {totalPages}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
    );
  };

  // Handle Admin Approval of Collector Unarchive Request
  const handleApproveUnarchive = async (reportId: string) => {
    // 1. Optimistically remove/unmark the report from the pending unarchive list immediately
    setSubmittedReports(prev => prev.filter(r => r.id !== reportId && r.reportNumber !== reportId));

    setNotification({
      open: true,
      message: 'Unarchive request approved successfully. Collector can now edit this report.',
      severity: 'success'
    });

    try {
      await approveUnarchiveReport(reportId);
      await loadData();
    } catch (err) {
      console.error('Failed to approve unarchive request:', err);
      setNotification({
        open: true,
        message: 'Failed to approve unarchive request.',
        severity: 'error'
      });
      await loadData();
    }
  };

  // Handle Admin Rejection of Collector Unarchive Request
  const handleRejectUnarchive = async (reportId: string) => {
    // 1. Optimistically update report to rejected state immediately
    setSubmittedReports(prev => prev.map(r => {
      if (r.id === reportId || r.reportNumber === reportId) {
        return {
          ...r,
          status: 'Submitted' as const,
          unarchiveStatus: 'Rejected' as const,
          unarchiveRequestedBy: undefined,
          unarchiveRequestedAt: undefined
        };
      }
      return r;
    }));

    setNotification({
      open: true,
      message: 'Unarchive request rejected.',
      severity: 'info'
    });

    try {
      await rejectUnarchiveReport(reportId);
      await loadData();
    } catch (err) {
      console.error('Failed to reject unarchive request:', err);
      setNotification({
        open: true,
        message: 'Failed to reject unarchive request.',
        severity: 'error'
      });
      await loadData();
    }
  };


  // Sync existing stagedTableRows if user positions map updates or Job Order status changes
  useEffect(() => {
    if (stagedTableRows.length > 0) {
      setStagedTableRows(prev => {
        let changed = false;
        const updated = prev.map(row => {
          const effectiveName = getEffectiveCollectorName(row.collectorEmail, row.userId, row.collectorName);
          if (effectiveName && effectiveName !== row.collectorName) {
            changed = true;
            return { ...row, collectorName: effectiveName };
          }
          return row;
        });
        return changed ? updated : prev;
      });
    }
  }, [userPositionsMap, signatories, managedUsersList]);

  // Helper for computing OR Range display string without leading zeroes
  const formatOrRange = (orList: string[]): string => {
    if (!orList || orList.length === 0) return 'None';
    const cleaned = Array.from(new Set(orList.map(stripLeadingZeroes).filter(Boolean)));
    if (cleaned.length === 0) return 'None';
    if (cleaned.length === 1) return cleaned[0];
    const sorted = [...cleaned].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (sorted[0] === sorted[sorted.length - 1]) return sorted[0];
    return `${sorted[0]} — ${sorted[sorted.length - 1]} (${sorted.length} ORs)`;
  };



  // Load all initial data from Supabase / local caches
  const loadData = async () => {
    setLoading(true);
    try {
      const [genData, rptData, managedUsers, submittedKeys, subReports, depositRecords, sigs] = await Promise.all([
        getCollectionEntries(),
        getRPTCollections(),
        getAllManagedUsers().catch(() => []),
        getSubmittedItemIds().catch(() => new Set<string>()),
        getAdminSubmittedReports().catch(() => []),
        getBankDeposits().catch(() => []),
        getSignatories().catch(() => [])
      ]);

      setGeneralCollections(genData);
      setRptCollections(rptData);
      setSubmittedItemKeys(submittedKeys);
      setSubmittedReports(subReports);
      setBankDeposits(depositRecords);
      setSignatories(sigs);
      setManagedUsersList(managedUsers);

      const nameMap: Record<string, string> = {};
      const posMap: Record<string, string> = {};

      if (managedUsers && managedUsers.length > 0) {
        managedUsers.forEach(u => {
          const name = u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
          if (u.email) {
            nameMap[u.email.toLowerCase().trim()] = name;
            if (u.position) posMap[u.email.toLowerCase().trim()] = u.position;
          }
          if (u.id) {
            nameMap[u.id.toLowerCase().trim()] = name;
            if (u.position) posMap[u.id.toLowerCase().trim()] = u.position;
          }
          if (name) {
            if (u.position) posMap[name.toLowerCase().trim()] = u.position;
          }
        });
      }

      if (sigs && sigs.length > 0) {
        sigs.forEach(s => {
          if (s.fullName && s.position) {
            posMap[s.fullName.toLowerCase().trim()] = s.position;
          }
        });
      }

      setUsersMap(nameMap);
      setUserPositionsMap(posMap);
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

  // Collector-submitted reports available for consolidation in Tab 0
  const availableSubmittedReports = useMemo(() => {
    // Collect all report IDs that have already been consolidated in any active admin weekly / monthly / consolidation report
    const consolidatedReportIdsSet = new Set<string>();
    submittedReports.forEach(r => {
      if (r.reportType === 'admin_weekly' || r.reportType === 'admin_consolidation' || r.reportType === 'admin_monthly' || r.reportNumber?.startsWith('ADM-')) {
        if (Array.isArray(r.consolidatedReportIds)) {
          r.consolidatedReportIds.forEach(id => {
            if (id) consolidatedReportIdsSet.add(String(id).trim().toUpperCase());
          });
        }
        if (Array.isArray(r.consolidatedWeeklyReportIds)) {
          r.consolidatedWeeklyReportIds.forEach(id => {
            if (id) consolidatedReportIdsSet.add(String(id).trim().toUpperCase());
          });
        }
      }
    });

    return submittedReports.filter(r => {
      // Must be a collector submission, not an admin consolidation
      if (r.reportType === 'admin_consolidation' || r.reportType === 'admin_weekly' || r.reportType === 'admin_monthly' || r.reportNumber?.startsWith('ADM-') || r.submittedBy === 'Administrator') {
        return false;
      }

      const rid = (r.id || '').trim().toUpperCase();
      const rno = (r.reportNumber || '').trim().toUpperCase();

      // Must NOT be in consolidatedReportIdsSet of any existing active admin weekly/monthly report
      if (consolidatedReportIdsSet.has(rid) || consolidatedReportIdsSet.has(rno)) {
        return false;
      }

      // If r has consolidatedInReportId, check if parent report actually exists in submittedReports
      if (r.consolidatedInReportId) {
        const parentKey = r.consolidatedInReportId.trim().toUpperCase();
        const parentExists = submittedReports.some(sr => 
          (sr.id?.trim().toUpperCase() === parentKey || sr.reportNumber?.trim().toUpperCase() === parentKey)
        );
        if (parentExists) return false;
      }

      // Must NOT be marked as reported / consolidated if it's currently consolidated
      if (r.isReportedByAdmin && (r.status === 'Consolidated' || r.status === 'Reported')) {
        return false;
      }

      if (r.unarchiveStatus === 'Approved') return false;

      if (builderCollectorFilter && getSubmittedCollectorNameForReport(r) !== builderCollectorFilter) {
        return false;
      }

      if (builderDateFrom) {
        const d = r.dateFrom || r.submittedAt?.substring(0, 10) || '';
        if (d && d < builderDateFrom) return false;
      }
      if (builderDateTo) {
        const d = r.dateTo || r.submittedAt?.substring(0, 10) || '';
        if (d && d > builderDateTo) return false;
      }

      if (builderSearchTerm.trim()) {
        const q = builderSearchTerm.toLowerCase();
        const matchNo = r.reportNumber.toLowerCase().includes(q);
        const matchCollector = getSubmittedCollectorNameForReport(r).toLowerCase().includes(q) || (r.collectorEmail || '').toLowerCase().includes(q);
        const matchAf = r.afNo.toLowerCase().includes(q);
        const matchOr = r.orRange.toLowerCase().includes(q);
        if (!matchNo && !matchCollector && !matchAf && !matchOr) return false;
      }

      return true;
    }).sort((a, b) => (a.reportNumber || '').localeCompare(b.reportNumber || '', undefined, { numeric: true, sensitivity: 'base' }));
  }, [submittedReports, builderCollectorFilter, builderDateFrom, builderDateTo, builderSearchTerm]);

  // Unique Collectors available in Submitted Reports for builder filter
  const uniqueBuilderCollectors = useMemo(() => {
    const set = new Set<string>();
    submittedReports.forEach(r => {
      const name = getSubmittedCollectorNameForReport(r);
      if (name) set.add(name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [submittedReports]);

  // Pending Unarchive Requests from collectors awaiting admin approval
  const pendingUnarchiveReports = useMemo(() => {
    return submittedReports.filter(r => 
      r.unarchiveStatus === 'Pending Admin Approval' || 
      r.status === 'Pending Admin Approval'
    );
  }, [submittedReports]);

  // Toggle selection of a collector-submitted report for active consolidation
  const handleToggleSelectSubmittedReport = (reportId: string) => {
    setSelectedSubmittedReportIds(prev => {
      const next = prev.includes(reportId)
        ? prev.filter(id => id !== reportId)
        : [...prev, reportId];

      const selectedReports = submittedReports.filter(r => next.includes(r.id));
      const allRows: StagedReportRow[] = [];
      selectedReports.forEach(r => {
        allRows.push(...getRowsForReport(r));
      });
      setStagedTableRows(allRows);
      return next;
    });
  };

  // Select All or Deselect All submitted reports for consolidation
  const handleSelectAllSubmittedReports = () => {
    if (selectedSubmittedReportIds.length === availableSubmittedReports.length) {
      setSelectedSubmittedReportIds([]);
      setStagedTableRows([]);
    } else {
      const allIds = availableSubmittedReports.map(r => r.id);
      setSelectedSubmittedReportIds(allIds);
      const allRows: StagedReportRow[] = [];
      availableSubmittedReports.forEach(r => {
        allRows.push(...getRowsForReport(r));
      });
      setStagedTableRows(allRows);
    }
  };

  // Clear all staged rows
  const handleClearStagedTable = () => {
    setStagedTableRows([]);
    setSelectedSubmittedReportIds([]);
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

  // Paginated Matrix Pages for multi-page printing with page subtotals and total on all subtotals
  const paginatedMatrixPages = useMemo(() => {
    const allRows = printMatrixData.rows;
    if (allRows.length === 0) {
      return [{
        pageIndex: 0,
        rows: [] as MatrixReportRow[],
        pageTotals: {
          poblacion: 0,
          sanPedro: 0,
          calSpring: 0,
          calPump: 0,
          samSpring: 0,
          samPump: 0,
          bakhawan: 0,
          masudsud: 0,
          dalajican: 0,
          sanVicente: 0,
          sundry: 0,
          amount: 0,
        }
      }];
    }

    const totalPages = Math.ceil(allRows.length / matrixRowsPerPage);
    const pages = [];

    for (let i = 0; i < totalPages; i++) {
      const pageRows = allRows.slice(i * matrixRowsPerPage, (i + 1) * matrixRowsPerPage);
      const pageWater = pageRows.reduce((sum, r) => 
        sum + (Number(r.poblacion) || 0)
            + (Number(r.sanPedro) || 0)
            + (Number(r.calabasahanSpring) || 0)
            + (Number(r.calabasahanPump) || 0)
            + (Number(r.sampongSpring) || 0)
            + (Number(r.sampongPump) || 0)
            + (Number(r.bakhawan) || 0)
            + (Number(r.masudsud) || 0)
            + (Number(r.dalajican) || 0)
            + (Number(r.sanVicente) || 0), 0);
      const pageSundry = pageRows.reduce((sum, r) => sum + (r.subCategory ? (Number(r.amount) || 0) : 0), 0);

      const pTotals = {
        poblacion: pageRows.reduce((sum, r) => sum + (Number(r.poblacion) || 0), 0),
        sanPedro: pageRows.reduce((sum, r) => sum + (Number(r.sanPedro) || 0), 0),
        calSpring: pageRows.reduce((sum, r) => sum + (Number(r.calabasahanSpring) || 0), 0),
        calPump: pageRows.reduce((sum, r) => sum + (Number(r.calabasahanPump) || 0), 0),
        samSpring: pageRows.reduce((sum, r) => sum + (Number(r.sampongSpring) || 0), 0),
        samPump: pageRows.reduce((sum, r) => sum + (Number(r.sampongPump) || 0), 0),
        bakhawan: pageRows.reduce((sum, r) => sum + (Number(r.bakhawan) || 0), 0),
        masudsud: pageRows.reduce((sum, r) => sum + (Number(r.masudsud) || 0), 0),
        dalajican: pageRows.reduce((sum, r) => sum + (Number(r.dalajican) || 0), 0),
        sanVicente: pageRows.reduce((sum, r) => sum + (Number(r.sanVicente) || 0), 0),
        sundry: pageSundry,
        amount: pageWater + pageSundry,
      };
      pages.push({
        pageIndex: i,
        rows: pageRows,
        pageTotals: pTotals,
      });
    }

    return pages;
  }, [printMatrixData.rows, matrixRowsPerPage]);

  const totalOnAllSubtotals = useMemo(() => {
    return paginatedMatrixPages.reduce(
      (acc, p) => ({
        poblacion: acc.poblacion + p.pageTotals.poblacion,
        sanPedro: acc.sanPedro + p.pageTotals.sanPedro,
        calSpring: acc.calSpring + p.pageTotals.calSpring,
        calPump: acc.calPump + p.pageTotals.calPump,
        samSpring: acc.samSpring + p.pageTotals.samSpring,
        samPump: acc.samPump + p.pageTotals.samPump,
        bakhawan: acc.bakhawan + p.pageTotals.bakhawan,
        masudsud: acc.masudsud + p.pageTotals.masudsud,
        dalajican: acc.dalajican + p.pageTotals.dalajican,
        sanVicente: acc.sanVicente + p.pageTotals.sanVicente,
        sundry: acc.sundry + p.pageTotals.sundry,
        amount: acc.amount + p.pageTotals.amount,
      }),
      {
        poblacion: 0,
        sanPedro: 0,
        calSpring: 0,
        calPump: 0,
        samSpring: 0,
        samPump: 0,
        bakhawan: 0,
        masudsud: 0,
        dalajican: 0,
        sanVicente: 0,
        sundry: 0,
        amount: 0,
      }
    );
  }, [paginatedMatrixPages]);

  // Compute Recapitulation Data:
  // Note: Only Water Surcharge is included in sundry items/amounts. Basic water charges are NOT in sundry amounts.
  // However, all basic water charges per barangay are included in the recapitulation grand total.
  const printRecapData = useMemo(() => {
    const map = new Map<string, { subCategory: string; accountCode: string; amount: number }>();
    let basicWaterTotal = 0;

    printRows.forEach(r => {
      const amt = r.amount;
      if (amt <= 0) return;

      // Basic water charges must NOT be included in sundry amounts!
      if (isWaterBasicCharge(r)) {
        basicWaterTotal += amt;
        return;
      }

      let subCatName = r.subCategory ? r.subCategory.trim() : 'Sundry';
      let accCode = r.accountCode ? r.accountCode.trim() : '-';

      if (isWaterSurcharge(r) || isWaterSurcharge({ subCategory: subCatName, accountCode: accCode })) {
        subCatName = 'Water-Surcharge';
        if (!accCode || accCode === '-') accCode = '4-02-02-980';
      } else if (subCatName === 'Community Tax - Individual' || subCatName === 'Community Tax - Corporation' || subCatName === 'Community Tax') {
        subCatName = 'Community Tax';
        if (!accCode || accCode === '-') accCode = '4-01-01-050';
      } else if (subCatName === 'Surcharge-CTC' || subCatName === 'Surcharge - CTC' || subCatName === 'CTC Surcharge') {
        subCatName = 'Surcharge-CTC';
        if (!accCode || accCode === '-') accCode = '4-01-05-010';
      }

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

    const sundryTotal = items.reduce((sum, i) => sum + i.amount, 0);
    const grandTotal = sundryTotal + basicWaterTotal;

    return { items, sundryTotal, basicWaterTotal, grandTotal };
  }, [printRows]);

  // Section C: Accountability for Accountable Forms (Beginning, Issued, Ending Balances)
  // Section B: Summary of Collections (TOTAL ONLY OF EACH BOOKLET)
  const printBookletSummaryData = useMemo(() => {
    const map = new Map<string, {
      batchId: string;
      bookletNo: string;
      reportNo: string;
      collectorName: string;
      collectionType: 'general' | 'rpt' | 'ctc' | 'consol' | string;
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
      const amt = r.amount;
      existing.totalAmount += amt;
    });

    const booklets = Array.from(map.values()).sort((a, b) => {
      const repA = (a.reportNo || '').trim();
      const repB = (b.reportNo || '').trim();
      return repA.localeCompare(repB, undefined, { numeric: true, sensitivity: 'base' });
    });
    const grandTotal = booklets.reduce((sum, b) => sum + b.totalAmount, 0);
    return { booklets, grandTotal };
  }, [printRows]);

  // Section A: Selected Bank Deposits for Balances Report
  const printReportSelectedDeposits = useMemo(() => {
    if (printingReport) {
      const depositsMap = new Map<string, BankDepositRecord>();

      if (printingReport.selectedDeposits && Array.isArray(printingReport.selectedDeposits)) {
        printingReport.selectedDeposits.forEach((d: any) => depositsMap.set(d.id, d));
      }
      if (printingReport.selectedDepositIds && Array.isArray(printingReport.selectedDepositIds)) {
        const matched = bankDeposits.filter(d => printingReport.selectedDepositIds!.includes(d.id));
        matched.forEach(d => depositsMap.set(d.id, d));
      }

      if (printingReport.reportType === 'admin_monthly' || printingReport.reportLevel === 'monthly') {
        const weeklyIds = new Set(printingReport.consolidatedWeeklyReportIds || []);
        const underlyingWeekly = submittedReports.filter(r => 
          (weeklyIds.size > 0 && (weeklyIds.has(r.id) || weeklyIds.has(r.reportNumber))) ||
          r.consolidatedInMonthlyReportId === printingReport.id ||
          r.consolidatedInMonthlyReportId === printingReport.reportNumber
        );

        underlyingWeekly.forEach(wRep => {
          if (wRep.selectedDeposits && Array.isArray(wRep.selectedDeposits)) {
            wRep.selectedDeposits.forEach(d => depositsMap.set(d.id, d));
          } else if (wRep.selectedDepositIds && Array.isArray(wRep.selectedDepositIds)) {
            const matched = bankDeposits.filter(d => wRep.selectedDepositIds!.includes(d.id));
            matched.forEach(d => depositsMap.set(d.id, d));
          }
        });
      }

      if (depositsMap.size === 0) {
        const matched = bankDeposits.filter(d => d.reportId === printingReport.reportNumber);
        matched.forEach(d => depositsMap.set(d.id, d));
      }

      const deposits = sortDepositsOldestToLatest(Array.from(depositsMap.values()));
      const total = deposits.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
      return { deposits, totalAmount: total };
    }

    // Active Staged Table: use selected deposits from state (or default to all unreported)
    const activeIds = selectedDepositIds.length > 0 ? selectedDepositIds : unreportedDeposits.map(d => d.id);
    const matched = sortDepositsOldestToLatest(bankDeposits.filter(d => activeIds.includes(d.id)));
    const total = matched.reduce((sum, d) => sum + d.amount, 0);
    return { deposits: matched, totalAmount: total };
  }, [printingReport, bankDeposits, selectedDepositIds, unreportedDeposits, submittedReports]);

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
      'Date',
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
      'Sundry',
      'Account Code',
      'Amount (₱)'
    ];

    const headerRow2 = [
      '',
      '',
      '',
      '',
      '',
      '', // Report No.
      '', // Poblacion
      '', // San Pedro
      'Spring',
      'Pump',
      'Bukal',
      'Guiob',
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
        mr.submissionDate || '-',
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
        mr.subCategory,
        mr.accountCode,
        mr.amount > 0 ? mr.amount : ''
      ]);
    });

    // Grand Total Row
    aoaData.push([
      '',
      '-',
      'GRAND TOTAL',
      `${totals.bookletCount} Booklets`,
      '',
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
      totals.sundry || 0,
      '',
      totals.grandTotal
    ]);

    const ws = XLSX.utils.aoa_to_sheet(aoaData);

    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // #
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // Date
      { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }, // Collector Name
      { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } }, // Booklet No.
      { s: { r: 0, c: 4 }, e: { r: 1, c: 4 } }, // OR Numbers
      { s: { r: 0, c: 5 }, e: { r: 1, c: 5 } }, // Report No.
      { s: { r: 0, c: 6 }, e: { r: 1, c: 6 } }, // Poblacion
      { s: { r: 0, c: 7 }, e: { r: 1, c: 7 } }, // San Pedro
      { s: { r: 0, c: 8 }, e: { r: 0, c: 9 } }, // Calabasahan (spanning Spring & Pump)
      { s: { r: 0, c: 10 }, e: { r: 0, c: 11 } }, // Sampong (spanning Bukal & Guiob)
      { s: { r: 0, c: 12 }, e: { r: 1, c: 12 } }, // Bakhawan
      { s: { r: 0, c: 13 }, e: { r: 1, c: 13 } }, // Masudsud
      { s: { r: 0, c: 14 }, e: { r: 1, c: 14 } }, // Dalajican
      { s: { r: 0, c: 15 }, e: { r: 1, c: 15 } }, // San Vicente
      { s: { r: 0, c: 16 }, e: { r: 1, c: 16 } }, // Sundry
      { s: { r: 0, c: 17 }, e: { r: 1, c: 17 } }, // Account Code
      { s: { r: 0, c: 18 }, e: { r: 1, c: 18 } }  // Amount (₱)
    ];

    ws['!cols'] = [
      { wch: 6 },  // #
      { wch: 12 }, // Date
      { wch: 22 }, // Collector Name
      { wch: 14 }, // Booklet No.
      { wch: 30 }, // OR Numbers
      { wch: 14 }, // Report No.
      { wch: 12 }, // Poblacion
      { wch: 12 }, // San Pedro
      { wch: 11 }, // Calabasahan Spring
      { wch: 11 }, // Calabasahan Pump
      { wch: 11 }, // Sampong Bukal
      { wch: 11 }, // Sampong Guiob
      { wch: 12 }, // Bakhawan
      { wch: 12 }, // Masudsud
      { wch: 12 }, // Dalajican
      { wch: 12 }, // San Vicente
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
      const uniqueCollectors = Array.from(new Set(stagedTableRows.map(r => getEffectiveCollectorName(r.collectorEmail, r.userId, r.collectorName)).filter(Boolean)));
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

      // Determine year and month code (YYYY-MM) from chosen report date
      const chosenReportDate = reportDateInput || getTodayDateString();
      let yyyy = chosenReportDate.slice(0, 4);
      let mm = chosenReportDate.slice(5, 7);

      // Extract week name / number (e.g. "Week 1 of September 2026" -> "WEEK1", "Week 2" -> "WEEK2")
      let weekTag = 'WEEK1';
      const weekMatch = weekLabelInput.match(/Week\s*(\d+)/i);
      if (weekMatch) {
        weekTag = `WEEK${weekMatch[1]}`;
      } else if (weekLabelInput.trim()) {
        weekTag = weekLabelInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 10);
      }

      const timeCode = Date.now().toString().slice(-4);
      const reportNum = `ADM-${yyyy}-${mm}-${weekTag}-${timeCode}`;

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

      const selectedDepositsList = sortDepositsOldestToLatest(bankDeposits.filter(d => selectedDepositIds.includes(d.id)));
      const totalDepositsAmount = round2(selectedDepositsList.reduce((sum, d) => sum + d.amount, 0));
      const computedEndingBalance = round2(round2(Number(beginningBalanceInput)) + round2(totalAmount) - totalDepositsAmount);

      const calculatedWeekLabel = weekLabelInput.trim() || resolveWeekLabel({ dateFrom: minDate, dateTo: maxDate, submittedAt: new Date().toISOString() } as any, weeklyReports);

      // Apply assigned report dates to staged rows
      const updatedStagedRows = stagedTableRows.map(r => {
        const assigned = (r.batchId ? reportDatesMap[r.batchId] : undefined) || (r.reportNo ? reportDatesMap[r.reportNo] : undefined) || chosenReportDate;
        return {
          ...r,
          submissionDate: assigned,
          dateFrom: assigned,
          dateTo: assigned
        };
      });

      const allAssignedDates = updatedStagedRows.map(r => r.submissionDate).filter(Boolean);
      const resolvedMinDate = allAssignedDates.length > 0 
        ? allAssignedDates.reduce((min, d) => d < min ? d : min, allAssignedDates[0]) 
        : (minDate || chosenReportDate);
      const resolvedMaxDate = allAssignedDates.length > 0 
        ? allAssignedDates.reduce((max, d) => d > max ? d : max, allAssignedDates[0]) 
        : (maxDate || chosenReportDate);

      const newRecord: AdminSubmittedReportRecord = {
        id: `adm_weekly_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        reportNumber: reportNum,
        weekLabel: calculatedWeekLabel,
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
        submittedAt: `${chosenReportDate}T${new Date().toTimeString().split(' ')[0]}.000Z`,
        reportDate: chosenReportDate,
        submittedBy: user?.name || 'Administrator',
        status: 'Submitted',
        reportType: 'admin_weekly',
        reportLevel: 'weekly',
        submittedToMonthly: false,
        isReportedByAdmin: true,
        consolidatedReportIds: [...selectedSubmittedReportIds],
        dateFrom: resolvedMinDate,
        dateTo: resolvedMaxDate,
        stagedRows: updatedStagedRows, // Snapshot with assigned report dates!
        beginningBalance: round2(Number(beginningBalanceInput)),
        endingBalance: computedEndingBalance,
        selectedDepositIds: selectedDepositIds,
        selectedDeposits: selectedDepositsList
      };

      await saveAdminSubmittedReport(newRecord);
      if (selectedSubmittedReportIds.length > 0) {
        await markCollectorReportsAsConsolidated(selectedSubmittedReportIds, newRecord.id);
        const idSet = new Set(selectedSubmittedReportIds);
        setSubmittedReports(prev => prev.map(r => {
          if (idSet.has(r.id) || (r.reportNumber && idSet.has(r.reportNumber))) {
            const assigned = (r.id ? reportDatesMap[r.id] : undefined) || (r.reportNumber ? reportDatesMap[r.reportNumber] : undefined) || chosenReportDate;
            return {
              ...r,
              isReportedByAdmin: true,
              status: 'Consolidated' as const,
              consolidatedInReportId: newRecord.id,
              submittedAt: `${assigned}T${new Date().toTimeString().split(' ')[0]}.000Z`,
              dateTo: assigned,
              reportDate: assigned
            };
          }
          return r;
        }));
      }
      localStorage.setItem('rcd_last_ending_balance', String(computedEndingBalance));

      // Clear the staged table
      handleClearStagedTable();
      await loadData();

      setSubmitConfirmOpen(false);
      setActiveTab(1); // Navigate to Weekly Reports Tab

      setNotification({
        open: true,
        message: `Successfully generated Weekly Report ${reportNum} with ${uniqueBooklets.length} booklets! Available in Weekly Reports tab.`,
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



  // Helper to format YYYY-MM to human readable label (e.g. "2026-09" -> "September 2026")
  const formatMonthLabel = (yearMonth: string): string => {
    if (!yearMonth || yearMonth.length < 7) return yearMonth || '';
    const parts = yearMonth.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    if (isNaN(year) || isNaN(month)) return yearMonth;
    const date = new Date(year, month, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Helper to resolve the correct Month Label for a report (prioritizes monthLabel/weekLabel, actual row transaction dates, and dateTo/submittedAt)
  const getReportMonthLabel = (target?: { dateTo?: string; dateFrom?: string; submittedAt?: string; stagedRows?: any[]; weekLabel?: string; monthLabel?: string } | null): string => {
    if (!target) return '';
    if (target.monthLabel) return target.monthLabel;

    // Check weekLabel if available (e.g. "Week 1 of September 2026" -> "September 2026")
    if (target.weekLabel) {
      const match = target.weekLabel.match(/of\s+(.+)$/i);
      if (match && match[1]) return match[1].trim();
    }

    // Check actual staged row dates (preferring dateTo / submissionDate / date over dateFrom)
    if (target.stagedRows && Array.isArray(target.stagedRows) && target.stagedRows.length > 0) {
      const dates = target.stagedRows.map((r: any) => r.dateTo || r.submissionDate || (r as any).date || r.dateFrom).filter(Boolean);
      if (dates.length > 0) {
        const sorted = [...dates].sort();
        const latestDate = sorted[sorted.length - 1];
        if (latestDate && latestDate.length >= 7) {
          return formatMonthLabel(latestDate.substring(0, 7));
        }
      }
    }

    const ym = target.dateTo?.substring(0, 7) || target.submittedAt?.substring(0, 7) || target.dateFrom?.substring(0, 7) || '';
    return formatMonthLabel(ym);
  };

  // All Admin Reports (consolidation / weekly / monthly)
  const adminReports = useMemo(() => {
    return submittedReports.filter(r => 
      r.reportType === 'admin_consolidation' || 
      r.reportType === 'admin_weekly' || 
      r.reportType === 'admin_monthly' || 
      r.reportNumber?.startsWith('ADM-') || 
      r.reportNumber?.startsWith('CONSOL-') || 
      r.submittedBy === 'Administrator'
    );
  }, [submittedReports]);

  // Weekly Reports: Admin reports that are weekly level and not monthly
  const weeklyReports = useMemo(() => {
    return adminReports.filter(r => {
      const isMonthly = r.reportType === 'admin_monthly' || r.reportLevel === 'monthly' || r.reportNumber?.includes('MONTHLY');
      return !isMonthly;
    });
  }, [adminReports]);

  // Monthly Reports: Admin reports that are monthly level
  const monthlyReports = useMemo(() => {
    return adminReports.filter(r => {
      const isMonthly = r.reportType === 'admin_monthly' || r.reportLevel === 'monthly' || r.reportNumber?.includes('MONTHLY');
      return isMonthly;
    });
  }, [adminReports]);

  // Available unique months from Weekly Reports
  const availableWeeklyMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    weeklyReports.forEach(r => {
      const dates = [r.submittedAt, r.dateFrom, r.dateTo].filter(Boolean);
      dates.forEach(d => {
        if (d && d.length >= 7 && /^\d{4}-\d{2}/.test(d)) {
          monthsSet.add(d.substring(0, 7));
        }
      });
    });
    return Array.from(monthsSet)
      .sort((a, b) => b.localeCompare(a))
      .map(ym => ({ value: ym, label: formatMonthLabel(ym) }));
  }, [weeklyReports]);

  // Unique Collectors in Weekly Reports
  const uniqueWeeklyCollectors = useMemo(() => {
    const set = new Set<string>();
    weeklyReports.forEach(r => {
      const cName = getSubmittedCollectorNameForReport(r);
      if (cName) set.add(cName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [weeklyReports, submittedReports]);

  // Helper to resolve or calculate week label (e.g. "Week 1", "Week 2") for any weekly report
  const resolveWeekLabel = useCallback((rep?: AdminSubmittedReportRecord | null, allWeeklyList: AdminSubmittedReportRecord[] = weeklyReports): string => {
    if (!rep) return 'Week 1';
    if (rep.weekLabel && rep.weekLabel.trim()) {
      return rep.weekLabel.trim();
    }

    // Check if report number itself contains WEEK pattern (e.g. ADM-2026-09-WEEK1-1234)
    if (rep.reportNumber) {
      const match = rep.reportNumber.match(/WEEK-?(\d+)/i);
      if (match && match[1]) {
        return `Week ${match[1]}`;
      }
    }

    // Determine target month key (YYYY-MM)
    const dateStr = rep.dateFrom || rep.dateTo || (rep.submittedAt ? rep.submittedAt.substring(0, 10) : '');
    const monthKey = dateStr && dateStr.length >= 7 ? dateStr.substring(0, 7) : '';

    if (monthKey && allWeeklyList.length > 0) {
      const sameMonth = allWeeklyList
        .filter(r => {
          const d = r.dateFrom || r.dateTo || (r.submittedAt ? r.submittedAt.substring(0, 10) : '');
          return d && d.startsWith(monthKey);
        })
        .sort((a, b) => {
          const dA = a.dateFrom || a.dateTo || a.submittedAt || '';
          const dB = b.dateFrom || b.dateTo || b.submittedAt || '';
          if (dA !== dB) return dA.localeCompare(dB);
          return (a.submittedAt || '').localeCompare(b.submittedAt || '');
        });

      const idx = sameMonth.findIndex(r => r.id === rep.id || r.reportNumber === rep.reportNumber);
      if (idx !== -1) {
        return `Week ${idx + 1}`;
      }
    }

    // Fallback by day of month
    if (dateStr && dateStr.length >= 10) {
      const day = parseInt(dateStr.substring(8, 10), 10);
      if (!isNaN(day)) {
        return `Week ${Math.min(5, Math.ceil(day / 7))}`;
      }
    }

    return 'Week 1';
  }, [weeklyReports]);

  // Filtered Weekly Reports
  const filteredWeeklyReports = useMemo(() => {
    return weeklyReports.filter(r => {
      if (weeklyShowFilter === 'unsubmitted' && (r.submittedToMonthly || r.consolidatedInMonthlyReportId)) {
        return false;
      }
      if (weeklyShowFilter === 'submitted' && !(r.submittedToMonthly || r.consolidatedInMonthlyReportId)) {
        return false;
      }
      if (weeklyCollectorFilter && getSubmittedCollectorNameForReport(r) !== weeklyCollectorFilter) {
        return false;
      }
      if (weeklyMonthFilter) {
        const matchesMonth = [r.submittedAt, r.dateFrom, r.dateTo].some(
          d => d && d.includes(weeklyMonthFilter)
        );
        if (!matchesMonth) return false;
      }
      if (weeklySearchTerm.trim()) {
        const q = weeklySearchTerm.toLowerCase();
        const matchNo = r.reportNumber.toLowerCase().includes(q);
        const matchCollector = getSubmittedCollectorNameForReport(r).toLowerCase().includes(q) || (r.collectorEmail || '').toLowerCase().includes(q);
        const matchAf = r.afNo.toLowerCase().includes(q);
        const matchOr = r.orRange.toLowerCase().includes(q);
        const matchWeek = resolveWeekLabel(r, weeklyReports).toLowerCase().includes(q);
        if (!matchNo && !matchCollector && !matchAf && !matchOr && !matchWeek) return false;
      }
      return true;
    });
  }, [weeklyReports, weeklyShowFilter, weeklyCollectorFilter, weeklyMonthFilter, weeklySearchTerm, resolveWeekLabel, submittedReports]);

  // Paginated Weekly Reports
  const paginatedWeeklyReports = useMemo(() => {
    const start = weeklyPage * weeklyRowsPerPage;
    return filteredWeeklyReports.slice(start, start + weeklyRowsPerPage);
  }, [filteredWeeklyReports, weeklyPage, weeklyRowsPerPage]);

  useEffect(() => {
    setWeeklyPage(0);
  }, [weeklyCollectorFilter, weeklyMonthFilter, weeklySearchTerm, weeklyShowFilter]);

  // Helper to sort weekly reports logically by week number extracted from weekLabel, then dateFrom, then dateTo, then submittedAt
  const sortWeeklyReportsForConsolidation = (reports: AdminSubmittedReportRecord[]): AdminSubmittedReportRecord[] => {
    const getWeekNum = (r: AdminSubmittedReportRecord): number => {
      const label = resolveWeekLabel(r, weeklyReports);
      const m = label.match(/Week\s*(\d+)/i);
      if (m) return parseInt(m[1], 10);
      return 999;
    };

    return [...reports].sort((a, b) => {
      const wA = getWeekNum(a);
      const wB = getWeekNum(b);
      if (wA !== wB) {
        return wA - wB; // Sort Week 1, Week 2, Week 3...
      }
      const da = a.dateFrom || a.submittedAt || '';
      const db = b.dateFrom || b.submittedAt || '';
      if (da !== db) {
        return da.localeCompare(db);
      }
      const dtoA = a.dateTo || '';
      const dtoB = b.dateTo || '';
      if (dtoA !== dtoB) {
        return dtoA.localeCompare(dtoB);
      }
      return (a.submittedAt || '').localeCompare(b.submittedAt || '');
    });
  };

  // Synthesize a single composite Monthly Report from selected Weekly Reports
  const consolidatedMonthlyRecordFromWeekly = useMemo((): AdminSubmittedReportRecord | null => {
    if (selectedWeeklyReportIds.length === 0) return null;
    const selectedReports = weeklyReports.filter(r => selectedWeeklyReportIds.includes(r.id));
    if (selectedReports.length === 0) return null;

    const sortedReports = sortWeeklyReportsForConsolidation(selectedReports);

    const combinedRows: StagedReportRow[] = [];
    const allCollectorsSet = new Set<string>();
    const allEmailsSet = new Set<string>();
    const allAfNosSet = new Set<string>();
    const allOrsSet = new Set<string>();
    const allItemIds: number[] = [];
    const depositIdsSet = new Set<string>();
    const depositsMap = new Map<string, BankDepositRecord>();

    let totalAmt = 0;
    let minDate = sortedReports[0].dateFrom || sortedReports[0].submittedAt.substring(0, 10);
    let maxDate = sortedReports[sortedReports.length - 1].dateTo || sortedReports[sortedReports.length - 1].submittedAt.substring(0, 10);

    sortedReports.forEach(rep => {
      const repCollector = getSubmittedCollectorNameForReport(rep) || getEffectiveCollectorName(rep.collectorEmail, rep.userId, rep.collectorName);
      if (repCollector) allCollectorsSet.add(repCollector);
      if (rep.collectorEmail) allEmailsSet.add(rep.collectorEmail);
      if (rep.afNo) allAfNosSet.add(rep.afNo);

      if (rep.orNumbers && rep.orNumbers.length > 0) {
        rep.orNumbers.forEach(o => allOrsSet.add(o));
      }
      if (rep.itemIds && rep.itemIds.length > 0) {
        allItemIds.push(...rep.itemIds);
      }

      if (rep.dateFrom && rep.dateFrom < minDate) minDate = rep.dateFrom;
      if (rep.dateTo && rep.dateTo > maxDate) maxDate = rep.dateTo;

      if (rep.selectedDepositIds) {
        rep.selectedDepositIds.forEach(id => depositIdsSet.add(id));
      }
      if (rep.selectedDeposits) {
        rep.selectedDeposits.forEach(d => depositsMap.set(d.id, d));
      }

      totalAmt += rep.totalAmount;

      const rows = getRowsForReport(rep);
      combinedRows.push(...rows);
    });

    const allOrNumbers = Array.from(allOrsSet);
    const subCatMap = new Map<string, AdminSubCategoryCharge>();
    combinedRows.forEach(row => {
      const key = `${row.subCategory}__${row.accountCode}`;
      const existing = subCatMap.get(key) || {
        subCategory: row.subCategory,
        mainCategory: row.mainCategory,
        accountCode: row.accountCode,
        amount: 0,
        itemCount: 0,
        itemIds: []
      };
      existing.amount += row.amount;
      existing.itemCount += row.itemCount;
      if (!existing.itemIds) existing.itemIds = [];
      existing.itemIds.push(...row.itemIds);
      subCatMap.set(key, existing);
    });

    const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const timeCode = Date.now().toString().slice(-4);
    const reportNum = `ADM-MONTHLY-${dateCode}-${timeCode}`;

    const firstRep = sortedReports[0];
    const lastRep = sortedReports[sortedReports.length - 1];

    const weekWithMonth = sortedReports.find(r => r.weekLabel && r.weekLabel.includes(' of '));
    const extractedMonth = weekWithMonth?.weekLabel 
      ? weekWithMonth.weekLabel.replace(/^Week\s+\d+\s+of\s+/i, '').trim()
      : formatMonthLabel(maxDate?.substring(0, 7) || new Date().toISOString().substring(0, 7));

    return {
      id: `adm_monthly_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      reportNumber: reportNum,
      monthLabel: extractedMonth,
      collectorName: Array.from(allCollectorsSet).join(', '),
      collectorEmail: Array.from(allEmailsSet).join(', '),
      afNo: Array.from(allAfNosSet).join(', '),
      orRange: formatOrRange(allOrNumbers),
      orCount: allOrNumbers.length,
      orNumbers: allOrNumbers,
      itemIds: Array.from(new Set(allItemIds)),
      collectionType: firstRep.collectionType || 'general',
      totalAmount: round2(totalAmt),
      subCategorySummary: Array.from(subCatMap.values()),
      submittedAt: new Date().toISOString(),
      submittedBy: user?.name || 'Administrator',
      status: 'Submitted',
      reportType: 'admin_monthly',
      reportLevel: 'monthly',
      consolidatedWeeklyReportIds: [...selectedWeeklyReportIds],
      dateFrom: minDate,
      dateTo: maxDate,
      stagedRows: combinedRows,
      beginningBalance: firstRep.beginningBalance || 0,
      endingBalance: lastRep.endingBalance || 0,
      selectedDepositIds: Array.from(depositIdsSet),
      selectedDeposits: sortDepositsOldestToLatest(Array.from(depositsMap.values()))
    };
  }, [selectedWeeklyReportIds, weeklyReports, user?.name]);

  // Generated Month Options for Monthly Report Tag Selection
  const generatedMonthOptions = useMemo(() => {
    const optionsSet = new Set<string>();

    if (consolidatedMonthlyRecordFromWeekly?.monthLabel) {
      optionsSet.add(consolidatedMonthlyRecordFromWeekly.monthLabel);
    }

    if (selectedWeeklyReportIds.length > 0) {
      const selectedReps = weeklyReports.filter(r => selectedWeeklyReportIds.includes(r.id));
      selectedReps.forEach(r => {
        const dates = [r.dateFrom, r.dateTo, r.submittedAt].filter(Boolean);
        dates.forEach(d => {
          if (d && d.length >= 7 && /^\d{4}-\d{2}/.test(d)) {
            optionsSet.add(formatMonthLabel(d.substring(0, 7)));
          }
        });
      });
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    for (let yr = currentYear - 1; yr <= currentYear + 1; yr++) {
      for (let m = 0; m < 12; m++) {
        const ym = `${yr}-${String(m + 1).padStart(2, '0')}`;
        optionsSet.add(formatMonthLabel(ym));
      }
    }

    return Array.from(optionsSet).map(label => ({ label, value: label }));
  }, [consolidatedMonthlyRecordFromWeekly, selectedWeeklyReportIds, weeklyReports]);

  // Open "Submit Selected Weekly Reports as Monthly Report" modal
  const handleOpenSubmitMonthlyModal = () => {
    if (selectedWeeklyReportIds.length === 0) return;
    const firstWeekBegBal = consolidatedMonthlyRecordFromWeekly?.beginningBalance ?? previousReportEndingBalance;
    setMonthlyBeginningBalanceInput(firstWeekBegBal);

    const defaultMonth = consolidatedMonthlyRecordFromWeekly?.monthLabel || getReportMonthLabel(consolidatedMonthlyRecordFromWeekly);
    setMonthlyTaggedMonthInput(defaultMonth);
    setQuickMonthSelectValue(defaultMonth);

    const weeklyDepositIds = consolidatedMonthlyRecordFromWeekly?.selectedDepositIds || [];
    const unreportedIds = unreportedDeposits.map(d => d.id);
    const combinedDepositIds = Array.from(new Set([...weeklyDepositIds, ...unreportedIds]));

    setMonthlySelectedDepositIds(combinedDepositIds);
    setSubmitMonthlyConfirmOpen(true);
  };

  // Confirm submission of Monthly Report
  const handleConfirmSubmitMonthlyReport = async () => {
    if (!consolidatedMonthlyRecordFromWeekly) return;
    setIsSubmittingMonthly(true);

    try {
      const weeklyDeposits = consolidatedMonthlyRecordFromWeekly.selectedDeposits || [];
      const weeklyDepositIds = consolidatedMonthlyRecordFromWeekly.selectedDepositIds || [];

      const additionalDeposits = bankDeposits.filter(d => monthlySelectedDepositIds.includes(d.id));

      const depositsMap = new Map<string, BankDepositRecord>();
      weeklyDeposits.forEach(d => depositsMap.set(d.id, d));
      additionalDeposits.forEach(d => depositsMap.set(d.id, d));

      const finalDepositsList = sortDepositsOldestToLatest(Array.from(depositsMap.values()));
      const finalDepositIds = Array.from(new Set([...weeklyDepositIds, ...monthlySelectedDepositIds, ...depositsMap.keys()]));

      const totalDepositsAmt = round2(finalDepositsList.reduce((sum, d) => sum + (Number(d.amount) || 0), 0));
      const begBal = round2(Number(monthlyBeginningBalanceInput));
      const totalCollAmt = consolidatedMonthlyRecordFromWeekly.totalAmount;
      const computedMonthlyEndingBal = round2(begBal + totalCollAmt - totalDepositsAmt);

      const finalRecord: AdminSubmittedReportRecord = {
        ...consolidatedMonthlyRecordFromWeekly,
        monthLabel: monthlyTaggedMonthInput.trim() || consolidatedMonthlyRecordFromWeekly.monthLabel,
        beginningBalance: begBal,
        endingBalance: computedMonthlyEndingBal,
        selectedDepositIds: finalDepositIds,
        selectedDeposits: finalDepositsList
      };

      await saveAdminSubmittedReport(finalRecord);
      await markWeeklyReportsAsConsolidatedInMonthly(selectedWeeklyReportIds, finalRecord.id);

      setSelectedWeeklyReportIds([]);
      await loadData();

      setSubmitMonthlyConfirmOpen(false);
      setActiveTab(2); // Switch to Monthly Reports Tab

      setNotification({
        open: true,
        message: `Successfully generated Monthly Report ${finalRecord.reportNumber}! Included ${finalDepositsList.length} bank deposit records.`,
        severity: 'success'
      });
    } catch (err) {
      console.error('Error submitting monthly report', err);
      setNotification({
        open: true,
        message: 'Failed to submit monthly report.',
        severity: 'error'
      });
    } finally {
      setIsSubmittingMonthly(false);
    }
  };

  // Available unique months from Monthly Reports
  const availableMonthlyMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    monthlyReports.forEach(r => {
      if (r.monthLabel) {
        monthsSet.add(r.monthLabel);
      }
      const dates = [r.submittedAt, r.dateFrom, r.dateTo].filter(Boolean);
      dates.forEach(d => {
        if (d && d.length >= 7 && /^\d{4}-\d{2}/.test(d)) {
          monthsSet.add(formatMonthLabel(d.substring(0, 7)));
        }
      });
    });
    return Array.from(monthsSet)
      .sort((a, b) => b.localeCompare(a))
      .map(m => {
        if (/^\d{4}-\d{2}/.test(m)) {
          return { value: m, label: formatMonthLabel(m) };
        }
        return { value: m, label: m };
      });
  }, [monthlyReports]);

  // Unique Collectors in Monthly Reports
  const uniqueMonthlyCollectors = useMemo(() => {
    const set = new Set<string>();
    monthlyReports.forEach(r => {
      const cName = getSubmittedCollectorNameForReport(r);
      if (cName) set.add(cName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [monthlyReports, submittedReports]);

  // Filtered Monthly Reports
  const filteredMonthlyReports = useMemo(() => {
    return monthlyReports.filter(r => {
      if (monthlyCollectorFilter && getSubmittedCollectorNameForReport(r) !== monthlyCollectorFilter) {
        return false;
      }
      if (monthlyMonthFilter) {
        const matchesMonth = [r.monthLabel, getReportMonthLabel(r), r.submittedAt, r.dateFrom, r.dateTo].some(
          d => d && d.toLowerCase().includes(monthlyMonthFilter.toLowerCase())
        );
        if (!matchesMonth) return false;
      }
      if (monthlySearchTerm.trim()) {
        const q = monthlySearchTerm.toLowerCase();
        const matchNo = r.reportNumber.toLowerCase().includes(q);
        const matchCollector = getSubmittedCollectorNameForReport(r).toLowerCase().includes(q) || (r.collectorEmail || '').toLowerCase().includes(q);
        const matchAf = r.afNo.toLowerCase().includes(q);
        const matchOr = r.orRange.toLowerCase().includes(q);
        const matchMonthLabel = (r.monthLabel || '').toLowerCase().includes(q);
        if (!matchNo && !matchCollector && !matchAf && !matchOr && !matchMonthLabel) return false;
      }
      return true;
    });
  }, [monthlyReports, monthlyCollectorFilter, monthlyMonthFilter, monthlySearchTerm, submittedReports]);

  // Paginated Monthly Reports
  const paginatedMonthlyReports = useMemo(() => {
    const start = monthlyPage * monthlyRowsPerPage;
    return filteredMonthlyReports.slice(start, start + monthlyRowsPerPage);
  }, [filteredMonthlyReports, monthlyPage, monthlyRowsPerPage]);

  useEffect(() => {
    setMonthlyPage(0);
  }, [monthlyCollectorFilter, monthlyMonthFilter, monthlySearchTerm]);

  // Reopen Weekly Report
  const handleConfirmUnmarkWeekly = async (targetReport?: AdminSubmittedReportRecord | null) => {
    const report = targetReport ?? reportToUnmark;
    if (!report) return;

    if (report.submittedToMonthly || report.consolidatedInMonthlyReportId) {
      setNotification({
        open: true,
        message: `Report ${report.reportNumber} is already submitted as part of a Monthly Report. Please reopen the Monthly Report first.`,
        severity: 'warning'
      });
      setUnmarkConfirmOpen(false);
      setReportToUnmark(null);
      return;
    }

    try {
      if (report.consolidatedReportIds && report.consolidatedReportIds.length > 0) {
        await revertCollectorReportsFromConsolidation(report.consolidatedReportIds);
      }
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
      setNotification({
        open: true,
        message: `Weekly Report ${report.reportNumber} reopened. Collector reports returned to available consolidation pool.`,
        severity: 'info'
      });
    } catch (err) {
      console.error('Error unmarking weekly report:', err);
      setNotification({
        open: true,
        message: 'Failed to reopen weekly report.',
        severity: 'error'
      });
    }
  };

  // Reopen Monthly Report
  const handleConfirmUnmarkMonthly = async (targetReport?: AdminSubmittedReportRecord | null) => {
    const report = targetReport ?? reportToUnmark;
    if (!report) return;

    try {
      if (report.consolidatedWeeklyReportIds && report.consolidatedWeeklyReportIds.length > 0) {
        await revertWeeklyReportsFromMonthly(report.consolidatedWeeklyReportIds);
      }
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
      setNotification({
        open: true,
        message: `Monthly Report ${report.reportNumber} reopened. Included weekly reports restored to unsubmitted state.`,
        severity: 'info'
      });
    } catch (err) {
      console.error('Error unmarking monthly report:', err);
      setNotification({
        open: true,
        message: 'Failed to reopen monthly report.',
        severity: 'error'
      });
    }
  };

  // Export any report (Weekly/Monthly) to Excel
  const handleExportReportExcel = (target: AdminSubmittedReportRecord) => {
    if (!target) return;
    const rows = target.stagedRows && target.stagedRows.length > 0 ? target.stagedRows : getRowsForReport(target);
    const matrixData = computeMatrixRows(rows);

    const isMonthly = target.reportLevel === 'monthly' || target.reportType === 'admin_monthly';
    const reportTypeHeader = isMonthly ? 'MONTHLY REPORT' : 'WEEKLY REPORT';
    const monthLabelStr = getReportMonthLabel(target).toUpperCase();
    const resolvedWeekStr = resolveWeekLabel(target, weeklyReports).toUpperCase();
    const weekLabelRaw = (target.weekLabel && target.weekLabel.trim()) ? target.weekLabel.trim().toUpperCase() : resolvedWeekStr;
    const weekOrMonthTag = isMonthly 
      ? ` — FOR THE MONTH OF ${monthLabelStr}` 
      : /of\s+/i.test(weekLabelRaw)
      ? ` — ${weekLabelRaw}`
      : ` — ${weekLabelRaw.includes('WEEK') ? weekLabelRaw : 'WEEK ' + weekLabelRaw}, ${monthLabelStr}`;

    const titleRow = [`OFFICIAL ${reportTypeHeader} OF COLLECTIONS AND DEPOSITS (${target.reportNumber})${weekOrMonthTag}`];
    const periodRow = [`Period: ${target.dateFrom || ''} to ${target.dateTo || ''} | Collectors: ${target.collectorName}`];
    const blankRow = [''];

    const headerRow1 = [
      '#',
      'Collector Name',
      'Booklet',
      'OR Numbers',
      'Report No.',
      'Waterworks Charges (₱)',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'RPT (₱)',
      'Sundry Charges',
      'Account Code',
      'Amount (₱)'
    ];

    const headerRow2 = [
      '',
      '',
      '',
      '',
      '',
      'Poblacion',
      'San Pedro',
      'Calabasahan Spring',
      'Calabasahan Pump',
      'Sampong Bukal',
      'Sampong Guiob',
      'Bakhawan',
      'Masudsud',
      'Dalajican',
      'San Vicente',
      '',
      '',
      '',
      ''
    ];

    const aoaData: any[][] = [titleRow, periodRow, blankRow, headerRow1, headerRow2];

    matrixData.rows.forEach(mr => {
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
        mr.subCategory,
        mr.accountCode,
        mr.amount > 0 ? mr.amount : ''
      ]);
    });

    aoaData.push([
      'TOTAL',
      '',
      '',
      '',
      '',
      matrixData.totals.poblacion > 0 ? matrixData.totals.poblacion : 0,
      matrixData.totals.sanPedro > 0 ? matrixData.totals.sanPedro : 0,
      matrixData.totals.calSpring > 0 ? matrixData.totals.calSpring : 0,
      matrixData.totals.calPump > 0 ? matrixData.totals.calPump : 0,
      matrixData.totals.samSpring > 0 ? matrixData.totals.samSpring : 0,
      matrixData.totals.samPump > 0 ? matrixData.totals.samPump : 0,
      matrixData.totals.bakhawan > 0 ? matrixData.totals.bakhawan : 0,
      matrixData.totals.masudsud > 0 ? matrixData.totals.masudsud : 0,
      matrixData.totals.dalajican > 0 ? matrixData.totals.dalajican : 0,
      matrixData.totals.sanVicente > 0 ? matrixData.totals.sanVicente : 0,
      matrixData.totals.rpt > 0 ? matrixData.totals.rpt : 0,
      matrixData.totals.sundry > 0 ? matrixData.totals.sundry : 0,
      '',
      matrixData.totals.grandTotal
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet(aoaData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
    XLSX.writeFile(workbook, `Report_${target.reportNumber}.xlsx`);
  };

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

      {/* Pending Unarchive Requests from Collectors */}
      {pendingUnarchiveReports.length > 0 && (
        <Paper 
          elevation={0} 
          sx={{ 
            borderRadius: 2, 
            border: '1px solid #fde68a', 
            bgcolor: '#fffbeb', 
            p: 2, 
            mb: 2.5 
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LockClock sx={{ color: '#d97706', fontSize: 22 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#92400e' }}>
                Pending Unarchive Requests ({pendingUnarchiveReports.length})
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 600 }}>
              Collectors have requested to unarchive these reports for modifications. Approve or Reject below:
            </Typography>
          </Box>

          <Stack spacing={1}>
            {pendingUnarchiveReports.map(rep => (
              <Box 
                key={rep.id} 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  bgcolor: '#ffffff', 
                  border: '1px solid #fef3c7', 
                  borderRadius: 1.5, 
                  px: 2, 
                  py: 1,
                  flexWrap: 'wrap',
                  gap: 1.5
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#0284c7' }}>
                    {rep.reportNumber}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                    Collector: {getSubmittedCollectorNameForReport(rep)}
                  </Typography>
                  <Chip label={rep.afNo} size="small" variant="outlined" sx={{ fontSize: '0.70rem', fontWeight: 700 }} />
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    {rep.orRange ? (rep.orRange.includes('OR') ? rep.orRange : `${rep.orRange} (${rep.orCount || (rep.orNumbers ? rep.orNumbers.length : 0)} ORs)`) : ''}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#059669' }}>
                    ₱ {(rep.totalAmount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    startIcon={<CheckCircle sx={{ fontSize: 16 }} />}
                    onClick={() => handleApproveUnarchive(rep.id)}
                    sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', px: 1.5 }}
                  >
                    Approve Request
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<Cancel sx={{ fontSize: 16 }} />}
                    onClick={() => handleRejectUnarchive(rep.id)}
                    sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', px: 1.5 }}
                  >
                    Reject
                  </Button>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Paper>
      )}

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
            label={`Submitted Collector Reports for Consolidation (${availableSubmittedReports.length})`} 
          />
          <Tab 
            icon={<CalendarMonth sx={{ fontSize: 18 }} />} 
            iconPosition="start" 
            label={`Weekly Reports (${weeklyReports.length})`} 
          />
          <Tab 
            icon={<Summarize sx={{ fontSize: 18 }} />} 
            iconPosition="start" 
            label={`Monthly Reports (${monthlyReports.length})`} 
          />
        </Tabs>

        {/* ========================================================================= */}
        {/* TAB 0: ACTIVE COLLECTIONS BUILDER & INTERACTIVE TABLE                    */}
        {/* ========================================================================= */}
        {activeTab === 0 && (
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            {/* Collector-Submitted Reports Selection & Consolidation Card */}
            <Card elevation={0} sx={{ borderRadius: 2, border: '1px solid #bae6fd', bgcolor: '#f0f9ff', mb: 2.5 }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                {/* Header Row */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0369a1', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <ReceiptLong sx={{ fontSize: 20 }} />
                      Submitted Collector Reports for Consolidation
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Select individual collector reports or click "Select All" to compile into the master matrix below.
                    </Typography>
                  </Box>

                  {/* Filters Bar: Search, Date Filter, Collector Filter */}
                  <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" gap={1}>
                    {/* Search Bar */}
                    <TextField
                      placeholder="Search reports..."
                      size="small"
                      value={builderSearchTerm}
                      onChange={(e) => setBuilderSearchTerm(e.target.value)}
                      sx={{ width: 185, bgcolor: '#ffffff', '& input': { py: 0.5, fontSize: '0.78rem' } }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Search fontSize="small" color="action" />
                          </InputAdornment>
                        ),
                        endAdornment: builderSearchTerm ? (
                          <InputAdornment position="end">
                            <IconButton size="small" onClick={() => setBuilderSearchTerm('')} sx={{ p: 0.2 }}>
                              <Clear fontSize="small" />
                            </IconButton>
                          </InputAdornment>
                        ) : null
                      }}
                    />

                    {/* Collector Filter */}
                    <Autocomplete
                      options={uniqueBuilderCollectors}
                      value={builderCollectorFilter}
                      onChange={(_, v) => setBuilderCollectorFilter(v)}
                      sx={{ width: 175, bgcolor: '#ffffff' }}
                      renderInput={(params) => (
                        <TextField 
                          {...params} 
                          label="Filter Collector" 
                          size="small" 
                          placeholder="All Collectors"
                          sx={{ '& input': { py: 0.5, fontSize: '0.78rem' } }}
                        />
                      )}
                    />

                    {/* Date Range Filter */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <TextField
                        type="date"
                        size="small"
                        label="From"
                        value={builderDateFrom}
                        onChange={(e) => setBuilderDateFrom(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={{ width: 125, bgcolor: '#ffffff', '& input': { py: 0.4, fontSize: '0.75rem' } }}
                      />
                      <Typography variant="caption" color="text.secondary">to</Typography>
                      <TextField
                        type="date"
                        size="small"
                        label="To"
                        value={builderDateTo}
                        onChange={(e) => setBuilderDateTo(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={{ width: 125, bgcolor: '#ffffff', '& input': { py: 0.4, fontSize: '0.75rem' } }}
                      />
                    </Box>

                    {(builderDateFrom || builderDateTo || builderSearchTerm || builderCollectorFilter) && (
                      <Tooltip title="Clear Builder Filters" arrow>
                        <IconButton 
                          size="small" 
                          onClick={() => { 
                            setBuilderDateFrom(''); 
                            setBuilderDateTo(''); 
                            setBuilderSearchTerm(''); 
                            setBuilderCollectorFilter(null); 
                          }} 
                          sx={{ color: '#64748b', bgcolor: '#ffffff' }}
                        >
                          <Clear fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </Box>

                {/* Quick Select All Strip */}
                <Paper
                  elevation={0}
                  sx={{
                    mb: 1.5,
                    px: 2,
                    py: 1,
                    bgcolor: '#ffffff',
                    borderRadius: 1.5,
                    border: '1.5px dashed #0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between',
                    gap: 1.5,
                    flexWrap: 'wrap'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Checkbox
                      size="small"
                      checked={availableSubmittedReports.length > 0 && selectedSubmittedReportIds.length === availableSubmittedReports.length}
                      indeterminate={selectedSubmittedReportIds.length > 0 && selectedSubmittedReportIds.length < availableSubmittedReports.length}
                      onChange={handleSelectAllSubmittedReports}
                      disabled={availableSubmittedReports.length === 0}
                    />
                    <Typography variant="body2" fontWeight="800" sx={{ color: '#0f172a' }}>
                      Select All Available Reports ({availableSubmittedReports.length})
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', md: 'inline' } }}>
                      — Consolidates all submitted reports into the master matrix table below
                    </Typography>
                  </Box>

                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<SelectAll />}
                    onClick={handleSelectAllSubmittedReports}
                    disabled={availableSubmittedReports.length === 0}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      py: 0.5,
                      px: 2,
                      borderRadius: 1.5,
                      bgcolor: '#0284c7',
                      '&:hover': { bgcolor: '#0369a1' }
                    }}
                  >
                    {selectedSubmittedReportIds.length === availableSubmittedReports.length && availableSubmittedReports.length > 0
                      ? 'Deselect All'
                      : `Select All (${availableSubmittedReports.length})`}
                  </Button>
                </Paper>

                {/* Table of Available Submitted Reports */}
                <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, maxHeight: 280 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 700, color: '#334155', fontSize: '0.75rem' } }}>
                        <TableCell padding="checkbox" align="center">
                          <Checkbox
                            size="small"
                            checked={availableSubmittedReports.length > 0 && selectedSubmittedReportIds.length === availableSubmittedReports.length}
                            indeterminate={selectedSubmittedReportIds.length > 0 && selectedSubmittedReportIds.length < availableSubmittedReports.length}
                            onChange={handleSelectAllSubmittedReports}
                            disabled={availableSubmittedReports.length === 0}
                          />
                        </TableCell>
                        <TableCell>Report Number</TableCell>
                        <TableCell>Collector Name</TableCell>
                        <TableCell>Booklet No.</TableCell>
                        <TableCell>OR Range</TableCell>
                        <TableCell align="center">Receipts</TableCell>
                        <TableCell>Date Period</TableCell>
                        <TableCell align="right">Total Collection</TableCell>
                        <TableCell>Date Submitted</TableCell>
                        <TableCell align="center">Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {availableSubmittedReports.map((report) => {
                        const isChecked = selectedSubmittedReportIds.includes(report.id);
                        return (
                          <TableRow 
                            key={report.id} 
                            hover 
                            selected={isChecked}
                            onClick={() => handleToggleSelectSubmittedReport(report.id)}
                            sx={{ cursor: 'pointer', '&.Mui-selected': { bgcolor: '#f0f9ff' } }}
                          >
                            <TableCell padding="checkbox" align="center" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                size="small"
                                checked={isChecked}
                                onChange={() => handleToggleSelectSubmittedReport(report.id)}
                              />
                            </TableCell>
                            <TableCell sx={{ fontWeight: 800, color: '#0284c7', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                              {report.reportNumber}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.78rem' }}>
                              {getSubmittedCollectorNameForReport(report)}
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={report.afNo} 
                                size="small" 
                                sx={{ fontWeight: 700, bgcolor: '#e0f2fe', color: '#0369a1', fontSize: '0.7rem', height: 20 }} 
                              />
                            </TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#475569' }}>
                              {report.orRange}
                            </TableCell>
                            <TableCell align="center">
                              <Chip 
                                label={`${report.orCount} ORs`} 
                                size="small" 
                                sx={{ height: 18, fontSize: '0.68rem', bgcolor: '#f1f5f9', fontWeight: 600 }} 
                              />
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.75rem', color: '#475569' }}>
                              {report.dateFrom || report.dateTo ? `${report.dateFrom} to ${report.dateTo}` : '-'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.82rem' }}>
                              ₱ {report.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.72rem', color: '#64748b' }}>
                              {new Date(report.submittedAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                              <Tooltip title="Submit this report as Weekly Report" arrow>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                  startIcon={<Send sx={{ fontSize: '13px !important' }} />}
                                  onClick={() => handleQuickSubmitReportAsWeekly(report)}
                                  sx={{ 
                                    fontSize: '0.68rem', 
                                    fontWeight: 700, 
                                    py: 0.25, 
                                    px: 1, 
                                    textTransform: 'none', 
                                    borderRadius: 1,
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  Submit Weekly
                                </Button>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      })}

                      {availableSubmittedReports.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={10} align="center" sx={{ py: 4, color: '#94a3b8' }}>
                            No submitted collector reports found matching the criteria.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
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

                  <Tooltip title="Submit and compile all table entries into an official Weekly Report" arrow>
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
                      Submit as Weekly Report
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

              {/* Data Table (Waterworks Matrix View) */}
              <TableContainer sx={{ maxHeight: 520 }}>
                <Table size="small" stickyHeader>
                    <TableHead>
                      {/* Row 1 Header */}
                      <TableRow sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 800, color: '#334155', fontSize: '0.72rem', borderBottom: '1px solid #cbd5e1', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.15, py: 0.8, px: 0.5 } }}>
                        <TableCell rowSpan={2} align="center" sx={{ width: 32, borderRight: '1px solid #e2e8f0', textAlign: 'center', verticalAlign: 'middle' }}>#</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ minWidth: 85, borderRight: '1px solid #e2e8f0', textAlign: 'center', verticalAlign: 'middle', fontWeight: 800 }}>Date</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ minWidth: 120, borderRight: '1px solid #e2e8f0', textAlign: 'center', verticalAlign: 'middle' }}>Collector Name</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ minWidth: 75, borderRight: '1px solid #e2e8f0', textAlign: 'center', verticalAlign: 'middle' }}>Booklet No.</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ minWidth: 140, borderRight: '1px solid #e2e8f0', textAlign: 'center', verticalAlign: 'middle' }}>OR Numbers</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ minWidth: 95, borderRight: '1px solid #e2e8f0', textAlign: 'center', verticalAlign: 'middle', fontWeight: 800, bgcolor: '#f8fafc' }}>Report No.</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ minWidth: 70, bgcolor: '#f0f9ff !important', color: '#0369a1 !important', borderRight: '1px solid #bae6fd', textAlign: 'center', verticalAlign: 'middle', fontSize: '0.70rem' }}>Poblacion</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ minWidth: 70, bgcolor: '#f0f9ff !important', color: '#0369a1 !important', borderRight: '1px solid #bae6fd', textAlign: 'center', verticalAlign: 'middle', fontSize: '0.70rem' }}>San Pedro</TableCell>
                        <TableCell colSpan={2} align="center" sx={{ bgcolor: '#e0f2fe !important', color: '#0369a1 !important', borderRight: '1px solid #bae6fd', textAlign: 'center', verticalAlign: 'middle' }}>Calabasahan</TableCell>
                        <TableCell colSpan={2} align="center" sx={{ bgcolor: '#e0f2fe !important', color: '#0369a1 !important', borderRight: '1px solid #bae6fd', textAlign: 'center', verticalAlign: 'middle' }}>Sampong</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ minWidth: 70, bgcolor: '#f0f9ff !important', color: '#0369a1 !important', borderRight: '1px solid #bae6fd', textAlign: 'center', verticalAlign: 'middle', fontSize: '0.70rem' }}>Bakhawan</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ minWidth: 70, bgcolor: '#f0f9ff !important', color: '#0369a1 !important', borderRight: '1px solid #bae6fd', textAlign: 'center', verticalAlign: 'middle', fontSize: '0.70rem' }}>Masudsud</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ minWidth: 70, bgcolor: '#f0f9ff !important', color: '#0369a1 !important', borderRight: '1px solid #bae6fd', textAlign: 'center', verticalAlign: 'middle', fontSize: '0.70rem' }}>Dalajican</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ minWidth: 70, bgcolor: '#f0f9ff !important', color: '#0369a1 !important', borderRight: '1px solid #bae6fd', textAlign: 'center', verticalAlign: 'middle', fontSize: '0.70rem' }}>San Vicente</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ minWidth: 110, borderRight: '1px solid #e2e8f0', textAlign: 'center', verticalAlign: 'middle' }}>Sundry</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ minWidth: 90, borderRight: '1px solid #e2e8f0', textAlign: 'center', verticalAlign: 'middle' }}>Account Code</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ minWidth: 95, borderRight: '1px solid #e2e8f0', textAlign: 'center', verticalAlign: 'middle' }}>Amount (₱)</TableCell>
                        <TableCell rowSpan={2} align="center" sx={{ width: 45, textAlign: 'center', verticalAlign: 'middle' }}>Action</TableCell>
                      </TableRow>
                      {/* Row 2 Subheaders for Spring & Pump */}
                      <TableRow sx={{ '& th': { bgcolor: '#f0f9ff', fontWeight: 700, color: '#0284c7', fontSize: '0.70rem', borderBottom: '2px solid #cbd5e1', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'normal', wordBreak: 'break-word', py: 0.5, px: 0.3 } }}>
                        <TableCell align="center" sx={{ minWidth: 65, borderRight: '1px solid #bae6fd', textAlign: 'center', verticalAlign: 'middle' }}>Spring</TableCell>
                        <TableCell align="center" sx={{ minWidth: 65, borderRight: '1px solid #bae6fd', textAlign: 'center', verticalAlign: 'middle' }}>Pump</TableCell>
                        <TableCell align="center" sx={{ minWidth: 65, borderRight: '1px solid #bae6fd', textAlign: 'center', verticalAlign: 'middle' }}>Bukal</TableCell>
                        <TableCell align="center" sx={{ minWidth: 65, borderRight: '1px solid #bae6fd', textAlign: 'center', verticalAlign: 'middle' }}>Guiob</TableCell>
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
                            <TableCell sx={{ color: '#94a3b8', fontSize: '0.75rem', px: 0.5 }}>{mr.rowNumber}</TableCell>
                            <TableCell align="center" sx={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600, whiteSpace: 'nowrap', px: 0.5 }}>
                              {mr.submissionDate || '-'}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.75rem', px: 0.8 }}>{mr.collectorName}</TableCell>
                            <TableCell sx={{ px: 0.5 }}>
                              {mr.bookletNo ? (
                                <Chip 
                                  label={mr.bookletNo} 
                                  size="small" 
                                  sx={{ fontWeight: 800, bgcolor: '#e0f2fe', color: '#0369a1', fontSize: '0.70rem' }} 
                                />
                              ) : null}
                            </TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', color: '#0284c7', fontWeight: 600, fontSize: '0.74rem', px: 0.5 }}>
                              {cleanOrDisplay(mr.orNumbersDisplay)}
                            </TableCell>
                            <TableCell align="center" sx={{ borderRight: '1px solid #f1f5f9', px: 0.5 }}>
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
                                      fontSize: '0.72rem',
                                      cursor: 'pointer',
                                      '&:hover': { bgcolor: '#dcfce7' }
                                    }} 
                                  />
                                </Tooltip>
                              ) : null}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.70rem', color: mr.poblacion ? '#0f172a' : '#cbd5e1', px: 0.5, whiteSpace: 'nowrap' }}>
                              {mr.poblacion ? Number(mr.poblacion).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.70rem', color: mr.sanPedro ? '#0f172a' : '#cbd5e1', px: 0.5, whiteSpace: 'nowrap' }}>
                              {mr.sanPedro ? Number(mr.sanPedro).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.70rem', color: mr.calabasahanSpring ? '#0f172a' : '#cbd5e1', px: 0.5, whiteSpace: 'nowrap' }}>
                              {mr.calabasahanSpring ? Number(mr.calabasahanSpring).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.70rem', color: mr.calabasahanPump ? '#0f172a' : '#cbd5e1', px: 0.5, whiteSpace: 'nowrap' }}>
                              {mr.calabasahanPump ? Number(mr.calabasahanPump).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.70rem', color: mr.sampongSpring ? '#0f172a' : '#cbd5e1', px: 0.5, whiteSpace: 'nowrap' }}>
                              {mr.sampongSpring ? Number(mr.sampongSpring).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.70rem', color: mr.sampongPump ? '#0f172a' : '#cbd5e1', px: 0.5, whiteSpace: 'nowrap' }}>
                              {mr.sampongPump ? Number(mr.sampongPump).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.70rem', color: mr.bakhawan ? '#0f172a' : '#cbd5e1', px: 0.5, whiteSpace: 'nowrap' }}>
                              {mr.bakhawan ? Number(mr.bakhawan).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.70rem', color: mr.masudsud ? '#0f172a' : '#cbd5e1', px: 0.5, whiteSpace: 'nowrap' }}>
                              {mr.masudsud ? Number(mr.masudsud).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.70rem', color: mr.dalajican ? '#0f172a' : '#cbd5e1', px: 0.5, whiteSpace: 'nowrap' }}>
                              {mr.dalajican ? Number(mr.dalajican).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.70rem', color: mr.sanVicente ? '#0f172a' : '#cbd5e1', px: 0.5, whiteSpace: 'nowrap' }}>
                              {mr.sanVicente ? Number(mr.sanVicente).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, color: '#1e293b', fontSize: '0.72rem', px: 0.5 }}>
                              {mr.subCategory}
                            </TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.72rem', color: mr.accountCode ? '#0369a1' : 'transparent', px: 0.5 }}>
                              {mr.accountCode}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800, color: mr.amount > 0 ? '#0f172a' : '#cbd5e1', fontSize: '0.75rem', px: 0.5, whiteSpace: 'nowrap' }}>
                              {mr.amount > 0 ? `₱ ${Number(mr.amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
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
                        <TableRow sx={{ bgcolor: '#f8fafc', borderTop: '2px solid #0284c7', '& td': { fontWeight: 800, py: 0.8, px: 0.5 } }}>
                          <TableCell colSpan={6} align="center" sx={{ fontWeight: 800, color: '#0284c7', fontSize: '0.74rem', bgcolor: '#f1f5f9', letterSpacing: 0.5, borderRight: '1px solid #e2e8f0' }}>
                            TOTAL
                          </TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontSize: '0.70rem', borderRight: '1px solid #bae6fd', px: 0.5, whiteSpace: 'nowrap' }}>
                            {matrixData.totals.poblacion > 0 ? Number(matrixData.totals.poblacion).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontSize: '0.70rem', borderRight: '1px solid #bae6fd', px: 0.5, whiteSpace: 'nowrap' }}>
                            {matrixData.totals.sanPedro > 0 ? Number(matrixData.totals.sanPedro).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontSize: '0.70rem', borderRight: '1px solid #bae6fd', px: 0.5, whiteSpace: 'nowrap' }}>
                            {matrixData.totals.calSpring > 0 ? Number(matrixData.totals.calSpring).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontSize: '0.70rem', borderRight: '1px solid #bae6fd', px: 0.5, whiteSpace: 'nowrap' }}>
                            {matrixData.totals.calPump > 0 ? Number(matrixData.totals.calPump).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontSize: '0.70rem', borderRight: '1px solid #bae6fd', px: 0.5, whiteSpace: 'nowrap' }}>
                            {matrixData.totals.samSpring > 0 ? Number(matrixData.totals.samSpring).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontSize: '0.70rem', borderRight: '1px solid #bae6fd', px: 0.5, whiteSpace: 'nowrap' }}>
                            {matrixData.totals.samPump > 0 ? Number(matrixData.totals.samPump).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontSize: '0.70rem', borderRight: '1px solid #bae6fd', px: 0.5, whiteSpace: 'nowrap' }}>
                            {matrixData.totals.bakhawan > 0 ? Number(matrixData.totals.bakhawan).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontSize: '0.70rem', borderRight: '1px solid #bae6fd', px: 0.5, whiteSpace: 'nowrap' }}>
                            {matrixData.totals.masudsud > 0 ? Number(matrixData.totals.masudsud).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontSize: '0.70rem', borderRight: '1px solid #bae6fd', px: 0.5, whiteSpace: 'nowrap' }}>
                            {matrixData.totals.dalajican > 0 ? Number(matrixData.totals.dalajican).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontSize: '0.70rem', borderRight: '1px solid #bae6fd', px: 0.5, whiteSpace: 'nowrap' }}>
                            {matrixData.totals.sanVicente > 0 ? Number(matrixData.totals.sanVicente).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f1f5f9', borderRight: '1px solid #e2e8f0', fontSize: '0.70rem', color: '#334155', px: 0.5, whiteSpace: 'nowrap' }}>
                            {matrixData.totals.sundry > 0 ? Number(matrixData.totals.sundry).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                          </TableCell>
                          <TableCell sx={{ bgcolor: '#f1f5f9', borderRight: '1px solid #e2e8f0' }} />
                          <TableCell align="right" sx={{ bgcolor: '#0284c7', color: '#ffffff', fontSize: '0.78rem', borderRight: '1px solid #0284c7', px: 0.5, whiteSpace: 'nowrap' }}>
                            ₱ {Number(matrixData.totals.grandTotal).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell sx={{ bgcolor: '#f1f5f9' }} />
                        </TableRow>
                      </TableFooter>
                    )}
                  </Table>
                </TableContainer>

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
        {/* TAB 1: WEEKLY REPORTS                                                     */}
        {/* ========================================================================= */}
        {activeTab === 1 && (
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            {/* Toolbar: Filters & Actions */}
            <Box sx={{ mb: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0f172a' }}>
                  Weekly Reports ({filteredWeeklyReports.length} of {weeklyReports.length})
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Compiled reports from collector submissions. Select weekly reports to submit as a Monthly Report.
                </Typography>
              </Box>

              {/* Filters */}
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                {/* Search Bar */}
                <TextField
                  placeholder="Search weekly (Report #, Collector, Booklet...)"
                  size="small"
                  value={weeklySearchTerm}
                  onChange={(e) => setWeeklySearchTerm(e.target.value)}
                  sx={{ width: { xs: '100%', sm: 260 }, bgcolor: '#ffffff', borderRadius: 1 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: weeklySearchTerm ? (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setWeeklySearchTerm('')}>
                          <Clear fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ) : null
                  }}
                />

                {/* Filter by Collector */}
                <FormControl size="small" sx={{ minWidth: 160, bgcolor: '#ffffff' }}>
                  <InputLabel id="weekly-collector-filter-label" sx={{ fontSize: '0.82rem' }}>Collector</InputLabel>
                  <Select
                    labelId="weekly-collector-filter-label"
                    value={weeklyCollectorFilter || 'ALL'}
                    label="Collector"
                    onChange={(e) => setWeeklyCollectorFilter(e.target.value === 'ALL' ? null : e.target.value)}
                    sx={{ fontSize: '0.82rem' }}
                  >
                    <MenuItem value="ALL" sx={{ fontSize: '0.82rem' }}>All Collectors</MenuItem>
                    {uniqueWeeklyCollectors.map(c => (
                      <MenuItem key={c} value={c} sx={{ fontSize: '0.82rem' }}>{c}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Filter by Month */}
                <FormControl size="small" sx={{ minWidth: 150, bgcolor: '#ffffff' }}>
                  <InputLabel id="weekly-month-filter-label" sx={{ fontSize: '0.82rem' }}>Month</InputLabel>
                  <Select
                    labelId="weekly-month-filter-label"
                    value={weeklyMonthFilter || 'ALL'}
                    label="Month"
                    onChange={(e) => setWeeklyMonthFilter(e.target.value === 'ALL' ? null : e.target.value)}
                    sx={{ fontSize: '0.82rem' }}
                  >
                    <MenuItem value="ALL" sx={{ fontSize: '0.82rem' }}>All Months</MenuItem>
                    {availableWeeklyMonths.map(m => (
                      <MenuItem key={m.value} value={m.value} sx={{ fontSize: '0.82rem' }}>{m.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Status Filter Toggle */}
                <FormControl size="small" sx={{ minWidth: 150, bgcolor: '#ffffff' }}>
                  <InputLabel id="weekly-status-filter-label" sx={{ fontSize: '0.82rem' }}>Status</InputLabel>
                  <Select
                    labelId="weekly-status-filter-label"
                    value={weeklyShowFilter}
                    label="Status"
                    onChange={(e) => setWeeklyShowFilter(e.target.value as any)}
                    sx={{ fontSize: '0.82rem' }}
                  >
                    <MenuItem value="all" sx={{ fontSize: '0.82rem' }}>All Statuses</MenuItem>
                    <MenuItem value="unsubmitted" sx={{ fontSize: '0.82rem' }}>Unsubmitted Only</MenuItem>
                    <MenuItem value="submitted" sx={{ fontSize: '0.82rem' }}>Submitted to Monthly</MenuItem>
                  </Select>
                </FormControl>

                {(weeklyCollectorFilter || weeklyMonthFilter || weeklySearchTerm || weeklyShowFilter !== 'all') && (
                  <Tooltip title="Clear Filters" arrow>
                    <IconButton size="small" onClick={() => {
                      setWeeklyCollectorFilter(null);
                      setWeeklyMonthFilter(null);
                      setWeeklySearchTerm('');
                      setWeeklyShowFilter('all');
                    }}>
                      <FilterListOff fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            </Box>

            {/* Selected Weekly Reports Action Card */}
            {selectedWeeklyReportIds.length > 0 && (
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 2, 
                  mb: 2.5, 
                  bgcolor: '#f0f9ff', 
                  border: '1.5px solid #0284c7', 
                  borderRadius: 2,
                  display: 'flex',
                  justify: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 1.5
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Avatar sx={{ bgcolor: '#0284c7', width: 36, height: 36 }}>
                    <Summarize sx={{ fontSize: 20 }} />
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle2" fontWeight="800" sx={{ color: '#0369a1' }}>
                      {selectedWeeklyReportIds.length} Weekly Reports Selected
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Total Collection: <strong>₱ {(consolidatedMonthlyRecordFromWeekly?.totalAmount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </Typography>
                  </Box>
                </Box>

                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Button
                    variant="contained"
                    size="small"
                    color="primary"
                    startIcon={<Send />}
                    onClick={handleOpenSubmitMonthlyModal}
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5 }}
                  >
                    Submit Selected as Monthly Report
                  </Button>

                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Print />}
                    onClick={() => consolidatedMonthlyRecordFromWeekly && handlePrintMatrix(consolidatedMonthlyRecordFromWeekly)}
                    sx={{ borderColor: '#0284c7', color: '#0284c7', '&:hover': { bgcolor: '#e0f2fe' }, fontWeight: 700, textTransform: 'none', borderRadius: 1.5 }}
                  >
                    Print Matrix
                  </Button>

                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<FileDownload />}
                    onClick={() => consolidatedMonthlyRecordFromWeekly && handleExportReportExcel(consolidatedMonthlyRecordFromWeekly)}
                    sx={{ borderColor: '#16a34a', color: '#16a34a', '&:hover': { bgcolor: '#f0fdf4' }, fontWeight: 700, textTransform: 'none', borderRadius: 1.5 }}
                  >
                    Export Excel
                  </Button>

                  <Button
                    variant="text"
                    size="small"
                    onClick={() => setSelectedWeeklyReportIds([])}
                    sx={{ color: '#64748b', textTransform: 'none', fontWeight: 600 }}
                  >
                    Deselect All
                  </Button>
                </Stack>
              </Paper>
            )}

            {/* Weekly Reports Table */}
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 700, color: '#334155' } }}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={filteredWeeklyReports.length > 0 && selectedWeeklyReportIds.length === filteredWeeklyReports.length}
                        indeterminate={selectedWeeklyReportIds.length > 0 && selectedWeeklyReportIds.length < filteredWeeklyReports.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedWeeklyReportIds(filteredWeeklyReports.map(r => r.id));
                          } else {
                            setSelectedWeeklyReportIds([]);
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>Report Number</TableCell>
                    <TableCell align="center">Week</TableCell>
                    <TableCell>Booklet No.</TableCell>
                    <TableCell>Date Period</TableCell>
                    <TableCell align="right">Total Collection</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedWeeklyReports.map((rep) => {
                    const isSelected = selectedWeeklyReportIds.includes(rep.id);
                    const isSubmittedToMonthly = Boolean(rep.submittedToMonthly || rep.consolidatedInMonthlyReportId);
                    const weekTagStr = resolveWeekLabel(rep, weeklyReports);

                    return (
                      <TableRow 
                        key={rep.id} 
                        hover 
                        selected={isSelected}
                        onClick={() => setViewingWeeklyReport(rep)}
                        sx={{ 
                          cursor: 'pointer',
                          '&:last-child td, &:last-child th': { border: 0 },
                          bgcolor: isSubmittedToMonthly ? '#f8fafc' : (isSelected ? '#f0f9ff' : 'inherit'),
                          '&:hover': {
                            bgcolor: isSubmittedToMonthly ? '#f1f5f9' : '#e0f2fe !important'
                          }
                        }}
                      >
                        <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            size="small"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedWeeklyReportIds(prev => [...prev, rep.id]);
                              } else {
                                setSelectedWeeklyReportIds(prev => prev.filter(id => id !== rep.id));
                              }
                            }}
                          />
                        </TableCell>

                        <TableCell>
                          <Typography variant="body2" fontWeight="700" sx={{ fontFamily: 'monospace', color: '#0f172a' }}>
                            {rep.reportNumber}
                          </Typography>
                          <Chip 
                            label={weekTagStr} 
                            size="small" 
                            sx={{ fontSize: '0.72rem', fontWeight: 800, height: 22, mt: 0.5, bgcolor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }} 
                          />
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                            Submitted: {rep.submittedAt ? new Date(rep.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                          </Typography>
                        </TableCell>

                        <TableCell align="center">
                          <Chip 
                            label={weekTagStr} 
                            size="small" 
                            sx={{ 
                              fontWeight: 800, 
                              fontSize: '0.75rem', 
                              bgcolor: '#0284c7', 
                              color: '#ffffff',
                              px: 0.5
                            }} 
                          />
                        </TableCell>

                        <TableCell>
                          <Chip 
                            label={(() => {
                              if (!rep.afNo) return '1 Booklet';
                              const match = rep.afNo.match(/^(\d+)\s+Booklets?/i);
                              if (match) {
                                const count = parseInt(match[1], 10);
                                return `${count} ${count === 1 ? 'Booklet' : 'Booklets'}`;
                              }
                              const parts = rep.afNo.split(',').map(s => s.trim()).filter(Boolean);
                              const count = parts.length || 1;
                              return `${count} ${count === 1 ? 'Booklet' : 'Booklets'}`;
                            })()} 
                            size="small" 
                            variant="outlined" 
                            sx={{ fontSize: '0.75rem', fontWeight: 600 }} 
                          />
                        </TableCell>

                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {rep.dateFrom && rep.dateTo ? `${rep.dateFrom} to ${rep.dateTo}` : rep.submittedAt ? rep.submittedAt.slice(0, 10) : '—'}
                          </Typography>
                        </TableCell>

                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="800" sx={{ color: '#16a34a' }}>
                            ₱ {rep.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Typography>
                        </TableCell>

                        <TableCell align="center">
                          {isSubmittedToMonthly ? (
                            <Chip 
                              icon={<CheckCircle sx={{ fontSize: '14px !important' }} />}
                              label="Submitted" 
                              size="small" 
                              color="success" 
                              sx={{ fontWeight: 700, fontSize: '0.7rem' }} 
                            />
                          ) : (
                            <Chip 
                              label="Unsubmitted" 
                              size="small" 
                              color="warning" 
                              variant="outlined" 
                              sx={{ fontWeight: 700, fontSize: '0.7rem' }} 
                            />
                          )}
                        </TableCell>

                        <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            <Tooltip title="Print Matrix" arrow>
                              <IconButton size="small" color="primary" onClick={() => handlePrintMatrix(rep)}>
                                <Print fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Export Excel" arrow>
                              <IconButton size="small" color="success" onClick={() => handleExportReportExcel(rep)}>
                                <FileDownload fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={isSubmittedToMonthly ? "Already included in Monthly Report" : "Reopen Weekly Report"} arrow>
                              <span>
                                <IconButton 
                                  size="small" 
                                  color="warning" 
                                  disabled={isSubmittedToMonthly}
                                  onClick={() => {
                                    setReportToUnmark(rep);
                                    setUnmarkConfirmOpen(true);
                                  }}
                                >
                                  <LockReset fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {filteredWeeklyReports.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 5, color: '#94a3b8' }}>
                        {weeklyReports.length === 0 
                          ? 'No weekly reports compiled yet. Consolidate collector reports in Tab 1 first.' 
                          : 'No weekly reports match the current filter criteria.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Table Pagination */}
              <TablePagination
                rowsPerPageOptions={[10, 25, 50, 100]}
                component="div"
                count={filteredWeeklyReports.length}
                rowsPerPage={weeklyRowsPerPage}
                page={weeklyPage}
                onPageChange={(_, newPage) => setWeeklyPage(newPage)}
                onRowsPerPageChange={(e) => {
                  setWeeklyRowsPerPage(parseInt(e.target.value, 10));
                  setWeeklyPage(0);
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

        {/* ========================================================================= */}
        {/* TAB 3: MONTHLY REPORTS TAB CONTENT                                       */}
        {/* ========================================================================= */}
        {activeTab === 2 && (
          <Box sx={{ p: 2.5 }}>
            {/* Filter Bar */}
            <Paper elevation={0} sx={{ p: 2, mb: 2.5, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
              <Grid container spacing={2} alignItems="center">
                <Grid size={{ xs: 12, sm: 4, md: 3 }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search monthly report #, collector, OR..."
                    value={monthlySearchTerm}
                    onChange={(e) => setMonthlySearchTerm(e.target.value)}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <Search fontSize="small" sx={{ color: '#94a3b8' }} />
                          </InputAdornment>
                        ),
                        endAdornment: monthlySearchTerm ? (
                          <InputAdornment position="end">
                            <IconButton size="small" onClick={() => setMonthlySearchTerm('')}>
                              <Clear fontSize="small" />
                            </IconButton>
                          </InputAdornment>
                        ) : null
                      }
                    }}
                    sx={{ bgcolor: '#ffffff', '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 4, md: 3 }}>
                  <FormControl fullWidth size="small" sx={{ bgcolor: '#ffffff' }}>
                    <InputLabel id="monthly-collector-select-label">Filter Collector</InputLabel>
                    <Select
                      labelId="monthly-collector-select-label"
                      value={monthlyCollectorFilter || ''}
                      label="Filter Collector"
                      onChange={(e) => setMonthlyCollectorFilter(e.target.value || null)}
                      sx={{ borderRadius: 1.5 }}
                    >
                      <MenuItem value=""><em>All Collectors</em></MenuItem>
                      {uniqueMonthlyCollectors.map(name => (
                        <MenuItem key={name} value={name}>{name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid size={{ xs: 12, sm: 4, md: 3 }}>
                  <FormControl fullWidth size="small" sx={{ bgcolor: '#ffffff' }}>
                    <InputLabel id="monthly-month-select-label">Filter Month</InputLabel>
                    <Select
                      labelId="monthly-month-select-label"
                      value={monthlyMonthFilter || ''}
                      label="Filter Month"
                      onChange={(e) => setMonthlyMonthFilter(e.target.value || null)}
                      sx={{ borderRadius: 1.5 }}
                    >
                      <MenuItem value=""><em>All Months</em></MenuItem>
                      {availableMonthlyMonths.map(m => (
                        <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid size={{ xs: 12, sm: 12, md: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    {(monthlySearchTerm || monthlyCollectorFilter || monthlyMonthFilter) && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        startIcon={<FilterListOff />}
                        onClick={() => {
                          setMonthlySearchTerm('');
                          setMonthlyCollectorFilter(null);
                          setMonthlyMonthFilter(null);
                        }}
                        sx={{ textTransform: 'none', borderRadius: 1.5 }}
                      >
                        Reset
                      </Button>
                    )}
                  </Box>
                </Grid>
              </Grid>
            </Paper>

            {/* Table of Monthly Reports */}
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 700, color: '#334155', fontSize: '0.75rem' } }}>
                    <TableCell>Report Number</TableCell>
                    <TableCell>Date Period</TableCell>
                    <TableCell align="right">Total Collection</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedMonthlyReports.map((rep) => (
                    <TableRow 
                      key={rep.id} 
                      hover 
                      onClick={() => setViewingWeeklyReport(rep)}
                      sx={{ cursor: 'pointer', '&:last-child td, &:last-child th': { border: 0 } }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.3 }}>
                          <Typography variant="body2" fontWeight="700" sx={{ fontFamily: 'monospace', color: '#0f172a' }}>
                            {rep.reportNumber}
                          </Typography>
                          <Chip 
                            label={getReportMonthLabel(rep) || 'Monthly'} 
                            size="small" 
                            sx={{ height: 20, fontSize: '0.68rem', fontWeight: 800, bgcolor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }} 
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Submitted: {rep.submittedAt ? new Date(rep.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {rep.dateFrom && rep.dateTo ? `${rep.dateFrom} to ${rep.dateTo}` : rep.submittedAt ? rep.submittedAt.slice(0, 10) : '—'}
                        </Typography>
                      </TableCell>

                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="800" sx={{ color: '#0284c7' }}>
                          ₱ {rep.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Typography>
                      </TableCell>

                      <TableCell align="center">
                        <Chip 
                          icon={<CheckCircle sx={{ fontSize: '14px !important' }} />}
                          label="Monthly Consolidated" 
                          size="small" 
                          color="primary" 
                          sx={{ fontWeight: 700, fontSize: '0.7rem' }} 
                        />
                      </TableCell>

                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} justifyContent="center" onClick={(e) => e.stopPropagation()}>
                          <Tooltip title="Print Matrix" arrow>
                            <IconButton size="small" color="primary" onClick={() => handlePrintMatrix(rep)}>
                              <Print fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Export Excel" arrow>
                            <IconButton size="small" color="success" onClick={() => handleExportReportExcel(rep)}>
                              <FileDownload fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Reopen Monthly Report (Cascade revert weekly reports)" arrow>
                            <IconButton 
                              size="small" 
                              color="warning" 
                              onClick={() => {
                                setReportToUnmark(rep);
                                setUnmarkConfirmOpen(true);
                              }}
                            >
                              <LockReset fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}

                  {filteredMonthlyReports.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 5, color: '#94a3b8' }}>
                        {monthlyReports.length === 0 
                          ? 'No monthly reports created yet. Select weekly reports in Tab 2 to submit as a monthly report.' 
                          : 'No monthly reports match the current filter criteria.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Table Pagination */}
              <TablePagination
                rowsPerPageOptions={[10, 25, 50, 100]}
                component="div"
                count={filteredMonthlyReports.length}
                rowsPerPage={monthlyRowsPerPage}
                page={monthlyPage}
                onPageChange={(_, newPage) => setMonthlyPage(newPage)}
                onRowsPerPageChange={(e) => {
                  setMonthlyRowsPerPage(parseInt(e.target.value, 10));
                  setMonthlyPage(0);
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
      {/* SUBMIT WEEKLY REPORTS AS MONTHLY CONFIRMATION DIALOG                     */}
      {/* ========================================================================= */}
      <Dialog
        open={submitMonthlyConfirmOpen}
        onClose={() => !isSubmittingMonthly && setSubmitMonthlyConfirmOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, p: 1 } }}
      >
        <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800, color: '#0f172a' }}>
          <CalendarMonth color="primary" />
          Submit Selected Weekly Reports as Monthly Report?
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5 }}>
          <Stack spacing={2}>
            <Alert severity="info" sx={{ borderRadius: 1.5 }}>
              Compiling <strong>{selectedWeeklyReportIds.length} weekly reports</strong> into a single Admin Monthly Report.
            </Alert>

            {consolidatedMonthlyRecordFromWeekly && (
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#f0f9ff', borderRadius: 1.5, border: '1px solid #bae6fd' }}>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary">Total Weekly Reports</Typography>
                    <Typography variant="body2" fontWeight="700">{selectedWeeklyReportIds.length} reports</Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary">Total Line Items</Typography>
                    <Typography variant="body2" fontWeight="700">{(consolidatedMonthlyRecordFromWeekly.stagedRows?.length || consolidatedMonthlyRecordFromWeekly.itemIds?.length || 0)} charges</Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary">Date Period</Typography>
                    <Typography variant="body2" fontWeight="700">
                      {consolidatedMonthlyRecordFromWeekly.dateFrom} to {consolidatedMonthlyRecordFromWeekly.dateTo}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary">Total Monthly Amount</Typography>
                    <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0284c7' }}>
                      ₱ {consolidatedMonthlyRecordFromWeekly.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            )}

            {/* Selected Weekly Reports Flow Breakdown */}
            {selectedWeeklyReportIds.length > 0 && (
              <Box>
                <Typography variant="caption" fontWeight="700" sx={{ color: '#475569', textTransform: 'uppercase', mb: 0.8, display: 'block' }}>
                  Selected Weekly Reports Flow & Balances:
                </Typography>
                <Stack spacing={0.8} sx={{ maxHeight: 180, overflowY: 'auto', pr: 0.5 }}>
                  {sortWeeklyReportsForConsolidation(weeklyReports.filter(r => selectedWeeklyReportIds.includes(r.id)))
                    .map((wRep) => (
                      <Paper key={wRep.id} elevation={0} variant="outlined" sx={{ p: 1, px: 1.5, borderRadius: 1.5, bgcolor: '#ffffff' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip 
                              label={resolveWeekLabel(wRep, weeklyReports)} 
                              size="small" 
                              sx={{ fontSize: '0.72rem', fontWeight: 800, height: 22, bgcolor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }} 
                            />
                            <Typography variant="body2" fontWeight="800" sx={{ color: '#0f172a', fontFamily: 'monospace' }}>
                              {wRep.reportNumber}
                            </Typography>
                          </Box>
                          <Typography variant="subtitle2" fontWeight="800" sx={{ color: '#0284c7' }}>
                            ₱ {wRep.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.4 }}>
                          <Typography variant="caption" color="text.secondary">
                            Period: {wRep.dateFrom && wRep.dateTo ? `${wRep.dateFrom} to ${wRep.dateTo}` : wRep.submittedAt?.slice(0, 10)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Beg: ₱{(wRep.beginningBalance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} → End: ₱{(wRep.endingBalance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Typography>
                        </Box>
                      </Paper>
                    ))}
                </Stack>
              </Box>
            )}

            {/* Tagged Month Selection Section */}
            <Paper elevation={0} variant="outlined" sx={{ p: 2, borderRadius: 1.5, bgcolor: '#ffffff', borderColor: '#cbd5e1' }}>
              <Typography variant="subtitle2" fontWeight="700" sx={{ mb: 1.5, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarMonth fontSize="small" color="primary" />
                Select Tagged Month for Monthly Report
              </Typography>
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="select-tagged-month-label">Quick Select Month</InputLabel>
                    <Select
                      labelId="select-tagged-month-label"
                      value={quickMonthSelectValue}
                      label="Quick Select Month"
                      onChange={(e) => {
                        const val = e.target.value;
                        setQuickMonthSelectValue(val);
                        if (val && val !== 'custom') {
                          setMonthlyTaggedMonthInput(val);
                        }
                      }}
                      sx={{ borderRadius: 1.5 }}
                    >
                      {generatedMonthOptions.map(opt => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                      <MenuItem value="custom"><em>Custom Tag...</em></MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Tagged Month Label"
                    value={monthlyTaggedMonthInput}
                    onChange={(e) => {
                      setMonthlyTaggedMonthInput(e.target.value);
                      setQuickMonthSelectValue('custom');
                    }}
                    placeholder="e.g. September 2026"
                    helperText="This month label will be tagged on the monthly report and printouts"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                  />
                </Grid>
              </Grid>
            </Paper>

            {/* Beginning Balance */}
            <Box>
              <Typography variant="subtitle2" fontWeight="700" sx={{ mb: 1, color: '#0f172a' }}>
                Beginning Balance (1st Week's Beginning Balance)
              </Typography>
              <TextField
                fullWidth
                size="small"
                label="Beginning Balance (₱)"
                type="number"
                value={monthlyBeginningBalanceInput}
                onChange={(e) => setMonthlyBeginningBalanceInput(Number(e.target.value) || 0)}
                inputProps={{ min: 0, step: '0.01' }}
                helperText={`Auto-filled from 1st week's beginning balance: ₱ ${(consolidatedMonthlyRecordFromWeekly?.beginningBalance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
              />
            </Box>

            {/* Dynamic Monthly Ending Balance Calculation */}
            {(() => {
              const modalWeeklyReflectingDeposits = sortDepositsOldestToLatest(consolidatedMonthlyRecordFromWeekly?.selectedDeposits || []);
              const modalWeeklyReflectingTotal = modalWeeklyReflectingDeposits.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

              const modalAdditionalDeposits = sortDepositsOldestToLatest(bankDeposits.filter(d => 
                monthlySelectedDepositIds.includes(d.id) && !modalWeeklyReflectingDeposits.some(wd => wd.id === d.id)
              ));
              const modalAdditionalDepositsTotal = modalAdditionalDeposits.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

              const modalTotalDeposits = modalWeeklyReflectingTotal + modalAdditionalDepositsTotal;
              const modalComputedEndingBal = round2(
                round2(Number(monthlyBeginningBalanceInput)) + 
                round2(consolidatedMonthlyRecordFromWeekly?.totalAmount || 0) - 
                round2(modalTotalDeposits)
              );

              return (
                <>
                  <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#f0fdf4', borderRadius: 1.5, border: '1px solid #bbf7d0' }}>
                    <Typography variant="caption" sx={{ color: '#166534', fontWeight: 700, display: 'block', mb: 0.5 }}>
                      Consolidated Monthly Ending Balance:
                    </Typography>
                    <Typography variant="h6" fontWeight="800" sx={{ color: '#15803d' }}>
                      ₱ {modalComputedEndingBal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                      Beg. Bal (₱{(Number(monthlyBeginningBalanceInput) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) + Collections (₱{(consolidatedMonthlyRecordFromWeekly?.totalAmount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) - Total Deposits (₱{modalTotalDeposits.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                    </Typography>
                  </Paper>

                  {/* Bank Deposits Section */}
                  <Box>
                    <Typography variant="subtitle2" fontWeight="700" sx={{ color: '#0f172a', mb: 1 }}>
                      Bank Deposits Included in Monthly Report ({modalWeeklyReflectingDeposits.length + modalAdditionalDeposits.length} Records)
                    </Typography>

                    {/* Weekly Deposits Section */}
                    {modalWeeklyReflectingDeposits.length > 0 && (
                      <Box sx={{ mb: 1.5 }}>
                        <Typography variant="caption" fontWeight="700" sx={{ color: '#0369a1', mb: 0.5, display: 'block' }}>
                          Deposits Reflecting from Selected Weeks (Auto-included: {modalWeeklyReflectingDeposits.length} records · ₱{modalWeeklyReflectingTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}):
                        </Typography>
                        <Paper elevation={0} variant="outlined" sx={{ maxHeight: 150, overflow: 'auto', borderRadius: 1.5, bgcolor: '#f0f9ff', borderColor: '#bae6fd' }}>
                          {modalWeeklyReflectingDeposits.map((dep) => (
                            <Box
                              key={dep.id}
                              sx={{
                                display: 'flex', alignItems: 'center', px: 1.5, py: 0.8,
                                borderBottom: '1px solid #e0f2fe'
                              }}
                            >
                              <Chip label="Reflected from Week" size="small" sx={{ fontSize: '0.65rem', height: 18, mr: 1, bgcolor: '#bae6fd', color: '#0369a1', fontWeight: 700 }} />
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>
                                  {dep.depositControlNumber}
                                </Typography>
                                <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>
                                  {dep.depositDate} · {dep.depositorName}
                                </Typography>
                              </Box>
                              <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: '#0284c7', ml: 1 }}>
                                ₱ {dep.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </Typography>
                            </Box>
                          ))}
                        </Paper>
                      </Box>
                    )}

                    {/* Additional Unreported Deposits Section */}
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.8 }}>
                        <Typography variant="caption" fontWeight="700" sx={{ color: '#475569' }}>
                          Additional Unreported Bank Deposits:
                        </Typography>
                        {unreportedDeposits.length > 0 && (
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button size="small" sx={{ fontSize: '0.68rem', textTransform: 'none', py: 0 }}
                              onClick={() => setMonthlySelectedDepositIds(prev => Array.from(new Set([...prev, ...unreportedDeposits.map(d => d.id)])))}>
                              Select All
                            </Button>
                            <Button size="small" sx={{ fontSize: '0.68rem', textTransform: 'none', py: 0 }}
                              onClick={() => setMonthlySelectedDepositIds(prev => prev.filter(id => !unreportedDeposits.some(ud => ud.id === id)))}>
                              Clear Additional
                            </Button>
                          </Box>
                        )}
                      </Box>

                      {unreportedDeposits.length === 0 ? (
                        <Alert severity="info" sx={{ borderRadius: 1.5, fontSize: '0.78rem', py: 0.5 }}>
                          No additional unreported bank deposits. All weekly deposits are included above.
                        </Alert>
                      ) : (
                        <Paper elevation={0} variant="outlined" sx={{ maxHeight: 160, overflow: 'auto', borderRadius: 1.5 }}>
                          {unreportedDeposits.map((dep) => {
                            const isSelected = monthlySelectedDepositIds.includes(dep.id);
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
                                onClick={() => setMonthlySelectedDepositIds(prev =>
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
                  </Box>
                </>
              );
            })()}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button 
            onClick={() => setSubmitMonthlyConfirmOpen(false)} 
            disabled={isSubmittingMonthly}
            sx={{ textTransform: 'none', color: '#64748b' }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color="primary"
            onClick={handleConfirmSubmitMonthlyReport} 
            disabled={isSubmittingMonthly}
            startIcon={isSubmittingMonthly ? <CircularProgress size={16} color="inherit" /> : <Send />}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {isSubmittingMonthly ? 'Submitting...' : 'Confirm & Submit Monthly Report'}
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
          Submit Consolidated Report as Weekly Report
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5 }}>
          <Stack spacing={2}>
            <Alert severity="info" sx={{ borderRadius: 1.5 }}>
              Once submitted as weekly report, all <strong>{stagedTableRows.length} line items</strong> will be compiled into an official Weekly Report and archived from the unsubmitted pool.
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

            {/* Report Date Assignment */}
            <Paper elevation={0} sx={{ p: 2, bgcolor: '#f0f9ff', borderRadius: 1.5, border: '1px solid #bae6fd' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="subtitle2" fontWeight="800" sx={{ color: '#0369a1', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <CalendarToday sx={{ fontSize: 18 }} />
                  Report Date Assignment
                </Typography>
                <Button 
                  size="small" 
                  variant="outlined"
                  onClick={() => {
                    const today = getTodayDateString();
                    setReportDateInput(today);
                    setReportDatesMap(prev => {
                      const updated: Record<string, string> = {};
                      Object.keys(prev).forEach(k => { updated[k] = today; });
                      return updated;
                    });
                  }}
                  sx={{ fontSize: '0.70rem', textTransform: 'none', py: 0.2, px: 1, bgcolor: '#ffffff', borderColor: '#bae6fd' }}
                >
                  Set to Today ({getTodayDateString()})
                </Button>
              </Box>

              <TextField
                fullWidth
                size="small"
                type="date"
                label="Weekly Report Date"
                value={reportDateInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setReportDateInput(val);
                  setReportDatesMap(prev => {
                    const updated: Record<string, string> = {};
                    Object.keys(prev).forEach(k => {
                      updated[k] = val;
                    });
                    return updated;
                  });
                }}
                InputLabelProps={{ shrink: true }}
                helperText="Assign the official report date for this Weekly Report (defaults to current date, editable)."
                sx={{ bgcolor: '#ffffff', '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
              />

              {/* Individual Report Dates */}
              {includedReportBatches.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.8 }}>
                    <Typography variant="caption" fontWeight="800" sx={{ color: '#0369a1', textTransform: 'uppercase' }}>
                      Report Date per Included Report ({includedReportBatches.length}):
                    </Typography>
                    <Button 
                      size="small" 
                      sx={{ fontSize: '0.68rem', textTransform: 'none', p: 0, color: '#0284c7' }}
                      onClick={() => {
                        setReportDatesMap(prev => {
                          const updated: Record<string, string> = {};
                          Object.keys(prev).forEach(k => { updated[k] = reportDateInput; });
                          return updated;
                        });
                      }}
                    >
                      Sync all to master date
                    </Button>
                  </Box>
                  <Stack spacing={0.8} sx={{ maxHeight: 160, overflowY: 'auto', pr: 0.5 }}>
                    {includedReportBatches.map((item) => (
                      <Box 
                        key={item.key} 
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between', 
                          p: 0.8, 
                          px: 1.2,
                          bgcolor: '#ffffff', 
                          borderRadius: 1, 
                          border: '1px solid #e2e8f0',
                          gap: 1
                        }}
                      >
                        <Box sx={{ flex: 1, minWidth: 120 }}>
                          <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>
                            {item.collectorName}
                          </Typography>
                          <Typography sx={{ fontSize: '0.68rem', color: '#64748b' }}>
                            Booklet: {item.bookletNo} · Rep: {item.reportNo} · ₱ {item.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </Typography>
                        </Box>
                        <TextField
                          type="date"
                          size="small"
                          label="Report Date"
                          value={reportDatesMap[item.key] || reportDatesMap[item.reportId] || reportDateInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            setReportDatesMap(prev => ({
                              ...prev,
                              [item.key]: val,
                              ...(item.reportId ? { [item.reportId]: val } : {})
                            }));
                          }}
                          InputLabelProps={{ shrink: true }}
                          sx={{ width: 145, bgcolor: '#ffffff', '& input': { py: 0.35, fontSize: '0.74rem' } }}
                        />
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}
            </Paper>

            {/* Week Designation (e.g. Week 1 of September 2026) */}
            <Box>
              <Typography variant="subtitle2" fontWeight="700" sx={{ mb: 1, color: '#0f172a' }}>
                Week Designation / Tag
              </Typography>
              <Autocomplete
                freeSolo
                options={suggestedWeekLabels}
                value={weekLabelInput}
                onInputChange={(_e, newValue) => setWeekLabelInput(newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    label="Week Designation"
                    placeholder="e.g. Week 1 of September 2026"
                    helperText="Designate the week sequence (e.g. Week 1 of September) for smooth monthly consolidation."
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                  />
                )}
              />
            </Box>

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
            {isSubmitting ? 'Processing...' : 'Confirm & Submit Weekly Report'}
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
            size: 13in 8.3in;
            margin: 4mm 5mm 4mm 5mm;
          }
          @media print {
            /* Hide the underlying web application completely */
            #root {
              display: none !important;
            }
            /* Hide modal backdrop, dialog title bar, buttons, tooltips, poppers and divider */
            .no-print,
            .MuiBackdrop-root,
            .MuiDialogTitle-root,
            .MuiDivider-root,
            .MuiTooltip-popper,
            .MuiTooltip-tooltip,
            .MuiPopper-root,
            .MuiPopover-root {
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
            /* Multi-page printable sheets */
            .print-page-sheet {
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              box-sizing: border-box !important;
            }
            .print-page-sheet:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
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
              padding: 2.6px 2px !important;
              line-height: 1.15 !important;
              color: #000000 !important;
            }
            .print-matrix-table th {
              background-color: #f1f5f9 !important;
              font-weight: 800 !important;
              font-size: 6.8pt !important;
              text-align: center !important;
              vertical-align: middle !important;
              text-transform: uppercase !important;
              white-space: normal !important;
              word-wrap: break-word !important;
              word-break: break-word !important;
              overflow-wrap: break-word !important;
              hyphens: auto !important;
              padding: 2.5px 1.5px !important;
            }
            .print-matrix-table td {
              font-size: 6.5pt !important;
              white-space: nowrap !important;
              overflow: hidden !important;
            }
            /* NEVER truncate numeric cells or table footer with ellipsis */
            .print-matrix-table td[align="right"],
            .print-matrix-table tfoot td {
              text-overflow: clip !important;
              overflow: visible !important;
              white-space: nowrap !important;
              font-variant-numeric: tabular-nums !important;
            }
            .print-matrix-table td[align="right"] {
              font-size: 6.5pt !important;
              font-weight: 700 !important;
              padding-left: 1px !important;
              padding-right: 1.5px !important;
            }
            .print-matrix-table tfoot td {
              font-weight: 800 !important;
              font-size: 5.8pt !important;
              letter-spacing: -0.2px !important;
              background-color: #f8fafc !important;
              border-top: 1pt solid #000000 !important;
              border-bottom: 0.5pt solid #000000 !important;
              padding: 2.2px 1px !important;
            }
            .print-matrix-table tfoot tr.total-subtotals-row td {
              font-weight: 900 !important;
              font-size: 6.0pt !important;
              letter-spacing: -0.25px !important;
              background-color: #e2e8f0 !important;
              border-top: 1pt solid #000000 !important;
              border-bottom: 2pt double #000000 !important;
              padding: 2.8px 1px !important;
            }
            .print-matrix-table tfoot td.footer-grand-total {
              font-size: 6.5pt !important;
              letter-spacing: -0.2px !important;
              padding-right: 1.5px !important;
            }
            .print-matrix-table tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .print-signatures-block {
              display: flex !important;
              justify-content: space-between !important;
              margin-top: 12px !important;
              padding-top: 4px !important;
              padding-left: 20px !important;
              padding-right: 20px !important;
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
            <ToggleButtonGroup
              value={printViewMode}
              exclusive
              size="small"
              onChange={(_, v) => v && setPrintViewMode(v)}
              sx={{ bgcolor: '#ffffff', height: 34, borderRadius: 1 }}
            >
              <Tooltip title="Matrix View (Landscape)" arrow>
                <ToggleButton value="matrix" sx={{ px: 1.2, py: 0.5, border: '1px solid #e2e8f0' }}>
                  <TableChart sx={{ fontSize: 18, color: '#0284c7' }} />
                </ToggleButton>
              </Tooltip>
              <Tooltip title="Recapitulation (RCD)" arrow>
                <ToggleButton value="recap" sx={{ px: 1.2, py: 0.5, border: '1px solid #e2e8f0' }}>
                  <Summarize sx={{ fontSize: 18, color: '#16a34a' }} />
                </ToggleButton>
              </Tooltip>
              <Tooltip title="Balances & Deposits" arrow>
                <ToggleButton value="balances" sx={{ px: 1.2, py: 0.5, border: '1px solid #e2e8f0' }}>
                  <AccountBalance sx={{ fontSize: 18, color: '#7c3aed' }} />
                </ToggleButton>
              </Tooltip>
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

            {printViewMode === 'matrix' && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 0.5 }}>
                <Typography sx={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                  Rows/Page:
                </Typography>
                <ToggleButtonGroup
                  value={matrixRowsPerPage}
                  exclusive
                  size="small"
                  onChange={(_, v) => v && setMatrixRowsPerPage(v)}
                  sx={{ bgcolor: '#f8fafc', height: 28 }}
                >
                  <ToggleButton value={20} sx={{ textTransform: 'none', fontSize: '0.68rem', px: 0.8, py: 0.1, fontWeight: 700 }}>
                    20
                  </ToggleButton>
                  <ToggleButton value={25} sx={{ textTransform: 'none', fontSize: '0.68rem', px: 0.8, py: 0.1, fontWeight: 700 }}>
                    25
                  </ToggleButton>
                  <ToggleButton value={28} sx={{ textTransform: 'none', fontSize: '0.68rem', px: 0.8, py: 0.1, fontWeight: 700 }}>
                    28
                  </ToggleButton>
                  <ToggleButton value={30} sx={{ textTransform: 'none', fontSize: '0.68rem', px: 0.8, py: 0.1, fontWeight: 700 }}>
                    30
                  </ToggleButton>
                  <ToggleButton value={32} sx={{ textTransform: 'none', fontSize: '0.68rem', px: 0.8, py: 0.1, fontWeight: 700 }}>
                    32
                  </ToggleButton>
                  <ToggleButton value={35} sx={{ textTransform: 'none', fontSize: '0.68rem', px: 0.8, py: 0.1, fontWeight: 700 }}>
                    35
                  </ToggleButton>
                </ToggleButtonGroup>
                <Chip
                  label={`${paginatedMatrixPages.length} ${paginatedMatrixPages.length === 1 ? 'Page' : 'Pages'}`}
                  size="small"
                  sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 700, fontSize: '0.7rem' }}
                />
              </Stack>
            )}
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title={printViewMode === 'balances' ? 'Print Balances & Deposits' : printViewMode === 'recap' ? 'Print Recapitulation' : 'Print Report'} arrow>
              <IconButton
                onClick={(e) => {
                  (e.currentTarget as HTMLElement).blur();
                  window.print();
                }}
                sx={{ 
                  bgcolor: printViewMode === 'balances' ? '#7c3aed' : printViewMode === 'recap' ? '#16a34a' : '#0284c7', 
                  color: '#ffffff', 
                  borderRadius: 1,
                  width: 34,
                  height: 34,
                  '&:hover': { bgcolor: printViewMode === 'balances' ? '#6d28d9' : printViewMode === 'recap' ? '#15803d' : '#0369a1', color: '#ffffff' }
                }}
              >
                <Print sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Close Preview" arrow>
              <IconButton 
                onClick={() => {
                  setPrintDialogOpen(false);
                  setPrintingReport(null);
                }} 
                sx={{ 
                  bgcolor: '#f1f5f9',
                  borderRadius: 1,
                  width: 34,
                  height: 34,
                  color: '#64748b',
                  '&:hover': { bgcolor: '#e2e8f0', color: '#0f172a' }
                }}
              >
                <Clear sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
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
            {/* Printable Report Header for Recap / Balances views */}
          {printViewMode !== 'matrix' && renderPrintHeader()}

          {/* Staged Table in Print View */}
          {printViewMode === 'matrix' ? (
            /* Multi-Page Paginated Waterworks Matrix Layout */
            <Box sx={{ width: '100%' }}>
              {paginatedMatrixPages.map((pageData, pageIdx) => (
                <Box
                  key={pageIdx}
                  className="print-page-sheet"
                  sx={{
                    width: '100%',
                    mb: { xs: 4, print: 0 },
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: { xs: 'auto', print: '100%' },
                    boxSizing: 'border-box',
                    pageBreakAfter: pageIdx < paginatedMatrixPages.length - 1 ? 'always' : 'auto',
                    breakAfter: pageIdx < paginatedMatrixPages.length - 1 ? 'page' : 'auto',
                  }}
                >
                  <Box>
                    {renderPrintHeader(pageIdx, paginatedMatrixPages.length)}
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
                          <TableRow sx={{ '& th': { bgcolor: '#f1f5f9', fontWeight: 800, fontSize: '6.8pt', border: '0.5pt solid #334155', py: 0.2, px: 0.2, color: '#0f172a', textAlign: 'center !important', verticalAlign: 'middle !important', whiteSpace: 'normal !important', wordBreak: 'break-word !important', lineHeight: 1.05 } }}>
                            <TableCell rowSpan={2} align="center" sx={{ width: '2.0%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>#</TableCell>
                            <TableCell rowSpan={2} align="center" sx={{ width: '5.0%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Date</TableCell>
                            <TableCell rowSpan={2} align="center" sx={{ width: '8.5%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Collector Name</TableCell>
                            <TableCell rowSpan={2} align="center" sx={{ width: '4.5%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Booklet</TableCell>
                            <TableCell rowSpan={2} align="center" sx={{ width: '8.5%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>OR Numbers</TableCell>
                            <TableCell rowSpan={2} align="center" sx={{ width: '6.0%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Report No.</TableCell>
                            <TableCell rowSpan={2} align="center" sx={{ width: '4.5%', textAlign: 'center !important', verticalAlign: 'middle !important', fontSize: '6.5pt !important' }}>Poblacion</TableCell>
                            <TableCell rowSpan={2} align="center" sx={{ width: '4.5%', textAlign: 'center !important', verticalAlign: 'middle !important', fontSize: '6.5pt !important' }}>San Pedro</TableCell>
                            <TableCell colSpan={2} align="center" sx={{ width: '8.4%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Calabasahan</TableCell>
                            <TableCell colSpan={2} align="center" sx={{ width: '8.4%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Sampong</TableCell>
                            <TableCell rowSpan={2} align="center" sx={{ width: '4.5%', textAlign: 'center !important', verticalAlign: 'middle !important', fontSize: '6.5pt !important' }}>Bakhawan</TableCell>
                            <TableCell rowSpan={2} align="center" sx={{ width: '4.5%', textAlign: 'center !important', verticalAlign: 'middle !important', fontSize: '6.5pt !important' }}>Masudsud</TableCell>
                            <TableCell rowSpan={2} align="center" sx={{ width: '4.5%', textAlign: 'center !important', verticalAlign: 'middle !important', fontSize: '6.5pt !important' }}>Dalajican</TableCell>
                            <TableCell rowSpan={2} align="center" sx={{ width: '4.5%', textAlign: 'center !important', verticalAlign: 'middle !important', fontSize: '6.5pt !important' }}>San Vicente</TableCell>
                            <TableCell rowSpan={2} align="center" sx={{ width: '7.6%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Sundry</TableCell>
                            <TableCell rowSpan={2} align="center" sx={{ width: '5.5%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Account Code</TableCell>
                            <TableCell rowSpan={2} align="center" sx={{ width: '8.5%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Amount (₱)</TableCell>
                          </TableRow>
                          <TableRow sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 700, fontSize: '6.5pt', border: '0.5pt solid #334155', py: 0.15, px: 0.2, color: '#0f172a', textAlign: 'center !important', verticalAlign: 'middle !important', whiteSpace: 'normal !important', wordBreak: 'break-word !important' } }}>
                            <TableCell align="center" sx={{ width: '4.2%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Spring</TableCell>
                            <TableCell align="center" sx={{ width: '4.2%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Pump</TableCell>
                            <TableCell align="center" sx={{ width: '4.2%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Bukal</TableCell>
                            <TableCell align="center" sx={{ width: '4.2%', textAlign: 'center !important', verticalAlign: 'middle !important' }}>Guiob</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {pageData.rows.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={17} align="center" sx={{ py: 2, fontSize: '7pt', color: '#64748b' }}>
                                No collection records to display.
                              </TableCell>
                            </TableRow>
                          ) : (
                            pageData.rows.map((mr, pageRowIdx) => (
                              <TableRow key={mr.key} sx={{ '& td': { py: 0.35, px: 0.25, fontSize: '6.8pt', border: '0.5pt solid #475569', color: '#000000', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }}>
                                <TableCell align="center">{mr.rowNumber}</TableCell>
                                <TableCell align="center" sx={{ fontSize: '6.8pt', whiteSpace: 'nowrap' }}>{mr.submissionDate || '-'}</TableCell>
                                <TableCell sx={{ fontWeight: 600, wordBreak: 'break-word', whiteSpace: 'normal', fontSize: '6.8pt' }}>
                                  {mr.collectorName || (pageRowIdx === 0 && mr.fullCollectorName ? `(Cont.) ${mr.fullCollectorName}` : '')}
                                </TableCell>
                                <TableCell align="center" sx={{ fontSize: '6.8pt', whiteSpace: 'nowrap' }}>
                                  {mr.bookletNo || (pageRowIdx === 0 && mr.fullBookletNo ? `(Cont.) ${mr.fullBookletNo}` : '')}
                                </TableCell>
                                <TableCell sx={{ fontFamily: 'monospace', fontSize: '6.8pt', wordBreak: 'break-all', whiteSpace: 'normal' }}>{cleanOrDisplay(mr.orNumbersDisplay)}</TableCell>
                                <TableCell align="center" sx={{ fontFamily: 'monospace', fontSize: '6.8pt', fontWeight: 700 }}>{mr.reportNo}</TableCell>
                                <TableCell align="right" sx={{ fontSize: '6.8pt', px: 0.2 }}>{mr.poblacion ? Number(mr.poblacion).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                                <TableCell align="right" sx={{ fontSize: '6.8pt', px: 0.2 }}>{mr.sanPedro ? Number(mr.sanPedro).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                                <TableCell align="right" sx={{ fontSize: '6.8pt', px: 0.2 }}>{mr.calabasahanSpring ? Number(mr.calabasahanSpring).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                                <TableCell align="right" sx={{ fontSize: '6.8pt', px: 0.2 }}>{mr.calabasahanPump ? Number(mr.calabasahanPump).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                                <TableCell align="right" sx={{ fontSize: '6.8pt', px: 0.2 }}>{mr.sampongSpring ? Number(mr.sampongSpring).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                                <TableCell align="right" sx={{ fontSize: '6.8pt', px: 0.2 }}>{mr.sampongPump ? Number(mr.sampongPump).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                                <TableCell align="right" sx={{ fontSize: '6.8pt', px: 0.2 }}>{mr.bakhawan ? Number(mr.bakhawan).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                                <TableCell align="right" sx={{ fontSize: '6.8pt', px: 0.2 }}>{mr.masudsud ? Number(mr.masudsud).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                                <TableCell align="right" sx={{ fontSize: '6.8pt', px: 0.2 }}>{mr.dalajican ? Number(mr.dalajican).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                                <TableCell align="right" sx={{ fontSize: '6.8pt', px: 0.2 }}>{mr.sanVicente ? Number(mr.sanVicente).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                                <TableCell sx={{ fontWeight: 600, wordBreak: 'break-word', whiteSpace: 'normal', fontSize: '6.8pt' }}>{mr.subCategory}</TableCell>
                                <TableCell align="center" sx={{ fontFamily: 'monospace', fontSize: '6.8pt' }}>{mr.accountCode}</TableCell>
                                <TableCell align="right" sx={{ fontSize: '6.8pt', px: 0.2, fontWeight: 700 }}>
                                  {mr.amount > 0 ? Number(mr.amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                        <TableFooter>
                          {/* Subtotal on this page */}
                          <TableRow sx={{ bgcolor: '#f8fafc', '& td': { fontWeight: 800, py: 0.3, px: 0.1, fontSize: '5.8pt', letterSpacing: '-0.2px', border: '0.5pt solid #000000', color: '#000000', whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' } }}>
                            <TableCell colSpan={6} align="center" sx={{ fontWeight: 900, fontSize: '6.5pt !important', letterSpacing: 'normal !important' }}>
                              {paginatedMatrixPages.length > 1
                                ? `SUBTOTAL (PAGE ${pageIdx + 1} OF ${paginatedMatrixPages.length})`
                                : 'SUBTOTAL'}
                            </TableCell>
                            <TableCell align="right">{Number(pageData.pageTotals.poblacion).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            <TableCell align="right">{Number(pageData.pageTotals.sanPedro).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            <TableCell align="right">{Number(pageData.pageTotals.calSpring).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            <TableCell align="right">{Number(pageData.pageTotals.calPump).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            <TableCell align="right">{Number(pageData.pageTotals.samSpring).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            <TableCell align="right">{Number(pageData.pageTotals.samPump).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            <TableCell align="right">{Number(pageData.pageTotals.bakhawan).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            <TableCell align="right">{Number(pageData.pageTotals.masudsud).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            <TableCell align="right">{Number(pageData.pageTotals.dalajican).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            <TableCell align="right">{Number(pageData.pageTotals.sanVicente).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            <TableCell align="right" sx={{ fontSize: '5.8pt', px: 0.1 }}>
                              {pageData.pageTotals.sundry > 0 ? Number(pageData.pageTotals.sundry).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            </TableCell>
                            <TableCell />
                            <TableCell align="right" className="footer-grand-total" sx={{ fontWeight: 900, fontSize: '6.5pt !important', letterSpacing: '-0.2px !important', px: 0.15 }}>
                              ₱{Number(pageData.pageTotals.amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>

                          {/* Total on all subtotals - Rendered on the last page */}
                          {pageIdx === paginatedMatrixPages.length - 1 && (
                            <TableRow
                              className="total-subtotals-row"
                              sx={{
                                bgcolor: '#e2e8f0',
                                '& td': {
                                  fontWeight: 900,
                                  py: 0.35,
                                  px: 0.1,
                                  fontSize: '6.0pt',
                                  letterSpacing: '-0.25px',
                                  borderTop: '1pt solid #000000 !important',
                                  borderBottom: '2.5pt double #000000 !important',
                                  color: '#000000',
                                  whiteSpace: 'nowrap',
                                  overflow: 'visible',
                                  textOverflow: 'clip'
                                }
                              }}
                            >
                              <TableCell colSpan={6} align="center" sx={{ fontWeight: 900, fontSize: '6.8pt !important', letterSpacing: '0.5px !important' }}>
                                TOTAL ON ALL SUBTOTALS
                              </TableCell>
                              <TableCell align="right">{Number(totalOnAllSubtotals.poblacion).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                              <TableCell align="right">{Number(totalOnAllSubtotals.sanPedro).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                              <TableCell align="right">{Number(totalOnAllSubtotals.calSpring).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                              <TableCell align="right">{Number(totalOnAllSubtotals.calPump).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                              <TableCell align="right">{Number(totalOnAllSubtotals.samSpring).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                              <TableCell align="right">{Number(totalOnAllSubtotals.samPump).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                              <TableCell align="right">{Number(totalOnAllSubtotals.bakhawan).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                              <TableCell align="right">{Number(totalOnAllSubtotals.masudsud).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                              <TableCell align="right">{Number(totalOnAllSubtotals.dalajican).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                              <TableCell align="right">{Number(totalOnAllSubtotals.sanVicente).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                              <TableCell align="right" sx={{ fontSize: '6.0pt', px: 0.1 }}>
                                {totalOnAllSubtotals.sundry > 0 ? Number(totalOnAllSubtotals.sundry).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                              </TableCell>
                              <TableCell />
                              <TableCell align="right" className="footer-grand-total" sx={{ fontWeight: 900, fontSize: '6.5pt !important', letterSpacing: '-0.2px !important', px: 0.15 }}>
                                ₱{Number(totalOnAllSubtotals.amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableFooter>
                      </Table>
                    </TableContainer>
                  </Box>

                  {/* Signatures on the final page of matrix report */}
                  {pageIdx === paginatedMatrixPages.length - 1 && (
                    <Box
                      className="print-signatures-block"
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        mt: 1.5,
                        pt: 1,
                        px: 3,
                        pageBreakInside: 'avoid',
                        breakInside: 'avoid'
                      }}
                    >
                      <Box sx={{ textAlign: 'center', width: 220 }}>
                        <Typography sx={{ fontSize: '6.5pt', color: '#475569', mb: 2.2 }}>Prepared by:</Typography>
                        <Box sx={{ borderBottom: '1px solid #000000', mb: 0.3 }} />
                        <Typography sx={{ fontSize: '7.5pt', fontWeight: 700, textTransform: 'uppercase' }}>
                          {printingReport?.submittedBy && printingReport.submittedBy !== 'Administrator' 
                            ? printingReport.submittedBy 
                            : (user?.name || 'ADMINISTRATOR')}
                        </Typography>
                        <Typography sx={{ fontSize: '6pt', color: '#64748b' }}>Designation / Revenue Collector</Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', width: 220 }}>
                        <Typography sx={{ fontSize: '6.5pt', color: '#475569', mb: 2.2 }}>Certified Correct:</Typography>
                        <Box sx={{ borderBottom: '1px solid #000000', mb: 0.3 }} />
                        <Typography sx={{ fontSize: '7.5pt', fontWeight: 700, textTransform: 'uppercase' }}>
                          {getMunicipalTreasurerName()}
                        </Typography>
                        <Typography sx={{ fontSize: '6pt', color: '#64748b' }}>Municipal Treasurer</Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          ) : printViewMode === 'recap' ? (
            /* Printable Recapitulation (RCD) - Minimal Layout, 8.5 x 13 Landscape, 2-Column Split Support */
            (() => {
              const isTwoColumn = recapLayoutMode === 'two-column' || (recapLayoutMode === 'auto' && printRecapData.items.length > 14);
              const mid = Math.ceil(printRecapData.items.length / 2);
              const col1Items = isTwoColumn ? printRecapData.items.slice(0, mid) : printRecapData.items;
              const col2Items = isTwoColumn ? printRecapData.items.slice(mid) : [];
              const subtotal1 = col1Items.reduce((sum, item) => sum + item.amount, 0);
              const subtotal2 = col2Items.reduce((sum, item) => sum + item.amount, 0);

              if (printRecapData.items.length === 0 && printRecapData.grandTotal === 0) {
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
                            <TableRow sx={{ '& th': { bgcolor: '#f1f5f9', fontWeight: 800, fontSize: '8.5pt', border: '0.5pt solid #334155', py: 0.35, px: 0.5, color: '#0f172a' } }}>
                              <TableCell sx={{ width: '56%', textAlign: 'left !important' }}>Sundry</TableCell>
                              <TableCell align="center" sx={{ width: '22%', textAlign: 'center !important' }}>Account Code</TableCell>
                              <TableCell align="right" sx={{ width: '22%', textAlign: 'right !important' }}>Amount (₱)</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {col1Items.map((item, idx) => (
                              <TableRow key={idx} sx={{ '& td': { py: 0.25, px: 0.5, fontSize: '8.5pt', border: '0.5pt solid #475569', lineHeight: 1.15 } }}>
                                <TableCell sx={{ fontWeight: 600, wordBreak: 'break-word' }}>{item.subCategory}</TableCell>
                                <TableCell align="center" sx={{ fontFamily: 'monospace', fontSize: '8pt' }}>{item.accountCode}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>
                                  {item.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                          <TableFooter>
                            <TableRow sx={{ bgcolor: '#f8fafc', '& td': { fontWeight: 800, py: 0.35, px: 0.5, fontSize: '8.5pt', border: '0.5pt solid #000000' } }}>
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
                            <TableRow sx={{ '& th': { bgcolor: '#f1f5f9', fontWeight: 800, fontSize: '8.5pt', border: '0.5pt solid #334155', py: 0.35, px: 0.5, color: '#0f172a' } }}>
                              <TableCell sx={{ width: '56%', textAlign: 'left !important' }}>Sundry</TableCell>
                              <TableCell align="center" sx={{ width: '22%', textAlign: 'center !important' }}>Account Code</TableCell>
                              <TableCell align="right" sx={{ width: '22%', textAlign: 'right !important' }}>Amount (₱)</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {col2Items.map((item, idx) => (
                              <TableRow key={idx} sx={{ '& td': { py: 0.25, px: 0.5, fontSize: '8.5pt', border: '0.5pt solid #475569', lineHeight: 1.15 } }}>
                                <TableCell sx={{ fontWeight: 600, wordBreak: 'break-word' }}>{item.subCategory}</TableCell>
                                <TableCell align="center" sx={{ fontFamily: 'monospace', fontSize: '8pt' }}>{item.accountCode}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>
                                  {item.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                          <TableFooter>
                            <TableRow sx={{ bgcolor: '#f8fafc', '& td': { fontWeight: 800, py: 0.35, px: 0.5, fontSize: '8.5pt', border: '0.5pt solid #000000' } }}>
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
                          <TableRow sx={{ '& th': { bgcolor: '#f1f5f9', fontWeight: 800, fontSize: '8.5pt', border: '0.5pt solid #334155', py: 0.35, px: 0.6, color: '#0f172a' } }}>
                            <TableCell sx={{ width: '55%', textAlign: 'left !important' }}>Sundry</TableCell>
                            <TableCell align="center" sx={{ width: '23%', textAlign: 'center !important' }}>Account Code</TableCell>
                            <TableCell align="right" sx={{ width: '22%', textAlign: 'right !important' }}>Amount (₱)</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {col1Items.map((item, idx) => (
                            <TableRow key={idx} sx={{ '& td': { py: 0.3, px: 0.6, fontSize: '8.5pt', border: '0.5pt solid #475569', lineHeight: 1.2 } }}>
                              <TableCell sx={{ fontWeight: 600, wordBreak: 'break-word' }}>{item.subCategory}</TableCell>
                              <TableCell align="center" sx={{ fontFamily: 'monospace', fontSize: '8.0pt' }}>{item.accountCode}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>
                                {item.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          {printRecapData.basicWaterTotal > 0 && (
                            <>
                              <TableRow sx={{ bgcolor: '#f8fafc', '& td': { fontWeight: 700, py: 0.3, px: 0.6, fontSize: '8.5pt', border: '0.5pt solid #475569' } }}>
                                <TableCell colSpan={2} align="right">SUBTOTAL (SUNDRY COLLECTIONS):</TableCell>
                                <TableCell align="right">₱ {printRecapData.sundryTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                              </TableRow>
                              <TableRow sx={{ bgcolor: '#f0f9ff', '& td': { fontWeight: 700, py: 0.3, px: 0.6, fontSize: '8.5pt', border: '0.5pt solid #475569' } }}>
                                <TableCell colSpan={2} align="right">WATERWORKS CHARGES (ALL BARANGAYS):</TableCell>
                                <TableCell align="right">₱ {printRecapData.basicWaterTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                              </TableRow>
                            </>
                          )}
                          <TableRow sx={{ bgcolor: '#f8fafc', '& td': { fontWeight: 900, py: 0.4, px: 0.6, fontSize: '9.0pt', border: '0.5pt solid #000000' } }}>
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
                        flexDirection: 'column',
                        gap: 0.5,
                        mt: 0.8,
                        py: 0.6,
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
                      {printRecapData.basicWaterTotal > 0 && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography sx={{ fontSize: '8pt', fontWeight: 700, color: '#334155' }}>
                            SUBTOTAL (SUNDRY): ₱ {printRecapData.sundryTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            &nbsp;&nbsp;|&nbsp;&nbsp;
                            WATERWORKS CHARGES (ALL BARANGAYS): ₱ {printRecapData.basicWaterTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Typography>
                        </Box>
                      )}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography sx={{ fontSize: '8.5pt', fontWeight: 800, color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          TOTAL COLLECTIONS (RECAPITULATION)
                        </Typography>
                        <Typography sx={{ fontSize: '10pt', fontWeight: 900, color: '#000000', fontFamily: 'monospace' }}>
                          ₱ {printRecapData.grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              );
            })()
          ) : (
            /* Balances, Deposits & Collections View */
            <Box sx={{ width: '100%' }}>
              {/* Two-Column Top Grid: A (Remittances & Deposits) and B (Summary of Collections) */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5, mb: 1.5, '@media print': { gridTemplateColumns: '1fr 1fr', gap: '8pt', mb: '8pt' } }}>
                {/* SECTION A: REMITTANCES & BANK DEPOSITS */}
                <Box sx={{ border: '0.5pt solid #000000', p: 0.8, bgcolor: '#ffffff' }}>
                  <Box sx={{ bgcolor: '#f1f5f9', py: 0.4, px: 0.8, borderBottom: '0.5pt solid #000000', mb: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontSize: '8.5pt', fontWeight: 900, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      A. REMITTANCES & BANK DEPOSITS
                    </Typography>
                    <Typography sx={{ fontSize: '7.5pt', color: '#64748b', fontWeight: 600 }}>
                      ({printReportSelectedDeposits.deposits.length} Records)
                    </Typography>
                  </Box>
                  <TableContainer component={Paper} elevation={0} sx={{ border: 'none', overflow: 'visible' }}>
                    <Table size="small" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                      <TableHead>
                        <TableRow sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 800, fontSize: '8.0pt', border: '0.5pt solid #000000', py: 0.3, px: 0.5 } }}>
                          <TableCell sx={{ width: '22%' }}>Date</TableCell>
                          <TableCell sx={{ width: '28%' }}>Deposit Control No.</TableCell>
                          <TableCell sx={{ width: '28%' }}>Name of Depositor</TableCell>
                          <TableCell align="right" sx={{ width: '22%' }}>Amount (₱)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {printReportSelectedDeposits.deposits.length === 0 ? (
                          <TableRow sx={{ '& td': { py: 1, px: 0.5, fontSize: '8.0pt', border: '0.5pt solid #000000', textAlign: 'center', color: '#64748b' } }}>
                            <TableCell colSpan={4}>
                              No deposit records applied to this report.
                            </TableCell>
                          </TableRow>
                        ) : (
                          printReportSelectedDeposits.deposits.map((dep: any, idx: number) => (
                            <TableRow key={dep.id || idx} sx={{ '& td': { py: 0.25, px: 0.5, fontSize: '8.0pt', border: '0.5pt solid #000000' } }}>
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
                        <TableRow sx={{ bgcolor: '#f1f5f9', '& td': { fontWeight: 900, py: 0.4, px: 0.5, fontSize: '8.5pt', border: '0.5pt solid #000000' } }}>
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
                    <Typography sx={{ fontSize: '8.5pt', fontWeight: 900, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      B. SUMMARY OF COLLECTIONS (TOTAL ONLY OF EACH BOOKLET)
                    </Typography>
                    <Typography sx={{ fontSize: '7.5pt', color: '#64748b', fontWeight: 600 }}>
                      ({printBookletSummaryData.booklets.length} Booklets)
                    </Typography>
                  </Box>
                  <TableContainer component={Paper} elevation={0} sx={{ border: 'none', overflow: 'visible' }}>
                    <Table size="small" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                      <TableHead>
                        <TableRow sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 800, fontSize: '8.0pt', border: '0.5pt solid #000000', py: 0.3, px: 0.5 } }}>
                          <TableCell sx={{ width: '22%' }}>Booklet No.</TableCell>
                          <TableCell sx={{ width: '18%' }}>Report No.</TableCell>
                          <TableCell sx={{ width: '22%' }}>Collector</TableCell>
                          <TableCell sx={{ width: '18%' }}>OR Range</TableCell>
                          <TableCell align="right" sx={{ width: '20%' }}>Amount (₱)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {printBookletSummaryData.booklets.length === 0 ? (
                          <TableRow sx={{ '& td': { py: 1, px: 0.5, fontSize: '8.0pt', border: '0.5pt solid #000000', textAlign: 'center', color: '#64748b' } }}>
                            <TableCell colSpan={5}>
                              No booklet collection records available.
                            </TableCell>
                          </TableRow>
                        ) : (
                          printBookletSummaryData.booklets.map((b, idx) => (
                            <TableRow key={b.batchId || idx} sx={{ '& td': { py: 0.25, px: 0.5, fontSize: '8.0pt', border: '0.5pt solid #000000' } }}>
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
                        <TableRow sx={{ bgcolor: '#f1f5f9', '& td': { fontWeight: 900, py: 0.4, px: 0.5, fontSize: '8.5pt', border: '0.5pt solid #000000' } }}>
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
                <Typography sx={{ fontSize: '9.0pt', fontWeight: 900, textTransform: 'uppercase', mb: 1, letterSpacing: 0.5, color: '#0f172a' }}>
                  C. SUMMARY OF CASH & ENDING BALANCE (ACCOUNTABILITY)
                </Typography>
                <Table size="small" sx={{ width: '100%', maxWidth: 650, borderCollapse: 'collapse', mx: 'auto' }}>
                  <TableBody>
                    <TableRow sx={{ '& td': { py: 0.25, fontSize: '8.5pt' } }}>
                      <TableCell sx={{ width: '60%', border: 'none' }}>Beginning Balance (Cash on Hand / Undeposited):</TableCell>
                      <TableCell align="right" sx={{ width: '10%', border: 'none', fontWeight: 700 }}>₱</TableCell>
                      <TableCell align="right" sx={{ width: '30%', border: 'none', fontWeight: 700, fontFamily: 'monospace' }}>
                        {printReportBeginningBalance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ '& td': { py: 0.25, fontSize: '8.5pt' } }}>
                      <TableCell sx={{ pl: 2, border: 'none' }}>Add: Total Collections (Total of each booklet):</TableCell>
                      <TableCell align="right" sx={{ border: 'none', fontWeight: 700 }}>₱</TableCell>
                      <TableCell align="right" sx={{ border: 'none', fontWeight: 700, fontFamily: 'monospace' }}>
                        {printBookletSummaryData.grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ '& td': { py: 0.25, fontSize: '8.5pt', bgcolor: '#f1f5f9' } }}>
                      <TableCell sx={{ fontWeight: 800, borderTop: '0.5pt solid #000000', borderBottom: '0.5pt solid #000000' }}>
                        Total Funds to be Accounted For:
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, borderTop: '0.5pt solid #000000', borderBottom: '0.5pt solid #000000' }}>₱</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, borderTop: '0.5pt solid #000000', borderBottom: '0.5pt solid #000000', fontFamily: 'monospace' }}>
                        {(printReportBeginningBalance + printBookletSummaryData.grandTotal).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ '& td': { py: 0.25, fontSize: '8.5pt' } }}>
                      <TableCell sx={{ pl: 2, border: 'none' }}>Less: Total Remittances / Deposits to Bank:</TableCell>
                      <TableCell align="right" sx={{ border: 'none', fontWeight: 700 }}>₱</TableCell>
                      <TableCell align="right" sx={{ border: 'none', fontWeight: 700, fontFamily: 'monospace', color: '#16a34a' }}>
                        {printReportSelectedDeposits.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ '& td': { py: 0.4, fontSize: '9.5pt', bgcolor: '#ffffff' } }}>
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
              GRAND TOTAL: ₱ {(printViewMode === 'recap' || printViewMode === 'balances' ? printRecapData.grandTotal : totalOnAllSubtotals.amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Typography>
          </Box>

          {/* Official Signatures for Printed 8.5 x 13 Document */}
          <Box
            sx={{
              display: (printViewMode === 'balances' || printViewMode === 'recap') ? 'flex' : 'none',
              '@media print': { display: (printViewMode === 'balances' || printViewMode === 'recap') ? 'flex !important' : 'none !important' },
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
                {printingReport?.submittedBy && printingReport.submittedBy !== 'Administrator' 
                  ? printingReport.submittedBy 
                  : (user?.name || 'ADMINISTRATOR')}
              </Typography>
              <Typography sx={{ fontSize: '6pt', color: '#64748b' }}>Designation / Revenue Collector</Typography>
            </Box>
            <Box sx={{ textAlign: 'center', width: 220 }}>
              <Typography sx={{ fontSize: '6.5pt', color: '#475569', mb: 2.5 }}>Certified Correct:</Typography>
              <Box sx={{ borderBottom: '1px solid #000000', mb: 0.3 }} />
              <Typography sx={{ fontSize: '7.5pt', fontWeight: 700, textTransform: 'uppercase' }}>
                {getMunicipalTreasurerName()}
              </Typography>
              <Typography sx={{ fontSize: '6pt', color: '#64748b' }}>Municipal Treasurer</Typography>
            </Box>
          </Box>
          </Box>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* WEEKLY REPORT INCLUSIONS & COMPREHENSIVE DETAILS DIALOG                  */}
      {/* ========================================================================= */}
      <Dialog
        open={Boolean(viewingWeeklyReport)}
        onClose={() => setViewingWeeklyReport(null)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2.5,
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }
        }}
      >
        {viewingWeeklyReport && (() => {
          const rep = viewingWeeklyReport;
          const isMonthlyReport = rep.reportType === 'admin_monthly' || rep.reportLevel === 'monthly';
          const isSubmittedToMonthly = Boolean(rep.submittedToMonthly || rep.consolidatedInMonthlyReportId);
          const underlying = viewingUnderlyingCollectorReports;
          const subCats = viewingWeeklySubCats;
          const deposits = viewingWeeklyDeposits;
          const totalDeposits = deposits.reduce((sum, d) => sum + (d.amount || 0), 0);
          const computedEnding = (rep.endingBalance !== undefined && rep.endingBalance !== null)
            ? rep.endingBalance
            : ((rep.beginningBalance || 0) + rep.totalAmount - totalDeposits);

          // Booklet count display
          let bookletLabel = '1 Booklet';
          if (rep.afNo) {
            const match = rep.afNo.match(/^(\d+)\s+Booklets?/i);
            if (match) {
              const count = parseInt(match[1], 10);
              bookletLabel = `${count} ${count === 1 ? 'Booklet' : 'Booklets'}`;
            } else {
              const parts = rep.afNo.split(',').filter(Boolean);
              bookletLabel = `${parts.length} ${parts.length === 1 ? 'Booklet' : 'Booklets'}`;
            }
          }

          return (
            <>
              {/* Header */}
              <DialogTitle
                component="div"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  bgcolor: '#0f172a',
                  color: '#ffffff',
                  px: 3,
                  py: 2
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  <AssessmentOutlined sx={{ color: '#38bdf8', fontSize: 26 }} />
                  <Typography variant="h6" fontWeight="800" sx={{ color: '#ffffff', letterSpacing: '-0.02em' }}>
                    {isMonthlyReport ? 'Monthly Report Inclusions & Details' : 'Weekly Report Inclusions & Details'}
                  </Typography>
                  <Chip
                    label={isMonthlyReport ? (rep.monthLabel || 'Monthly') : resolveWeekLabel(rep, weeklyReports)}
                    size="small"
                    sx={{
                      bgcolor: '#0284c7',
                      color: '#ffffff',
                      fontWeight: 800,
                      px: 0.5
                    }}
                  />
                  <Chip
                    label={rep.reportNumber}
                    size="small"
                    sx={{
                      bgcolor: 'rgba(56, 189, 248, 0.15)',
                      color: '#38bdf8',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      border: '1px solid rgba(56, 189, 248, 0.3)'
                    }}
                  />
                  {isMonthlyReport ? (
                    <Chip
                      icon={<CheckCircle sx={{ fontSize: '14px !important', color: '#4ade80 !important' }} />}
                      label="Monthly Consolidated"
                      size="small"
                      sx={{ bgcolor: 'rgba(74, 222, 128, 0.15)', color: '#4ade80', fontWeight: 700 }}
                    />
                  ) : isSubmittedToMonthly ? (
                    <Chip
                      icon={<CheckCircle sx={{ fontSize: '14px !important', color: '#4ade80 !important' }} />}
                      label="Submitted to Monthly"
                      size="small"
                      sx={{ bgcolor: 'rgba(74, 222, 128, 0.15)', color: '#4ade80', fontWeight: 700 }}
                    />
                  ) : (
                    <Chip
                      label="Unsubmitted"
                      size="small"
                      sx={{ bgcolor: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', fontWeight: 700 }}
                    />
                  )}
                </Box>
                <IconButton
                  size="small"
                  onClick={() => setViewingWeeklyReport(null)}
                  sx={{ color: '#94a3b8', '&:hover': { color: '#ffffff', bgcolor: 'rgba(255,255,255,0.1)' } }}
                >
                  <Close fontSize="small" />
                </IconButton>
              </DialogTitle>

              <DialogContent sx={{ p: 3, bgcolor: '#f8fafc' }}>
                <Stack spacing={2.5}>
                  {/* Summary Metric Cards */}
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          bgcolor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderLeft: '4px solid #16a34a'
                        }}
                      >
                        <Typography variant="caption" color="text.secondary" fontWeight="600" display="block">
                          TOTAL COLLECTIONS
                        </Typography>
                        <Typography variant="h6" fontWeight="900" sx={{ color: '#16a34a', mt: 0.5 }}>
                          ₱ {rep.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                          Gross collection for this period
                        </Typography>
                      </Paper>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          bgcolor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderLeft: '4px solid #0284c7'
                        }}
                      >
                        <Typography variant="caption" color="text.secondary" fontWeight="600" display="block">
                          INCLUDED BOOKLETS
                        </Typography>
                        <Typography variant="h6" fontWeight="800" sx={{ color: '#0284c7', mt: 0.5 }}>
                          {bookletLabel}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {rep.afNo}
                        </Typography>
                      </Paper>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          bgcolor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderLeft: '4px solid #8b5cf6'
                        }}
                      >
                        <Typography variant="caption" color="text.secondary" fontWeight="600" display="block">
                          OFFICIAL RECEIPTS (ORs)
                        </Typography>
                        <Typography variant="h6" fontWeight="800" sx={{ color: '#8b5cf6', mt: 0.5 }}>
                          {rep.orCount || (rep.orNumbers ? rep.orNumbers.length : 0)} ORs
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontFamily: 'monospace', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {rep.orRange}
                        </Typography>
                      </Paper>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          bgcolor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderLeft: '4px solid #f59e0b'
                        }}
                      >
                        <Typography variant="caption" color="text.secondary" fontWeight="600" display="block">
                          COVERAGE PERIOD
                        </Typography>
                        <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#b45309', mt: 0.5 }}>
                          {rep.dateFrom && rep.dateTo ? `${rep.dateFrom} to ${rep.dateTo}` : rep.submittedAt?.slice(0, 10) || '—'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                          Submitted {rep.submittedAt ? new Date(rep.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>

                  {/* Inclusions Section 1: Booklets & Collector Reports Inclusions */}
                  <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, bgcolor: '#ffffff', border: '1px solid #e2e8f0' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <ReceiptLong sx={{ color: '#0284c7' }} />
                      <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0f172a' }}>
                        1. Collector Booklets & Submissions Inclusions
                      </Typography>
                    </Box>

                    <TableContainer sx={{ border: '1px solid #f1f5f9', borderRadius: 1.5 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 700, color: '#334155' } }}>
                            <TableCell>Collector Name</TableCell>
                            <TableCell>Accountable Form / Booklet</TableCell>
                            <TableCell>OR Series / Range</TableCell>
                            <TableCell align="center">OR Count</TableCell>
                            <TableCell align="right">Total Subtotal</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {underlying.length > 0 ? (
                            underlying.map((cr) => (
                              <TableRow key={cr.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                                <TableCell>
                                  <Typography variant="body2" fontWeight="700" sx={{ color: '#0f172a' }}>
                                    {getSubmittedCollectorNameForReport(cr)}
                                  </Typography>
                                  {cr.collectorEmail && (
                                    <Typography variant="caption" color="text.secondary" display="block">
                                      {cr.collectorEmail}
                                    </Typography>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Chip label={cr.afNo} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                    {cr.orRange}
                                  </Typography>
                                </TableCell>
                                <TableCell align="center">
                                  <Chip label={`${cr.orCount || cr.orNumbers?.length || 0} ORs`} size="small" sx={{ fontSize: '0.72rem', height: 20 }} />
                                </TableCell>
                                <TableCell align="right">
                                  <Typography variant="body2" fontWeight="800" sx={{ color: '#16a34a' }}>
                                    ₱ {cr.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow sx={{ '&:last-child td': { border: 0 } }}>
                              <TableCell>
                                <Typography variant="body2" fontWeight="700" sx={{ color: '#0f172a' }}>
                                  {getSubmittedCollectorNameForReport(rep)}
                                </Typography>
                                {rep.collectorEmail && (
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    {rep.collectorEmail}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                <Chip label={rep.afNo} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                  {rep.orRange}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                <Chip label={`${rep.orCount || rep.orNumbers?.length || 0} ORs`} size="small" sx={{ fontSize: '0.72rem', height: 20 }} />
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" fontWeight="800" sx={{ color: '#16a34a' }}>
                                  ₱ {rep.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                        <TableFooter>
                          <TableRow sx={{ '& td': { bgcolor: '#f8fafc', fontWeight: 800, borderTop: '2px solid #e2e8f0' } }}>
                            <TableCell colSpan={3}>
                              <Typography variant="body2" fontWeight="800" sx={{ color: '#0f172a' }}>
                                TOTAL FOR WEEKLY REPORT ({underlying.length > 0 ? underlying.length : 1} {underlying.length === 1 ? 'Booklet' : 'Booklets'})
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Typography variant="body2" fontWeight="800">
                                {rep.orCount || (rep.orNumbers ? rep.orNumbers.length : 0)} ORs
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="subtitle2" fontWeight="900" sx={{ color: '#16a34a' }}>
                                ₱ {rep.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </TableContainer>
                  </Paper>

                  {/* Inclusions Section 2: Collections by Revenue Category & Account Code */}
                  <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, bgcolor: '#ffffff', border: '1px solid #e2e8f0' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <TableChart sx={{ color: '#0284c7' }} />
                      <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0f172a' }}>
                        2. Revenue Category & Account Code Breakdown
                      </Typography>
                    </Box>

                    <TableContainer sx={{ border: '1px solid #f1f5f9', borderRadius: 1.5, maxHeight: 320 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 700, color: '#334155' } }}>
                            <TableCell sx={{ width: 140 }}>Account Code</TableCell>
                            <TableCell>Sub-Category / Particulars</TableCell>
                            <TableCell>Main Category</TableCell>
                            <TableCell align="center" sx={{ width: 100 }}>Item / OR Count</TableCell>
                            <TableCell align="right" sx={{ width: 160 }}>Amount (₱)</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {subCats.length > 0 ? (
                            subCats.map((sc, idx) => (
                              <TableRow key={idx} hover sx={{ '&:last-child td': { border: 0 } }}>
                                <TableCell>
                                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                                    {sc.accountCode || '—'}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" fontWeight="600" sx={{ color: '#334155' }}>
                                    {sc.subCategory}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="caption" color="text.secondary">
                                    {sc.mainCategory || 'Tax Revenue'}
                                  </Typography>
                                </TableCell>
                                <TableCell align="center">
                                  <Chip label={`${sc.itemCount || 1}`} size="small" sx={{ fontSize: '0.72rem', height: 20 }} />
                                </TableCell>
                                <TableCell align="right">
                                  <Typography variant="body2" fontWeight="700" sx={{ color: '#0f172a' }}>
                                    ₱ {sc.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={5} align="center" sx={{ py: 3, color: '#94a3b8' }}>
                                No granular sub-category charges recorded.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                        <TableFooter>
                          <TableRow sx={{ '& td': { bgcolor: '#f8fafc', fontWeight: 800, borderTop: '2px solid #e2e8f0' } }}>
                            <TableCell colSpan={3}>
                              <Typography variant="body2" fontWeight="800" sx={{ color: '#0f172a' }}>
                                TOTAL REVENUE INCLUSIONS ({subCats.length} Particulars)
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Typography variant="body2" fontWeight="800">
                                {subCats.reduce((s, c) => s + (c.itemCount || 1), 0)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="subtitle2" fontWeight="900" sx={{ color: '#16a34a' }}>
                                ₱ {rep.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </TableContainer>
                  </Paper>

                  {/* Inclusions Section 3: Cash Balances & Remitted Bank Deposits */}
                  <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, bgcolor: '#ffffff', border: '1px solid #e2e8f0' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <AccountBalance sx={{ color: '#0284c7' }} />
                      <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0f172a' }}>
                        3. Balances & Bank Deposits Remitted
                      </Typography>
                    </Box>

                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, md: 5 }}>
                        <Paper elevation={0} sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0', height: '100%' }}>
                          <Typography variant="caption" fontWeight="700" sx={{ color: '#475569', textTransform: 'uppercase', mb: 1, display: 'block' }}>
                            Cash Flow Statement
                          </Typography>
                          <Stack spacing={1.2}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" color="text.secondary">Beginning Balance (Cash on Hand):</Typography>
                              <Typography variant="body2" fontWeight="700">
                                ₱ {(rep.beginningBalance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" color="text.secondary">Add: Collections for Period:</Typography>
                              <Typography variant="body2" fontWeight="700" sx={{ color: '#16a34a' }}>
                                + ₱ {rep.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" color="text.secondary">Less: Remittances / Bank Deposits:</Typography>
                              <Typography variant="body2" fontWeight="700" sx={{ color: '#dc2626' }}>
                                - ₱ {totalDeposits.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </Typography>
                            </Box>
                            <Divider sx={{ my: 0.5 }} />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="subtitle2" fontWeight="800" sx={{ color: '#0f172a' }}>Ending Cash Balance:</Typography>
                              <Typography variant="subtitle1" fontWeight="900" sx={{ color: computedEnding >= 0 ? '#16a34a' : '#dc2626' }}>
                                ₱ {computedEnding.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </Typography>
                            </Box>
                          </Stack>
                        </Paper>
                      </Grid>

                      <Grid size={{ xs: 12, md: 7 }}>
                        <Paper elevation={0} sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0', height: '100%' }}>
                          <Typography variant="caption" fontWeight="700" sx={{ color: '#475569', textTransform: 'uppercase', mb: 1, display: 'block' }}>
                            Remitted Bank Deposits ({deposits.length})
                          </Typography>
                          {deposits.length > 0 ? (
                            <Stack spacing={1} sx={{ maxHeight: 180, overflowY: 'auto', pr: 0.5 }}>
                              {deposits.map((dep, idx) => (
                                <Paper key={idx} elevation={0} variant="outlined" sx={{ p: 1, px: 1.5, borderRadius: 1.2, bgcolor: '#ffffff' }}>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box>
                                      <Typography variant="body2" fontWeight="700" sx={{ color: '#0f172a' }}>
                                        {dep.depositControlNumber || `Deposit #${idx + 1}`}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {dep.depositDate || '—'} · {dep.depositorName || 'Bank Deposit'}
                                      </Typography>
                                    </Box>
                                    <Typography variant="body2" fontWeight="800" sx={{ color: '#16a34a' }}>
                                      ₱ {(dep.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Typography>
                                  </Box>
                                </Paper>
                              ))}
                            </Stack>
                          ) : (
                            <Box sx={{ py: 3, textAlign: 'center', color: '#94a3b8' }}>
                              <Typography variant="caption">No bank deposits were remitted in this weekly report.</Typography>
                            </Box>
                          )}
                        </Paper>
                      </Grid>
                    </Grid>
                  </Paper>
                </Stack>
              </DialogContent>

              <DialogActions sx={{ p: 2, px: 3, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary">
                  Prepared by: <strong>{rep.submittedBy || 'Administrator'}</strong>
                </Typography>
                <Stack direction="row" spacing={1.5}>
                  <Button
                    variant="outlined"
                    startIcon={<Print />}
                    onClick={() => handlePrintMatrix(rep)}
                    sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5 }}
                  >
                    Print Matrix
                  </Button>
                  <Button
                    variant="outlined"
                    color="success"
                    startIcon={<FileDownload />}
                    onClick={() => handleExportReportExcel(rep)}
                    sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5 }}
                  >
                    Export Excel
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => setViewingWeeklyReport(null)}
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, bgcolor: '#0f172a', '&:hover': { bgcolor: '#334155' } }}
                  >
                    Close
                  </Button>
                </Stack>
              </DialogActions>
            </>
          );
        })()}
      </Dialog>

      {/* Confirmation Dialog for Unmark / Reopen */}
      <ConfirmDialog
        open={unmarkConfirmOpen}
        title={reportToUnmark?.reportLevel === 'monthly' ? "Reopen Monthly Report?" : "Reopen Weekly Report?"}
        message={
          reportToUnmark?.reportLevel === 'monthly'
            ? `Are you sure you want to reopen Monthly Report ${reportToUnmark?.reportNumber}? The associated weekly reports will be restored to unsubmitted status in the Weekly Reports tab.`
            : `Are you sure you want to reopen Weekly Report ${reportToUnmark?.reportNumber} for ${reportToUnmark?.collectorName}? It will return to the Submitted Collector Reports for Consolidation pool.`
        }
        confirmText="Reopen Report"
        severity="warning"
        onConfirm={() => {
          if (!reportToUnmark) return;
          if (reportToUnmark.reportLevel === 'monthly') {
            handleConfirmUnmarkMonthly(reportToUnmark);
          } else {
            handleConfirmUnmarkWeekly(reportToUnmark);
          }
        }}
        onClose={() => {
          setUnmarkConfirmOpen(false);
        }}
      />

      {/* Modern Glassmorphism Loading Spinner Overlay */}
      <Backdrop
        open={loading}
        sx={{
          color: '#ffffff',
          zIndex: (theme) => theme.zIndex.drawer + 999,
          bgcolor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Card
          elevation={24}
          sx={{
            p: 4,
            borderRadius: 4,
            maxWidth: 440,
            width: '90%',
            textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.8)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Animated Top Progress Bar */}
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
            <LinearProgress sx={{ height: 4, bgcolor: '#e0f2fe', '& .MuiLinearProgress-bar': { bgcolor: '#0284c7' } }} />
          </Box>

          {/* Spinner & Pulsing Concentric Rings */}
          <Box sx={{ position: 'relative', display: 'inline-flex', mb: 3, mt: 1 }}>
            <CircularProgress
              size={68}
              thickness={4}
              sx={{
                color: '#0284c7',
                filter: 'drop-shadow(0 4px 8px rgba(2, 132, 199, 0.3))'
              }}
            />
            <CircularProgress
              size={48}
              thickness={3.5}
              sx={{
                color: '#38bdf8',
                position: 'absolute',
                top: 10,
                left: 10,
                animationDuration: '1.2s'
              }}
            />
          </Box>

          <Typography variant="h6" fontWeight="800" sx={{ color: '#0f172a', letterSpacing: '-0.3px', mb: 1 }}>
            Syncing Admin Reports
          </Typography>

          <Typography variant="body2" sx={{ color: '#64748b', mb: 2.5, px: 1, lineHeight: 1.5, fontSize: '0.85rem' }}>
            Fetching real-time updates from Supabase for active collections, RPT, Community Tax, and submitted archives...
          </Typography>

          <Chip
            icon={<Refresh sx={{ fontSize: '14px !important', animation: 'spin 2s linear infinite', '@keyframes spin': { '100%': { transform: 'rotate(360deg)' } } }} />}
            label="Updating Database Records"
            size="small"
            sx={{
              bgcolor: '#e0f2fe',
              color: '#0369a1',
              fontWeight: 700,
              fontSize: '0.73rem',
              border: '1px solid #bae6fd',
              py: 0.5
            }}
          />
        </Card>
      </Backdrop>

      <Notification
        open={notification.open}
        message={notification.message}
        severity={notification.severity}
        onClose={handleCloseNotification}
      />
    </Container>
  );
};
