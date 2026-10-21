import React, { useEffect, useState } from 'react';
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
  Tooltip,
  CircularProgress,
  Tabs,
  Tab,
  Autocomplete,
  TextField,
  Grid,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Divider,
  InputAdornment,
  Collapse
} from '@mui/material';
import { Download, Clear, Print, Search, Send, TaskAlt, History, CheckCircle, Cancel, LockClock, Refresh, KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { 
  getRecentReports, 
  getCollectionEntries, 
  getSignatories, 
  getRPTCollections, 
  getCommunityTaxCollections,
  getAllManagedUsers,
  getSubmittedItemIds,
  saveAdminSubmittedReport,
  getAdminSubmittedReports,
  unmarkAdminSubmittedReport,
  requestUnarchiveReport,
  rejectUnarchiveReport,
  normalizeOrRangeAndCount,
  isCurrentUserAdmin,
  type AdminSubmittedReportRecord,
  type CollectionItem, 
  type ManagedUser 
} from '../services/supabaseService';
import type { RCDReport, Signatory, RPTCollectionItem, CommunityTaxItem } from '../types/rcd';
import { useAuth } from '../context/useAuth';
import { Notification } from '../components/Notification';

const normalizeAf = (af?: string): string => {
  if (!af) return '51';
  const clean = af.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (clean.includes('51')) return '51';
  if (clean.includes('56')) return '56';
  if (clean.includes('0016') || clean.includes('16') || clean.includes('BRF')) return '0016';
  return clean.replace(/^(AFNO|AF)/, '') || clean || '51';
};

const matchAfNo = (itemAf?: string, targetAf?: string): boolean => {
  if (!targetAf) return true;
  if (!itemAf) return normalizeAf(targetAf) === '51';
  return normalizeAf(itemAf) === normalizeAf(targetAf);
};

export const getAfFormType = (raw?: string, defaultCategory: 'general' | 'rpt' | 'ctc' = 'general'): string => {
  if (!raw || !raw.trim()) {
    if (defaultCategory === 'rpt') return 'A.F. NO. 56';
    if (defaultCategory === 'ctc') return 'BRF NO. 0016';
    return 'A.F. NO. 51';
  }

  const clean = raw.trim().toUpperCase();

  if (clean.includes('56') || clean.includes('AF56') || clean.includes('AF 56')) {
    return 'A.F. NO. 56';
  }
  if (clean.includes('BRF') || clean.includes('0016') || clean.includes('CTC')) {
    return 'BRF NO. 0016';
  }
  if (clean.includes('51') || clean.includes('AF51') || clean.includes('AF 51')) {
    return 'A.F. NO. 51';
  }
  if (clean.includes('52') || clean.includes('AF52') || clean.includes('AF 52')) {
    return 'A.F. NO. 52';
  }
  if (clean.includes('53') || clean.includes('AF53') || clean.includes('AF 53')) {
    return 'A.F. NO. 53';
  }
  if (clean.includes('54') || clean.includes('AF54') || clean.includes('AF 54')) {
    return 'A.F. NO. 54';
  }
  if (clean.includes('55') || clean.includes('AF55') || clean.includes('AF 55')) {
    return 'A.F. NO. 55';
  }

  if (/^(A\.?F\.?|BRF)\s*(NO\.?)?\s*\d+/i.test(clean)) {
    return clean;
  }

  if (defaultCategory === 'rpt') return 'A.F. NO. 56';
  if (defaultCategory === 'ctc') return 'BRF NO. 0016';
  return 'A.F. NO. 51';
};

const cleanOrDisplay = (val: string | null | undefined): string => {
  if (!val) return '';
  const str = String(val).trim();
  const stripped = str.replace(/^0+(?=\d)/, '');
  return stripped || str;
};

const isSnapshot = (obj: any): boolean => {
  return Boolean(
    obj && 
    typeof obj === 'object' && 
    !obj._reactName && 
    !obj.nativeEvent && 
    !obj.target && 
    !obj.preventDefault &&
    !obj.stopPropagation
  );
};

const ModernLoadingOverlay: React.FC<{ message?: string }> = ({ message = 'Synchronizing data with Supabase...' }) => {
  return (
    <Box
      sx={{
        py: 7,
        px: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '340px',
        background: 'linear-gradient(135deg, rgba(248, 250, 252, 0.95) 0%, rgba(241, 245, 249, 0.98) 100%)',
        borderRadius: 3,
        border: '1px solid rgba(226, 232, 240, 0.9)',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02)',
        my: 3
      }}
    >
      <Box sx={{ position: 'relative', display: 'inline-flex', mb: 3 }}>
        <CircularProgress
          variant="indeterminate"
          disableShrink
          size={68}
          thickness={4}
          sx={{
            color: '#2563eb',
            animationDuration: '900ms',
          }}
        />
        <Box
          sx={{
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Refresh sx={{ fontSize: 26, color: '#3b82f6', animation: 'spin 2.5s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />
        </Box>
      </Box>

      <Typography
        variant="h6"
        sx={{
          fontWeight: 700,
          color: '#0f172a',
          letterSpacing: '-0.02em',
          mb: 1,
          textAlign: 'center'
        }}
      >
        Loading Collector's Report Data
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: '#10b981',
            boxShadow: '0 0 10px #10b981',
            animation: 'pulse 1.5s infinite',
            '@keyframes pulse': {
              '0%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(16, 185, 129, 0.7)' },
              '70%': { transform: 'scale(1.05)', boxShadow: '0 0 0 8px rgba(16, 185, 129, 0)' },
              '100%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(16, 185, 129, 0)' }
            }
          }}
        />
        <Typography variant="body2" sx={{ color: '#475569', fontWeight: 500 }}>
          {message}
        </Typography>
      </Box>

      <Chip
        label="Supabase Database • Real-time Sync Active"
        size="small"
        sx={{
          backgroundColor: 'rgba(37, 99, 235, 0.08)',
          color: '#2563eb',
          fontWeight: 600,
          fontSize: '0.75rem',
          border: '1px solid rgba(37, 99, 235, 0.2)'
        }}
      />
    </Box>
  );
};

// Helper to extract official municipal signatories for Section D (Treasurer) and Section E (Accountant & Preparer)
export const getSectionSignatories = (sigs: Signatory[], collectorName?: string) => {
  const normColName = (collectorName || '').toLowerCase().trim();

  // 1. Section D: Verification & Acknowledgment - Municipal Treasurer
  const treasurer: Signatory = sigs.find(s => {
    const rem = (s.remarks || '').toLowerCase();
    const pos = (s.position || '').toLowerCase();
    const name = (s.fullName || '').toLowerCase().trim();

    // Must NOT be the collector
    if (rem.includes('certification') || rem.includes("treasurer's office staff")) return false;
    if (pos.includes('revenue collection') || pos === 'collector') return false;
    if (normColName && (name === normColName || name === 'accountable officer')) return false;

    return (
      rem.includes('verification') || 
      rem.includes('acknowledgment') ||
      pos === 'municipal treasurer' || 
      (pos.includes('treasurer') && !pos.includes('staff') && !pos.includes('clerk') && !pos.includes('assistant'))
    );
  }) || { 
    id: 44, 
    fullName: 'MENARD A. HERRERA', 
    position: 'Municipal Treasurer',
    department: 'Office of the Municipal Treasurer',
    remarks: 'Municipal Treasurer / Verification & Acknowledgment'
  };

  // 2. Section E: Certified Correct / Certified by - Municipal Accountant
  const accountant: Signatory = sigs.find(s => {
    const rem = (s.remarks || '').toLowerCase();
    const pos = (s.position || '').toLowerCase();
    const name = (s.fullName || '').toLowerCase().trim();

    // Must NOT be the collector
    if (rem.includes('certification') || rem.includes("treasurer's office staff")) return false;
    if (pos.includes('revenue collection') || pos === 'collector') return false;
    if (normColName && (name === normColName || name === 'accountable officer')) return false;

    return (
      rem.includes('certified') ||
      pos.includes('municipal accountant') ||
      pos.includes('oic-office of the mun. accountant') ||
      pos.includes('mun. accountant') ||
      (pos.includes('accountant') && !pos.includes('staff') && !pos.includes('assistant') && !pos.includes('clerk')) ||
      (rem.includes('accountant') && !rem.includes('staff') && !rem.includes('prepared')) ||
      name.includes('atillano') ||
      name.includes('paz')
    );
  }) || { 
    id: 45, 
    fullName: 'SISTINE F. ATILLANO JR', 
    position: 'SAA I/OIC-Office of the Mun. Accountant',
    department: 'Office of the Municipal Accountant',
    remarks: 'Municipal Accountant / Certified Correct'
  };

  // 3. Section E: Prepared by - Designated Official from Signatories Page (Accounting Staff)
  // CRITICAL: Must NEVER be the collector's name. It must be the official name set in the Signatories Page.
  const preparer: Signatory = 
    // Priority 1: Official signatory matching 'prepared' (excluding accountant, treasurer, and collector)
    sigs.find(s => {
      const rem = (s.remarks || '').toLowerCase();
      const pos = (s.position || '').toLowerCase();
      const name = (s.fullName || '').toLowerCase().trim();

      if (rem.includes('certification') || rem.includes("treasurer's office staff")) return false;
      if (pos.includes('revenue collection') || pos === 'collector') return false;
      if (normColName && (name === normColName || name === 'accountable officer')) return false;
      if (accountant && (s.id === accountant.id || name === accountant.fullName.toLowerCase().trim())) return false;
      if (treasurer && (s.id === treasurer.id || name === treasurer.fullName.toLowerCase().trim())) return false;

      return rem.includes('prepared');
    }) ||
    // Priority 2: Check localStorage official_signatories directly (saved from Signatories Page)
    (() => {
      try {
        const cached = JSON.parse(localStorage.getItem('official_signatories') || '[]');
        const found = cached.find((s: Signatory) => {
          const rem = (s.remarks || '').toLowerCase();
          const name = (s.fullName || '').toLowerCase().trim();
          if (accountant && (s.id === accountant.id || name === accountant.fullName.toLowerCase().trim())) return false;
          if (treasurer && (s.id === treasurer.id || name === treasurer.fullName.toLowerCase().trim())) return false;
          return rem.includes('prepared');
        });
        if (found && found.fullName) return found;
      } catch {}
      return null;
    })() ||
    // Priority 3: Any Accounting Department staff from municipal pool
    sigs.find(s => {
      const rem = (s.remarks || '').toLowerCase();
      const pos = (s.position || '').toLowerCase();
      const dept = (s.department || '').toLowerCase();
      const name = (s.fullName || '').toLowerCase().trim();

      if (rem.includes('certification') || rem.includes("treasurer's office staff")) return false;
      if (pos.includes('revenue collection') || pos === 'collector') return false;
      if (normColName && (name === normColName || name === 'accountable officer')) return false;
      if (accountant && (s.id === accountant.id || name === accountant.fullName.toLowerCase().trim())) return false;
      if (treasurer && (s.id === treasurer.id || name === treasurer.fullName.toLowerCase().trim())) return false;
      if (rem.includes('certified') || pos.includes('municipal accountant') || pos.includes('mun. accountant')) return false;

      return dept.includes('account') || rem.includes('staff') || name.includes('fanoga') || pos.includes('admin assistant');
    }) ||
    // Fallback: Standard designated municipal official
    { 
      id: 46, 
      fullName: 'HESTHER F. FANOGA SR', 
      position: 'Admin Assistant II',
      department: 'Office of the Municipal Accountant',
      remarks: 'Accounting Staff / Prepared by'
    };

  return { treasurer, accountant, preparer };
};

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [, setReports] = useState<RCDReport[]>([]);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [rptCollections, setRptCollections] = useState<RPTCollectionItem[]>([]);
  const [communityTaxCollections, setCommunityTaxCollections] = useState<CommunityTaxItem[]>([]);
  const [filteredCollections, setFilteredCollections] = useState<CollectionItem[]>([]);
  const [filteredRptCollections, setFilteredRptCollections] = useState<RPTCollectionItem[]>([]);
  const [filteredCtcCollections, setFilteredCtcCollections] = useState<CommunityTaxItem[]>([]);
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [submittedReports, setSubmittedReports] = useState<AdminSubmittedReportRecord[]>([]);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [archiveSearchTerm, setArchiveSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStatusMessage, setLoadingStatusMessage] = useState('Fetching active collections, AF & OR ranges from Supabase...');
  const [tabValue, setTabValue] = useState(0);

  // Notification State
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Archive pagination & expanded rows
  const [archivePage, setArchivePage] = useState<number>(0);
  const [archiveRowsPerPage, setArchiveRowsPerPage] = useState<number>(10);
  const [expandedArchiveRows, setExpandedArchiveRows] = useState<Record<string, boolean>>({});

  // Filters
  const [selectedCollectors, setSelectedCollectors] = useState<string[]>([]);
  const [selectedAfNos, setSelectedAfNos] = useState<string[]>([]);
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>([]);
  const [selectedMainCategories, setSelectedMainCategories] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [startOr1, setStartOr1] = useState<string | null>(null);
  const [endOr1, setEndOr1] = useState<string | null>(null);
  const [startOr2, setStartOr2] = useState<string | null>(null);
  const [endOr2, setEndOr2] = useState<string | null>(null);

  const [rptStartOr1, setRptStartOr1] = useState<string | null>(null);
  const [rptEndOr1, setRptEndOr1] = useState<string | null>(null);
  const [rptFilterAf56Id, setRptFilterAf56Id] = useState<string | null>(null);
  const [rptStartDate, setRptStartDate] = useState<string>('');
  const [rptEndDate, setRptEndDate] = useState<string>('');

  const [ctcStartOr1, setCtcStartOr1] = useState<string | null>(null);
  const [ctcEndOr1, setCtcEndOr1] = useState<string | null>(null);
  const [ctcFilterBookletNo, setCtcFilterBookletNo] = useState<string | null>(null);
  const [ctcFilterType, setCtcFilterType] = useState<string>('ALL');
  const [ctcFilterBarangay, setCtcFilterBarangay] = useState<string | null>(null);
  const [ctcStartDate, setCtcStartDate] = useState<string>('');
  const [ctcEndDate, setCtcEndDate] = useState<string>('');

  // Filter submitted reports to show ALL reports for Admin, or only my reports for Collector
  const mySubmittedReports = React.useMemo(() => {
    return submittedReports.filter(r => {
      // Exclude Admin Master Consolidation reports from Collector archive
      if (r.reportType === 'admin_consolidation' || r.reportNumber?.startsWith('ADM-') || r.submittedBy === 'Administrator') {
        return false;
      }

      // If current user is Admin, cover ALL submitted reports from ALL collectors!
      if (isCurrentUserAdmin()) {
        return true;
      }

      if (!user) return true;

      const currentUserId = user.id ? String(user.id).trim().toLowerCase() : '';
      const currentUserEmail = user.email ? user.email.trim().toLowerCase() : '';
      const currentUserName = user.name ? user.name.trim().toLowerCase() : '';

      const rUserId = r.userId ? String(r.userId).trim().toLowerCase() : '';
      const rEmail = r.collectorEmail ? r.collectorEmail.trim().toLowerCase() : '';
      const rCollectorName = r.collectorName ? r.collectorName.trim().toLowerCase() : '';
      const rSubmittedBy = r.submittedBy ? r.submittedBy.trim().toLowerCase() : '';

      // Check for matching user ID
      if (currentUserId && rUserId && currentUserId === rUserId) {
        return true;
      }

      // Check for matching email
      if (currentUserEmail && rEmail && currentUserEmail === rEmail) {
        return true;
      }

      // Check for matching name (collectorName or submittedBy)
      if (currentUserName) {
        if (rCollectorName && rCollectorName === currentUserName) return true;
        if (rSubmittedBy && rSubmittedBy === currentUserName) return true;
      }

      // If user info exists but none matched, this report belongs to another user
      if (currentUserId || currentUserEmail || currentUserName) {
        return false;
      }

      return true;
    });
  }, [submittedReports, user]);

  // Group user's submitted reports by base report control number (e.g. 26-09-0001)
  const groupedArchiveReports = React.useMemo(() => {
    interface GroupedArchivedReport {
      baseReportNumber: string;
      collectorName: string;
      dateFrom: string;
      dateTo: string;
      afNo: string;
      combinedOrRange: string;
      totalOrCount: number;
      totalAmount: number;
      status: string;
      unarchiveStatus?: string;
      reports: AdminSubmittedReportRecord[];
    }

    const groups: Record<string, GroupedArchivedReport> = {};

    mySubmittedReports.forEach(r => {
      const baseKey = r.baseReportNumber || (r.reportNumber || '').replace(/[-_][AB]$/i, '');
      if (!groups[baseKey]) {
        groups[baseKey] = {
          baseReportNumber: baseKey,
          collectorName: r.collectorName,
          dateFrom: r.dateFrom,
          dateTo: r.dateTo,
          afNo: r.afNo,
          combinedOrRange: '',
          totalOrCount: 0,
          totalAmount: 0,
          status: r.status,
          unarchiveStatus: r.unarchiveStatus,
          reports: []
        };
      }
      groups[baseKey].reports.push(r);
    });

    Object.values(groups).forEach(g => {
      g.reports.sort((a, b) => (a.subReportSuffix || '').localeCompare(b.subReportSuffix || ''));
      g.totalOrCount = g.reports.reduce((sum, r) => sum + (normalizeOrRangeAndCount(r.orRange, r.orNumbers, r.orCount).orCount), 0);
      g.totalAmount = g.reports.reduce((sum, r) => sum + (r.totalAmount || 0), 0);

      const rangeStrs = g.reports.map(r => {
        if (r.subReportSuffix) {
          return `Range ${r.subReportSuffix}: ${r.orRange}`;
        }
        return r.orRange;
      });
      g.combinedOrRange = rangeStrs.join(' | ');

      const datesFrom = g.reports.map(r => r.dateFrom).filter(Boolean).sort();
      const datesTo = g.reports.map(r => r.dateTo).filter(Boolean).sort();
      if (datesFrom.length > 0) g.dateFrom = datesFrom[0];
      if (datesTo.length > 0) g.dateTo = datesTo[datesTo.length - 1];

      const pendingChild = g.reports.find(r => r.status === 'Pending Admin Approval' || r.unarchiveStatus === 'Pending Admin Approval');
      if (pendingChild) {
        g.status = 'Pending Admin Approval';
        g.unarchiveStatus = 'Pending Admin Approval';
      }
    });

    return Object.values(groups);
  }, [mySubmittedReports]);

  // Apply search filtering on grouped submitted reports
  const filteredGroupedArchiveReports = React.useMemo(() => {
    if (!archiveSearchTerm.trim()) return groupedArchiveReports;
    const term = archiveSearchTerm.toLowerCase();
    return groupedArchiveReports.filter(g =>
      g.baseReportNumber.toLowerCase().includes(term) ||
      g.collectorName.toLowerCase().includes(term) ||
      g.afNo.toLowerCase().includes(term) ||
      g.combinedOrRange.toLowerCase().includes(term) ||
      g.reports.some(r => (r.reportNumber || '').toLowerCase().includes(term) || (r.orRange || '').toLowerCase().includes(term))
    );
  }, [groupedArchiveReports, archiveSearchTerm]);

  // Print Certification Modal State
  const [printDialogOpen, setPrintDialogOpen] = useState<boolean>(false);
  const [printTarget, setPrintTarget] = useState<'COLLECTIONS' | 'RPT_GENERAL' | 'RPT_SEF' | 'COMMUNITY_TAX' | null>(null);
  const [selectedUserDropdownId, setSelectedUserDropdownId] = useState<string>('current');
  const [certAccountableName, setCertAccountableName] = useState<string>('');
  const [certPosition, setCertPosition] = useState<string>('');

  // Submit Report Modal State
  const [submitDialogOpen, setSubmitDialogOpen] = useState<boolean>(false);
  const [submitReportNumber, setSubmitReportNumber] = useState<string>('');
  const [submitScope, setSubmitScope] = useState<'CURRENT' | 'ALL'>('CURRENT');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadAllData = async (customMsg?: string) => {
    setIsLoading(true);
    setLoadingStatusMessage(customMsg || 'Fetching active collections, AF & OR ranges from Supabase...');
    try {
      const [reportsData, collectionsData, signatoriesData, rptData, usersData, ctcData, submittedKeysSet, submittedReportsData] = await Promise.all([
        getRecentReports(),
        getCollectionEntries(),
        getSignatories(),
        getRPTCollections(),
        getAllManagedUsers(),
        getCommunityTaxCollections(),
        getSubmittedItemIds(),
        getAdminSubmittedReports()
      ]);

      setReports(reportsData);
      setSignatories(signatoriesData);
      setManagedUsers(usersData);
      setSubmittedReports(submittedReportsData);

      // Filter active collections to exclude submitted items
      const activeCollections = collectionsData.filter(item => {
        if (submittedKeysSet.has(`general_${item.id}`)) return false;
        if (item.orNo) {
          const cleanOr = String(item.orNo).trim();
          if (
            submittedKeysSet.has(`or_${item.afNo}_${cleanOr}`) ||
            submittedKeysSet.has(`or_A.F. NO. 51_${cleanOr}`) ||
            submittedKeysSet.has(`or_AF51_${cleanOr}`) ||
            submittedKeysSet.has(`or_51_${cleanOr}`) ||
            (item.afNo && submittedKeysSet.has(`or_${item.afNo.replace(/[^a-zA-Z0-9]/g, '')}_${cleanOr}`))
          ) return false;
        }
        return true;
      });

      const activeRptCollections = rptData.filter(item => {
        if (submittedKeysSet.has(`rpt_${item.id}`)) return false;
        if (item.orNumber) {
          const cleanOr = String(item.orNumber).trim();
          if (
            submittedKeysSet.has(`or_A.F. NO. 56_${cleanOr}`) ||
            submittedKeysSet.has(`or_${item.af56Id}_${cleanOr}`) ||
            submittedKeysSet.has(`or_AF56_${cleanOr}`) ||
            submittedKeysSet.has(`or_56_${cleanOr}`) ||
            (item.af56Id && submittedKeysSet.has(`or_${item.af56Id.replace(/[^a-zA-Z0-9]/g, '')}_${cleanOr}`))
          ) return false;
        }
        return true;
      });

      const activeCtcCollections = ctcData.filter(item => {
        if (submittedKeysSet.has(`ctc_${item.id}`)) return false;
        if (item.ctcNo) {
          const cleanOr = String(item.ctcNo).trim();
          if (
            submittedKeysSet.has(`or_BRF NO. 0016_${cleanOr}`) ||
            submittedKeysSet.has(`or_BRF 0016_${cleanOr}`) ||
            submittedKeysSet.has(`or_0016_${cleanOr}`) ||
            (item.bookletNo && submittedKeysSet.has(`or_${item.bookletNo}_${cleanOr}`))
          ) return false;
        }
        return true;
      });

      const isAdmin = isCurrentUserAdmin();

      if (isAdmin) {
        setCollections(collectionsData);
        setFilteredCollections(collectionsData);
        setRptCollections(rptData);
        setFilteredRptCollections(rptData);
        setCommunityTaxCollections(ctcData);
        setFilteredCtcCollections(ctcData);
      } else {
        setCollections(activeCollections);
        setFilteredCollections(activeCollections);
        setRptCollections(activeRptCollections);
        setFilteredRptCollections(activeRptCollections);
        setCommunityTaxCollections(activeCtcCollections);
        setFilteredCtcCollections(activeCtcCollections);
      }
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();

    const handleFocus = () => {
      loadAllData();
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const getSubmittedCollectorName = (item: any): string => {
    if (!item) return 'Revenue Collector';
    if (item.collectorName && item.collectorName !== 'Collector') return item.collectorName;
    const emailKey = (item.collectorEmail || '').toLowerCase().trim();
    const uidKey = (item.userId || '').toLowerCase().trim();
    const matchedUser = managedUsers.find(u => 
      (u.email && u.email.toLowerCase().trim() === emailKey) ||
      (u.id && u.id.toLowerCase().trim() === uidKey)
    );
    if (matchedUser) {
      return matchedUser.fullName || `${matchedUser.firstName || ''} ${matchedUser.lastName || ''}`.trim() || matchedUser.email;
    }
    return item.collectorEmail || item.userId || 'Revenue Collector';
  };

  const uniqueCollectors = React.useMemo(() => {
    const set = new Set<string>();
    collections.forEach(c => {
      const name = getSubmittedCollectorName(c);
      if (name) set.add(name);
    });
    rptCollections.forEach(c => {
      const name = getSubmittedCollectorName(c);
      if (name) set.add(name);
    });
    communityTaxCollections.forEach(c => {
      const name = getSubmittedCollectorName(c);
      if (name) set.add(name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [collections, rptCollections, communityTaxCollections, managedUsers]);

  // Base collections before applying OR range filtering (used for OR range dropdown options)
  const collectionsForOrPicker = React.useMemo(() => {
    let result = collections;

    if (selectedCollectors.length > 0) {
      result = result.filter(item => {
        const cName = getSubmittedCollectorName(item);
        return selectedCollectors.some(sc => sc === cName || (item.collectorEmail || '').toLowerCase().includes(sc.toLowerCase()));
      });
    }

    if (selectedAfNos.length > 0) {
      result = result.filter(item => selectedAfNos.some(af => matchAfNo(item.afNo, af)));
    }

    if (selectedSubCategories.length > 0) {
      result = result.filter(item => selectedSubCategories.includes(item.subCategory));
    }

    if (selectedMainCategories.length > 0) {
      result = result.filter(item => selectedMainCategories.includes(item.mainCategory));
    }

    if (startDate) {
      result = result.filter(item => {
        const itemDate = new Date(item.date);
        const start = new Date(startDate);
        return itemDate >= start;
      });
    }

    if (endDate) {
      result = result.filter(item => {
        const itemDate = new Date(item.date);
        const end = new Date(endDate);
        return itemDate <= end;
      });
    }

    return result;
  }, [collections, selectedCollectors, selectedAfNos, selectedSubCategories, selectedMainCategories, startDate, endDate, managedUsers]);

  // Filter Logic for table display
  useEffect(() => {
    let result = collectionsForOrPicker;

    if ((startOr1 && endOr1) || (startOr2 && endOr2)) {
      result = result.filter(item => {
        if (!item.orNo) return false;
        
        const checkRange = (startStr: string, endStr: string) => {
          const itemOr = parseInt(item.orNo, 10);
          const start = parseInt(startStr, 10);
          const end = parseInt(endStr, 10);
          
          if (!isNaN(itemOr) && !isNaN(start) && !isNaN(end)) {
            return itemOr >= start && itemOr <= end;
          }
          return item.orNo >= startStr && item.orNo <= endStr;
        };

        const inRange1 = (startOr1 && endOr1) ? checkRange(startOr1, endOr1) : false;
        const inRange2 = (startOr2 && endOr2) ? checkRange(startOr2, endOr2) : false;
        
        return inRange1 || inRange2;
      });
    }

    setFilteredCollections(result);
    setPage(0);
  }, [collectionsForOrPicker, startOr1, endOr1, startOr2, endOr2]);

  const uniqueAfNos = React.useMemo(() => {
    const afSet = new Set<string>();
    collections.forEach(c => {
      if (c.afNo && c.afNo.trim()) afSet.add(c.afNo.trim());
    });
    if (afSet.size === 0) afSet.add('A.F. NO. 51');
    return Array.from(afSet).sort();
  }, [collections]);

  const uniqueSubCategories = Array.from(new Set(collections.map(c => c.subCategory).filter(Boolean))).sort();
  const uniqueMainCategories = Array.from(new Set(collections.map(c => c.mainCategory).filter(Boolean))).sort();

  // RPT Filter Logic
  useEffect(() => {
    let result = rptCollections;

    if (selectedCollectors.length > 0) {
      result = result.filter(item => {
        const cName = getSubmittedCollectorName(item);
        return selectedCollectors.some(sc => sc === cName || (item.collectorEmail || '').toLowerCase().includes(sc.toLowerCase()));
      });
    }

    if (rptFilterAf56Id) {
      result = result.filter(item => matchAfNo(item.af56Id || (item as any).afNo || '56', rptFilterAf56Id));
    }

    if (rptStartDate) {
      result = result.filter(item => item.date >= rptStartDate);
    }

    if (rptEndDate) {
      result = result.filter(item => item.date <= rptEndDate);
    }

    if (rptStartOr1 && rptEndOr1) {
      const start = parseInt(rptStartOr1, 10);
      const end = parseInt(rptEndOr1, 10);
      result = result.filter(item => {
        if (!item.orNumber) return false;
        const itemOr = parseInt(item.orNumber, 10);
        if (!isNaN(itemOr) && !isNaN(start) && !isNaN(end)) {
          return itemOr >= Math.min(start, end) && itemOr <= Math.max(start, end);
        }
        return item.orNumber >= rptStartOr1 && item.orNumber <= rptEndOr1;
      });
    }

    setFilteredRptCollections(result);
    // Only reset page if we are on the RPT tab
    if (tabValue === 1) {
      setPage(0);
    }
  }, [rptCollections, selectedCollectors, rptFilterAf56Id, rptStartDate, rptEndDate, rptStartOr1, rptEndOr1, tabValue, managedUsers]);

  const uniqueRptAf56Ids = React.useMemo(() => {
    const rptSet = new Set<string>();
    rptCollections.forEach(c => {
      if (c.af56Id && c.af56Id.trim()) rptSet.add(c.af56Id.trim());
      if ((c as any).afNo && String((c as any).afNo).trim()) rptSet.add(String((c as any).afNo).trim());
    });
    if (rptSet.size === 0) rptSet.add('A.F. NO. 56');
    return Array.from(rptSet).sort();
  }, [rptCollections]);

  // Calculate valid RPT ORs from active RPT collections
  const validRptOrs = React.useMemo(() => {
    const targetRpt = filteredRptCollections.length > 0 ? filteredRptCollections : rptCollections;
    let filtered = targetRpt;
    if (rptFilterAf56Id) {
      filtered = targetRpt.filter(c => matchAfNo(c.af56Id || (c as any).afNo || '56', rptFilterAf56Id));
    }
    const ors = filtered
      .map(c => c.orNumber)
      .filter((or): or is string => Boolean(or));
      
    return Array.from(new Set(ors)).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b, undefined, { numeric: true });
    });
  }, [filteredRptCollections, rptCollections, rptFilterAf56Id]);

  const validRptEndOr1Options = React.useMemo(() => {
    if (!rptStartOr1) return validRptOrs;
    const idx = validRptOrs.indexOf(rptStartOr1);
    if (idx === -1) return validRptOrs;
    return validRptOrs.slice(idx);
  }, [validRptOrs, rptStartOr1]);

  // Reset RPT OR selection when AF56 ID changes
  useEffect(() => {
    setRptStartOr1(null);
    setRptEndOr1(null);
  }, [rptFilterAf56Id]);



  // Calculate valid ORs for General collections from all available items in current AF / category / date filters
  const validOrs = React.useMemo(() => {
    const ors = collectionsForOrPicker
      .map(c => c.orNo)
      .filter((or): or is string => Boolean(or));

    return Array.from(new Set(ors)).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b, undefined, { numeric: true });
    });
  }, [collectionsForOrPicker]);

  // Option lists for OR 1 and OR 2 fields enforcing range continuation
  const validEndOr1Options = React.useMemo(() => {
    if (!startOr1) return validOrs;
    const startIndex = validOrs.indexOf(startOr1);
    if (startIndex === -1) return validOrs;
    return validOrs.slice(startIndex);
  }, [validOrs, startOr1]);

  const validStartOr2Options = React.useMemo(() => {
    if (endOr1) {
      const endIndex = validOrs.indexOf(endOr1);
      if (endIndex === -1) return validOrs;
      return validOrs.slice(endIndex + 1);
    }
    if (startOr1) {
      const startIndex = validOrs.indexOf(startOr1);
      if (startIndex === -1) return validOrs;
      return validOrs.slice(startIndex + 1);
    }
    return validOrs;
  }, [validOrs, endOr1, startOr1]);

  const validEndOr2Options = React.useMemo(() => {
    if (startOr2) {
      const start2Index = validOrs.indexOf(startOr2);
      if (start2Index === -1) return validStartOr2Options;
      return validOrs.slice(start2Index);
    }
    return validStartOr2Options;
  }, [validOrs, startOr2, validStartOr2Options]);

  // Reset OR selection if selected OR values are no longer present in validOrs
  useEffect(() => {
    if (startOr1 && !validOrs.includes(startOr1)) setStartOr1(null);
    if (endOr1 && !validOrs.includes(endOr1)) setEndOr1(null);
    if (startOr2 && !validOrs.includes(startOr2)) setStartOr2(null);
    if (endOr2 && !validOrs.includes(endOr2)) setEndOr2(null);
  }, [validOrs, startOr1, endOr1, startOr2, endOr2]);

  // Validate Start OR 2 when End OR 1 changes without forcing auto-fill of OR2
  useEffect(() => {
    if (endOr1 && validOrs.length > 0) {
      const currentIndex = validOrs.indexOf(endOr1);
      if (startOr2) {
        const start2Index = validOrs.indexOf(startOr2);
        if (start2Index !== -1 && start2Index <= currentIndex) {
          setStartOr2(null);
          setEndOr2(null);
        }
      }
    }
  }, [endOr1, validOrs, startOr2]);

  const totalFilteredAmount = filteredCollections.reduce((sum, item) => sum + (item.amount || 0), 0);

  // Community Tax Filter Logic
  useEffect(() => {
    let result = communityTaxCollections;

    if (selectedCollectors.length > 0) {
      result = result.filter(item => {
        const cName = getSubmittedCollectorName(item);
        return selectedCollectors.some(sc => sc === cName || (item.collectorEmail || '').toLowerCase().includes(sc.toLowerCase()));
      });
    }

    if (ctcFilterBookletNo) {
      result = result.filter(item => {
        const itemBooklet = item.bookletNo || item.afNo || '';
        return itemBooklet === ctcFilterBookletNo || matchAfNo(itemBooklet, ctcFilterBookletNo);
      });
    }

    if (ctcFilterType !== 'ALL') {
      result = result.filter(item => (item.gender || 'Male') === ctcFilterType);
    }

    if (ctcFilterBarangay) {
      result = result.filter(item => item.barangay === ctcFilterBarangay);
    }

    if (ctcStartDate) {
      result = result.filter(item => item.date >= ctcStartDate);
    }

    if (ctcEndDate) {
      result = result.filter(item => item.date <= ctcEndDate);
    }

    if (ctcStartOr1 && ctcEndOr1) {
      const start = parseInt(ctcStartOr1.replace(/\D/g, ''), 10);
      const end = parseInt(ctcEndOr1.replace(/\D/g, ''), 10);
      result = result.filter(item => {
        if (!item.ctcNo) return false;
        const num = parseInt(item.ctcNo.replace(/\D/g, ''), 10);
        if (!isNaN(num) && !isNaN(start) && !isNaN(end)) {
          return num >= Math.min(start, end) && num <= Math.max(start, end);
        }
        return item.ctcNo >= ctcStartOr1 && item.ctcNo <= ctcEndOr1;
      });
    }

    setFilteredCtcCollections(result);
    if (tabValue === 2) {
      setPage(0);
    }
  }, [communityTaxCollections, selectedCollectors, ctcFilterBookletNo, ctcFilterType, ctcFilterBarangay, ctcStartDate, ctcEndDate, ctcStartOr1, ctcEndOr1, tabValue, managedUsers]);

  const uniqueCtcBookletNos = React.useMemo(() => {
    const bookletSet = new Set<string>();
    communityTaxCollections.forEach(c => {
      const b = c.bookletNo || (c as any).afNo;
      if (b && b.trim()) bookletSet.add(b.trim());
    });
    if (bookletSet.size === 0) bookletSet.add('BRF NO. 0016');
    return Array.from(bookletSet).sort();
  }, [communityTaxCollections]);

  const validCtcOrs = React.useMemo(() => {
    const ors = communityTaxCollections
      .map(c => c.ctcNo)
      .filter(Boolean);
    return Array.from(new Set(ors)).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10);
      const numB = parseInt(b.replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [communityTaxCollections]);

  // Calculate Summaries for RCD Summaries Tab
  const afNoSummary = React.useMemo(() => {
    const summary: { [key: string]: number } = {};
    collections.forEach(item => {
      const afNo = item.afNo || 'Unspecified';
      summary[afNo] = (summary[afNo] || 0) + (item.amount || 0);
    });
    if (rptCollections.length > 0) {
      const totalRpt = rptCollections.reduce((s, i) => s + (i.amount || 0), 0);
      summary['A.F. NO. 56'] = (summary['A.F. NO. 56'] || 0) + totalRpt;
    }
    if (communityTaxCollections.length > 0) {
      const totalCtc = communityTaxCollections.reduce((s, i) => s + (i.amount || 0), 0);
      summary['BRF NO. 0016'] = (summary['BRF NO. 0016'] || 0) + totalCtc;
    }
    return Object.entries(summary)
      .map(([afNo, amount]) => ({ afNo, amount }))
      .sort((a, b) => a.afNo.localeCompare(b.afNo));
  }, [collections, rptCollections, communityTaxCollections]);

  const monthlySummary = React.useMemo(() => {
    const summary: { [key: string]: number } = {};
    const addDate = (dStr?: string, amt?: number) => {
      if (!dStr) return;
      const date = new Date(dStr);
      if (isNaN(date.getTime())) return;
      const monthYear = date.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
      summary[monthYear] = (summary[monthYear] || 0) + (amt || 0);
    };

    collections.forEach(item => addDate(item.date, item.amount));
    rptCollections.forEach(item => addDate(item.date, item.amount));
    communityTaxCollections.forEach(item => addDate(item.date, item.amount));

    return Object.entries(summary)
      .map(([monthYear, amount]) => ({ monthYear, amount }))
      .sort((a, b) => {
        const dateA = new Date(a.monthYear);
        const dateB = new Date(b.monthYear);
        return dateB.getTime() - dateA.getTime();
      });
  }, [collections, rptCollections, communityTaxCollections]);

  const subCategorySummary = React.useMemo(() => {
    const summary: { [key: string]: number } = {};
    collections.forEach(item => {
      const subCat = item.subCategory || 'Unspecified';
      summary[subCat] = (summary[subCat] || 0) + (item.amount || 0);
    });
    if (rptCollections.length > 0) {
      const totalRpt = rptCollections.reduce((s, i) => s + (i.amount || 0), 0);
      summary['Real Property Tax - Basic'] = (summary['Real Property Tax - Basic'] || 0) + (totalRpt / 2);
      summary['Special Education Tax (SEF)'] = (summary['Special Education Tax (SEF)'] || 0) + (totalRpt / 2);
    }
    communityTaxCollections.forEach(item => {
      const penalty = item.penalty || 0;
      const basic = Math.max(0, (item.amount || 0) - penalty);
      if (basic > 0 || penalty === 0) {
        summary['Community Tax'] = (summary['Community Tax'] || 0) + basic;
      }
      if (penalty > 0) {
        summary['Surcharge-CTC'] = (summary['Surcharge-CTC'] || 0) + penalty;
      }
    });
    return Object.entries(summary)
      .map(([subCategory, amount]) => ({ subCategory, amount }))
      .sort((a, b) => a.subCategory.localeCompare(b.subCategory));
  }, [collections, rptCollections, communityTaxCollections]);

  const mainCategorySummary = React.useMemo(() => {
    const summary: { [key: string]: number } = {};
    collections.forEach(item => {
      const mainCat = item.mainCategory || 'Unspecified';
      summary[mainCat] = (summary[mainCat] || 0) + (item.amount || 0);
    });
    if (rptCollections.length > 0) {
      const totalRpt = rptCollections.reduce((s, i) => s + (i.amount || 0), 0);
      summary['Tax Revenue'] = (summary['Tax Revenue'] || 0) + totalRpt;
    }
    if (communityTaxCollections.length > 0) {
      const totalCtc = communityTaxCollections.reduce((s, i) => s + (i.amount || 0), 0);
      summary['Tax Revenue'] = (summary['Tax Revenue'] || 0) + totalCtc;
    }
    return Object.entries(summary)
      .map(([mainCategory, amount]) => ({ mainCategory, amount }))
      .sort((a, b) => a.mainCategory.localeCompare(b.mainCategory));
  }, [collections, rptCollections, communityTaxCollections]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setPage(0);
    loadAllData();
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handlePrintCover = (snapshot?: any) => {
    const isSnap = isSnapshot(snapshot);
    const snap = isSnap ? snapshot : undefined;

    const dataCollections = (snap?.filteredCollections && Array.isArray(snap.filteredCollections))
      ? snap.filteredCollections 
      : (filteredCollections || []);

    if (dataCollections.length === 0 && !snap) {
      setNotification({
        open: true,
        message: 'No collection records found to print cover.',
        severity: 'warning'
      });
      return;
    }

    const afList = (snap?.selectedAfNos && Array.isArray(snap.selectedAfNos) && snap.selectedAfNos.length > 0) ? snap.selectedAfNos : (selectedAfNos || []);
    const afNo = snap?.afNo || snap?.filterBookletNo || (afList.length === 1 ? afList[0] : 'A.F. NO. 51');

    let sOr1 = snap?.startOr1 !== undefined ? snap.startOr1 : startOr1;
    let eOr1 = snap?.endOr1 !== undefined ? snap.endOr1 : endOr1;
    let sOr2 = snap?.startOr2 !== undefined ? snap.startOr2 : startOr2;
    let eOr2 = snap?.endOr2 !== undefined ? snap.endOr2 : endOr2;

    const sourceDataset = (snap && Array.isArray(snap.filteredCollections))
      ? snap.filteredCollections 
      : ((Array.isArray(collectionsForOrPicker) && collectionsForOrPicker.length > 0) ? collectionsForOrPicker : dataCollections);

    const afFilteredData = (afList.length === 1 && Array.isArray(sourceDataset))
      ? sourceDataset.filter((item: CollectionItem) => matchAfNo(item?.afNo, afNo))
      : sourceDataset;

    const targetDataset = (Array.isArray(afFilteredData) && afFilteredData.length > 0) 
      ? afFilteredData 
      : (Array.isArray(sourceDataset) ? sourceDataset : []);

    // Helper to get sorted ORs from dataset
    const getSortedOrs = (dataset: CollectionItem[]) => {
      const ors = dataset
        .map(item => item.orNo)
        .filter((or): or is string => Boolean(or));
      return Array.from(new Set(ors)).sort((a, b) => {
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b, undefined, { numeric: true });
      });
    };

    const allOrs = getSortedOrs(targetDataset);

    // Determine 1st set of ORs (Range 1) and 2nd set of ORs (Range 2)
    if (sOr1 && eOr1 && sOr2 && eOr2) {
      // User explicitly specified all 4 bounds for Range 1 and Range 2
    } else if (sOr1 && eOr1 && !sOr2 && !eOr2) {
      // User explicitly specified ONLY Range 1 (OR1 set). Keep Range 2 empty!
      sOr2 = null;
      eOr2 = null;
    } else if (sOr1 && eOr1 && sOr2 && !eOr2) {
      if (allOrs.length > 0) {
        eOr2 = allOrs[allOrs.length - 1];
      }
    } else if (!sOr1 && !eOr1 && !sOr2 && !eOr2) {
      // User specified NO ranges. Default Range 1 to cover all ORs in dataset!
      if (allOrs.length > 0) {
        sOr1 = allOrs[0];
        eOr1 = allOrs[allOrs.length - 1];
        sOr2 = null;
        eOr2 = null;
      }
    } else {
      if (sOr1 && !eOr1) eOr1 = sOr1;
      if (sOr2 && !eOr2) eOr2 = allOrs.length > 0 ? allOrs[allOrs.length - 1] : sOr2;
    }

    const filterByRange = (sOr: string | null, eOr: string | null) => {
      if (!sOr || !eOr) return [];
      return targetDataset.filter((item: CollectionItem) => {
        if (!item.orNo) return false;
        
        const itemOr = parseInt(item.orNo, 10);
        const start = parseInt(sOr, 10);
        const end = parseInt(eOr, 10);
        
        if (!isNaN(itemOr) && !isNaN(start) && !isNaN(end)) {
          return itemOr >= start && itemOr <= end;
        }
        return item.orNo >= sOr && item.orNo <= eOr;
      });
    };

    const range1Data = (sOr1 && eOr1) ? filterByRange(sOr1, eOr1) : targetDataset;
    const range2Data = (sOr2 && eOr2) ? filterByRange(sOr2, eOr2) : [];

    const calculateSummary = (data: CollectionItem[]) => {
      const summary: { [key: string]: number } = {};
      let total = 0;
      data.forEach(item => {
        const subCat = item.subCategory || 'Unspecified';
        summary[subCat] = (summary[subCat] || 0) + (item.amount || 0);
        total += (item.amount || 0);
      });
      return {
        summary: Object.entries(summary)
          .map(([subCategory, amount]) => ({ subCategory, amount }))
          .filter(item => item.amount !== 0)
          .sort((a, b) => a.subCategory.localeCompare(b.subCategory)),
        total
      };
    };

    const r1 = calculateSummary(range1Data);
    const r2 = calculateSummary(range2Data);

    const getDstItems = (data: CollectionItem[]) => {
      return data
        .filter(item => item.subCategory === 'DST')
        .sort((a, b) => {
          const orA = parseInt(a.orNo || '0', 10);
          const orB = parseInt(b.orNo || '0', 10);
          return orA - orB;
        });
    };

    const r1DstItems = getDstItems(range1Data);
    const r2DstItems = getDstItems(range2Data);

    const printContent = (
      _rangeLabel: string, 
      start: string | null, 
      end: string | null, 
      data: { summary: { subCategory: string; amount: number }[]; total: number }, 
      dstItems: CollectionItem[],
      isSecondColumnEmpty: boolean = false
    ) => {
      if (isSecondColumnEmpty) {
        return `
        <div class="column">
          <div class="section center-text">
            <div class="label">OR Numbers (Range 2)</div>
            <div class="value">-</div>
          </div>
          
          <div class="section center-text">
            <div class="label">AMOUNT</div>
            <div class="value">₱ 0.00</div>
          </div>

          <div class="section">
            <div class="header-box">GENERAL FUND</div>
            <table class="summary-table">
              <tbody>
                <tr>
                  <td style="color: #999; text-align: center; padding: 15px 0;">(No Range 2 Selected)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        `;
      }

      const dstSection = dstItems.length > 0 ? `
        <div class="section">
          <div class="header-box">DST Details</div>
          <table class="summary-table">
            <thead>
              <tr>
                <th style="text-align: left; border-bottom: 1px solid #eee;">Date</th>
                <th style="text-align: left; border-bottom: 1px solid #eee;">OR Number</th>
                <th style="text-align: right; border-bottom: 1px solid #eee;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${dstItems.map(item => `
                <tr>
                  <td>${item.date ? new Date(item.date).toLocaleDateString('en-PH') : '-'}</td>
                  <td>${item.orNo}</td>
                  <td class="text-right">₱ ${(item.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="2">Total</td>
                <td class="text-right">₱ ${dstItems.reduce((sum, item) => sum + (item.amount || 0), 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ` : '';

      return `
      <div class="column">
        <div class="section center-text">
          <div class="label">${_rangeLabel === 'Range 2' ? 'OR NUMBERS (RANGE 2)' : 'OR NUMBERS'}</div>
          <div class="value">${start || 'N/A'} - ${end || 'N/A'}</div>
        </div>
        
        <div class="section center-text">
          <div class="label">AMOUNT</div>
          <div class="value">₱ ${data.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
        </div>

        <div class="section">
          <div class="header-box">GENERAL FUND</div>
          <table class="summary-table">
            <tbody>
              ${data.summary.map(item => `
                <tr>
                  <td>${item.subCategory}</td>
                  <td class="text-right">₱ ${item.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td>Total</td>
                <td class="text-right">₱ ${data.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>
        ${dstSection}
      </div>
    `;
    };

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Cover - ${afNo}</title>
            <style>
              @page { size: Letter portrait; margin: 0.5in; }
              body { font-family: Arial, sans-serif; margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
              .container { display: flex; width: 100%; min-height: 100vh; box-sizing: border-box; }
              .column { flex: 1; width: 50%; padding: 0 20px; box-sizing: border-box; }
              .column:first-child { border-right: 1px dashed #999; }
              .section { margin-bottom: 25px; }
              .center-text { text-align: center; }
              .label { font-size: 13px; font-weight: bold; color: #555; text-transform: uppercase; margin-bottom: 4px; }
              .value { font-size: 18px; font-weight: bold; text-decoration: underline; color: #000; }
              .header-box { 
                background-color: #f0f0f0; 
                padding: 8px 12px; 
                text-align: center; 
                font-weight: bold; 
                font-size: 14px;
                border: 1px solid #000;
                margin-bottom: 12px;
                text-transform: uppercase;
              }
              .summary-table { width: 100%; border-collapse: collapse; font-size: 13px; }
              .summary-table td, .summary-table th { padding: 6px 4px; border-bottom: 1px solid #eee; }
              .summary-table .text-right { text-align: right; }
              .summary-table .total-row td { font-weight: bold; border-top: 1px solid #000; border-bottom: none; padding-top: 8px; }
            </style>
          </head>
          <body>
            <div class="container">
              ${printContent('Range 1', sOr1, eOr1, r1, r1DstItems, false)}
              ${printContent('Range 2', sOr2, eOr2, r2, r2DstItems, !sOr2 || !eOr2)}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  // Submit Report Modal Open Handler
  const handleOpenSubmitDialog = async () => {
    let count = 0;
    if (tabValue === 0) count = filteredCollections.length;
    else if (tabValue === 1) count = filteredRptCollections.length;
    else if (tabValue === 2) count = filteredCtcCollections.length;
    else count = filteredCollections.length + filteredRptCollections.length + filteredCtcCollections.length;

    if (count === 0 && collections.length === 0 && rptCollections.length === 0 && communityTaxCollections.length === 0) {
      setNotification({
        open: true,
        message: 'No active collection records available to submit.',
        severity: 'warning'
      });
      return;
    }

    let maxSeq = 0;
    const now = new Date();
    const currentYy = String(now.getFullYear()).slice(-2);
    const currentMm = String(now.getMonth() + 1).padStart(2, '0');

    // Fetch latest submitted reports to guarantee continuous sequence calculation
    let allReportRecords = [...submittedReports];
    try {
      const freshSubmitted = await getAdminSubmittedReports();
      if (freshSubmitted && freshSubmitted.length > 0) {
        setSubmittedReports(freshSubmitted);
        allReportRecords = [...freshSubmitted];
      }
    } catch (err) {
      console.warn('Using existing report state for sequence calculation:', err);
    }

    allReportRecords.forEach(r => {
      const num = (r.reportNumber || r.id || '').trim();
      if (!num) return;

      // Match YY-MM-XXXX pattern (e.g. 26-09-0277, 26-09-0277-A, ADM-26-09-0277)
      const match = num.match(/(\d{2})[-_](\d{2})[-_](\d{4})/);
      if (match) {
        const rYy = match[1];
        const seqNum = parseInt(match[3], 10);
        if (rYy === currentYy && !isNaN(seqNum) && seqNum > maxSeq) {
          maxSeq = seqNum;
        }
      }
    });

    const nextSeq = maxSeq + 1;
    const genNo = `${currentYy}-${currentMm}-${String(nextSeq).padStart(4, '0')}`;
    setSubmitReportNumber(genNo);
    setSubmitScope('CURRENT');
    setSubmitDialogOpen(true);
  };

  // Submit Report Execution Handler
  const handleExecuteSubmitReport = async () => {
    if (!submitReportNumber.trim()) {
      setNotification({
        open: true,
        message: 'Please enter or generate a valid report number.',
        severity: 'error'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const baseReportNo = submitReportNumber.trim().toUpperCase();
      const collectorName = certAccountableName.trim().toUpperCase() || (user?.name ? user.name.toUpperCase() : 'COLLECTOR');

      const isOrInRange = (orNoStr?: string, sStr?: string | null, eStr?: string | null): boolean => {
        if (!orNoStr || !sStr || !eStr) return false;
        const itemOr = parseInt(orNoStr, 10);
        const start = parseInt(sStr, 10);
        const end = parseInt(eStr, 10);
        if (!isNaN(itemOr) && !isNaN(start) && !isNaN(end)) {
          return itemOr >= start && itemOr <= end;
        }
        return orNoStr >= sStr && orNoStr <= eStr;
      };

      const buildReportRecord = (
        baseNo: string,
        suffix: 'A' | 'B' | '',
        cols: CollectionItem[],
        rptCols: RPTCollectionItem[],
        ctcCols: CommunityTaxItem[],
        targetTypeVal: 'general' | 'rpt' | 'ctc' | 'consol',
        afNoVal: string,
        rangeStartVal?: string | null,
        rangeEndVal?: string | null
      ): AdminSubmittedReportRecord => {
        const isSplit = Boolean(suffix);
        const repNumber = isSplit ? `${baseNo}-${suffix}` : baseNo;

        const itemIds = [
          ...cols.map(c => c.id),
          ...rptCols.map(c => c.id),
          ...ctcCols.map(c => c.id)
        ].filter((id): id is number => typeof id === 'number');

        const orNumbers = Array.from(new Set([
          ...cols.map(c => c.orNo),
          ...rptCols.map(c => c.orNumber),
          ...ctcCols.map(c => c.ctcNo)
        ].filter((or): or is string => Boolean(or))));

        const total = cols.reduce((s, c) => s + (c.amount || 0), 0)
          + rptCols.reduce((s, c) => s + (c.amount || 0), 0)
          + ctcCols.reduce((s, c) => s + (c.amount || 0), 0);

        let rawOrRangeStr = '';
        if (rangeStartVal && rangeEndVal) {
          rawOrRangeStr = `${rangeStartVal} — ${rangeEndVal}`;
        } else if (orNumbers.length > 0) {
          const sorted = [...orNumbers].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
          rawOrRangeStr = (sorted.length === 1 || sorted[0] === sorted[sorted.length - 1]) 
            ? sorted[0] 
            : `${sorted[0]} — ${sorted[sorted.length - 1]}`;
        } else {
          rawOrRangeStr = 'N/A';
        }

        const { orRange: normOrRange, orCount: normOrCount } = normalizeOrRangeAndCount(rawOrRangeStr, orNumbers, undefined);

        const allDates = [
          ...cols.map(c => c.date),
          ...rptCols.map(c => c.date),
          ...ctcCols.map(c => c.date)
        ].filter(Boolean).sort();

        const dateFrom = allDates[0] || new Date().toISOString().split('T')[0];
        const dateTo = allDates[allDates.length - 1] || new Date().toISOString().split('T')[0];

        const submitSubCatMap: { [key: string]: { subCategory: string; mainCategory: string; accountCode: string; amount: number; count: number } } = {};
        
        cols.forEach(item => {
          const subCat = item.subCategory || 'Unspecified';
          const mainCat = item.mainCategory || 'Tax Revenue';
          const accCode = item.accountCode || '';
          const key = `${subCat}____${accCode}`;
          if (!submitSubCatMap[key]) {
            submitSubCatMap[key] = { subCategory: subCat, mainCategory: mainCat, accountCode: accCode, amount: 0, count: 0 };
          }
          submitSubCatMap[key].amount += (item.amount || 0);
          submitSubCatMap[key].count += 1;
        });

        if (rptCols.length > 0) {
          rptCols.forEach(item => {
            const subCat = 'Real Property Tax';
            const mainCat = 'Tax Revenue';
            const accCode = '01-01-02-01';
            const key = `${subCat}____${accCode}`;
            if (!submitSubCatMap[key]) {
              submitSubCatMap[key] = { subCategory: subCat, mainCategory: mainCat, accountCode: accCode, amount: 0, count: 0 };
            }
            submitSubCatMap[key].amount += (item.amount || 0);
            submitSubCatMap[key].count += 1;
          });
        }

        if (ctcCols.length > 0) {
          ctcCols.forEach(item => {
            const penalty = item.penalty || 0;
            const basic = Math.max(0, (item.amount || 0) - penalty);

            if (basic > 0 || penalty === 0) {
              const subCat = 'Community Tax';
              const mainCat = 'Tax Revenue';
              const accCode = '4-01-01-050';
              const key = `${subCat}____${accCode}`;
              if (!submitSubCatMap[key]) {
                submitSubCatMap[key] = { subCategory: subCat, mainCategory: mainCat, accountCode: accCode, amount: 0, count: 0 };
              }
              submitSubCatMap[key].amount += basic;
              submitSubCatMap[key].count += 1;
            }

            if (penalty > 0) {
              const subCat = 'Surcharge-CTC';
              const mainCat = 'Tax Revenue';
              const accCode = '4-01-05-010';
              const key = `${subCat}____${accCode}`;
              if (!submitSubCatMap[key]) {
                submitSubCatMap[key] = { subCategory: subCat, mainCategory: mainCat, accountCode: accCode, amount: 0, count: 0 };
              }
              submitSubCatMap[key].amount += penalty;
              submitSubCatMap[key].count += 1;
            }
          });
        }

        const calculatedSubmitSubCategorySummary = Object.values(submitSubCatMap).map(s => ({
          subCategory: s.subCategory,
          mainCategory: s.mainCategory,
          accountCode: s.accountCode,
          itemCount: s.count,
          amount: s.amount
        }));

        return {
          id: `sub_rep_${Date.now()}_${suffix || 'main'}_${Math.random().toString(36).substring(2, 6)}`,
          reportNumber: repNumber,
          baseReportNumber: baseNo,
          subReportSuffix: suffix || undefined,
          collectorName,
          collectorEmail: user?.email || undefined,
          userId: user?.id ? String(user.id) : undefined,
          afNo: afNoVal,
          orRange: normOrRange,
          orCount: normOrCount,
          orNumbers,
          itemIds,
          collectionType: targetTypeVal,
          totalAmount: total,
          subCategorySummary: calculatedSubmitSubCategorySummary,
          submittedAt: new Date().toISOString(),
          submittedBy: user?.name || 'Collector',
          status: 'Submitted',
          reportType: 'collector_submission',
          isReportedByAdmin: false,
          dateFrom,
          dateTo,
          reportData: {
            printTarget: targetTypeVal === 'general' ? 'COLLECTIONS' : targetTypeVal === 'rpt' ? 'RPT_GENERAL' : targetTypeVal === 'ctc' ? 'COMMUNITY_TAX' : 'ALL',
            selectedAfNos,
            startOr1: suffix === 'A' ? rangeStartVal : suffix === 'B' ? null : startOr1,
            endOr1: suffix === 'A' ? rangeEndVal : suffix === 'B' ? null : endOr1,
            startOr2: suffix === 'B' ? rangeStartVal : null,
            endOr2: suffix === 'B' ? rangeEndVal : null,
            rptFilterAf56Id,
            rptStartOr1,
            rptEndOr1,
            ctcStartOr1,
            ctcEndOr1,
            certAccountableName: collectorName,
            certPosition: certPosition || user?.position || 'Revenue Collection Clerk I',
            filteredCollections: cols,
            filteredRptCollections: rptCols,
            filteredCtcCollections: ctcCols,
            subCategorySummary: calculatedSubmitSubCategorySummary
          }
        };
      };

      // Check if dual OR ranges are active (OR1 and OR2 filled out)
      const isDualRange = submitScope === 'CURRENT' && tabValue === 0 && Boolean(startOr1 && endOr1 && startOr2 && endOr2);

      if (isDualRange) {
        const colsA = filteredCollections.filter(c => isOrInRange(c.orNo, startOr1, endOr1));
        const colsB = filteredCollections.filter(c => isOrInRange(c.orNo, startOr2, endOr2));
        const afVal = selectedAfNos.length === 1 ? selectedAfNos[0] : 'A.F. NO. 51';

        const recordA = buildReportRecord(baseReportNo, 'A', colsA, [], [], 'general', afVal, startOr1, endOr1);
        const recordB = buildReportRecord(baseReportNo, 'B', colsB, [], [], 'general', afVal, startOr2, endOr2);

        const successA = await saveAdminSubmittedReport(recordA);
        const successB = await saveAdminSubmittedReport(recordB);

        if (successA && successB) {
          setSubmitDialogOpen(false);
          setStartOr1(null);
          setEndOr1(null);
          setStartOr2(null);
          setEndOr2(null);
          setRptStartOr1(null);
          setRptEndOr1(null);
          setCtcStartOr1(null);
          setCtcEndOr1(null);
          setPage(0);
          setNotification({
            open: true,
            message: `Report ${baseReportNo} (Ranges A & B) successfully submitted & archived! Selected AF & ORs will not appear in future reports.`,
            severity: 'success'
          });
          await loadAllData();
        } else {
          setNotification({
            open: true,
            message: 'Failed to submit report ranges. Please try again.',
            severity: 'error'
          });
        }
        return;
      }

      // Single Range Submission
      let targetType: 'general' | 'rpt' | 'ctc' | 'consol' = 'general';
      let activeCols: CollectionItem[] = [];
      let activeRpt: RPTCollectionItem[] = [];
      let activeCtc: CommunityTaxItem[] = [];
      let afVal = 'A.F. NO. 51';
      let rStart = startOr1;
      let rEnd = endOr1;

      if (submitScope === 'CURRENT') {
        if (tabValue === 0) {
          targetType = 'general';
          afVal = selectedAfNos.length === 1 ? selectedAfNos[0] : 'A.F. NO. 51';
          activeCols = (rStart && rEnd) ? filteredCollections.filter(c => isOrInRange(c.orNo, rStart, rEnd)) : filteredCollections;
          activeRpt = [];
          activeCtc = [];
        } else if (tabValue === 1) {
          targetType = 'rpt';
          activeCols = [];
          afVal = rptFilterAf56Id || 'A.F. NO. 56';
          rStart = rptStartOr1;
          rEnd = rptEndOr1;
          activeRpt = (rStart && rEnd) ? filteredRptCollections.filter(c => isOrInRange(c.orNumber, rStart, rEnd)) : filteredRptCollections;
          activeCtc = [];
        } else if (tabValue === 2) {
          targetType = 'ctc';
          activeCols = [];
          activeRpt = [];
          afVal = ctcFilterBookletNo || 'BRF NO. 0016';
          rStart = ctcStartOr1;
          rEnd = ctcEndOr1;
          activeCtc = (rStart && rEnd) ? filteredCtcCollections.filter(c => isOrInRange(c.ctcNo, rStart, rEnd)) : filteredCtcCollections;
        }
      } else {
        targetType = 'consol';
        activeCols = collections;
        activeRpt = rptCollections;
        activeCtc = communityTaxCollections;
        afVal = 'A.F. NO. 51 / 56 / 0016';
        rStart = null;
        rEnd = null;
      }

      const singleRecord = buildReportRecord(baseReportNo, '', activeCols, activeRpt, activeCtc, targetType, afVal, rStart, rEnd);
      const success = await saveAdminSubmittedReport(singleRecord);

      if (success) {
        setSubmitDialogOpen(false);
        setStartOr1(null);
        setEndOr1(null);
        setStartOr2(null);
        setEndOr2(null);
        setRptStartOr1(null);
        setRptEndOr1(null);
        setCtcStartOr1(null);
        setCtcEndOr1(null);
        setPage(0);
        setNotification({
          open: true,
          message: `Report ${singleRecord.reportNumber} successfully submitted & archived! Selected AF & ORs will not appear in future reports.`,
          severity: 'success'
        });
        await loadAllData();
      } else {
        setNotification({
          open: true,
          message: 'Failed to submit report. Please try again.',
          severity: 'error'
        });
      }
    } catch (err) {
      console.error('Error executing report submission:', err);
      setNotification({
        open: true,
        message: 'An error occurred while submitting the report.',
        severity: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler for Collector to Request Unarchive of an archived report
  const handleRequestUnarchiveReport = async (report: AdminSubmittedReportRecord) => {
    // 1. Optimistically update local UI state immediately for 0ms delay real-time feel
    setSubmittedReports(prev => prev.map(r => {
      if (r.id === report.id || r.reportNumber === report.reportNumber) {
        return {
          ...r,
          status: 'Pending Admin Approval' as const,
          unarchiveStatus: 'Pending Admin Approval' as const,
          unarchiveRequestedBy: user?.name || user?.email || 'Collector',
          unarchiveRequestedAt: new Date().toISOString()
        };
      }
      return r;
    }));

    setNotification({
      open: true,
      message: `Unarchive request for Report ${report.reportNumber} submitted to Admin for approval.`,
      severity: 'info'
    });

    try {
      await requestUnarchiveReport(report.id, user?.name || user?.email || 'Collector');
      await loadAllData();
    } catch (err) {
      console.error('Error requesting unarchive:', err);
    }
  };

  // Handler for Admin to Approve Unarchive Request
  const handleApproveUnarchiveReport = async (report: AdminSubmittedReportRecord) => {
    // 1. Optimistically remove report from archive immediately
    setSubmittedReports(prev => prev.filter(r => r.id !== report.id && r.reportNumber !== report.reportNumber));

    setNotification({
      open: true,
      message: `Report ${report.reportNumber} unarchived. Collection items restored to active lists.`,
      severity: 'success'
    });

    try {
      await unmarkAdminSubmittedReport(
        report.id,
        report.itemIds || [],
        report.collectionType || 'general',
        report.afNo,
        report.orNumbers
      );

      await loadAllData();
    } catch (err) {
      console.error('Error approving unarchive:', err);
    }
  };

  // Handler for Admin to Reject Unarchive Request
  const handleRejectUnarchiveReport = async (report: AdminSubmittedReportRecord) => {
    // 1. Optimistically update report to rejected state immediately
    setSubmittedReports(prev => prev.map(r => {
      if (r.id === report.id || r.reportNumber === report.reportNumber) {
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
      message: `Unarchive request for Report ${report.reportNumber} rejected.`,
      severity: 'warning'
    });

    try {
      await rejectUnarchiveReport(report.id);
      const submittedReportsData = await getAdminSubmittedReports();
      setSubmittedReports(submittedReportsData);
    } catch (err) {
      console.error('Error rejecting unarchive:', err);
    }
  };

  // Helper to construct a self-contained snapshot for archived reports based on exact booklet/AF & OR range
  const createArchivedSnapshot = (report: AdminSubmittedReportRecord) => {
    const snap = report.reportData ? JSON.parse(JSON.stringify(report.reportData)) : {};

    const afVal = report.afNo || snap.afNo || snap.filterBookletNo || snap.rptFilterBookletNo || snap.ctcFilterBookletNo || snap.rptFilterAf56Id || snap.ctcFilterAfNo || 'A.F. NO. 51';
    
    snap.afNo = afVal;
    snap.selectedAfNos = [afVal];
    snap.filterBookletNo = afVal;
    snap.rptFilterBookletNo = afVal;
    snap.ctcFilterBookletNo = afVal;
    snap.ctcFilterAfNo = afVal;
    snap.rptFilterAf56Id = afVal;

    let sOr: string | null = null;
    let eOr: string | null = null;

    if (report.orNumbers && Array.isArray(report.orNumbers) && report.orNumbers.length > 0) {
      const sortedOrs = [...report.orNumbers].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      sOr = sortedOrs[0];
      eOr = sortedOrs[sortedOrs.length - 1];
    } else if (report.orRange) {
      const parts = report.orRange.split(/—|-|to/i).map(s => s.trim()).filter(Boolean);
      if (parts.length >= 1) {
        sOr = parts[0];
        eOr = parts.length >= 2 ? parts[1] : parts[0];
      }
    }

    if (sOr || eOr) {
      snap.startOr1 = sOr;
      snap.endOr1 = eOr;
      snap.startOr2 = null;
      snap.endOr2 = null;

      snap.rptStartOr1 = sOr;
      snap.rptEndOr1 = eOr;
      snap.rptStartOr2 = null;
      snap.rptEndOr2 = null;

      snap.ctcStartOr1 = sOr;
      snap.ctcEndOr1 = eOr;
    }

    const checkOrInRange = (orNoStr?: string, sStr?: string | null, eStr?: string | null): boolean => {
      if (!orNoStr) return false;
      if (!sStr && !eStr) return true;
      if (!sStr || !eStr) return false;
      const itemOr = parseInt(orNoStr, 10);
      const start = parseInt(sStr, 10);
      const end = parseInt(eStr, 10);
      if (!isNaN(itemOr) && !isNaN(start) && !isNaN(end)) {
        return itemOr >= start && itemOr <= end;
      }
      return orNoStr >= sStr && orNoStr <= eStr;
    };

    const orSet = report.orNumbers && report.orNumbers.length > 0
      ? new Set(report.orNumbers.map(o => String(o).trim().toLowerCase()))
      : null;

    const itemIdsSet = report.itemIds && Array.isArray(report.itemIds) && report.itemIds.length > 0
      ? new Set(report.itemIds.map(id => Number(id)))
      : null;

    const matchesAf = (itemAf?: string) => {
      if (!itemAf) return true;
      const a = itemAf.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const b = afVal.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!a || !b) return true;
      return a.includes(b) || b.includes(a);
    };

    const matchesOr = (orNoStr?: string, itemId?: number) => {
      if (itemId !== undefined && itemIdsSet && itemIdsSet.size > 0 && itemIdsSet.has(Number(itemId))) {
        return true;
      }
      if (!orNoStr) return false;
      const cleanOr = String(orNoStr).trim().toLowerCase();
      if (orSet && orSet.size > 0 && orSet.has(cleanOr)) {
        return true;
      }
      return checkOrInRange(cleanOr, sOr, eOr);
    };

    // Determine report collection type
    const rawColType = (report.collectionType || snap.collectionType || '').toLowerCase();
    const afUpper = afVal.toUpperCase();
    const subCats = report.subCategorySummary || [];

    let colType: 'general' | 'rpt' | 'ctc' = 'general';
    if (rawColType === 'rpt' || rawColType === 'sef' || afUpper.includes('56') || subCats.some(s => s.mainCategory?.toUpperCase().includes('REAL PROPERTY'))) {
      colType = 'rpt';
    } else if (rawColType === 'ctc' || rawColType === 'community_tax' || afUpper.includes('BRF') || afUpper.includes('0016') || subCats.some(s => s.subCategory?.includes('Community Tax') || s.subCategory?.includes('Surcharge-CTC'))) {
      colType = 'ctc';
    }

    // 1. General Collections
    if (colType === 'general') {
      let list = Array.isArray(snap.filteredCollections) ? snap.filteredCollections : [];
      if (list.length > 0) {
        list = list.filter((c: any) => matchesAf(c.afNo) && matchesOr(c.orNo, c.id));
      }
      if (list.length === 0 && Array.isArray(collections) && collections.length > 0) {
        list = collections.filter((c: CollectionItem) => matchesAf(c.afNo) && matchesOr(c.orNo, c.id));
      }
      if (list.length === 0) {
        if (Array.isArray(report.stagedRows) && report.stagedRows.length > 0) {
          list = report.stagedRows.map((sr: any, idx: number) => ({
            id: sr.id || idx + 1,
            afNo: sr.bookletNo || afVal,
            orNo: sr.orNumbersDisplay || sOr || 'N/A',
            payor: sr.payor || 'VARIOUS',
            subCategory: sr.subCategory || 'General Collection',
            mainCategory: sr.mainCategory || 'General Collection',
            accountCode: sr.accountCode || '',
            amount: Number(sr.amount) || 0,
            date: sr.date || report.dateTo || new Date().toISOString().split('T')[0],
            remarks: ''
          }));
        } else if (Array.isArray(report.subCategorySummary) && report.subCategorySummary.length > 0) {
          list = report.subCategorySummary.map((sc: any, idx: number) => ({
            id: sc.id || idx + 1,
            afNo: afVal,
            orNo: sc.orNo || sc.orNumber || sOr || 'N/A',
            payor: sc.payor || 'VARIOUS',
            subCategory: sc.subCategory || 'General Collection',
            mainCategory: sc.mainCategory || 'General Collection',
            accountCode: sc.accountCode || '',
            amount: Number(sc.amount) || 0,
            date: report.dateTo || new Date().toISOString().split('T')[0],
            remarks: ''
          }));
        }
      }
      snap.filteredCollections = list;
    }

    // 2. RPT Collections
    if (colType === 'rpt') {
      let list = Array.isArray(snap.filteredRptCollections) ? snap.filteredRptCollections : [];
      if (list.length > 0) {
        list = list.filter((c: any) => matchesAf(c.afNo) && matchesOr(c.orNumber, c.id));
      }
      if (list.length === 0 && Array.isArray(rptCollections) && rptCollections.length > 0) {
        list = rptCollections.filter((c: RPTCollectionItem) => matchesAf((c as any).afNo) && matchesOr(c.orNumber, c.id));
      }
      if (list.length === 0) {
        if (Array.isArray(report.stagedRows) && report.stagedRows.length > 0) {
          list = report.stagedRows.map((sr: any, idx: number) => ({
            id: sr.id || idx + 1,
            afNo: sr.bookletNo || afVal,
            orNumber: sr.orNumbersDisplay || sOr || 'N/A',
            taxpayerName: sr.payor || 'VARIOUS',
            subCategory: sr.subCategory || 'Real Property Tax',
            mainCategory: sr.mainCategory || 'REAL PROPERTY TAX',
            accountCode: sr.accountCode || '',
            amount: Number(sr.amount) || 0,
            date: sr.date || report.dateTo || new Date().toISOString().split('T')[0],
            fundType: afUpper.includes('56') ? 'SEF' : 'GENERAL'
          }));
        } else if (Array.isArray(report.subCategorySummary) && report.subCategorySummary.length > 0) {
          list = report.subCategorySummary.map((sc: any, idx: number) => ({
            id: sc.id || idx + 1,
            afNo: afVal,
            orNumber: sc.orNo || sc.orNumber || sOr || 'N/A',
            taxpayerName: sc.payor || 'VARIOUS',
            subCategory: sc.subCategory || 'Real Property Tax',
            mainCategory: sc.mainCategory || 'REAL PROPERTY TAX',
            accountCode: sc.accountCode || '',
            amount: Number(sc.amount) || 0,
            date: report.dateTo || new Date().toISOString().split('T')[0],
            fundType: afUpper.includes('56') ? 'SEF' : 'GENERAL'
          }));
        }
      }
      snap.filteredRptCollections = list;
    }

    // 3. Community Tax Collections
    if (colType === 'ctc') {
      let list = Array.isArray(snap.filteredCtcCollections) ? snap.filteredCtcCollections : [];
      if (list.length > 0) {
        list = list.filter((c: any) => matchesAf(c.afNo) && matchesOr(c.ctcNo, c.id));
      }
      if (list.length === 0 && Array.isArray(communityTaxCollections) && communityTaxCollections.length > 0) {
        list = communityTaxCollections.filter((c: CommunityTaxItem) => matchesAf((c as any).afNo) && matchesOr(c.ctcNo, c.id));
      }
      if (list.length === 0) {
        if (Array.isArray(report.stagedRows) && report.stagedRows.length > 0) {
          list = report.stagedRows.map((sr: any, idx: number) => ({
            id: sr.id || idx + 1,
            afNo: sr.bookletNo || afVal,
            ctcNo: sr.orNumbersDisplay || sOr || 'N/A',
            taxpayerName: sr.payor || 'VARIOUS',
            amount: Number(sr.amount) || 0,
            penalty: 0,
            date: sr.date || report.dateTo || new Date().toISOString().split('T')[0]
          }));
        } else if (Array.isArray(report.subCategorySummary) && report.subCategorySummary.length > 0) {
          let basicAmt = 0;
          let penaltyAmt = 0;
          report.subCategorySummary.forEach((sc: any) => {
            if (sc.subCategory?.includes('Surcharge') || sc.subCategory?.includes('Penalty')) {
              penaltyAmt += (Number(sc.amount) || 0);
            } else {
              basicAmt += (Number(sc.amount) || 0);
            }
          });
          list = [{
            id: 1,
            afNo: afVal,
            ctcNo: sOr || 'N/A',
            taxpayerName: 'VARIOUS',
            amount: basicAmt + penaltyAmt,
            penalty: penaltyAmt,
            date: report.dateTo || new Date().toISOString().split('T')[0]
          }];
        }
      }
      snap.filteredCtcCollections = list;
    }

    return snap;
  };

  const handlePrintArchivedCover = (report: AdminSubmittedReportRecord) => {
    const snap = createArchivedSnapshot(report);
    const rawColType = (report.collectionType || snap.collectionType || '').toLowerCase();
    const afUpper = (report.afNo || snap.afNo || '').toUpperCase();
    const subCats = report.subCategorySummary || [];

    if (rawColType === 'rpt' || rawColType === 'sef' || afUpper.includes('56') || subCats.some(s => s.mainCategory?.toUpperCase().includes('REAL PROPERTY'))) {
      handlePrintRptCover(snap);
    } else if (rawColType === 'ctc' || rawColType === 'community_tax' || afUpper.includes('BRF') || afUpper.includes('0016') || subCats.some(s => s.subCategory?.includes('Community Tax') || s.subCategory?.includes('Surcharge-CTC'))) {
      handlePrintCtcCover(snap);
    } else {
      handlePrintCover(snap);
    }
  };

  const handlePrintArchivedReport = (report: AdminSubmittedReportRecord) => {
    const snap = createArchivedSnapshot(report);
    const certName = report.collectorName || snap?.certAccountableName;
    const certPos = snap?.certPosition || 'Revenue Collection Clerk I';
    const rawColType = (report.collectionType || snap.collectionType || '').toLowerCase();
    const afUpper = (report.afNo || snap.afNo || '').toUpperCase();
    const subCats = report.subCategorySummary || [];

    if (rawColType === 'rpt' || rawColType === 'sef' || afUpper.includes('56') || subCats.some(s => s.mainCategory?.toUpperCase().includes('REAL PROPERTY'))) {
      const fundType = afUpper.includes('56') ? 'SEF' : 'GENERAL';
      handlePrintRptReport(fundType, certName, certPos, snap);
    } else if (rawColType === 'ctc' || rawColType === 'community_tax' || afUpper.includes('BRF') || afUpper.includes('0016') || subCats.some(s => s.subCategory?.includes('Community Tax') || s.subCategory?.includes('Surcharge-CTC'))) {
      handlePrintCommunityTaxReport(certName, certPos, snap);
    } else {
      handlePrintReport(certName, certPos, snap);
    }
  };

  const handleExportArchivedExcel = (report: AdminSubmittedReportRecord) => {
    const snap = createArchivedSnapshot(report);
    handleExportToExcel(snap);
  };

  const createCombinedGroupSnapshot = (group: { baseReportNumber: string; collectorName: string; reports: AdminSubmittedReportRecord[] }) => {
    const reps = [...group.reports].sort((a, b) => (a.subReportSuffix || '').localeCompare(b.subReportSuffix || ''));
    if (reps.length === 1) {
      return createArchivedSnapshot(reps[0]);
    }

    const firstRep = reps[0];
    const secondRep = reps[1];

    const snapA = createArchivedSnapshot(firstRep);
    const snapB = secondRep ? createArchivedSnapshot(secondRep) : null;

    const combinedSnap = JSON.parse(JSON.stringify(snapA));

    combinedSnap.reportNumber = group.baseReportNumber;
    combinedSnap.baseReportNumber = group.baseReportNumber;
    combinedSnap.collectorName = group.collectorName || firstRep.collectorName;

    // Set OR Range 1 from Range A
    combinedSnap.startOr1 = snapA.startOr1 || null;
    combinedSnap.endOr1 = snapA.endOr1 || null;
    combinedSnap.rptStartOr1 = snapA.rptStartOr1 || snapA.startOr1 || null;
    combinedSnap.rptEndOr1 = snapA.rptEndOr1 || snapA.endOr1 || null;
    combinedSnap.ctcStartOr1 = snapA.ctcStartOr1 || snapA.startOr1 || null;
    combinedSnap.ctcEndOr1 = snapA.ctcEndOr1 || snapA.startOr1 || null;

    // Set OR Range 2 from Range B if present
    if (snapB) {
      combinedSnap.startOr2 = snapB.startOr1 || null;
      combinedSnap.endOr2 = snapB.endOr1 || null;
      combinedSnap.rptStartOr2 = snapB.rptStartOr1 || snapB.startOr1 || null;
      combinedSnap.rptEndOr2 = snapB.rptEndOr1 || snapB.endOr1 || null;
      combinedSnap.ctcStartOr2 = snapB.ctcStartOr1 || snapB.startOr1 || null;
      combinedSnap.ctcEndOr2 = snapB.ctcEndOr1 || snapB.startOr1 || null;
    }

    // Combine all staged rows from all sub-reports
    const allStaged: any[] = [];
    reps.forEach(r => {
      if (Array.isArray(r.stagedRows) && r.stagedRows.length > 0) {
        allStaged.push(...r.stagedRows);
      }
    });

    if (allStaged.length > 0) {
      combinedSnap.stagedRows = allStaged;
    }

    // Combine all sub-category summaries
    const subCatMap: Record<string, any> = {};
    reps.forEach(r => {
      (r.subCategorySummary || []).forEach((sc: any) => {
        const key = `${sc.subCategory || 'General'}_${sc.accountCode || ''}`;
        if (!subCatMap[key]) {
          subCatMap[key] = { ...sc };
        } else {
          subCatMap[key].amount = (subCatMap[key].amount || 0) + (Number(sc.amount) || 0);
          subCatMap[key].itemCount = (subCatMap[key].itemCount || 0) + (Number(sc.itemCount) || 0);
        }
      });
    });
    combinedSnap.subCategorySummary = Object.values(subCatMap);

    // Combined OR numbers
    const allOrs = new Set<string>();
    reps.forEach(r => {
      (r.orNumbers || []).forEach(o => { if (o) allOrs.add(String(o).trim()); });
    });
    combinedSnap.orNumbers = Array.from(allOrs);

    // Combined collections datasets
    const combinedFilteredCols: any[] = [];
    const combinedFilteredRpt: any[] = [];
    const combinedFilteredCtc: any[] = [];

    reps.forEach(r => {
      const s = createArchivedSnapshot(r);
      if (Array.isArray(s.filteredCollections)) combinedFilteredCols.push(...s.filteredCollections);
      if (Array.isArray(s.filteredRptCollections)) combinedFilteredRpt.push(...s.filteredRptCollections);
      if (Array.isArray(s.filteredCtcCollections)) combinedFilteredCtc.push(...s.filteredCtcCollections);
    });

    if (combinedFilteredCols.length > 0) combinedSnap.filteredCollections = combinedFilteredCols;
    if (combinedFilteredRpt.length > 0) combinedSnap.filteredRptCollections = combinedFilteredRpt;
    if (combinedFilteredCtc.length > 0) combinedSnap.filteredCtcCollections = combinedFilteredCtc;

    return combinedSnap;
  };

  const handlePrintArchivedGroupCover = (group: { baseReportNumber: string; collectorName: string; reports: AdminSubmittedReportRecord[] }) => {
    const snap = createCombinedGroupSnapshot(group);
    const mainRep = group.reports[0];
    const rawColType = (mainRep.collectionType || snap.collectionType || '').toLowerCase();
    const afUpper = (mainRep.afNo || snap.afNo || '').toUpperCase();
    const subCats = mainRep.subCategorySummary || [];

    if (rawColType === 'rpt' || rawColType === 'sef' || afUpper.includes('56') || subCats.some(s => s.mainCategory?.toUpperCase().includes('REAL PROPERTY'))) {
      handlePrintRptCover(snap);
    } else if (rawColType === 'ctc' || rawColType === 'community_tax' || afUpper.includes('BRF') || afUpper.includes('0016') || subCats.some(s => s.subCategory?.includes('Community Tax') || s.subCategory?.includes('Surcharge-CTC'))) {
      handlePrintCtcCover(snap);
    } else {
      handlePrintCover(snap);
    }
  };

  const handlePrintArchivedGroupReport = (group: { baseReportNumber: string; collectorName: string; reports: AdminSubmittedReportRecord[] }) => {
    const snap = createCombinedGroupSnapshot(group);
    const mainRep = group.reports[0];
    const certName = group.collectorName || mainRep.collectorName || snap?.certAccountableName;
    const certPos = snap?.certPosition || 'Revenue Collection Clerk I';
    const rawColType = (mainRep.collectionType || snap.collectionType || '').toLowerCase();
    const afUpper = (mainRep.afNo || snap.afNo || '').toUpperCase();
    const subCats = mainRep.subCategorySummary || [];

    if (rawColType === 'rpt' || rawColType === 'sef' || afUpper.includes('56') || subCats.some(s => s.mainCategory?.toUpperCase().includes('REAL PROPERTY'))) {
      const fundType = afUpper.includes('56') ? 'SEF' : 'GENERAL';
      handlePrintRptReport(fundType, certName, certPos, snap);
    } else if (rawColType === 'ctc' || rawColType === 'community_tax' || afUpper.includes('BRF') || afUpper.includes('0016') || subCats.some(s => s.subCategory?.includes('Community Tax') || s.subCategory?.includes('Surcharge-CTC'))) {
      handlePrintCommunityTaxReport(certName, certPos, snap);
    } else {
      handlePrintReport(certName, certPos, snap);
    }
  };

  const handleExportArchivedGroupExcel = (group: { baseReportNumber: string; collectorName: string; reports: AdminSubmittedReportRecord[] }) => {
    const snap = createCombinedGroupSnapshot(group);
    handleExportToExcel(snap);
  };

  const handleInitiatePrint = (target: 'COLLECTIONS' | 'RPT_GENERAL' | 'RPT_SEF' | 'COMMUNITY_TAX') => {
    if (target === 'COLLECTIONS' && filteredCollections.length === 0) {
      setNotification({
        open: true,
        message: 'No collection records found to print.',
        severity: 'warning'
      });
      return;
    }
    if ((target === 'RPT_GENERAL' || target === 'RPT_SEF') && filteredRptCollections.length === 0) {
      setNotification({
        open: true,
        message: 'No RPT collection records found to print.',
        severity: 'warning'
      });
      return;
    }
    if (target === 'COMMUNITY_TAX' && filteredCtcCollections.length === 0) {
      setNotification({
        open: true,
        message: 'No Community Tax records found to print.',
        severity: 'warning'
      });
      return;
    }

    setPrintTarget(target);

    // Default to logged-in user's full name and position
    const defaultName = (user?.name || 'ACCOUNTABLE OFFICER').toUpperCase();
    const defaultPosition = user?.position || 'Revenue Collection Clerk I';

    setCertAccountableName(defaultName);
    setCertPosition(defaultPosition);
    setSelectedUserDropdownId(user?.id ? String(user.id) : 'current');
    setPrintDialogOpen(true);
  };

  const handleUserDropdownChange = (userId: string) => {
    setSelectedUserDropdownId(userId);
    if (userId === 'current') {
      const defaultName = (user?.name || 'ACCOUNTABLE OFFICER').toUpperCase();
      const defaultPosition = user?.position || 'Revenue Collection Clerk I';
      setCertAccountableName(defaultName);
      setCertPosition(defaultPosition);
    } else {
      const selected = managedUsers.find(u => String(u.id) === String(userId));
      if (selected) {
        setCertAccountableName(selected.fullName.trim().toUpperCase());
        setCertPosition(selected.position?.trim() || 'Revenue Collection Clerk I');
      }
    }
  };

  const handleProceedPrint = () => {
    const finalName = certAccountableName.trim().toUpperCase() || (user?.name ? user.name.toUpperCase() : 'ACCOUNTABLE OFFICER');
    const finalPos = certPosition.trim() || user?.position || 'Revenue Collection Clerk I';

    setPrintDialogOpen(false);

    if (printTarget === 'COLLECTIONS') {
      handlePrintReport(finalName, finalPos);
    } else if (printTarget === 'RPT_GENERAL') {
      handlePrintRptReport('GENERAL', finalName, finalPos);
    } else if (printTarget === 'RPT_SEF') {
      handlePrintRptReport('SEF', finalName, finalPos);
    } else if (printTarget === 'COMMUNITY_TAX') {
      handlePrintCommunityTaxReport(finalName, finalPos);
    }
  };

  const handlePrintReport = (accountableOfficerName?: string, accountableOfficerPosition?: string, snapshot?: any) => {
    const isSnap = isSnapshot(snapshot);
    const snap = isSnap ? snapshot : undefined;

    // 1. Prepare Data
    const reportData = snap?.filteredCollections || filteredCollections;
    const totalAmount = reportData.reduce((sum: number, item: CollectionItem) => sum + (item.amount || 0), 0);
    const sOr1 = snap?.startOr1 !== undefined ? snap.startOr1 : startOr1;
    const eOr1 = snap?.endOr1 !== undefined ? snap.endOr1 : endOr1;
    const sOr2 = snap?.startOr2 !== undefined ? snap.startOr2 : startOr2;
    const eOr2 = snap?.endOr2 !== undefined ? snap.endOr2 : endOr2;
    
    // Group items by AF No
    const itemsByAf: Record<string, typeof reportData> = {};
    const accountEntries: Record<string, { code: string, name: string, amount: number }> = {};

    reportData.forEach((item: CollectionItem) => {
      const af = item.afNo || '51';
      if (!itemsByAf[af]) itemsByAf[af] = [];
      itemsByAf[af].push(item);

      // Accounting Entries Particulars & COA Code (summarized strictly by Major Category)
      const mainCat = item.mainCategory || 'General Collection';
      const code = item.accountCode || '';
      const amt = item.amount || 0;
      
      const key = `${mainCat}`;
      if (!accountEntries[key]) {
        accountEntries[key] = { code, name: mainCat, amount: 0 };
      }
      accountEntries[key].amount += amt;
      if (!accountEntries[key].code && code) {
        accountEntries[key].code = code;
      }
    });

    // 2. Process AF ranges for Section A.1 and Section C (50 OR numbers per booklet)
    interface AfRangeItem {
      name: string;
      minOr: string;
      maxOr: string;
      amount: number;
      qty: number;
      minNum: number;
      maxNum: number;
    }

    const afRanges: AfRangeItem[] = [];

    const selectedAf = snap?.afNo || (snap?.selectedAfNos && snap.selectedAfNos.length > 0 ? snap.selectedAfNos[0] : (selectedAfNos && selectedAfNos.length > 0 ? selectedAfNos[0] : (reportData[0]?.afNo || '51')));

    const formNameTitle = getAfFormType(selectedAf, 'general');

    if ((sOr1 && eOr1) || (sOr2 && eOr2)) {
      const getRangeData = (s: string, e: string) => {
        const start = parseInt(s, 10);
        const end = parseInt(e, 10);
        const matched = reportData.filter((item: CollectionItem) => {
          if (!item.orNo) return false;
          const itemOr = parseInt(item.orNo, 10);
          if (!isNaN(itemOr) && !isNaN(start) && !isNaN(end)) {
            return itemOr >= start && itemOr <= end;
          }
          return item.orNo >= s && item.orNo <= e;
        });
        const total = matched.reduce((sum: number, item: CollectionItem) => sum + (item.amount || 0), 0);
        return { total, count: matched.length };
      };

      if (sOr1 && eOr1) {
        const r1 = getRangeData(sOr1, eOr1);
        const minN = parseInt(sOr1, 10);
        const maxN = parseInt(eOr1, 10);
        afRanges.push({
          name: formNameTitle,
          minOr: sOr1,
          maxOr: eOr1,
          amount: r1.total,
          qty: !isNaN(minN) && !isNaN(maxN) ? Math.max(1, maxN - minN + 1) : r1.count,
          minNum: minN,
          maxNum: maxN
        });
      }

      if (sOr2 && eOr2) {
        const r2 = getRangeData(sOr2, eOr2);
        const minN = parseInt(sOr2, 10);
        const maxN = parseInt(eOr2, 10);
        afRanges.push({
          name: formNameTitle,
          minOr: sOr2,
          maxOr: eOr2,
          amount: r2.total,
          qty: !isNaN(minN) && !isNaN(maxN) ? Math.max(1, maxN - minN + 1) : r2.count,
          minNum: minN,
          maxNum: maxN
        });
      }
    } else {
      // Automatically detect contiguous ranges from reportData
      const sorted = [...reportData]
        .filter(it => it.orNo)
        .sort((a, b) => {
          const nA = parseInt(a.orNo || '', 10);
          const nB = parseInt(b.orNo || '', 10);
          if (!isNaN(nA) && !isNaN(nB)) return nA - nB;
          return (a.orNo || '').localeCompare(b.orNo || '');
        });

      let curMinOr = '';
      let curMaxOr = '';
      let curAmount = 0;
      let curQty = 0;
      let curMinN = -1;
      let curLastN = -1;
      let hasActive = false;

      for (const it of sorted) {
        const orVal = it.orNo || '';
        const orN = parseInt(orVal, 10);
        const amt = it.amount || 0;

        if (!hasActive) {
          curMinOr = orVal;
          curMaxOr = orVal;
          curAmount = amt;
          curQty = 1;
          curMinN = isNaN(orN) ? -1 : orN;
          curLastN = isNaN(orN) ? -1 : orN;
          hasActive = true;
        } else {
          if (!isNaN(orN) && curLastN !== -1 && orN === curLastN + 1) {
            curMaxOr = orVal;
            curAmount += amt;
            curQty += 1;
            curLastN = orN;
          } else {
            afRanges.push({
              name: formNameTitle,
              minOr: curMinOr,
              maxOr: curMaxOr,
              amount: curAmount,
              qty: curQty,
              minNum: curMinN,
              maxNum: curLastN
            });
            curMinOr = orVal;
            curMaxOr = orVal;
            curAmount = amt;
            curQty = 1;
            curMinN = isNaN(orN) ? -1 : orN;
            curLastN = isNaN(orN) ? -1 : orN;
          }
        }
      }

      if (hasActive) {
        afRanges.push({
          name: formNameTitle,
          minOr: curMinOr,
          maxOr: curMaxOr,
          amount: curAmount,
          qty: curQty,
          minNum: curMinN,
          maxNum: curLastN
        });
      }
    }

    // 3. Booklet Math (50 OR Numbers per Booklet) for Section C
    interface SectionCRow {
      name: string;
      begQty: string | number;
      begFrom: string;
      begTo: string;
      recQty: string;
      recFrom: string;
      recTo: string;
      issQty: string | number;
      issFrom: string;
      issTo: string;
      endQty: string | number;
      endFrom: string;
      endTo: string;
    }

    const sectionCRows: SectionCRow[] = [];
    let prevEndState: { formName: string; toNum: number; nextStartNum: number; padLen: number } | null = null;

    afRanges.forEach((range) => {
      const formName = formNameTitle;
      const padLen = range.minOr.length || 5;
      const fmt = (n: number) => n.toString().padStart(padLen, '0');

      const startNum = range.minNum;
      const endNum = range.maxNum;

      if (isNaN(startNum) || isNaN(endNum)) {
        sectionCRows.push({
          name: formName,
          begQty: range.qty,
          begFrom: range.minOr,
          begTo: range.maxOr,
          recQty: '', recFrom: '', recTo: '',
          issQty: range.qty,
          issFrom: range.minOr,
          issTo: range.maxOr,
          endQty: '',
          endFrom: '',
          endTo: ''
        });
        return;
      }

      // Formula: Every booklet contains 50 ORs
      const bookletStartNum = Math.floor((startNum - 1) / 50) * 50 + 1;
      const bookletEndNum = bookletStartNum + 50 - 1;

      let begFromNum = bookletStartNum;
      let begToNum = bookletEndNum;
      let begQty = 50;

      // If continuous within same booklet from previous row
      if (prevEndState && prevEndState.formName === formName && prevEndState.toNum === bookletEndNum && prevEndState.nextStartNum === startNum) {
        begFromNum = startNum;
        begToNum = bookletEndNum;
        begQty = bookletEndNum - startNum + 1;
      } else if (startNum > bookletStartNum) {
        begFromNum = startNum;
        begToNum = bookletEndNum;
        begQty = bookletEndNum - startNum + 1;
      }

      const issFromNum = startNum;
      const issToNum = endNum;
      const issQty = endNum - startNum + 1;

      const endFromNum = issToNum + 1;
      const endToNum = bookletEndNum;
      const endQty = Math.max(0, endToNum - endFromNum + 1);

      prevEndState = {
        formName,
        toNum: bookletEndNum,
        nextStartNum: endFromNum,
        padLen
      };

      sectionCRows.push({
        name: formName,
        begQty,
        begFrom: fmt(begFromNum),
        begTo: fmt(begToNum),
        recQty: '',
        recFrom: '',
        recTo: '',
        issQty,
        issFrom: fmt(issFromNum),
        issTo: fmt(issToNum),
        endQty: endQty > 0 ? endQty : '',
        endFrom: endQty > 0 ? fmt(endFromNum) : '',
        endTo: endQty > 0 ? fmt(endToNum) : ''
      });
    });

    // Accounting entries sorted by COA Code
    const sortedEntries = Object.values(accountEntries)
      .filter(entry => entry.amount !== 0)
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

    // Dates & Report numbers
    const dateObj = reportData.length > 0 && reportData[0].date ? new Date(reportData[0].date) : new Date();
    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const certificationDateStr = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    
    const yy = dateObj.getFullYear().toString().slice(-2);
    const mm = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const reportNo = `${yy}-${mm}-`;

    // Number to words converter
    const numberToWords = (num: number): string => {
      const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
      const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

      const convertLessThanOneThousand = (n: number): string => {
        if (n === 0) return '';
        let result = '';
        if (n >= 100) {
          result += a[Math.floor(n / 100)] + ' Hundred ';
          n %= 100;
        }
        if (n >= 20) {
          result += b[Math.floor(n / 10)] + (n % 10 !== 0 ? '-' + a[n % 10] : '') + ' ';
        } else if (n > 0) {
          result += a[n] + ' ';
        }
        return result;
      };

      const intPart = Math.floor(num);
      const centPart = Math.round((num - intPart) * 100);

      let words = '';
      if (intPart === 0) {
        words = 'Zero';
      } else {
        const millions = Math.floor(intPart / 1000000);
        const thousands = Math.floor((intPart % 1000000) / 1000);
        const remainder = intPart % 1000;

        if (millions > 0) {
          words += convertLessThanOneThousand(millions).trim() + ' Million ';
        }
        if (thousands > 0) {
          words += convertLessThanOneThousand(thousands).trim() + ' Thousand ';
        }
        if (remainder > 0) {
          words += convertLessThanOneThousand(remainder).trim() + ' ';
        }
      }

      words = words.trim() + ' Pesos';

      if (centPart > 0) {
        let centWords = '';
        if (centPart >= 20) {
          centWords = b[Math.floor(centPart / 10)] + (centPart % 10 !== 0 ? '-' + a[centPart % 10] : '');
        } else {
          centWords = a[centPart];
        }
        words += ` and ${centWords} Centavos`;
      }

      return `${words.trim()} only`;
    };

    const amountInWords = numberToWords(totalAmount);

    // Dynamic Signatories (Exact 4 Official Roles)
    // 1. CERTIFICATION: Collector / Accountable Officer
    const collector = {
      fullName: (accountableOfficerName || user?.name || 'ACCOUNTABLE OFFICER').trim().toUpperCase(),
      position: (accountableOfficerPosition || user?.position || 'Revenue Collection Clerk I').trim()
    };

    // 2, 3, 4: Official Municipal Signatories (Section D & Section E)
    const { treasurer, accountant, preparer } = getSectionSignatories(signatories, collector.fullName);

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html> 
        <html lang="en"> 
        <head> 
        <meta charset="UTF-8"> 
        <title>Report of Collections and Deposits - ${formNameTitle}</title> 
        <style> 
          @page { 
            size: 8.5in 13in; 
            margin: 0.35in 0.45in; 
          }
          * {
            box-sizing: border-box;
          }
          body { 
            font-family: Arial, Helvetica, sans-serif; 
            font-size: 10.5px; 
            color: #000;
            margin: 0;
            padding: 0;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          } 
          .sheet {
            width: 100%;
            max-width: 7.6in;
            margin: 0 auto;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .page-break {
            page-break-before: always;
            break-before: page;
          }
          .appendix-tag {
            text-align: right;
            font-size: 11px;
            font-weight: bold;
            margin-bottom: 2px;
            padding-right: 2px;
          }
          .border-frame {
            border: 2px solid #000;
            padding: 6px;
            position: relative;
            min-height: 12.1in;
            display: flex;
            flex-direction: column;
          }
          .page-num {
            position: absolute;
            top: 6px;
            right: 8px;
            font-size: 10px;
          }
          .header-titles {
            text-align: center;
            margin-top: 8px;
            margin-bottom: 10px;
          }
          .header-titles .main-title {
            font-weight: bold;
            font-size: 12px;
            letter-spacing: 0.5px;
          }
          .header-titles .sub-title {
            font-weight: bold;
            font-size: 11px;
            margin-top: 1px;
          }
          .meta-table {
            width: 100%;
            border-collapse: collapse;
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
            margin-bottom: 6px;
          }
          .meta-table td {
            padding: 2px 4px;
            font-size: 10.5px;
          }
          .sec-title {
            font-weight: bold;
            font-size: 11px;
            margin-top: 4px;
            margin-bottom: 2px;
            text-transform: uppercase;
          }
          .sec-sub-title {
            font-weight: bold;
            font-size: 11px;
            text-indent: 14px;
            margin-top: 4px;
            margin-bottom: 2px;
          }
          .grid-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #000;
            font-size: 10.5px;
          }
          .grid-table th, .grid-table td {
            border: 1px solid #000;
            padding: 2px 4px;
            height: 17px;
          }
          .grid-table th {
            background-color: #f9f9f9;
            text-align: center;
            font-weight: bold;
            font-size: 10px;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .bold { font-weight: bold; }
          
          /* Section D Box */
          .summary-card {
            border: 2px solid #000;
            padding: 6px;
            margin-top: 8px;
          }
          .summary-grid {
            display: flex;
            gap: 15px;
          }
          .summary-left {
            flex: 1.1;
          }
          .summary-right {
            flex: 0.9;
          }
          .calc-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10.5px;
          }
          .calc-table td {
            padding: 1.5px 0;
          }
          .checks-table {
            width: 100%;
            border-collapse: collapse;
            border: 1.5px solid #000;
            font-size: 10px;
          }
          .checks-table th, .checks-table td {
            border: 1px solid #000;
            padding: 2px 4px;
            height: 16px;
          }
          .cert-grid {
            display: flex;
            gap: 20px;
            font-size: 10.5px;
            margin-top: 6px;
            align-items: stretch;
          }
          .cert-col {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .sig-row {
            display: flex;
            gap: 12px;
            align-items: flex-end;
            margin-top: auto;
            padding-top: 14px;
          }
          .sig-name-box {
            flex: 6.5;
            text-align: center;
          }
          .sig-date-box {
            flex: 3.5;
            text-align: center;
          }
          .sig-line {
            border-bottom: 1.5px solid #000;
            font-weight: bold;
            font-size: 10.5px;
            padding-bottom: 1px;
            min-height: 16px;
            line-height: 1.2;
            display: flex;
            align-items: flex-end;
            justify-content: center;
          }
          .sig-sub {
            font-size: 9.5px;
            margin-top: 2px;
            min-height: 14px;
            line-height: 1.2;
          }
        </style> 
        </head> 
        <body> 
        
        <!-- PAGE 1 OF 2 -->
        <div class="sheet">
          <div class="appendix-tag">Appendix 34</div>
          <div class="border-frame">
            <div class="page-num">Page 1 of 2</div>

            <div class="header-titles">
              <div class="main-title">REPORT OF COLLECTIONS AND DEPOSITS</div>
              <div class="sub-title">Concepcion, Romblon</div>
              <div class="sub-title">LGU</div>
            </div>

            <table class="meta-table">
              <tr>
                <td style="width: 58%;">Fund: <strong>GENERAL FUND</strong></td>
                <td style="width: 42%;">Report No.: <strong>${reportNo}</strong></td>
              </tr>
              <tr>
                <td>Name of Accountable Officer: <strong>${collector.fullName}</strong></td>
                <td>Sheet No.: <strong>01</strong></td>
              </tr>
              <tr>
                <td></td>
                <td>Date: <strong>${dateStr}</strong></td>
              </tr>
            </table>

            <div class="sec-title">A. COLLECTIONS</div>
            <div class="sec-sub-title">1. FOR COLLECTORS</div>
            <table class="grid-table">
              <thead>
                <tr>
                  <th rowspan="2" style="width: 45%;">Type (Form No.)</th>
                  <th colspan="2" style="width: 35%;">Official Receipt / Serial No.</th>
                  <th rowspan="2" style="width: 20%;">Amount</th>
                </tr>
                <tr>
                  <th style="width: 17.5%;">From</th>
                  <th style="width: 17.5%;">To</th>
                </tr>
              </thead>
              <tbody>
                ${afRanges.map(item => `
                  <tr>
                    <td>${getAfFormType(item.name || formNameTitle, 'general')}</td>
                    <td class="text-center">${item.minOr}</td>
                    <td class="text-center">${item.maxOr}</td>
                    <td class="text-right">${item.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                  </tr>
                `).join('')}
                <!-- Exact filler rows to match 16 data/blank rows in reference image -->
                ${Array(Math.max(0, 16 - afRanges.length)).fill(0).map(() => `
                  <tr><td>&nbsp;</td><td></td><td></td><td></td></tr>
                `).join('')}
                <tr>
                  <td colspan="3" class="text-right bold">Total</td>
                  <td class="text-right bold">${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>

            <div class="sec-sub-title" style="margin-top: 6px;">2. FOR LIQUIDATING OFFICERS / TREASURERS</div>
            <table class="grid-table">
              <thead>
                <tr>
                  <th style="width: 50%;">Name of Accountable Officer</th>
                  <th style="width: 25%;">Report No.</th>
                  <th style="width: 25%;">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${collector.fullName}</td>
                  <td class="text-center">${reportNo}</td>
                  <td class="text-right">${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                </tr>
                <!-- Exact filler rows to match 18 data/blank rows in reference image -->
                ${Array(17).fill(0).map(() => `
                  <tr><td>&nbsp;</td><td></td><td></td></tr>
                `).join('')}
                <tr>
                  <td colspan="2" class="text-right bold">Total</td>
                  <td class="text-right bold">${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>

            <div class="sec-title" style="margin-top: 6px;">B. REMITTANCES/DEPOSITS</div>
            <table class="grid-table">
              <thead>
                <tr>
                  <th style="width: 50%;">Accountable Officer / Bank</th>
                  <th style="width: 25%;">Reference</th>
                  <th style="width: 25%;">Amount</th>
                </tr>
              </thead>
              <tbody>
                <!-- 15 filler rows (11 + 4 additional rows) -->
                ${Array(15).fill(0).map(() => `
                  <tr><td>&nbsp;</td><td></td><td></td></tr>
                `).join('')}
                <tr>
                  <td colspan="2" class="text-right bold">TOTAL</td>
                  <td class="text-center bold">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="page-break"></div>

        <!-- PAGE 2 OF 2 -->
        <div class="sheet">
          <div class="appendix-tag">Appendix 34</div>
          <div class="border-frame">
            <div class="page-num">Page 2 of 2</div>

            <div class="sec-title" style="margin-top: 2px;">C. ACCOUNTABILITY FOR ACCOUNTABLE FORMS</div>
            <table class="grid-table">
              <thead>
                <tr>
                  <th rowspan="2" style="width: 20%;">Name of Form & No.</th>
                  <th colspan="3" style="width: 20%;">Beginning Balance</th>
                  <th colspan="3" style="width: 20%;">Receipt</th>
                  <th colspan="3" style="width: 20%;">Issued</th>
                  <th colspan="3" style="width: 20%;">Ending Balance</th>
                </tr>
                <tr>
                  <th style="width: 5%;">Qty</th><th style="width: 7.5%;">From</th><th style="width: 7.5%;">To</th>
                  <th style="width: 5%;">Qty</th><th style="width: 7.5%;">From</th><th style="width: 7.5%;">To</th>
                  <th style="width: 5%;">Qty</th><th style="width: 7.5%;">From</th><th style="width: 7.5%;">To</th>
                  <th style="width: 5%;">Qty</th><th style="width: 7.5%;">From</th><th style="width: 7.5%;">To</th>
                </tr>
              </thead>
              <tbody>
                ${sectionCRows.map(r => `
                  <tr>
                    <td>${getAfFormType(r.name, 'general')}</td>
                    <td class="text-center">${r.begQty}</td><td class="text-center">${r.begFrom}</td><td class="text-center">${r.begTo}</td>
                    <td class="text-center">${r.recQty}</td><td class="text-center">${r.recFrom}</td><td class="text-center">${r.recTo}</td>
                    <td class="text-center">${r.issQty}</td><td class="text-center">${r.issFrom}</td><td class="text-center">${r.issTo}</td>
                    <td class="text-center">${r.endQty}</td><td class="text-center">${r.endFrom}</td><td class="text-center">${r.endTo}</td>
                  </tr>
                `).join('')}
                <!-- Exact filler rows to match 8 total rows in reference image -->
                ${Array(Math.max(0, 8 - sectionCRows.length)).fill(0).map(() => `
                  <tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
                `).join('')}
              </tbody>
            </table>

            <div class="summary-card" style="border: 2px solid #000; padding: 8px 10px; margin-top: 8px; margin-bottom: 8px;">
              <div style="font-weight: bold; font-size: 11px; margin-bottom: 8px;">D. SUMMARY OF COLLECTIONS</div>
              <div class="summary-grid" style="display: flex; gap: 20px; align-items: flex-start;">
                <!-- Left Summary -->
                <div class="summary-left" style="flex: 1.15;">
                  <table class="calc-table" style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
                    <tr>
                      <td colspan="3" style="padding-bottom: 2px;">Beginning Balance: ${dateStr}</td>
                    </tr>
                    <tr>
                      <td colspan="3" style="padding-bottom: 2px;">Add: Collections</td>
                    </tr>
                    <tr>
                      <td style="padding-left: 20px; width: 55%;">Cash</td>
                      <td style="text-align: right; width: 25px;">₱</td>
                      <td style="text-align: right; width: 105px;">${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td style="padding-left: 20px;">Check/s</td>
                      <td style="text-align: right;"></td>
                      <td style="text-align: right; border-bottom: 1.5px solid #000;">-</td>
                    </tr>
                    <tr>
                      <td>Total</td>
                      <td style="text-align: right;">₱</td>
                      <td style="text-align: right; border-bottom: 1.5px solid #000;">${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td>Less: Remittance/Deposit to Treasurer</td>
                      <td style="text-align: right;">₱</td>
                      <td style="text-align: right; border-bottom: 1.5px solid #000;">${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td style="padding-top: 2px;">Balance</td>
                      <td style="text-align: right; padding-top: 2px;">₱</td>
                      <td style="text-align: right; border-bottom: 2px solid #000; padding-top: 2px;">-</td>
                    </tr>
                  </table>
                </div>

                <!-- Right: List of Checks (3 blank rows matching reference image) -->
                <div class="summary-right" style="flex: 0.85;">
                  <div style="font-size: 10px; margin-bottom: 3px;">List of Checks :</div>
                  <table class="checks-table" style="width: 100%; border-collapse: collapse; border: 2px solid #000; font-size: 10px;">
                    <thead>
                      <tr>
                        <th style="width: 35%; border: 1.5px solid #000; height: 18px;"></th>
                        <th style="width: 35%; border: 1.5px solid #000; font-weight: bold; text-align: center;">Payee</th>
                        <th style="width: 30%; border: 1.5px solid #000; font-weight: bold; text-align: center;">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td style="border: 1.5px solid #000; height: 18px;">&nbsp;</td><td style="border: 1.5px solid #000;"></td><td style="border: 1.5px solid #000;"></td></tr>
                      <tr><td style="border: 1.5px solid #000; height: 18px;">&nbsp;</td><td style="border: 1.5px solid #000;"></td><td style="border: 1.5px solid #000;"></td></tr>
                      <tr><td style="border: 1.5px solid #000; height: 18px;">&nbsp;</td><td style="border: 1.5px solid #000;"></td><td style="border: 1.5px solid #000;"></td></tr>
                    </tbody>
                  </table>
                  <div style="font-size: 9.5px; text-align: center; margin-top: 4px;">NOTE: Use additional sheet if necessary.</div>
                </div>
              </div>

              <!-- Thick Dividing Line -->
              <div style="border-bottom: 2px solid #000; margin: 14px 0 12px 0;"></div>

              <!-- Certifications -->
              <div class="cert-grid">
                <div class="cert-col">
                  <div>
                    <div style="font-weight: bold; margin-bottom: 6px; font-size: 10.5px;">CERTIFICATION:</div>
                    <p style="font-size: 9.5px; line-height: 1.4; margin: 0; text-align: justify;">
                      I hereby certify that the foregoing report of collections and deposits, and accountability for accountable forms is true and correct.
                    </p>
                  </div>
                  <div class="sig-row">
                    <div class="sig-name-box">
                      <div class="sig-line">${collector.fullName}</div>
                      <div class="sig-sub">${collector.position}</div>
                    </div>
                    <div class="sig-date-box">
                      <div class="sig-line">${certificationDateStr}</div>
                      <div class="sig-sub">Date</div>
                    </div>
                  </div>
                </div>

                <div class="cert-col">
                  <div>
                    <div style="font-weight: bold; margin-bottom: 6px; font-size: 10.5px;">VERIFICATION AND ACKNOWLEDGMENT:</div>
                    <p style="font-size: 9.5px; line-height: 1.4; margin: 0; text-align: justify;">
                      I hereby certify that the foregoing report of collections has been verified and acknowledge receipt of (₱ ${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}) ${amountInWords}
                    </p>
                  </div>
                  <div class="sig-row">
                    <div class="sig-name-box">
                      <div class="sig-line">${treasurer.fullName}</div>
                      <div class="sig-sub">${treasurer.position}</div>
                    </div>
                    <div class="sig-date-box">
                      <div class="sig-line">&nbsp;</div>
                      <div class="sig-sub">Date</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="sec-title" style="margin-top: 6px;">E. ACCOUNTING ENTRIES</div>
            <table class="grid-table">
              <thead>
                <tr>
                  <th style="width: 45%;">Particulars</th>
                  <th style="width: 20%;">Account Code</th>
                  <th style="width: 17.5%;">Debit</th>
                  <th style="width: 17.5%;">Credit</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="text-left">Cash in Local Treasury</td>
                  <td class="text-center">1-01-01-010</td>
                  <td class="text-right">₱ ${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                  <td></td>
                </tr>
                ${sortedEntries.map(entry => `
                  <tr>
                    <td class="text-left">${entry.name}</td>
                    <td class="text-center">${entry.code}</td>
                    <td></td>
                    <td class="text-right">₱ ${entry.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                  </tr>
                `).join('')}
                <!-- Exact filler rows to match 32 total rows (reduced by 3 rows) -->
                ${Array(Math.max(0, 31 - sortedEntries.length)).fill(0).map(() => `
                  <tr><td>&nbsp;</td><td></td><td></td><td></td></tr>
                `).join('')}
              </tbody>
            </table>

            <div style="display: flex; justify-content: space-between; margin-top: 14px; padding: 0 10px 4px 10px;">
              <div style="width: 45%;">
                <div style="font-size: 10px;">Prepared by:</div>
                <div style="margin-top: 22px; font-weight: bold; font-size: 11px;">${preparer.fullName}</div>
                <div style="font-size: 9.5px;">${preparer.position}</div>
              </div>
              <div style="width: 45%;">
                <div style="font-size: 10px;">Certified Correct:</div>
                <div style="margin-top: 22px; font-weight: bold; font-size: 11px;">${accountant.fullName}</div>
                <div style="font-size: 9.5px;">${accountant.position}</div>
              </div>
            </div>
          </div>
        </div>

        </body> 
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const handlePrintRptCover = (snapshot?: any) => {
    const isSnap = isSnapshot(snapshot);
    const snap = isSnap ? snapshot : undefined;

    const dataRpt = snap?.filteredRptCollections || filteredRptCollections;
    if (dataRpt.length === 0 && !snap) {
      setNotification({
        open: true,
        message: 'No RPT collection records found to print cover.',
        severity: 'warning'
      });
      return;
    }

    const afNo = snap?.afNo || snap?.filterBookletNo || snap?.rptFilterBookletNo || snap?.rptFilterAf56Id || rptFilterAf56Id || 'A.F. NO. 56';
    let sOr1 = snap?.rptStartOr1 !== undefined ? snap.rptStartOr1 : (snap?.startOr1 !== undefined ? snap.startOr1 : rptStartOr1);
    let eOr1 = snap?.rptEndOr1 !== undefined ? snap.rptEndOr1 : (snap?.endOr1 !== undefined ? snap.endOr1 : rptEndOr1);

    const filterByRange = (sOr: string | null, eOr: string | null) => {
      if (!sOr || !eOr) return [];
      return dataRpt.filter((item: RPTCollectionItem) => {
        if (!item.orNumber) return false;
        
        const itemOr = parseInt(item.orNumber, 10);
        const start = parseInt(sOr, 10);
        const end = parseInt(eOr, 10);
        
        if (!isNaN(itemOr) && !isNaN(start) && !isNaN(end)) {
          return itemOr >= start && itemOr <= end;
        }
        return item.orNumber >= sOr && item.orNumber <= eOr;
      });
    };

    const targetData = (sOr1 && eOr1) ? filterByRange(sOr1, eOr1) : dataRpt;

    const sortedOrs = targetData
      .map((item: RPTCollectionItem) => item.orNumber)
      .filter((or: string | null): or is string => Boolean(or))
      .sort((a: string, b: string) => {
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b, undefined, { numeric: true });
      });

    const startOr = sOr1 || (sortedOrs.length > 0 ? sortedOrs[0] : 'N/A');
    const endOr = eOr1 || (sortedOrs.length > 0 ? sortedOrs[sortedOrs.length - 1] : 'N/A');

    const totalAmount = targetData.reduce((sum: number, item: RPTCollectionItem) => sum + (item.amount || 0), 0);

    const totalCents = Math.round((totalAmount || 0) * 100);
    const basicCents = Math.ceil(totalCents / 2);
    const sefCents = totalCents - basicCents;
    const basic = basicCents / 100;
    const sef = sefCents / 100;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print RPT Cover - ${afNo}</title>
            <style>
              @page { size: Letter portrait; margin: 0.5in; }
              body { 
                font-family: Arial, sans-serif; 
                margin: 0; 
                padding: 0; 
                -webkit-print-color-adjust: exact;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 90vh;
              }
              .container { 
                display: flex; 
                flex-direction: column; 
                align-items: center; 
                justify-content: center; 
                width: 100%; 
                box-sizing: border-box; 
                padding: 20px;
              }
              .column { 
                width: 85%; 
                max-width: 600px; 
                box-sizing: border-box; 
                display: flex; 
                flex-direction: column; 
                align-items: center; 
              }
              .header-box { 
                border: 3px double black; 
                padding: 8px 25px; 
                color: red; 
                font-weight: bold; 
                font-size: 20px;
                text-align: center; 
                margin-bottom: 50px;
                margin-top: 20px;
                width: 100%;
                box-sizing: border-box;
              }
              .section { margin-bottom: 45px; text-align: center; width: 100%; }
              .label { 
                font-size: 18px; 
                text-transform: uppercase; 
                margin-bottom: 15px; 
                color: black;
                font-weight: bold;
              }
              .value { 
                font-size: 32px; 
                font-weight: bold; 
                text-decoration: underline; 
              }
              .breakdown {
                font-size: 26px;
                display: flex;
                flex-direction: column;
                gap: 20px;
                margin-top: 20px;
                width: 100%;
              }
              .breakdown-item {
                display: flex;
                justify-content: center;
                gap: 15px;
              }
              .red-label {
                color: red;
                font-weight: bold;
              }
              .amount-val {
                color: black;
                font-weight: bold;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="column">
                <div class="header-box">
                  ACCOUNTABLE FORM NO. 56
                </div>

                <div class="section">
                  <div class="label">OR NO.</div>
                  <div class="value">${startOr}${endOr && endOr !== startOr ? ` - ${endOr}` : ''}</div>
                </div>
                
                <div class="section">
                  <div class="label">TOTAL AMOUNT:</div>
                  <div class="value">₱ ${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>

                <div class="section breakdown">
                  <div class="breakdown-item">
                    <span class="red-label">BASIC:</span> <span class="amount-val">₱ ${basic.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div class="breakdown-item">
                    <span class="red-label">SEF:</span> <span class="amount-val">₱ ${sef.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const handlePrintRptReport = (fundType: 'GENERAL' | 'SEF' = 'GENERAL', accountableOfficerName?: string, accountableOfficerPosition?: string, snapshot?: any) => {
    const isSnap = isSnapshot(snapshot);
    const snap = isSnap ? snapshot : undefined;

    const dataRpt = snap?.filteredRptCollections || rptCollections;
    const sOr1 = snap?.rptStartOr1 !== undefined ? snap.rptStartOr1 : (snap?.startOr1 !== undefined ? snap.startOr1 : rptStartOr1);
    const eOr1 = snap?.rptEndOr1 !== undefined ? snap.rptEndOr1 : (snap?.endOr1 !== undefined ? snap.endOr1 : rptEndOr1);

    const filterByRange = (sOr: string | null, eOr: string | null) => {
      if (!sOr || !eOr) return [];
      return dataRpt.filter((item: RPTCollectionItem) => {
        if (!item.orNumber) return false;
        
        const itemOr = parseInt(item.orNumber, 10);
        const start = parseInt(sOr, 10);
        const end = parseInt(eOr, 10);
        
        if (!isNaN(itemOr) && !isNaN(start) && !isNaN(end)) {
          return itemOr >= start && itemOr <= end;
        }
        return item.orNumber >= sOr && item.orNumber <= eOr;
      });
    };

    const allData = (sOr1 && eOr1 ? filterByRange(sOr1, eOr1) : dataRpt).sort((a: RPTCollectionItem, b: RPTCollectionItem) => {
        const orA = parseInt(a.orNumber, 10);
        const orB = parseInt(b.orNumber, 10);
        return orA - orB;
    });

    if (allData.length === 0) return;

    const isGeneral = fundType === 'GENERAL';
    const fundLabel = isGeneral ? 'GENERAL FUND' : 'SPECIAL EDUCATION FUND';
    const reportTitle = isGeneral ? 'General Fund Report' : 'SEF Report';

    // Helper function: Splits any amount into Basic and SEF (50/50).
    // If not divisible by equal 2 decimal points, Basic has the higher decimal (ceil)
    // and SEF has the lower decimal (floor) so Basic + SEF === Total.
    const splitAmount = (amt: number): { basic: number; sef: number } => {
      const totalCents = Math.round((amt || 0) * 100);
      const basicCents = Math.ceil(totalCents / 2);
      const sefCents = totalCents - basicCents;
      return {
        basic: basicCents / 100,
        sef: sefCents / 100
      };
    };

    // Calculate totals for this fund type
    const reportItems = allData.map((item: RPTCollectionItem) => {
      const { basic, sef } = splitAmount(item.amount || 0);
      return {
        ...item,
        amount: isGeneral ? basic : sef
      };
    });
    
    const rawTotalAmount = allData.reduce((sum: number, item: RPTCollectionItem) => sum + (item.amount || 0), 0);
    const { basic: totalBasic, sef: totalSef } = splitAmount(rawTotalAmount);
    const totalAmount = isGeneral ? totalBasic : totalSef;

    // Date Logic
    const dateObj = reportItems.length > 0 && reportItems[0].date ? new Date(reportItems[0].date) : new Date();
    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const certificationDateStr = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    
    // Report No Logic
    const yy = dateObj.getFullYear().toString().slice(-2);
    const mm = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const reportNo = `${yy}-${mm}-`; 

    // Number to Words
    const numberToWords = (num: number): string => {
      const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
      const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

      const convertLessThanOneThousand = (n: number): string => {
        if (n === 0) return '';
        let result = '';
        if (n >= 100) {
          result += a[Math.floor(n / 100)] + ' Hundred ';
          n %= 100;
        }
        if (n >= 20) {
          result += b[Math.floor(n / 10)] + (n % 10 !== 0 ? '-' + a[n % 10] : '') + ' ';
        } else if (n > 0) {
          result += a[n] + ' ';
        }
        return result;
      };

      const intPart = Math.floor(num);
      const centPart = Math.round((num - intPart) * 100);

      let words = '';
      if (intPart === 0) {
        words = 'Zero';
      } else {
        const millions = Math.floor(intPart / 1000000);
        const thousands = Math.floor((intPart % 1000000) / 1000);
        const remainder = intPart % 1000;

        if (millions > 0) {
          words += convertLessThanOneThousand(millions).trim() + ' Million ';
        }
        if (thousands > 0) {
          words += convertLessThanOneThousand(thousands).trim() + ' Thousand ';
        }
        if (remainder > 0) {
          words += convertLessThanOneThousand(remainder).trim() + ' ';
        }
      }

      words = words.trim() + ' Pesos';

      if (centPart > 0) {
        let centWords = '';
        if (centPart >= 20) {
          centWords = b[Math.floor(centPart / 10)] + (centPart % 10 !== 0 ? '-' + a[centPart % 10] : '');
        } else {
          centWords = a[centPart];
        }
        words += ` and ${centWords} Centavos`;
      }

      return `${words.trim()} only`;
    };

    const amountInWords = numberToWords(totalAmount);

    // Dynamic Signatories (Exact 4 Official Roles)
    // 1. CERTIFICATION: Collector / Accountable Officer
    const collector = {
      fullName: (accountableOfficerName || user?.name || 'ACCOUNTABLE OFFICER').trim().toUpperCase(),
      position: (accountableOfficerPosition || user?.position || 'Revenue Collection Clerk I').trim()
    };

    // 2, 3, 4: Official Municipal Signatories (Section D & Section E)
    const { treasurer, accountant, preparer } = getSectionSignatories(signatories, collector.fullName);

    // Calculate OR Ranges for Section A.1 and Section C (50 ORs/Booklet)
    interface RptRangeItem {
      minOr: string;
      maxOr: string;
      amount: number;
      qty: number;
      minNum: number;
      maxNum: number;
    }
    const rptRanges: RptRangeItem[] = [];

    if (sOr1 && eOr1) {
      const r1ItemsRaw = filterByRange(sOr1, eOr1);
      const r1RawTotal = r1ItemsRaw.reduce((sum: number, i: RPTCollectionItem) => sum + (i.amount || 0), 0);
      const { basic: r1Basic, sef: r1Sef } = splitAmount(r1RawTotal);
      const r1Tot = isGeneral ? r1Basic : r1Sef;
      const minN = parseInt(sOr1, 10);
      const maxN = parseInt(eOr1, 10);
      rptRanges.push({
        minOr: sOr1,
        maxOr: eOr1,
        amount: r1Tot,
        qty: !isNaN(minN) && !isNaN(maxN) ? Math.max(1, maxN - minN + 1) : r1ItemsRaw.length,
        minNum: minN,
        maxNum: maxN
      });
    }

    // Section C 50-OR booklet calculations
    interface SectionCRow {
      name: string;
      begQty: string | number;
      begFrom: string;
      begTo: string;
      recQty: string;
      recFrom: string;
      recTo: string;
      issQty: string | number;
      issFrom: string;
      issTo: string;
      endQty: string | number;
      endFrom: string;
      endTo: string;
    }

    const sectionCRows: SectionCRow[] = [];
    let prevEndState: { formName: string; toNum: number; nextStartNum: number; padLen: number } | null = null;

    rptRanges.forEach((range) => {
      const formName = 'A.F. NO. 56';
      const padLen = range.minOr.length || 7;
      const fmt = (n: number) => n.toString().padStart(padLen, '0');

      const startNum = range.minNum;
      const endNum = range.maxNum;

      if (isNaN(startNum) || isNaN(endNum)) {
        sectionCRows.push({
          name: formName,
          begQty: range.qty,
          begFrom: range.minOr,
          begTo: range.maxOr,
          recQty: '', recFrom: '', recTo: '',
          issQty: range.qty,
          issFrom: range.minOr,
          issTo: range.maxOr,
          endQty: '', endFrom: '', endTo: ''
        });
        return;
      }

      const bookletStartNum = Math.floor((startNum - 1) / 50) * 50 + 1;
      const bookletEndNum = bookletStartNum + 50 - 1;

      let begFromNum = bookletStartNum;
      let begToNum = bookletEndNum;
      let begQty = 50;

      if (prevEndState && prevEndState.formName === formName && prevEndState.toNum === bookletEndNum && prevEndState.nextStartNum === startNum) {
        begFromNum = startNum;
        begToNum = bookletEndNum;
        begQty = bookletEndNum - startNum + 1;
      } else if (startNum > bookletStartNum) {
        begFromNum = startNum;
        begToNum = bookletEndNum;
        begQty = bookletEndNum - startNum + 1;
      }

      const issFromNum = startNum;
      const issToNum = endNum;
      const issQty = endNum - startNum + 1;

      const endFromNum = issToNum + 1;
      const endToNum = bookletEndNum;
      const endQty = Math.max(0, endToNum - endFromNum + 1);

      prevEndState = {
        formName,
        toNum: bookletEndNum,
        nextStartNum: endFromNum,
        padLen
      };

      sectionCRows.push({
        name: formName,
        begQty,
        begFrom: fmt(begFromNum),
        begTo: fmt(begToNum),
        recQty: '',
        recFrom: '',
        recTo: '',
        issQty,
        issFrom: fmt(issFromNum),
        issTo: fmt(issToNum),
        endQty: endQty > 0 ? endQty : '',
        endFrom: endQty > 0 ? fmt(endFromNum) : '',
        endTo: endQty > 0 ? fmt(endToNum) : ''
      });
    });

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html> 
        <html lang="en"> 
        <head> 
        <meta charset="UTF-8"> 
        <title>${reportTitle} - A.F. NO. 56</title> 
        <style> 
          @page { 
            size: 8.5in 13in; 
            margin: 0.35in 0.45in; 
          }
          * {
            box-sizing: border-box;
          }
          body { 
            font-family: Arial, Helvetica, sans-serif; 
            font-size: 10.5px; 
            color: #000;
            margin: 0;
            padding: 0;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          } 
          .sheet {
            width: 100%;
            max-width: 7.6in;
            margin: 0 auto;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .page-break {
            page-break-before: always;
            break-before: page;
          }
          .appendix-tag {
            text-align: right;
            font-size: 11px;
            font-weight: bold;
            margin-bottom: 2px;
            padding-right: 2px;
          }
          .border-frame {
            border: 2px solid #000;
            padding: 6px;
            position: relative;
            min-height: 12.1in;
            display: flex;
            flex-direction: column;
          }
          .page-num {
            position: absolute;
            top: 6px;
            right: 8px;
            font-size: 10px;
          }
          .header-titles {
            text-align: center;
            margin-top: 8px;
            margin-bottom: 10px;
          }
          .header-titles .main-title {
            font-weight: bold;
            font-size: 12px;
            letter-spacing: 0.5px;
          }
          .header-titles .sub-title {
            font-weight: bold;
            font-size: 11px;
            margin-top: 1px;
          }
          .meta-table {
            width: 100%;
            border-collapse: collapse;
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
            margin-bottom: 6px;
          }
          .meta-table td {
            padding: 2px 4px;
            font-size: 10.5px;
          }
          .sec-title {
            font-weight: bold;
            font-size: 11px;
            margin-top: 4px;
            margin-bottom: 2px;
            text-transform: uppercase;
          }
          .sec-sub-title {
            font-weight: bold;
            font-size: 11px;
            text-indent: 14px;
            margin-top: 4px;
            margin-bottom: 2px;
          }
          .grid-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #000;
            font-size: 10.5px;
          }
          .grid-table th, .grid-table td {
            border: 1px solid #000;
            padding: 2px 4px;
            height: 17px;
          }
          .grid-table th {
            background-color: #f9f9f9;
            text-align: center;
            font-weight: bold;
            font-size: 10px;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .bold { font-weight: bold; }
          
          /* Section D Box */
          .summary-card {
            border: 2px solid #000;
            padding: 8px 10px;
            margin-top: 8px;
            margin-bottom: 8px;
          }
          .summary-grid {
            display: flex;
            gap: 20px;
            align-items: flex-start;
          }
          .summary-left {
            flex: 1.15;
          }
          .summary-right {
            flex: 0.85;
          }
          .calc-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10.5px;
          }
          .calc-table td {
            padding: 1.5px 0;
          }
          .checks-table {
            width: 100%;
            border-collapse: collapse;
            border: 2px solid #000;
            font-size: 10px;
          }
          .checks-table th, .checks-table td {
            border: 1.5px solid #000;
            padding: 2px 4px;
            height: 18px;
          }
          .cert-grid {
            display: flex;
            gap: 20px;
            font-size: 10.5px;
            margin-top: 6px;
            align-items: stretch;
          }
          .cert-col {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .sig-row {
            display: flex;
            gap: 12px;
            align-items: flex-end;
            margin-top: auto;
            padding-top: 14px;
          }
          .sig-name-box {
            flex: 6.5;
            text-align: center;
          }
          .sig-date-box {
            flex: 3.5;
            text-align: center;
          }
          .sig-line {
            border-bottom: 1.5px solid #000;
            font-weight: bold;
            font-size: 10.5px;
            padding-bottom: 1px;
            min-height: 16px;
            line-height: 1.2;
            display: flex;
            align-items: flex-end;
            justify-content: center;
          }
          .sig-sub {
            font-size: 9.5px;
            margin-top: 2px;
            min-height: 14px;
            line-height: 1.2;
          }
        </style> 
        </head> 
        <body> 
        
        <!-- PAGE 1 OF 2 -->
        <div class="sheet">
          <div class="appendix-tag">Appendix 34</div>
          <div class="border-frame">
            <div class="page-num">Page 1 of 2</div>

            <div class="header-titles">
              <div class="main-title">REPORT OF COLLECTIONS AND DEPOSITS</div>
              <div class="sub-title">Concepcion, Romblon</div>
              <div class="sub-title">LGU</div>
            </div>

            <table class="meta-table">
              <tr>
                <td style="width: 58%;">Fund: <strong>${fundLabel}</strong></td>
                <td style="width: 42%;">Report No.: <strong>${reportNo}</strong></td>
              </tr>
              <tr>
                <td>Name of Accountable Officer: <strong>${collector.fullName}</strong></td>
                <td>Sheet No.: <strong>01</strong></td>
              </tr>
              <tr>
                <td></td>
                <td>Date: <strong>${dateStr}</strong></td>
              </tr>
            </table>

            <div class="sec-title">A. COLLECTIONS</div>
            <div class="sec-sub-title">1. FOR COLLECTORS</div>
            <table class="grid-table">
              <thead>
                <tr>
                  <th rowspan="2" style="width: 45%;">Type (Form No.)</th>
                  <th colspan="2" style="width: 35%;">Official Receipt / Serial No.</th>
                  <th rowspan="2" style="width: 20%;">Amount</th>
                </tr>
                <tr>
                  <th style="width: 17.5%;">From</th>
                  <th style="width: 17.5%;">To</th>
                </tr>
              </thead>
              <tbody>
                ${rptRanges.map(item => `
                  <tr>
                    <td>A.F. NO. 56</td>
                    <td class="text-center">${item.minOr}</td>
                    <td class="text-center">${item.maxOr}</td>
                    <td class="text-right">${item.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                  </tr>
                `).join('')}
                <!-- Exact filler rows to match 16 data/blank rows -->
                ${Array(Math.max(0, 16 - rptRanges.length)).fill(0).map(() => `
                  <tr><td>&nbsp;</td><td></td><td></td><td></td></tr>
                `).join('')}
                <tr>
                  <td colspan="3" class="text-right bold">Total</td>
                  <td class="text-right bold">${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>

            <div class="sec-sub-title" style="margin-top: 6px;">2. FOR LIQUIDATING OFFICERS / TREASURERS</div>
            <table class="grid-table">
              <thead>
                <tr>
                  <th style="width: 50%;">Name of Accountable Officer</th>
                  <th style="width: 25%;">Report No.</th>
                  <th style="width: 25%;">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${collector.fullName}</td>
                  <td class="text-center">${reportNo}</td>
                  <td class="text-right">${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                </tr>
                <!-- Exact filler rows to match 18 data/blank rows -->
                ${Array(17).fill(0).map(() => `
                  <tr><td>&nbsp;</td><td></td><td></td></tr>
                `).join('')}
                <tr>
                  <td colspan="2" class="text-right bold">Total</td>
                  <td class="text-right bold">${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>

            <div class="sec-title" style="margin-top: 6px;">B. REMITTANCES/DEPOSITS</div>
            <table class="grid-table">
              <thead>
                <tr>
                  <th style="width: 50%;">Accountable Officer / Bank</th>
                  <th style="width: 25%;">Reference</th>
                  <th style="width: 25%;">Amount</th>
                </tr>
              </thead>
              <tbody>
                <!-- 15 filler rows -->
                ${Array(15).fill(0).map(() => `
                  <tr><td>&nbsp;</td><td></td><td></td></tr>
                `).join('')}
                <tr>
                  <td colspan="2" class="text-right bold">TOTAL</td>
                  <td class="text-center bold">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="page-break"></div>

        <!-- PAGE 2 OF 2 -->
        <div class="sheet">
          <div class="appendix-tag">Appendix 34</div>
          <div class="border-frame">
            <div class="page-num">Page 2 of 2</div>

            <div class="sec-title" style="margin-top: 2px;">C. ACCOUNTABILITY FOR ACCOUNTABLE FORMS</div>
            <table class="grid-table">
              <thead>
                <tr>
                  <th rowspan="2" style="width: 20%;">Name of Form & No.</th>
                  <th colspan="3" style="width: 20%;">Beginning Balance</th>
                  <th colspan="3" style="width: 20%;">Receipt</th>
                  <th colspan="3" style="width: 20%;">Issued</th>
                  <th colspan="3" style="width: 20%;">Ending Balance</th>
                </tr>
                <tr>
                  <th style="width: 5%;">Qty</th><th style="width: 7.5%;">From</th><th style="width: 7.5%;">To</th>
                  <th style="width: 5%;">Qty</th><th style="width: 7.5%;">From</th><th style="width: 7.5%;">To</th>
                  <th style="width: 5%;">Qty</th><th style="width: 7.5%;">From</th><th style="width: 7.5%;">To</th>
                  <th style="width: 5%;">Qty</th><th style="width: 7.5%;">From</th><th style="width: 7.5%;">To</th>
                </tr>
              </thead>
              <tbody>
                ${sectionCRows.map(r => `
                  <tr>
                    <td>${r.name}</td>
                    <td class="text-center">${r.begQty}</td><td class="text-center">${r.begFrom}</td><td class="text-center">${r.begTo}</td>
                    <td class="text-center">${r.recQty}</td><td class="text-center">${r.recFrom}</td><td class="text-center">${r.recTo}</td>
                    <td class="text-center">${r.issQty}</td><td class="text-center">${r.issFrom}</td><td class="text-center">${r.issTo}</td>
                    <td class="text-center">${r.endQty}</td><td class="text-center">${r.endFrom}</td><td class="text-center">${r.endTo}</td>
                  </tr>
                `).join('')}
                <!-- Exact filler rows to match 8 total rows in reference image -->
                ${Array(Math.max(0, 8 - sectionCRows.length)).fill(0).map(() => `
                  <tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
                `).join('')}
              </tbody>
            </table>

            <div class="summary-card">
              <div style="font-weight: bold; font-size: 11px; margin-bottom: 8px;">D. SUMMARY OF COLLECTIONS</div>
              <div class="summary-grid">
                <!-- Left Summary -->
                <div class="summary-left">
                  <table class="calc-table">
                    <tr>
                      <td colspan="3" style="padding-bottom: 2px;">Beginning Balance: ${dateStr}</td>
                    </tr>
                    <tr>
                      <td colspan="3" style="padding-bottom: 2px;">Add: Collections</td>
                    </tr>
                    <tr>
                      <td style="padding-left: 20px; width: 55%;">Cash</td>
                      <td style="text-align: right; width: 25px;">₱</td>
                      <td style="text-align: right; width: 105px;">${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td style="padding-left: 20px;">Check/s</td>
                      <td style="text-align: right;"></td>
                      <td style="text-align: right; border-bottom: 1.5px solid #000;">-</td>
                    </tr>
                    <tr>
                      <td>Total</td>
                      <td style="text-align: right;">₱</td>
                      <td style="text-align: right; border-bottom: 1.5px solid #000;">${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td>Less: Remittance/Deposit to Treasurer</td>
                      <td style="text-align: right;">₱</td>
                      <td style="text-align: right; border-bottom: 1.5px solid #000;">${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td style="padding-top: 2px;">Balance</td>
                      <td style="text-align: right; padding-top: 2px;">₱</td>
                      <td style="text-align: right; border-bottom: 2px solid #000; padding-top: 2px;">-</td>
                    </tr>
                  </table>
                </div>

                <!-- Right: List of Checks -->
                <div class="summary-right">
                  <div style="font-size: 10px; margin-bottom: 3px;">List of Checks :</div>
                  <table class="checks-table">
                    <thead>
                      <tr>
                        <th style="width: 35%; border: 1.5px solid #000; height: 18px;"></th>
                        <th style="width: 35%; border: 1.5px solid #000; font-weight: bold; text-align: center;">Payee</th>
                        <th style="width: 30%; border: 1.5px solid #000; font-weight: bold; text-align: center;">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td style="border: 1.5px solid #000; height: 18px;">&nbsp;</td><td style="border: 1.5px solid #000;"></td><td style="border: 1.5px solid #000;"></td></tr>
                      <tr><td style="border: 1.5px solid #000; height: 18px;">&nbsp;</td><td style="border: 1.5px solid #000;"></td><td style="border: 1.5px solid #000;"></td></tr>
                      <tr><td style="border: 1.5px solid #000; height: 18px;">&nbsp;</td><td style="border: 1.5px solid #000;"></td><td style="border: 1.5px solid #000;"></td></tr>
                    </tbody>
                  </table>
                  <div style="font-size: 9.5px; text-align: center; margin-top: 4px;">NOTE: Use additional sheet if necessary.</div>
                </div>
              </div>

              <!-- Thick Dividing Line -->
              <div style="border-bottom: 2px solid #000; margin: 14px 0 12px 0;"></div>

              <!-- Certifications -->
              <div class="cert-grid">
                <div class="cert-col">
                  <div>
                    <div style="font-weight: bold; margin-bottom: 6px; font-size: 10.5px;">CERTIFICATION:</div>
                    <p style="font-size: 9.5px; line-height: 1.4; margin: 0; text-align: justify;">
                      I hereby certify that the foregoing report of collections and deposits, and accountability for accountable forms is true and correct.
                    </p>
                  </div>
                  <div class="sig-row">
                    <div class="sig-name-box">
                      <div class="sig-line">${collector.fullName}</div>
                      <div class="sig-sub">${collector.position}</div>
                    </div>
                    <div class="sig-date-box">
                      <div class="sig-line">${certificationDateStr}</div>
                      <div class="sig-sub">Date</div>
                    </div>
                  </div>
                </div>

                <div class="cert-col">
                  <div>
                    <div style="font-weight: bold; margin-bottom: 6px; font-size: 10.5px;">VERIFICATION AND ACKNOWLEDGMENT:</div>
                    <p style="font-size: 9.5px; line-height: 1.4; margin: 0; text-align: justify;">
                      I hereby certify that the foregoing report of collections has been verified and acknowledge receipt of (₱ ${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}) ${amountInWords}
                    </p>
                  </div>
                  <div class="sig-row">
                    <div class="sig-name-box">
                      <div class="sig-line">${treasurer.fullName}</div>
                      <div class="sig-sub">${treasurer.position}</div>
                    </div>
                    <div class="sig-date-box">
                      <div class="sig-line">&nbsp;</div>
                      <div class="sig-sub">Date</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="sec-title" style="margin-top: 6px;">E. ACCOUNTING ENTRIES</div>
            <table class="grid-table">
              <thead>
                <tr>
                  <th style="width: 45%;">Particulars</th>
                  <th style="width: 20%;">Account Code</th>
                  <th style="width: 17.5%;">Debit</th>
                  <th style="width: 17.5%;">Credit</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="text-left">Cash in Local Treasury</td>
                  <td class="text-center">1-01-01-010</td>
                  <td class="text-right">₱ ${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                  <td></td>
                </tr>
                ${isGeneral ? `
                <tr>
                  <td class="text-left" style="padding-left: 24px;">Due to LGUs Barangay</td>
                  <td class="text-center">2-02-01-070</td>
                  <td></td>
                  <td></td>
                </tr>
                <tr>
                  <td class="text-left" style="padding-left: 24px;">Due to LGUs Province</td>
                  <td class="text-center">2-02-01-070</td>
                  <td></td>
                  <td></td>
                </tr>
                <tr>
                  <td class="text-left">Real Property Tax-Basic</td>
                  <td class="text-center">4-01-02-040</td>
                  <td></td>
                  <td></td>
                </tr>
                <tr>
                  <td class="text-left">Discount on Real Property Tax- Basic</td>
                  <td class="text-center">4-01-02-041</td>
                  <td></td>
                  <td></td>
                </tr>
                <tr>
                  <td class="text-left">Tax Revenue-Fines and Penalties Property Tax</td>
                  <td class="text-center">4-01-05-020</td>
                  <td></td>
                  <td></td>
                </tr>
                ${Array(23).fill(0).map(() => `<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>`).join('')}
                ` : `
                ${Array(28).fill(0).map(() => `<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>`).join('')}
                `}
              </tbody>
            </table>

            <div style="display: flex; justify-content: space-between; margin-top: 14px; padding: 0 10px 4px 10px;">
              <div style="width: 45%;">
                <div style="font-size: 10px;">Prepared by:</div>
                <div style="margin-top: 22px; font-weight: bold; font-size: 11px;">${preparer.fullName}</div>
                <div style="font-size: 9.5px;">${preparer.position}</div>
              </div>
              <div style="width: 45%;">
                <div style="font-size: 10px;">Certified Correct:</div>
                <div style="margin-top: 22px; font-weight: bold; font-size: 11px;">${accountant.fullName}</div>
                <div style="font-size: 9.5px;">${accountant.position}</div>
              </div>
            </div>
          </div>
        </div>

        </body> 
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const handlePrintCtcCover = (snapshot?: any) => {
    const isSnap = isSnapshot(snapshot);
    const snap = isSnap ? snapshot : undefined;

    const data = snap?.filteredCtcCollections || filteredCtcCollections;
    if (data.length === 0) return;

    let minCtc = (snap?.ctcStartOr1 !== undefined ? snap.ctcStartOr1 : (snap?.startOr1 !== undefined ? snap.startOr1 : ctcStartOr1)) || '';
    let maxCtc = (snap?.ctcEndOr1 !== undefined ? snap.ctcEndOr1 : (snap?.endOr1 !== undefined ? snap.endOr1 : ctcEndOr1)) || '';
    if (!minCtc || !maxCtc) {
      const sorted = [...data].sort((a, b) => (a.ctcNo || '').localeCompare(b.ctcNo || '', undefined, { numeric: true }));
      minCtc = sorted[0]?.ctcNo || '';
      maxCtc = sorted[sorted.length - 1]?.ctcNo || '';
    }

    const total = data.reduce((s: number, i: CommunityTaxItem) => s + (i.amount || 0), 0);
    const totalPenalty = data.reduce((s: number, i: CommunityTaxItem) => s + (i.penalty || 0), 0);
    const totalBasic = Math.max(0, total - totalPenalty);

    const afNo = snap?.afNo || snap?.filterBookletNo || snap?.ctcFilterBookletNo || snap?.ctcFilterAfNo || ctcFilterBookletNo || 'BRF NO. 0016';

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
        <head>
          <title>Print Community Tax Cover - ${afNo}</title>
          <style>
            @page { size: Letter portrait; margin: 0.5in; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
            .container { display: flex; width: 100%; height: 100vh; justify-content: center; align-items: center; }
            .column { width: 85%; padding: 30px; border: 3px double #000; text-align: center; }
            .header-box { font-size: 18px; font-weight: bold; color: #000000; margin-bottom: 25px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .label { font-size: 14px; font-weight: bold; color: #475569; text-transform: uppercase; margin-top: 15px; }
            .value { font-size: 22px; font-weight: 800; text-decoration: underline; margin-top: 5px; }
            .breakdown { margin-top: 25px; padding-top: 15px; border-top: 1px dashed #94a3b8; display: flex; justify-content: space-around; }
            .breakdown-item { font-size: 14px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="column">
              <div class="header-box">
                COMMUNITY TAX CERTIFICATE (CEDULA)
              </div>
              <div class="label">CTC / CERTIFICATE NO. RANGE</div>
              <div class="value">${minCtc} — ${maxCtc}</div>

              <div class="label">TOTAL REMITTANCE AMOUNT</div>
              <div class="value" style="color: #0284c7;">₱ ${total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>

              <div class="breakdown">
                <div class="breakdown-item">TOTAL BASIC AMOUNT: ₱ ${totalBasic.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                <div class="breakdown-item">TOTAL PENALTY: ₱ ${totalPenalty.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const handlePrintCommunityTaxReport = (accountableOfficerName?: string, accountableOfficerPosition?: string, snapshot?: any) => {
    const isSnap = isSnapshot(snapshot);
    const snap = isSnap ? snapshot : undefined;

    const reportData = snap?.filteredCtcCollections || filteredCtcCollections;
    const totalAmount = reportData.reduce((sum: number, item: CommunityTaxItem) => sum + (item.amount || 0), 0);

    let minCtc = (snap?.ctcStartOr1 !== undefined ? snap.ctcStartOr1 : (snap?.startOr1 !== undefined ? snap.startOr1 : ctcStartOr1)) || '';
    let maxCtc = (snap?.ctcEndOr1 !== undefined ? snap.ctcEndOr1 : (snap?.endOr1 !== undefined ? snap.endOr1 : ctcEndOr1)) || '';
    if (!minCtc || !maxCtc) {
      if (reportData.length > 0) {
        const sortedCtc = [...reportData].sort((a, b) => (a.ctcNo || '').localeCompare(b.ctcNo || '', undefined, { numeric: true }));
        minCtc = sortedCtc[0]?.ctcNo || '';
        maxCtc = sortedCtc[sortedCtc.length - 1]?.ctcNo || '';
      }
    }

    const minNum = parseInt(minCtc.replace(/\D/g, ''), 10);
    const maxNum = parseInt(maxCtc.replace(/\D/g, ''), 10);
    const qty = (!isNaN(minNum) && !isNaN(maxNum) && maxNum >= minNum) ? (maxNum - minNum + 1) : reportData.length;

    const afNoTitle = snap?.afNo || snap?.filterBookletNo || snap?.ctcFilterBookletNo || snap?.ctcFilterAfNo || ctcFilterBookletNo || 'BRF NO. 0016';
    const formNameTitle = getAfFormType(afNoTitle, 'ctc');

    interface AfRangeItem {
      name: string;
      minOr: string;
      maxOr: string;
      amount: number;
      qty: number;
      minNum: number;
      maxNum: number;
    }

    const afRanges: AfRangeItem[] = [{
      name: formNameTitle,
      minOr: minCtc || 'N/A',
      maxOr: maxCtc || 'N/A',
      amount: totalAmount,
      qty: qty,
      minNum: isNaN(minNum) ? -1 : minNum,
      maxNum: isNaN(maxNum) ? -1 : maxNum
    }];

    interface SectionCRow {
      name: string;
      begQty: string | number;
      begFrom: string;
      begTo: string;
      recQty: string;
      recFrom: string;
      recTo: string;
      issQty: string | number;
      issFrom: string;
      issTo: string;
      endQty: string | number;
      endFrom: string;
      endTo: string;
    }

    const sectionCRows: SectionCRow[] = [];
    let prevEndState: { formName: string; toNum: number; nextStartNum: number; padLen: number } | null = null;

    afRanges.forEach((range) => {
      const formName = formNameTitle;
      const padLen = range.minOr.length || 6;
      const fmt = (n: number) => n.toString().padStart(padLen, '0');

      const startNum = range.minNum;
      const endNum = range.maxNum;

      if (isNaN(startNum) || isNaN(endNum) || startNum === -1 || endNum === -1) {
        sectionCRows.push({
          name: formName,
          begQty: range.qty,
          begFrom: range.minOr,
          begTo: range.maxOr,
          recQty: '', recFrom: '', recTo: '',
          issQty: range.qty,
          issFrom: range.minOr,
          issTo: range.maxOr,
          endQty: '',
          endFrom: '',
          endTo: ''
        });
        return;
      }

      const bookletStartNum = Math.floor((startNum - 1) / 50) * 50 + 1;
      const bookletEndNum = bookletStartNum + 50 - 1;

      let begFromNum = bookletStartNum;
      let begToNum = bookletEndNum;
      let begQty = 50;

      if (prevEndState && prevEndState.formName === formName && prevEndState.toNum === bookletEndNum && prevEndState.nextStartNum === startNum) {
        begFromNum = startNum;
        begToNum = bookletEndNum;
        begQty = bookletEndNum - startNum + 1;
      } else if (startNum > bookletStartNum) {
        begFromNum = startNum;
        begToNum = bookletEndNum;
        begQty = bookletEndNum - startNum + 1;
      }

      const issFromNum = startNum;
      const issToNum = endNum;
      const issQty = endNum - startNum + 1;

      const endFromNum = issToNum + 1;
      const endToNum = bookletEndNum;
      const endQty = Math.max(0, endToNum - endFromNum + 1);

      prevEndState = {
        formName,
        toNum: bookletEndNum,
        nextStartNum: endFromNum,
        padLen
      };

      sectionCRows.push({
        name: formName,
        begQty,
        begFrom: fmt(begFromNum),
        begTo: fmt(begToNum),
        recQty: '',
        recFrom: '',
        recTo: '',
        issQty,
        issFrom: fmt(issFromNum),
        issTo: fmt(issToNum),
        endQty: endQty > 0 ? endQty : '',
        endFrom: endQty > 0 ? fmt(endFromNum) : '',
        endTo: endQty > 0 ? fmt(endToNum) : ''
      });
    });

    const dateObj = reportData.length > 0 && reportData[0].date ? new Date(reportData[0].date) : new Date();
    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const certificationDateStr = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    
    const yy = dateObj.getFullYear().toString().slice(-2);
    const mm = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const reportNo = `CTC-${yy}-${mm}-`;

    const numberToWords = (num: number): string => {
      const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
      const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

      const convertLessThanOneThousand = (n: number): string => {
        if (n === 0) return '';
        let result = '';
        if (n >= 100) {
          result += a[Math.floor(n / 100)] + ' Hundred ';
          n %= 100;
        }
        if (n >= 20) {
          result += b[Math.floor(n / 10)] + (n % 10 !== 0 ? '-' + a[n % 10] : '') + ' ';
        } else if (n > 0) {
          result += a[n] + ' ';
        }
        return result;
      };

      const intPart = Math.floor(num);
      const centPart = Math.round((num - intPart) * 100);

      let words = '';
      if (intPart === 0) {
        words = 'Zero';
      } else {
        const millions = Math.floor(intPart / 1000000);
        const thousands = Math.floor((intPart % 1000000) / 1000);
        const remainder = intPart % 1000;

        if (millions > 0) {
          words += convertLessThanOneThousand(millions).trim() + ' Million ';
        }
        if (thousands > 0) {
          words += convertLessThanOneThousand(thousands).trim() + ' Thousand ';
        }
        if (remainder > 0) {
          words += convertLessThanOneThousand(remainder).trim() + ' ';
        }
      }

      words = words.trim() + ' Pesos';

      if (centPart > 0) {
        let centWords = '';
        if (centPart >= 20) {
          centWords = b[Math.floor(centPart / 10)] + (centPart % 10 !== 0 ? '-' + a[centPart % 10] : '');
        } else {
          centWords = a[centPart];
        }
        words += ` and ${centWords} Centavos`;
      }

      return `${words.trim()} only`;
    };

    const amountInWords = numberToWords(totalAmount);

    const collector = {
      fullName: (accountableOfficerName || user?.name || 'ACCOUNTABLE OFFICER').trim().toUpperCase(),
      position: (accountableOfficerPosition || user?.position || 'Revenue Collection Clerk I').trim()
    };

    // Official Municipal Signatories (Section D & Section E)
    const { treasurer, accountant, preparer } = getSectionSignatories(signatories, collector.fullName);

    const totalPenalty = reportData.reduce((sum: number, i: CommunityTaxItem) => sum + (i.penalty || 0), 0);
    const netTax = Math.max(0, totalAmount - totalPenalty);

    const ctcEntries: { name: string; code: string; amount: number }[] = [
      {
        name: 'Community Tax',
        code: '4-01-01-050',
        amount: netTax
      },
      {
        name: 'Surcharge-CTC',
        code: '4-01-05-010',
        amount: totalPenalty
      }
    ];

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html> 
        <html lang="en"> 
        <head> 
        <meta charset="UTF-8"> 
        <title>Report of Collections and Deposits - ${formNameTitle}</title> 
        <style> 
          @page { 
            size: 8.5in 13in; 
            margin: 0.35in 0.45in; 
          }
          * {
            box-sizing: border-box;
          }
          body { 
            font-family: Arial, Helvetica, sans-serif; 
            font-size: 10.5px; 
            color: #000;
            margin: 0;
            padding: 0;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          } 
          .sheet {
            width: 100%;
            max-width: 7.6in;
            margin: 0 auto;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .page-break {
            page-break-before: always;
            break-before: page;
          }
          .appendix-tag {
            text-align: right;
            font-size: 11px;
            font-weight: bold;
            margin-bottom: 2px;
            padding-right: 2px;
          }
          .border-frame {
            border: 2px solid #000;
            padding: 6px;
            position: relative;
            min-height: 12.1in;
            display: flex;
            flex-direction: column;
          }
          .page-num {
            position: absolute;
            top: 6px;
            right: 8px;
            font-size: 10px;
          }
          .header-titles {
            text-align: center;
            margin-top: 8px;
            margin-bottom: 10px;
          }
          .header-titles .main-title {
            font-weight: bold;
            font-size: 12px;
            letter-spacing: 0.5px;
          }
          .header-titles .sub-title {
            font-weight: bold;
            font-size: 11px;
            margin-top: 1px;
          }
          .meta-table {
            width: 100%;
            border-collapse: collapse;
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
            margin-bottom: 6px;
          }
          .meta-table td {
            padding: 2px 4px;
            font-size: 10.5px;
          }
          .sec-title {
            font-weight: bold;
            font-size: 11px;
            margin-top: 4px;
            margin-bottom: 2px;
            text-transform: uppercase;
          }
          .sec-sub-title {
            font-weight: bold;
            font-size: 11px;
            text-indent: 14px;
            margin-top: 4px;
            margin-bottom: 2px;
          }
          .grid-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #000;
            font-size: 10.5px;
          }
          .grid-table th, .grid-table td {
            border: 1px solid #000;
            padding: 2px 4px;
            height: 17px;
          }
          .grid-table th {
            background-color: #f9f9f9;
            text-align: center;
            font-weight: bold;
            font-size: 10px;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .bold { font-weight: bold; }
          
          .summary-card {
            border: 2px solid #000;
            padding: 6px;
            margin-top: 8px;
          }
          .summary-grid {
            display: flex;
            gap: 15px;
          }
          .summary-left {
            flex: 1.1;
          }
          .summary-right {
            flex: 0.9;
          }
          .calc-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10.5px;
          }
          .calc-table td {
            padding: 1.5px 0;
          }
          .checks-table {
            width: 100%;
            border-collapse: collapse;
            border: 1.5px solid #000;
            font-size: 10px;
          }
          .checks-table th, .checks-table td {
            border: 1px solid #000;
            padding: 2px 4px;
            height: 16px;
          }
          .cert-grid {
            display: flex;
            gap: 20px;
            font-size: 10.5px;
            margin-top: 6px;
            align-items: stretch;
          }
          .cert-col {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .sig-row {
            display: flex;
            gap: 12px;
            align-items: flex-end;
            margin-top: auto;
            padding-top: 14px;
          }
          .sig-name-box {
            flex: 6.5;
            text-align: center;
          }
          .sig-date-box {
            flex: 3.5;
            text-align: center;
          }
          .sig-line {
            border-bottom: 1.5px solid #000;
            font-weight: bold;
            font-size: 10.5px;
            padding-bottom: 1px;
            min-height: 16px;
            line-height: 1.2;
            display: flex;
            align-items: flex-end;
            justify-content: center;
          }
          .sig-sub {
            font-size: 9.5px;
            margin-top: 2px;
            min-height: 14px;
            line-height: 1.2;
          }
        </style> 
        </head> 
        <body> 
        
        <!-- PAGE 1 OF 2 -->
        <div class="sheet">
          <div class="appendix-tag">Appendix 34</div>
          <div class="border-frame">
            <div class="page-num">Page 1 of 2</div>

            <div class="header-titles">
              <div class="main-title">REPORT OF COLLECTIONS AND DEPOSITS</div>
              <div class="sub-title">Concepcion, Romblon</div>
              <div class="sub-title">LGU</div>
            </div>

            <table class="meta-table">
              <tr>
                <td style="width: 58%;">Fund: <strong>GENERAL FUND</strong></td>
                <td style="width: 42%;">Report No.: <strong>${reportNo}</strong></td>
              </tr>
              <tr>
                <td>Name of Accountable Officer: <strong>${collector.fullName}</strong></td>
                <td>Sheet No.: <strong>01</strong></td>
              </tr>
              <tr>
                <td></td>
                <td>Date: <strong>${dateStr}</strong></td>
              </tr>
            </table>

            <div class="sec-title">A. COLLECTIONS</div>
            <div class="sec-sub-title">1. FOR COLLECTORS</div>
            <table class="grid-table">
              <thead>
                <tr>
                  <th rowspan="2" style="width: 45%;">Type (Form No.)</th>
                  <th colspan="2" style="width: 35%;">Official Receipt / Serial No.</th>
                  <th rowspan="2" style="width: 20%;">Amount</th>
                </tr>
                <tr>
                  <th style="width: 17.5%;">From</th>
                  <th style="width: 17.5%;">To</th>
                </tr>
              </thead>
              <tbody>
                ${afRanges.map(item => `
                  <tr>
                    <td>${getAfFormType(item.name || formNameTitle, 'ctc')}</td>
                    <td class="text-center">${item.minOr}</td>
                    <td class="text-center">${item.maxOr}</td>
                    <td class="text-right">${item.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                  </tr>
                `).join('')}
                ${Array(Math.max(0, 16 - afRanges.length)).fill(0).map(() => `
                  <tr><td>&nbsp;</td><td></td><td></td><td></td></tr>
                `).join('')}
                <tr>
                  <td colspan="3" class="text-right bold">Total</td>
                  <td class="text-right bold">${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>

            <div class="sec-sub-title" style="margin-top: 6px;">2. FOR LIQUIDATING OFFICERS / TREASURERS</div>
            <table class="grid-table">
              <thead>
                <tr>
                  <th style="width: 50%;">Name of Accountable Officer</th>
                  <th style="width: 25%;">Report No.</th>
                  <th style="width: 25%;">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${collector.fullName}</td>
                  <td class="text-center">${reportNo}</td>
                  <td class="text-right">${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                </tr>
                ${Array(17).fill(0).map(() => `
                  <tr><td>&nbsp;</td><td></td><td></td></tr>
                `).join('')}
                <tr>
                  <td colspan="2" class="text-right bold">Total</td>
                  <td class="text-right bold">${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>

            <div class="sec-title" style="margin-top: 6px;">B. REMITTANCES/DEPOSITS</div>
            <table class="grid-table">
              <thead>
                <tr>
                  <th style="width: 50%;">Accountable Officer / Bank</th>
                  <th style="width: 25%;">Reference</th>
                  <th style="width: 25%;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${Array(15).fill(0).map(() => `
                  <tr><td>&nbsp;</td><td></td><td></td></tr>
                `).join('')}
                <tr>
                  <td colspan="2" class="text-right bold">Total</td>
                  <td class="text-right bold">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="page-break"></div>

        <!-- PAGE 2 OF 2 -->
        <div class="sheet">
          <div class="appendix-tag">Appendix 34</div>
          <div class="border-frame">
            <div class="page-num">Page 2 of 2</div>

            <div class="sec-title" style="margin-top: 2px;">C. ACCOUNTABILITY FOR ACCOUNTABLE FORMS</div>
            <table class="grid-table">
              <thead>
                <tr>
                  <th rowspan="2" style="width: 20%;">Name of Form & No.</th>
                  <th colspan="3" style="width: 20%;">Beginning Balance</th>
                  <th colspan="3" style="width: 20%;">Receipt</th>
                  <th colspan="3" style="width: 20%;">Issued</th>
                  <th colspan="3" style="width: 20%;">Ending Balance</th>
                </tr>
                <tr>
                  <th style="width: 5%;">Qty</th><th style="width: 7.5%;">From</th><th style="width: 7.5%;">To</th>
                  <th style="width: 5%;">Qty</th><th style="width: 7.5%;">From</th><th style="width: 7.5%;">To</th>
                  <th style="width: 5%;">Qty</th><th style="width: 7.5%;">From</th><th style="width: 7.5%;">To</th>
                  <th style="width: 5%;">Qty</th><th style="width: 7.5%;">From</th><th style="width: 7.5%;">To</th>
                </tr>
              </thead>
              <tbody>
                ${sectionCRows.map(r => `
                  <tr>
                    <td>${getAfFormType(r.name, 'ctc')}</td>
                    <td class="text-center">${r.begQty}</td><td class="text-center">${r.begFrom}</td><td class="text-center">${r.begTo}</td>
                    <td class="text-center">${r.recQty}</td><td class="text-center">${r.recFrom}</td><td class="text-center">${r.recTo}</td>
                    <td class="text-center">${r.issQty}</td><td class="text-center">${r.issFrom}</td><td class="text-center">${r.issTo}</td>
                    <td class="text-center">${r.endQty}</td><td class="text-center">${r.endFrom}</td><td class="text-center">${r.endTo}</td>
                  </tr>
                `).join('')}
                ${Array(Math.max(0, 8 - sectionCRows.length)).fill(0).map(() => `
                  <tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
                `).join('')}
              </tbody>
            </table>

            <div class="summary-card" style="border: 2px solid #000; padding: 8px 10px; margin-top: 8px; margin-bottom: 8px;">
              <div style="font-weight: bold; font-size: 11px; margin-bottom: 8px;">D. SUMMARY OF COLLECTIONS</div>
              <div class="summary-grid" style="display: flex; gap: 20px; align-items: flex-start;">
                <!-- Left Summary -->
                <div class="summary-left" style="flex: 1.15;">
                  <table class="calc-table" style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
                    <tr>
                      <td colspan="3" style="padding-bottom: 2px;">Beginning Balance: ${dateStr}</td>
                    </tr>
                    <tr>
                      <td colspan="3" style="padding-bottom: 2px;">Add: Collections</td>
                    </tr>
                    <tr>
                      <td style="padding-left: 20px; width: 55%;">Cash</td>
                      <td style="text-align: right; width: 25px;">₱</td>
                      <td style="text-align: right; width: 105px;">${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td style="padding-left: 20px;">Check/s</td>
                      <td style="text-align: right;"></td>
                      <td style="text-align: right; border-bottom: 1.5px solid #000;">-</td>
                    </tr>
                    <tr>
                      <td>Total</td>
                      <td style="text-align: right;">₱</td>
                      <td style="text-align: right; border-bottom: 1.5px solid #000;">${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td>Less: Remittance/Deposit to Treasurer</td>
                      <td style="text-align: right;">₱</td>
                      <td style="text-align: right; border-bottom: 1.5px solid #000;">${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td style="padding-top: 2px;">Balance</td>
                      <td style="text-align: right; padding-top: 2px;">₱</td>
                      <td style="text-align: right; border-bottom: 2px solid #000; padding-top: 2px;">-</td>
                    </tr>
                  </table>
                </div>

                <!-- Right: List of Checks -->
                <div class="summary-right" style="flex: 0.85;">
                  <div style="font-size: 10px; margin-bottom: 3px;">List of Checks :</div>
                  <table class="checks-table" style="width: 100%; border-collapse: collapse; border: 2px solid #000; font-size: 10px;">
                    <thead>
                      <tr>
                        <th style="width: 35%; border: 1.5px solid #000; height: 18px;"></th>
                        <th style="width: 35%; border: 1.5px solid #000; font-weight: bold; text-align: center;">Payee</th>
                        <th style="width: 30%; border: 1.5px solid #000; font-weight: bold; text-align: center;">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td style="border: 1.5px solid #000; height: 18px;">&nbsp;</td><td style="border: 1.5px solid #000;"></td><td style="border: 1.5px solid #000;"></td></tr>
                      <tr><td style="border: 1.5px solid #000; height: 18px;">&nbsp;</td><td style="border: 1.5px solid #000;"></td><td style="border: 1.5px solid #000;"></td></tr>
                      <tr><td style="border: 1.5px solid #000; height: 18px;">&nbsp;</td><td style="border: 1.5px solid #000;"></td><td style="border: 1.5px solid #000;"></td></tr>
                    </tbody>
                  </table>
                  <div style="font-size: 9.5px; text-align: center; margin-top: 4px;">NOTE: Use additional sheet if necessary.</div>
                </div>
              </div>

              <!-- Thick Dividing Line -->
              <div style="border-bottom: 2px solid #000; margin: 14px 0 12px 0;"></div>

              <!-- Certifications -->
              <div class="cert-grid">
                <div class="cert-col">
                  <div>
                    <div style="font-weight: bold; margin-bottom: 6px; font-size: 10.5px;">CERTIFICATION:</div>
                    <p style="font-size: 9.5px; line-height: 1.4; margin: 0; text-align: justify;">
                      I hereby certify that the foregoing report of collections and deposits, and accountability for accountable forms is true and correct.
                    </p>
                  </div>
                  <div class="sig-row">
                    <div class="sig-name-box">
                      <div class="sig-line">${collector.fullName}</div>
                      <div class="sig-sub">${collector.position}</div>
                    </div>
                    <div class="sig-date-box">
                      <div class="sig-line">${certificationDateStr}</div>
                      <div class="sig-sub">Date</div>
                    </div>
                  </div>
                </div>

                <div class="cert-col">
                  <div>
                    <div style="font-weight: bold; margin-bottom: 6px; font-size: 10.5px;">VERIFICATION AND ACKNOWLEDGMENT:</div>
                    <p style="font-size: 9.5px; line-height: 1.4; margin: 0; text-align: justify;">
                      I hereby certify that the foregoing report of collections has been verified and acknowledge receipt of (₱ ${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}) ${amountInWords}
                    </p>
                  </div>
                  <div class="sig-row">
                    <div class="sig-name-box">
                      <div class="sig-line">${treasurer.fullName}</div>
                      <div class="sig-sub">${treasurer.position}</div>
                    </div>
                    <div class="sig-date-box">
                      <div class="sig-line">${certificationDateStr}</div>
                      <div class="sig-sub">Date</div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="sec-title" style="margin-top: 6px;">E. ACCOUNTING ENTRIES</div>
              <table class="grid-table">
                <thead>
                  <tr>
                    <th style="width: 45%;">Particulars</th>
                    <th style="width: 20%;">Account Code</th>
                    <th style="width: 17.5%;">Debit</th>
                    <th style="width: 17.5%;">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="text-left">Cash in Local Treasury</td>
                    <td class="text-center">1-01-01-010</td>
                    <td class="text-right">₱ ${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td></td>
                  </tr>
                  ${ctcEntries.map(entry => `
                    <tr>
                      <td class="text-left">${entry.name}</td>
                      <td class="text-center">${entry.code}</td>
                      <td></td>
                      <td class="text-right">${entry.amount > 0 ? `₱ ${entry.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '-'}</td>
                    </tr>
                  `).join('')}
                  ${Array(28).fill(0).map(() => `
                    <tr><td>&nbsp;</td><td></td><td></td><td></td></tr>
                  `).join('')}
                </tbody>
              </table>

              <!-- Bottom Preparer and Accountant Signatures -->
              <div style="display: flex; justify-content: space-between; margin-top: 14px; padding: 0 10px 4px 10px; font-size: 10px;">
                <div style="width: 45%;">
                  <div style="font-size: 10px;">Prepared by:</div>
                  <div style="margin-top: 22px; font-weight: bold; font-size: 11px;">${preparer.fullName}</div>
                  <div style="font-size: 9.5px;">${preparer.position}</div>
                </div>
                <div style="width: 45%;">
                  <div style="font-size: 10px;">Certified Correct:</div>
                  <div style="margin-top: 22px; font-weight: bold; font-size: 11px;">${accountant.fullName}</div>
                  <div style="font-size: 9.5px;">${accountant.position}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        </body> 
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const handleExportToExcel = (snapshot?: any) => {
    try {
      const wb = XLSX.utils.book_new();

      // 1. Collections Details Sheet (filtered or all)
      const dataToExport = snapshot?.filteredCollections || (filteredCollections.length > 0 ? filteredCollections : collections);
      if (dataToExport.length > 0) {
        const collectionsSheetData = dataToExport.map((item: CollectionItem, idx: number) => ({
          '#': idx + 1,
          'Date': item.date || '',
          'AF No.': item.afNo || '',
          'OR No.': item.orNo || '',
          'Payor / Taxpayer': item.payor || '',
          'Particulars / Sub-Category': item.subCategory || '',
          'Main Category': item.mainCategory || '',
          'Account Code': item.accountCode || '',
          'Amount (PHP)': item.amount ?? 0,
          'Remarks': item.remarks || ''
        }));

        const wsCollections = XLSX.utils.json_to_sheet(collectionsSheetData);
        wsCollections['!cols'] = [
          { wch: 6 },
          { wch: 13 },
          { wch: 10 },
          { wch: 15 },
          { wch: 30 },
          { wch: 32 },
          { wch: 28 },
          { wch: 16 },
          { wch: 16 },
          { wch: 25 }
        ];
        XLSX.utils.book_append_sheet(wb, wsCollections, 'Collections Details');
      }

      // 2. Summary by AF No.
      if (afNoSummary.length > 0) {
        const afSummaryRows = afNoSummary.map(item => ({
          'Accountable Form (AF)': item.afNo,
          'Total Amount (PHP)': item.amount
        }));
        const wsAf = XLSX.utils.json_to_sheet(afSummaryRows);
        wsAf['!cols'] = [{ wch: 25 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, wsAf, 'AF Summary');
      }

      // 3. Summary by Main Category
      if (mainCategorySummary.length > 0) {
        const mainCatRows = mainCategorySummary.map(item => ({
          'Main Category': item.mainCategory,
          'Total Amount (PHP)': item.amount
        }));
        const wsMain = XLSX.utils.json_to_sheet(mainCatRows);
        wsMain['!cols'] = [{ wch: 35 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, wsMain, 'Main Category Summary');
      }

      // 4. Summary by Sub Category
      if (subCategorySummary.length > 0) {
        const subCatRows = subCategorySummary.map(item => ({
          'Sub-Category / Account': item.subCategory,
          'Total Amount (PHP)': item.amount
        }));
        const wsSub = XLSX.utils.json_to_sheet(subCatRows);
        wsSub['!cols'] = [{ wch: 40 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, wsSub, 'Sub-Category Summary');
      }

      // 5. Monthly Summary
      if (monthlySummary.length > 0) {
        const monthRows = monthlySummary.map(item => ({
          'Month / Year': item.monthYear,
          'Total Amount (PHP)': item.amount
        }));
        const wsMonth = XLSX.utils.json_to_sheet(monthRows);
        wsMonth['!cols'] = [{ wch: 25 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, wsMonth, 'Monthly Summary');
      }

      // 6. RPT Collections Sheet
      const rptDataToExport = snapshot?.filteredRptCollections || (filteredRptCollections.length > 0 ? filteredRptCollections : rptCollections);
      if (rptDataToExport.length > 0) {
        const rptSheetData = rptDataToExport.map((item: RPTCollectionItem, idx: number) => ({
          '#': idx + 1,
          'Date': item.date || '',
          'AF56 ID': item.af56Id || '',
          'OR Number': item.orNumber || '',
          'Payor / Declared Owner': item.payor || '',
          'Barangay': item.barangay || '',
          'Land / Property Name': item.landName || '',
          'Tax Declaration (TD) No.': item.tdNumber || '',
          'Period Covered / Years Paid': item.yearsPaid || '',
          'Amount (PHP)': item.amount ?? 0,
          'Remarks': item.remarks || ''
        }));

        const wsRpt = XLSX.utils.json_to_sheet(rptSheetData);
        wsRpt['!cols'] = [
          { wch: 6 },
          { wch: 13 },
          { wch: 15 },
          { wch: 15 },
          { wch: 30 },
          { wch: 22 },
          { wch: 26 },
          { wch: 22 },
          { wch: 25 },
          { wch: 16 },
          { wch: 25 }
        ];
        XLSX.utils.book_append_sheet(wb, wsRpt, 'RPT Collections (AF56)');
      }

      // 7. Community Tax Sheet (BRF 0016)
      const ctcDataToExport = snapshot?.filteredCtcCollections || (filteredCtcCollections.length > 0 ? filteredCtcCollections : communityTaxCollections);
      if (ctcDataToExport.length > 0) {
        const ctcSheetData = ctcDataToExport.map((item: CommunityTaxItem, idx: number) => ({
          '#': idx + 1,
          'Date': item.date || '',
          'Form No.': item.afNo || 'BRF 0016',
          'CTC Number': item.ctcNo || '',
          'Taxpayer Name': item.taxpayerName || '',
          'Gender': item.gender || 'Male',
          'Barangay': item.barangay || '',
          'Address': item.address || '',
          'Basic Tax (PHP)': item.basicTax ?? 0,
          'Additional Tax (PHP)': item.additionalTax ?? 0,
          'Penalty / Surcharge (PHP)': item.penalty ?? 0,
          'Total Amount (PHP)': item.amount ?? 0,
          'Remarks': item.remarks || ''
        }));

        const wsCtc = XLSX.utils.json_to_sheet(ctcSheetData);
        wsCtc['!cols'] = [
          { wch: 6 },
          { wch: 13 },
          { wch: 12 },
          { wch: 16 },
          { wch: 28 },
          { wch: 15 },
          { wch: 18 },
          { wch: 25 },
          { wch: 15 },
          { wch: 18 },
          { wch: 18 },
          { wch: 18 },
          { wch: 25 }
        ];
        XLSX.utils.book_append_sheet(wb, wsCtc, 'Community Tax (BRF 0016)');
      }

      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `RCD_Reports_Summary_${timestamp}.xlsx`;
      XLSX.writeFile(wb, filename);

      setNotification({
        open: true,
        message: `Successfully exported reports data to ${filename}`,
        severity: 'success'
      });
    } catch (err: any) {
      console.error('Error exporting data to Excel:', err);
      setNotification({
        open: true,
        message: 'Failed to export reports to Excel. Please try again.',
        severity: 'error'
      });
    }
  };

  return (
    <Box>
      <Notification
        open={notification.open}
        message={notification.message}
        severity={notification.severity}
        onClose={() => setNotification(prev => ({ ...prev, open: false }))}
      />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography variant="h5" component="h1" fontWeight="800" sx={{ color: '#0f172a' }}>
            Reports & Summaries
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.2, fontSize: '0.82rem' }}>
            Consolidated collection reports, accountable forms summary, and official RCD printouts.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Collection Details Tab (tab 0) */}
          {tabValue === 0 && (
            <>
              <Box sx={{ minWidth: 135, width: 145 }}>
                <Autocomplete
                  size="small"
                  options={validOrs}
                  value={startOr1}
                  onChange={(_, newValue) => setStartOr1(newValue)}
                  getOptionLabel={(option) => cleanOrDisplay(option)}
                  renderInput={(params) => <TextField {...params} label="Start OR 1" sx={{ '& .MuiInputBase-input': { fontSize: '0.82rem', fontWeight: 600 } }} />}
                />
              </Box>
              <Box sx={{ minWidth: 135, width: 145 }}>
                <Autocomplete
                  size="small"
                  options={validEndOr1Options}
                  value={endOr1}
                  onChange={(_, newValue) => setEndOr1(newValue)}
                  getOptionLabel={(option) => cleanOrDisplay(option)}
                  renderInput={(params) => <TextField {...params} label="End OR 1" sx={{ '& .MuiInputBase-input': { fontSize: '0.82rem', fontWeight: 600 } }} />}
                />
              </Box>
              <Box sx={{ minWidth: 135, width: 145 }}>
                <Autocomplete
                  size="small"
                  options={validStartOr2Options}
                  value={startOr2}
                  onChange={(_, newValue) => setStartOr2(newValue)}
                  getOptionLabel={(option) => cleanOrDisplay(option)}
                  renderInput={(params) => <TextField {...params} label="Start OR 2" sx={{ '& .MuiInputBase-input': { fontSize: '0.82rem', fontWeight: 600 } }} />}
                />
              </Box>
              <Box sx={{ minWidth: 135, width: 145 }}>
                <Autocomplete
                  size="small"
                  options={validEndOr2Options}
                  value={endOr2}
                  onChange={(_, newValue) => setEndOr2(newValue)}
                  getOptionLabel={(option) => cleanOrDisplay(option)}
                  renderInput={(params) => <TextField {...params} label="End OR 2" sx={{ '& .MuiInputBase-input': { fontSize: '0.82rem', fontWeight: 600 } }} />}
                />
              </Box>
              <Tooltip title="Print Cover" arrow>
                <IconButton 
                  color="primary"
                  disabled={filteredCollections.length === 0}
                  onClick={() => handlePrintCover()}
                  sx={{ 
                    bgcolor: '#0284c7', 
                    color: '#ffffff', 
                    borderRadius: 1,
                    '&:hover': { bgcolor: '#0369a1', color: '#ffffff' }
                  }}
                >
                  <Print />
                </IconButton>
              </Tooltip>
              <Tooltip title="Print Official RCD Report" arrow>
                <IconButton 
                  color="primary" 
                  onClick={() => handleInitiatePrint('COLLECTIONS')}
                  sx={{ 
                    bgcolor: '#0284c7', 
                    color: '#ffffff', 
                    borderRadius: 1, 
                    '&:hover': { bgcolor: '#0369a1', color: '#ffffff' } 
                  }}
                >
                  <Print />
                </IconButton>
              </Tooltip>
              <Tooltip title="Export All Data to Excel" arrow>
                <IconButton 
                  color="secondary" 
                  onClick={handleExportToExcel}
                  sx={{ 
                    bgcolor: '#f0f9ff', 
                    color: '#0284c7',
                    borderRadius: 1, 
                    border: '1px solid rgba(14, 165, 233, 0.2)',
                    '&:hover': { bgcolor: '#e0f2fe' }
                  }}
                >
                  <Download />
                </IconButton>
              </Tooltip>
            </>
          )}

          {/* RPT Collections Tab (tab 1) */}
          {tabValue === 1 && (
            <>
              <Box sx={{ minWidth: 135, width: 145 }}>
                <Autocomplete
                  size="small"
                  options={validRptOrs}
                  value={rptStartOr1}
                  onChange={(_, newValue) => setRptStartOr1(newValue)}
                  getOptionLabel={(option) => cleanOrDisplay(option)}
                  renderInput={(params) => <TextField {...params} label="Start OR" sx={{ '& .MuiInputBase-input': { fontSize: '0.82rem', fontWeight: 600 } }} />}
                />
              </Box>
              <Box sx={{ minWidth: 135, width: 145 }}>
                <Autocomplete
                  size="small"
                  options={validRptEndOr1Options}
                  value={rptEndOr1}
                  onChange={(_, newValue) => setRptEndOr1(newValue)}
                  getOptionLabel={(option) => cleanOrDisplay(option)}
                  renderInput={(params) => <TextField {...params} label="End OR" sx={{ '& .MuiInputBase-input': { fontSize: '0.82rem', fontWeight: 600 } }} />}
                />
              </Box>
              <Tooltip title="Print RPT Cover" arrow>
                <IconButton
                  color="primary"
                  onClick={() => handlePrintRptCover()}
                  disabled={filteredRptCollections.length === 0}
                  sx={{ 
                    bgcolor: '#0284c7', 
                    color: '#ffffff', 
                    borderRadius: 1,
                    '&:hover': { bgcolor: '#0369a1', color: '#ffffff' }
                  }}
                >
                  <Print />
                </IconButton>
              </Tooltip>
              <Tooltip title="Print General Fund RPT Report" arrow>
                <IconButton
                  color="primary"
                  onClick={() => handleInitiatePrint('RPT_GENERAL')}
                  disabled={filteredRptCollections.length === 0}
                  sx={{ 
                    bgcolor: '#0369a1', 
                    color: '#ffffff', 
                    borderRadius: 1, 
                    '&:hover': { bgcolor: '#075985', color: '#ffffff' } 
                  }}
                >
                  <Print />
                </IconButton>
              </Tooltip>
              <Tooltip title="Print Special Education Fund (SEF) RPT Report" arrow>
                <IconButton
                  color="secondary"
                  onClick={() => handleInitiatePrint('RPT_SEF')}
                  disabled={filteredRptCollections.length === 0}
                  sx={{ 
                    bgcolor: '#f0f9ff', 
                    color: '#0369a1',
                    borderRadius: 1, 
                    border: '1px solid rgba(14, 165, 233, 0.4)',
                    '&:hover': { bgcolor: '#e0f2fe' }
                  }}
                >
                  <Print />
                </IconButton>
              </Tooltip>
              <Tooltip title="Export RPT & All Data to Excel" arrow>
                <IconButton 
                  color="secondary" 
                  onClick={handleExportToExcel}
                  sx={{ 
                    bgcolor: '#f0f9ff', 
                    color: '#0284c7',
                    borderRadius: 1, 
                    border: '1px solid rgba(14, 165, 233, 0.2)',
                    '&:hover': { bgcolor: '#e0f2fe' }
                  }}
                >
                  <Download />
                </IconButton>
              </Tooltip>
            </>
          )}

          {/* Community Tax Tab (tab 2) */}
          {tabValue === 2 && (
            <>
              <Box sx={{ minWidth: 165, width: 175 }}>
                <Autocomplete
                  size="small"
                  options={validCtcOrs}
                  value={ctcStartOr1}
                  onChange={(_, newValue) => setCtcStartOr1(newValue)}
                  getOptionLabel={(option) => cleanOrDisplay(option)}
                  renderInput={(params) => <TextField {...params} label="Start CTC No." sx={{ '& .MuiInputBase-input': { fontSize: '0.86rem', fontWeight: 600 } }} />}
                />
              </Box>
              <Box sx={{ minWidth: 165, width: 175 }}>
                <Autocomplete
                  size="small"
                  options={validCtcOrs}
                  value={ctcEndOr1}
                  onChange={(_, newValue) => setCtcEndOr1(newValue)}
                  getOptionLabel={(option) => cleanOrDisplay(option)}
                  renderInput={(params) => <TextField {...params} label="End CTC No." sx={{ '& .MuiInputBase-input': { fontSize: '0.86rem', fontWeight: 600 } }} />}
                />
              </Box>
              <Tooltip title="Print Community Tax Cover" arrow>
                <IconButton
                  color="primary"
                  onClick={() => handlePrintCtcCover()}
                  sx={{ 
                    bgcolor: '#0284c7', 
                    color: '#ffffff', 
                    borderRadius: 1,
                    '&:hover': { bgcolor: '#0369a1', color: '#ffffff' }
                  }}
                >
                  <Print />
                </IconButton>
              </Tooltip>
              <Tooltip title="Print Official Community Tax RCD (BRF NO. 0016)" arrow>
                <IconButton
                  color="primary"
                  onClick={() => handleInitiatePrint('COMMUNITY_TAX')}
                  sx={{ 
                    bgcolor: '#0369a1', 
                    color: '#ffffff', 
                    borderRadius: 1, 
                    '&:hover': { bgcolor: '#075985', color: '#ffffff' } 
                  }}
                >
                  <Print />
                </IconButton>
              </Tooltip>
              <Tooltip title="Export Community Tax to Excel" arrow>
                <IconButton 
                  color="secondary" 
                  onClick={handleExportToExcel}
                  sx={{ 
                    bgcolor: '#f0f9ff', 
                    color: '#0284c7',
                    borderRadius: 1, 
                    border: '1px solid rgba(14, 165, 233, 0.2)',
                    '&:hover': { bgcolor: '#e0f2fe' }
                  }}
                >
                  <Download />
                </IconButton>
              </Tooltip>
            </>
          )}

          {/* RCD Summaries Tab (tab 4) */}
          {tabValue === 4 && (
            <>
              <Tooltip title="Print Official RCD Report" arrow>
                <IconButton 
                  color="primary" 
                  onClick={() => handleInitiatePrint('COLLECTIONS')}
                  sx={{ 
                    bgcolor: '#0284c7', 
                    color: '#ffffff', 
                    borderRadius: 1, 
                    '&:hover': { bgcolor: '#0369a1', color: '#ffffff' } 
                  }}
                >
                  <Print />
                </IconButton>
              </Tooltip>
              <Tooltip title="Export All Data to Excel" arrow>
                <IconButton 
                  color="secondary" 
                  onClick={handleExportToExcel}
                  sx={{ 
                    bgcolor: '#f0f9ff', 
                    color: '#0284c7',
                    borderRadius: 1, 
                    border: '1px solid rgba(14, 165, 233, 0.2)',
                    '&:hover': { bgcolor: '#e0f2fe' }
                  }}
                >
                  <Download />
                </IconButton>
              </Tooltip>
            </>
          )}

          <Tooltip title="Refresh Data & Unarchived Collections" arrow>
            <IconButton
              onClick={() => loadAllData()}
              sx={{
                bgcolor: '#f8fafc',
                color: '#475569',
                borderRadius: 1,
                border: '1px solid #cbd5e1',
                '&:hover': { bgcolor: '#f1f5f9', color: '#0284c7', borderColor: '#0284c7' }
              }}
            >
              <Refresh />
            </IconButton>
          </Tooltip>

          <Button
            variant="contained"
            color="success"
            startIcon={<Send />}
            onClick={handleOpenSubmitDialog}
            sx={{
              bgcolor: '#059669',
              fontWeight: 700,
              borderRadius: 1,
              px: 2,
              ml: 1,
              '&:hover': { bgcolor: '#047857' }
            }}
          >
            Submit Report
          </Button>
        </Box>
      </Box>

      <Paper elevation={0} sx={{ width: '100%', overflow: 'hidden', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          sx={{ 
            borderBottom: '1px solid #e2e8f0', 
            px: 2, 
            pt: 1.5,
            bgcolor: '#f8fafc',
            '& .MuiTab-root': {
              fontWeight: 700,
              fontSize: '0.92rem',
              color: '#64748b',
              borderRadius: '4px 4px 0 0',
              '&.Mui-selected': {
                color: '#0284c7',
                bgcolor: '#ffffff'
              }
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#0284c7',
              height: 3,
              borderRadius: '2px 2px 0 0'
            }
          }}
        >
          <Tab label="Collection Details" />
          <Tab label="RPT Collections" />
          <Tab label="Community Tax" />
          <Tab label={`Submitted Archives (${groupedArchiveReports.length})`} />
          <Tab label="RCD Summaries" />
        </Tabs>

        {isLoading ? (
          <ModernLoadingOverlay message={loadingStatusMessage} />
        ) : (
          <>
            {tabValue === 4 && (
              <Box sx={{ p: 3 }}>
                <Grid container spacing={3} sx={{ mb: 4 }}>
                  {/* AF No. Summary */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Paper elevation={0} sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
                      <Typography variant="h6" gutterBottom fontWeight="bold">
                        Collection by Accountable Form
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold' }}>AF No.</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Amount</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {afNoSummary.map((item) => (
                              <TableRow key={item.afNo}>
                                <TableCell>{item.afNo}</TableCell>
                                <TableCell align="right">
                                  ₱ {item.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold' }}>Total</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                ₱ {afNoSummary.reduce((sum, item) => sum + item.amount, 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Paper>
                  </Grid>

                  {/* Monthly Summary */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Paper elevation={0} sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
                      <Typography variant="h6" gutterBottom fontWeight="bold">
                        Collection by Month & Year
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold' }}>Month & Year</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Amount</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {monthlySummary.map((item) => (
                              <TableRow key={item.monthYear}>
                                <TableCell>{item.monthYear}</TableCell>
                                <TableCell align="right">
                                  ₱ {item.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold' }}>Total</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                ₱ {monthlySummary.reduce((sum, item) => sum + item.amount, 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Paper>
                  </Grid>

                  {/* Sub Category Summary */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
                      <Typography variant="h6" gutterBottom fontWeight="bold">
                        Collection by Sub Category
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold' }}>Sub Category</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Amount</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {subCategorySummary.map((item) => (
                              <TableRow key={item.subCategory}>
                                <TableCell>{item.subCategory}</TableCell>
                                <TableCell align="right">
                                  ₱ {item.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold' }}>Total</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                ₱ {subCategorySummary.reduce((sum, item) => sum + item.amount, 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Paper>
                  </Grid>

                  {/* Main Category Summary */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
                      <Typography variant="h6" gutterBottom fontWeight="bold">
                        Collection by Main Category
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold' }}>Main Category</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Amount</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {mainCategorySummary.map((item) => (
                              <TableRow key={item.mainCategory}>
                                <TableCell>{item.mainCategory}</TableCell>
                                <TableCell align="right">
                                  ₱ {item.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold' }}>Total</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                ₱ {mainCategorySummary.reduce((sum, item) => sum + item.amount, 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
            )}

            {tabValue === 0 && (
              <>
                <Box sx={{ p: 2, borderBottom: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                    {uniqueCollectors.length > 0 && (
                      <Box sx={{ flexGrow: 1, minWidth: '180px' }}>
                        <Autocomplete
                          multiple
                          size="small"
                          options={uniqueCollectors}
                          value={selectedCollectors}
                          onChange={(_, newValue) => setSelectedCollectors(newValue)}
                          renderInput={(params) => <TextField {...params} label="Collector Name" placeholder="All Collectors" />}
                        />
                      </Box>
                    )}

                    <Box sx={{ flexGrow: 1, minWidth: '150px' }}>
                      <Autocomplete
                        multiple
                        size="small"
                        options={uniqueAfNos}
                        value={selectedAfNos}
                        onChange={(_, newValue) => setSelectedAfNos(newValue)}
                        renderInput={(params) => <TextField {...params} label="AF No." placeholder="All AF No." />}
                      />
                    </Box>

                    <Box sx={{ flexGrow: 2, minWidth: '250px' }}>
                      <Autocomplete
                        multiple
                        size="small"
                        options={uniqueSubCategories}
                        value={selectedSubCategories}
                        onChange={(_, newValue) => setSelectedSubCategories(newValue)}
                        renderInput={(params) => <TextField {...params} label="Sub Category" placeholder="All Sub Categories" />}
                      />
                    </Box>
                    <Box sx={{ flexGrow: 2, minWidth: '250px' }}>
                      <Autocomplete
                        multiple
                        size="small"
                        options={uniqueMainCategories}
                        value={selectedMainCategories}
                        onChange={(_, newValue) => setSelectedMainCategories(newValue)}
                        renderInput={(params) => <TextField {...params} label="Main Category" placeholder="All Main Categories" />}
                      />
                    </Box>
                    <Box sx={{ flexGrow: 1, minWidth: '150px' }}>
                      <TextField
                        type="date"
                        label="Start Date"
                        size="small"
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </Box>
                    <Box sx={{ flexGrow: 1, minWidth: '150px' }}>
                      <TextField
                        type="date"
                        label="End Date"
                        size="small"
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </Box>

                    <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', minWidth: '300px', ml: 'auto' }}>
                      <Typography variant="h6" fontWeight="bold" color="text.secondary" sx={{ mr: 2 }}>
                        Total Amount:
                      </Typography>
                      <Typography variant="h5" fontWeight="bold" color="primary.main">
                        ₱ {totalFilteredAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
                <TableContainer sx={{ maxHeight: 700 }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        {isCurrentUserAdmin() && <TableCell sx={{ fontWeight: 'bold' }}>Collector</TableCell>}
                        <TableCell sx={{ fontWeight: 'bold' }}>Sub Category</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Main Category</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Account Code</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredCollections
                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                        .map((item) => (
                        <TableRow key={item.id} hover>
                          {isCurrentUserAdmin() && <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>{getSubmittedCollectorName(item)}</TableCell>}
                          <TableCell>{item.subCategory}</TableCell>
                          <TableCell>{item.mainCategory}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', bgcolor: 'grey.50' }}>{item.accountCode}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                            ₱ {(item.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredCollections.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={isCurrentUserAdmin() ? 5 : 4} align="center" sx={{ py: 8 }}>
                            <Typography color="text.secondary">No collection entries found matching filters.</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  rowsPerPageOptions={[10, 25, 50]}
                  component="div"
                  count={filteredCollections.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  labelRowsPerPage="Entries per page:"
                />
              </>
            )}

            {tabValue === 1 && (
              <>
                <Box sx={{ p: 2, borderBottom: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                    {uniqueCollectors.length > 0 && (
                      <Box sx={{ flexGrow: 1, minWidth: '180px' }}>
                        <Autocomplete
                          multiple
                          size="small"
                          options={uniqueCollectors}
                          value={selectedCollectors}
                          onChange={(_, newValue) => setSelectedCollectors(newValue)}
                          renderInput={(params) => <TextField {...params} label="Collector Name" placeholder="All Collectors" size="small" />}
                        />
                      </Box>
                    )}
                    <Box sx={{ flexGrow: 1, minWidth: '200px' }}>
                      <Autocomplete
                        options={uniqueRptAf56Ids}
                        value={rptFilterAf56Id}
                        onChange={(_, newValue) => setRptFilterAf56Id(newValue)}
                        renderInput={(params) => <TextField {...params} label="AF56 ID" size="small" />}
                      />
                    </Box>
                    <Box sx={{ flexGrow: 1, minWidth: '150px' }}>
                      <TextField
                        type="date"
                        label="Start Date"
                        size="small"
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        value={rptStartDate}
                        onChange={(e) => setRptStartDate(e.target.value)}
                      />
                    </Box>
                    <Box sx={{ flexGrow: 1, minWidth: '150px' }}>
                      <TextField
                        type="date"
                        label="End Date"
                        size="small"
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        value={rptEndDate}
                        onChange={(e) => setRptEndDate(e.target.value)}
                      />
                    </Box>
                    <Tooltip title="Clear Filters" arrow>
                      <IconButton 
                        onClick={() => {
                          setSelectedCollectors([]);
                          setRptFilterAf56Id(null);
                          setRptStartDate('');
                          setRptEndDate('');
                        }}
                        sx={{ bgcolor: '#f1f5f9', color: '#64748b', p: 1, borderRadius: 1, '&:hover': { bgcolor: '#fee2e2', color: '#ef4444' } }}
                      >
                        <Clear />
                      </IconButton>
                    </Tooltip>

                    <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', minWidth: '300px', ml: 'auto' }}>
                      <Typography variant="h6" fontWeight="bold" color="text.secondary" sx={{ mr: 2 }}>
                        Total Amount:
                      </Typography>
                      <Typography variant="h5" fontWeight="bold" color="primary.main">
                        ₱ {filteredRptCollections.reduce((sum, item) => sum + (item.amount || 0), 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
                <TableContainer sx={{ maxHeight: 700 }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        {isCurrentUserAdmin() && <TableCell sx={{ fontWeight: 'bold' }}>Collector</TableCell>}
                        <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>OR Number</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Payor</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Barangay</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Amount</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Remarks</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredRptCollections
                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                        .map((item) => (
                        <TableRow key={item.id} hover>
                          {isCurrentUserAdmin() && <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>{getSubmittedCollectorName(item)}</TableCell>}
                          <TableCell>{item.date}</TableCell>
                          <TableCell>{item.orNumber}</TableCell>
                          <TableCell>{item.payor}</TableCell>
                          <TableCell>{item.barangay}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                            ₱ {(item.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>{item.remarks || '-'}</TableCell>
                        </TableRow>
                      ))}
                      {filteredRptCollections.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={isCurrentUserAdmin() ? 7 : 6} align="center" sx={{ py: 8 }}>
                            <Typography color="text.secondary">No RPT collections found matching filters.</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  rowsPerPageOptions={[10, 25, 50]}
                  component="div"
                  count={filteredRptCollections.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  labelRowsPerPage="Entries per page:"
                />
              </>
            )}

            {tabValue === 2 && (
              <Box sx={{ p: 3 }}>
                {/* Search & Filter Controls */}
                <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid #e2e8f0', borderRadius: 1.5, bgcolor: '#f8fafc' }}>
                  <Grid container spacing={2} alignItems="center">
                    {uniqueCollectors.length > 0 && (
                      <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
                        <Autocomplete
                          multiple
                          size="small"
                          options={uniqueCollectors}
                          value={selectedCollectors}
                          onChange={(_, newValue) => setSelectedCollectors(newValue)}
                          renderInput={(params) => <TextField {...params} label="Collector Name" placeholder="All Collectors" size="small" />}
                        />
                      </Grid>
                    )}
                    <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
                      <Autocomplete
                        size="small"
                        options={uniqueCtcBookletNos}
                        value={ctcFilterBookletNo}
                        onChange={(_, val) => setCtcFilterBookletNo(val)}
                        renderInput={(params) => <TextField {...params} label="Booklet No." size="small" />}
                      />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 6, md: 2 }}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Gender</InputLabel>
                        <Select
                          value={ctcFilterType}
                          label="Gender"
                          onChange={(e) => setCtcFilterType(e.target.value)}
                        >
                          <MenuItem value="ALL">All Genders</MenuItem>
                          <MenuItem value="Male">Male</MenuItem>
                          <MenuItem value="Female">Female</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 6, md: 2.5 }}>
                      <Autocomplete
                        size="small"
                        options={['Bakhawan', 'Calabasahan', 'Dalajican', 'Masadya', 'Masudsud', 'Poblacion', 'Sampong', 'San Pedro', 'San Vicente']}
                        value={ctcFilterBarangay}
                        onChange={(_, val) => setCtcFilterBarangay(val)}
                        renderInput={(params) => <TextField {...params} label="Filter Barangay" />}
                      />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 6, md: 2.5 }}>
                      <TextField
                        type="date"
                        size="small"
                        fullWidth
                        label="From Date"
                        value={ctcStartDate}
                        onChange={(e) => setCtcStartDate(e.target.value)}
                        slotProps={{ inputLabel: { shrink: true } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 6, md: 2.5 }}>
                      <TextField
                        type="date"
                        size="small"
                        fullWidth
                        label="To Date"
                        value={ctcEndDate}
                        onChange={(e) => setCtcEndDate(e.target.value)}
                        slotProps={{ inputLabel: { shrink: true } }}
                      />
                    </Grid>
                  </Grid>

                  {(selectedCollectors.length > 0 || ctcFilterBookletNo || ctcFilterType !== 'ALL' || ctcFilterBarangay || ctcStartDate || ctcEndDate || ctcStartOr1 || ctcEndOr1) && (
                    <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        Showing {filteredCtcCollections.length} of {communityTaxCollections.length} records
                      </Typography>
                      <Button
                        size="small"
                        sx={{ fontSize: '0.75rem', py: 0 }}
                        onClick={() => {
                          setSelectedCollectors([]);
                          setCtcFilterBookletNo(null);
                          setCtcFilterType('ALL');
                          setCtcFilterBarangay(null);
                          setCtcStartDate('');
                          setCtcEndDate('');
                          setCtcStartOr1(null);
                          setCtcEndOr1(null);
                        }}
                      >
                        Clear Filters
                      </Button>
                    </Box>
                  )}
                </Paper>

                {/* Table */}
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f8fafc' }}>
                        {isCurrentUserAdmin() && <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Collector</TableCell>}
                        <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Date</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Form No.</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#334155' }}>CTC No.</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Taxpayer Name</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Gender</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Barangay</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#334155' }}>Basic</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#334155' }}>Additional</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#334155' }}>Penalty</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#334155' }}>Total (PHP)</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Remarks</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredCtcCollections.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={isCurrentUserAdmin() ? 12 : 11} align="center" sx={{ py: 4, color: '#64748b' }}>
                            No Community Tax records found matching the filter criteria.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCtcCollections
                          .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                          .map((item) => (
                            <TableRow key={item.id} hover>
                              {isCurrentUserAdmin() && <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>{getSubmittedCollectorName(item)}</TableCell>}
                              <TableCell>{item.date || '-'}</TableCell>
                              <TableCell>
                                <Chip label={item.afNo || 'BRF 0016'} size="small" sx={{ height: 20, fontSize: '0.72rem', bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 700 }} />
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#0284c7' }}>{item.ctcNo || '-'}</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>{item.taxpayerName || '-'}</TableCell>
                              <TableCell>
                                <Chip
                                  label={item.gender || 'Male'}
                                  size="small"
                                  sx={{ 
                                    height: 20, 
                                    fontSize: '0.72rem', 
                                    fontWeight: 600,
                                    bgcolor: (item.gender || 'Male') === 'Female' ? '#fdf2f8' : '#f0f9ff',
                                    color: (item.gender || 'Male') === 'Female' ? '#db2777' : '#0284c7',
                                    border: '1px solid',
                                    borderColor: (item.gender || 'Male') === 'Female' ? '#fbcfe8' : '#bae6fd'
                                  }}
                                />
                              </TableCell>
                              <TableCell>{item.barangay || '-'}</TableCell>
                              <TableCell align="right">₱ {(item.basicTax || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell align="right">₱ {(item.additionalTax || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell align="right">₱ {(item.penalty || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700, color: '#0f172a' }}>
                                ₱ {(item.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.remarks || '-'}
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                      {filteredCtcCollections.length > 0 && (
                        <TableRow sx={{ bgcolor: '#f1f5f9' }}>
                          <TableCell colSpan={6} sx={{ fontWeight: 800 }}>
                            TOTAL COMMUNITY TAX COLLECTION ({filteredCtcCollections.length} record{filteredCtcCollections.length > 1 ? 's' : ''})
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>
                            ₱ {filteredCtcCollections.reduce((s, i) => s + (i.basicTax || 0), 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>
                            ₱ {filteredCtcCollections.reduce((s, i) => s + (i.additionalTax || 0), 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>
                            ₱ {filteredCtcCollections.reduce((s, i) => s + (i.penalty || 0), 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, color: '#0284c7', fontSize: '0.92rem' }}>
                            ₱ {filteredCtcCollections.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                <TablePagination
                  rowsPerPageOptions={[10, 25, 50, 100]}
                  component="div"
                  count={filteredCtcCollections.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  labelRowsPerPage="Entries per page:"
                />
              </Box>
            )}

            {tabValue === 3 && (
              <Box sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                  <Typography variant="h6" fontWeight="bold" sx={{ color: '#0f172a' }}>
                    Submitted & Archived Reports
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Refresh />}
                      onClick={async () => {
                        setIsLoading(true);
                        try {
                          const reports = await getAdminSubmittedReports();
                          setSubmittedReports(reports);
                        } finally {
                          setIsLoading(false);
                        }
                      }}
                      sx={{ textTransform: 'none', fontWeight: 600, height: 40 }}
                    >
                      Refresh
                    </Button>
                    <TextField
                      size="small"
                      placeholder="Search report no., collector, AF, OR range..."
                      value={archiveSearchTerm}
                      onChange={(e) => {
                        setArchiveSearchTerm(e.target.value);
                        setArchivePage(0);
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Search fontSize="small" />
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
                      sx={{ width: 320 }}
                    />
                  </Box>
                </Box>

                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#f8fafc' }}>
                      <TableRow>
                        <TableCell sx={{ width: 40 }} />
                        <TableCell sx={{ fontWeight: 'bold' }}>Report No.</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Collector Name</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Period Covered</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>AF & OR Range</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>OR Count</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total Amount</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>Status</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(() => {
                        if (filteredGroupedArchiveReports.length === 0) {
                          return (
                            <TableRow>
                              <TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                No submitted reports found.
                              </TableCell>
                            </TableRow>
                          );
                        }

                        const paginatedGroups = filteredGroupedArchiveReports.slice(
                          archivePage * archiveRowsPerPage,
                          archivePage * archiveRowsPerPage + archiveRowsPerPage
                        );

                        return paginatedGroups.map(group => {
                          const isDual = group.reports.length > 1;
                          const isExpanded = Boolean(expandedArchiveRows[group.baseReportNumber]);
                          const mainReport = group.reports[0];

                          return (
                            <React.Fragment key={group.baseReportNumber}>
                              <TableRow hover sx={{ bgcolor: isDual ? (isExpanded ? '#f0f9ff' : '#ffffff') : '#ffffff' }}>
                                <TableCell sx={{ width: 40, p: 0.5, textAlign: 'center' }}>
                                  {isDual ? (
                                    <IconButton
                                      size="small"
                                      onClick={() => setExpandedArchiveRows(prev => ({ ...prev, [group.baseReportNumber]: !prev[group.baseReportNumber] }))}
                                      sx={{ color: '#0284c7' }}
                                    >
                                      {isExpanded ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
                                    </IconButton>
                                  ) : null}
                                </TableCell>
                                <TableCell sx={{ fontWeight: 700, color: '#0284c7' }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    {group.baseReportNumber}
                                    {isDual && (
                                      <Chip label="Dual Range (A & B)" size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: '0.70rem', fontWeight: 700 }} />
                                    )}
                                  </Box>
                                </TableCell>
                                <TableCell>{group.collectorName}</TableCell>
                                <TableCell>{group.dateFrom} to {group.dateTo}</TableCell>
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Chip label={group.afNo} size="small" variant="outlined" sx={{ fontSize: '0.75rem', fontWeight: 600 }} />
                                    <Typography variant="caption" color="text.secondary">{group.combinedOrRange}</Typography>
                                  </Box>
                                </TableCell>
                                <TableCell align="right">{group.totalOrCount}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, color: '#059669' }}>
                                  ₱ {(group.totalAmount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell align="center">
                                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                                    {((group.status === 'Pending Admin Approval' || group.unarchiveStatus === 'Pending Admin Approval')) ? (
                                      <Chip label="Pending Approval" size="small" sx={{ bgcolor: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', fontWeight: 700, fontSize: '0.70rem' }} />
                                    ) : (
                                      <Chip label={group.status || 'Submitted'} size="small" sx={{ bgcolor: '#d1fae5', color: '#059669', border: '1px solid #a7f3d0', fontWeight: 700, fontSize: '0.70rem' }} />
                                    )}
                                  </Box>
                                </TableCell>
                                <TableCell align="center">
                                  {!isDual ? (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                                      <Tooltip title="Print Cover" arrow>
                                        <IconButton size="small" color="primary" onClick={() => handlePrintArchivedCover(mainReport)}>
                                          <Print fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title="Print Official RCD Report" arrow>
                                        <IconButton size="small" color="info" onClick={() => handlePrintArchivedReport(mainReport)}>
                                          <TaskAlt fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title="Export Excel" arrow>
                                        <IconButton size="small" color="secondary" onClick={() => handleExportArchivedExcel(mainReport)}>
                                          <Download fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                      {(() => {
                                        const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'administrator';
                                        const isPending = mainReport.status === 'Pending Admin Approval' || mainReport.unarchiveStatus === 'Pending Admin Approval';

                                        if (isAdmin) {
                                          if (isPending) {
                                            return (
                                              <>
                                                <Tooltip title="Approve Unarchive Request (Restore items to Active)" arrow>
                                                  <IconButton size="small" sx={{ bgcolor: '#d1fae5', color: '#059669', border: '1px solid #a7f3d0', '&:hover': { bgcolor: '#059669', color: '#ffffff' } }} onClick={() => handleApproveUnarchiveReport(mainReport)}>
                                                    <CheckCircle fontSize="small" />
                                                  </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Reject Unarchive Request" arrow>
                                                  <IconButton size="small" sx={{ bgcolor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', '&:hover': { bgcolor: '#dc2626', color: '#ffffff' } }} onClick={() => handleRejectUnarchiveReport(mainReport)}>
                                                    <Cancel fontSize="small" />
                                                  </IconButton>
                                                </Tooltip>
                                              </>
                                            );
                                          }
                                          return (
                                            <Tooltip title="Unarchive Report (Admin Direct Restore)" arrow>
                                              <IconButton size="small" color="warning" onClick={() => handleApproveUnarchiveReport(mainReport)}>
                                                <History fontSize="small" />
                                              </IconButton>
                                            </Tooltip>
                                          );
                                        } else {
                                          if (isPending) {
                                            return (
                                              <Tooltip title="Unarchive Request Submitted (Awaiting Admin Approval)" arrow>
                                                <span>
                                                  <IconButton size="small" disabled sx={{ bgcolor: '#fef3c7', color: '#d97706', border: '1px solid #fde68a' }}>
                                                    <LockClock fontSize="small" />
                                                  </IconButton>
                                                </span>
                                              </Tooltip>
                                            );
                                          }
                                          return (
                                            <Tooltip title="Request Admin Approval to Unarchive & Edit" arrow>
                                              <IconButton size="small" color="warning" onClick={() => handleRequestUnarchiveReport(mainReport)}>
                                                <History fontSize="small" />
                                              </IconButton>
                                            </Tooltip>
                                          );
                                        }
                                      })()}
                                    </Box>
                                  ) : (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5 }}>
                                      <Tooltip title={`Print Combined Cover (${group.baseReportNumber})`} arrow>
                                        <IconButton size="small" color="primary" onClick={() => handlePrintArchivedGroupCover(group)}>
                                          <Print fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title={`Print Combined Official RCD (${group.baseReportNumber})`} arrow>
                                        <IconButton size="small" color="info" onClick={() => handlePrintArchivedGroupReport(group)}>
                                          <TaskAlt fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title={`Export Combined Excel (${group.baseReportNumber})`} arrow>
                                        <IconButton size="small" color="secondary" onClick={() => handleExportArchivedGroupExcel(group)}>
                                          <Download fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                      <Button
                                        size="small"
                                        variant={isExpanded ? "contained" : "outlined"}
                                        onClick={() => setExpandedArchiveRows(prev => ({ ...prev, [group.baseReportNumber]: !prev[group.baseReportNumber] }))}
                                        sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.3, px: 1.2, fontWeight: 700, ml: 0.5 }}
                                      >
                                        {isExpanded ? "Hide Breakdown" : "Expand A & B"}
                                      </Button>
                                    </Box>
                                  )}
                                </TableCell>
                              </TableRow>

                              {/* Collapsible Breakdown Row */}
                              {isDual && (
                                <TableRow>
                                  <TableCell colSpan={9} sx={{ p: 0, bgcolor: '#f8fafc', borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none' }}>
                                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                      <Box sx={{ p: 2, pl: 6, bgcolor: '#f0f9ff', borderTop: '1px solid #bae6fd', borderBottom: '1px solid #bae6fd' }}>
                                        <Typography variant="caption" fontWeight="800" sx={{ color: '#0369a1', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1, display: 'block' }}>
                                          Booklet Sub-Reports Breakdown ({group.reports.length} Ranges)
                                        </Typography>
                                        <Table size="small" sx={{ bgcolor: '#ffffff', borderRadius: 1.5, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                          <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                            <TableRow>
                                              <TableCell sx={{ fontWeight: 'bold' }}>Sub-Report</TableCell>
                                              <TableCell sx={{ fontWeight: 'bold' }}>Report Control #</TableCell>
                                              <TableCell sx={{ fontWeight: 'bold' }}>OR Range</TableCell>
                                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>OR Count</TableCell>
                                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Subtotal</TableCell>
                                              <TableCell align="center" sx={{ fontWeight: 'bold' }}>Status</TableCell>
                                              <TableCell align="center" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                                            </TableRow>
                                          </TableHead>
                                          <TableBody>
                                            {group.reports.map(rep => (
                                              <TableRow key={rep.id || rep.reportNumber} hover>
                                                <TableCell>
                                                  <Chip
                                                    label={`Range ${rep.subReportSuffix || 'Main'}`}
                                                    size="small"
                                                    sx={{
                                                      fontWeight: 800,
                                                      fontSize: '0.72rem',
                                                      bgcolor: rep.subReportSuffix === 'A' ? '#e0f2fe' : rep.subReportSuffix === 'B' ? '#f0fdf4' : '#f1f5f9',
                                                      color: rep.subReportSuffix === 'A' ? '#0369a1' : rep.subReportSuffix === 'B' ? '#15803d' : '#475569',
                                                      border: '1px solid',
                                                      borderColor: rep.subReportSuffix === 'A' ? '#bae6fd' : rep.subReportSuffix === 'B' ? '#bbf7d0' : '#cbd5e1'
                                                    }}
                                                  />
                                                </TableCell>
                                                <TableCell sx={{ fontWeight: 700, color: '#0284c7' }}>{rep.reportNumber}</TableCell>
                                                <TableCell>{rep.orRange}</TableCell>
                                                <TableCell align="right">{rep.orCount || (rep.orNumbers ? rep.orNumbers.length : 0)}</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 700, color: '#059669' }}>
                                                  ₱ {(rep.totalAmount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell align="center">
                                                  {(rep.status === 'Pending Admin Approval' || rep.unarchiveStatus === 'Pending Admin Approval') ? (
                                                    <Chip label="Pending Approval" size="small" sx={{ bgcolor: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', fontWeight: 700, fontSize: '0.70rem' }} />
                                                  ) : (
                                                    <Chip label={rep.status || 'Submitted'} size="small" sx={{ bgcolor: '#d1fae5', color: '#059669', border: '1px solid #a7f3d0', fontWeight: 700, fontSize: '0.70rem' }} />
                                                  )}
                                                </TableCell>
                                                <TableCell align="center">
                                                  <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                                                    <Tooltip title={`Print Cover (${rep.reportNumber})`} arrow>
                                                      <IconButton size="small" color="primary" onClick={() => handlePrintArchivedCover(rep)}>
                                                        <Print fontSize="small" />
                                                      </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title={`Print Official RCD (${rep.reportNumber})`} arrow>
                                                      <IconButton size="small" color="info" onClick={() => handlePrintArchivedReport(rep)}>
                                                        <TaskAlt fontSize="small" />
                                                      </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title={`Export Excel (${rep.reportNumber})`} arrow>
                                                      <IconButton size="small" color="secondary" onClick={() => handleExportArchivedExcel(rep)}>
                                                        <Download fontSize="small" />
                                                      </IconButton>
                                                    </Tooltip>
                                                    {(() => {
                                                      const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'administrator';
                                                      const isPending = rep.status === 'Pending Admin Approval' || rep.unarchiveStatus === 'Pending Admin Approval';

                                                      if (isAdmin) {
                                                        if (isPending) {
                                                          return (
                                                            <>
                                                              <Tooltip title="Approve Unarchive Request" arrow>
                                                                <IconButton size="small" sx={{ bgcolor: '#d1fae5', color: '#059669', border: '1px solid #a7f3d0', '&:hover': { bgcolor: '#059669', color: '#ffffff' } }} onClick={() => handleApproveUnarchiveReport(rep)}>
                                                                  <CheckCircle fontSize="small" />
                                                                </IconButton>
                                                              </Tooltip>
                                                              <Tooltip title="Reject Unarchive Request" arrow>
                                                                <IconButton size="small" sx={{ bgcolor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', '&:hover': { bgcolor: '#dc2626', color: '#ffffff' } }} onClick={() => handleRejectUnarchiveReport(rep)}>
                                                                  <Cancel fontSize="small" />
                                                                </IconButton>
                                                              </Tooltip>
                                                            </>
                                                          );
                                                        }
                                                        return (
                                                          <Tooltip title="Unarchive Sub-Report (Admin Restore)" arrow>
                                                            <IconButton size="small" color="warning" onClick={() => handleApproveUnarchiveReport(rep)}>
                                                              <History fontSize="small" />
                                                            </IconButton>
                                                          </Tooltip>
                                                        );
                                                      } else {
                                                        if (isPending) {
                                                          return (
                                                            <Tooltip title="Unarchive Request Submitted" arrow>
                                                              <span>
                                                                <IconButton size="small" disabled sx={{ bgcolor: '#fef3c7', color: '#d97706', border: '1px solid #fde68a' }}>
                                                                  <LockClock fontSize="small" />
                                                                </IconButton>
                                                              </span>
                                                            </Tooltip>
                                                          );
                                                        }
                                                        return (
                                                          <Tooltip title="Request Admin Approval to Unarchive" arrow>
                                                            <IconButton size="small" color="warning" onClick={() => handleRequestUnarchiveReport(rep)}>
                                                              <History fontSize="small" />
                                                            </IconButton>
                                                          </Tooltip>
                                                        );
                                                      }
                                                    })()}
                                                  </Box>
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </Box>
                                    </Collapse>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>
                </TableContainer>

                <TablePagination
                  rowsPerPageOptions={[10, 25, 50]}
                  component="div"
                  count={filteredGroupedArchiveReports.length}
                  rowsPerPage={archiveRowsPerPage}
                  page={archivePage}
                  onPageChange={(_, newPage) => setArchivePage(newPage)}
                  onRowsPerPageChange={(e) => {
                    setArchiveRowsPerPage(parseInt(e.target.value, 10));
                    setArchivePage(0);
                  }}
                  labelRowsPerPage="Reports per page:"
                />
              </Box>
            )}
          </>
        )}
      </Paper>

      {/* Print Certification Signatory Modal */}
      <Dialog 
        open={printDialogOpen} 
        onClose={() => setPrintDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, border: '1px solid #e2e8f0' } }}
      >
        <DialogTitle sx={{ bgcolor: '#f8fafc', color: '#0369a1', p: 2, borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Print sx={{ color: '#0284c7' }} />
            <Typography variant="h6" fontWeight="800">
              Report Certification Signatory
            </Typography>
          </Box>
          <Chip 
            label={
              printTarget === 'COLLECTIONS' 
                ? 'Collections (A.F. NO. 51)' 
                : printTarget === 'RPT_GENERAL' 
                ? 'RPT General Fund (A.F. NO. 56)' 
                : printTarget === 'RPT_SEF'
                ? 'RPT SEF Fund (A.F. NO. 56)'
                : 'Community Tax (BRF NO. 0016)'
            }
            size="small"
            color="primary"
            sx={{ fontWeight: 700 }}
          />
        </DialogTitle>

        <DialogContent sx={{ p: 3, pt: 3 }}>
          <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 1.5 }}>
            <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 600, display: 'block', mb: 0.5 }}>
              Section D: Certification
            </Typography>
            <Typography variant="body2" sx={{ color: '#0c4a6e', fontSize: '0.84rem' }}>
              Select an accountable officer from registered users or customize the name and position below. This will appear as the certifying signatory in <strong>Section D</strong> on the official RCD.
            </Typography>
          </Paper>

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="select-user-label">Select from Users</InputLabel>
                <Select
                  labelId="select-user-label"
                  label="Select from Users"
                  value={selectedUserDropdownId}
                  onChange={(e) => handleUserDropdownChange(e.target.value as string)}
                >
                  <MenuItem value="current">
                    <em>⭐ Current Logged-in User ({user?.name || user?.email})</em>
                  </MenuItem>
                  {managedUsers.length > 0 && <Divider sx={{ my: 0.5 }} />}
                  {managedUsers.map((u) => (
                    <MenuItem key={u.id} value={String(u.id)}>
                      {u.fullName} — {u.position || 'Collector'} ({u.department || 'Treasury'})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                label="Accountable Officer Name"
                fullWidth
                size="small"
                value={certAccountableName}
                onChange={(e) => setCertAccountableName(e.target.value)}
                placeholder="e.g. CHRISTIAN S. TOLENTINO"
                required
                helperText="Printed on Section D Certification line"
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                label="Position / Designation"
                fullWidth
                size="small"
                value={certPosition}
                onChange={(e) => setCertPosition(e.target.value)}
                placeholder="e.g. Revenue Collection Clerk I"
                required
                helperText="Printed underneath the certification signature line"
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 2, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0', gap: 1 }}>
          <Button 
            onClick={() => setPrintDialogOpen(false)}
            sx={{ color: '#64748b' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<Print />}
            onClick={handleProceedPrint}
            disabled={!certAccountableName.trim() || !certPosition.trim()}
            sx={{
              bgcolor: '#0284c7',
              fontWeight: 700,
              '&:hover': { bgcolor: '#0369a1' }
            }}
          >
            Proceed to Print
          </Button>
        </DialogActions>
      </Dialog>

      {/* Submit Report Modal */}
      <Dialog
        open={submitDialogOpen}
        onClose={() => setSubmitDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ bgcolor: '#ecfdf5', color: '#047857', p: 2, borderBottom: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Send sx={{ color: '#059669' }} />
          <Typography variant="h6" fontWeight="800">
            Submit Collection Report
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 3, pt: 3 }}>
          <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 1.5 }}>
            <Typography variant="body2" sx={{ color: '#166534', fontSize: '0.85rem' }}>
              Submitting this report will mark the selected AF Numbers and OR numbers as reported. They will be archived and excluded from future un-reported collection reports.
            </Typography>
          </Paper>

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Report Control Number"
                fullWidth
                size="small"
                value={submitReportNumber}
                onChange={(e) => setSubmitReportNumber(e.target.value)}
                placeholder="e.g. 26-09-0001"
                required
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="submit-scope-label">Report Scope</InputLabel>
                <Select
                  labelId="submit-scope-label"
                  label="Report Scope"
                  value={submitScope}
                  onChange={(e) => setSubmitScope(e.target.value as 'CURRENT' | 'ALL')}
                >
                  <MenuItem value="CURRENT">
                    Selected / Filtered Items in Current Tab View
                  </MenuItem>
                  <MenuItem value="ALL">
                    All Active Unsubmitted Collection Items Across All Tabs
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={1}>
                  SUBMISSION SUMMARY PREVIEW
                </Typography>
                {(() => {
                  let totalAmt = 0;
                  let count = 0;
                  if (submitScope === 'CURRENT') {
                    if (tabValue === 0) {
                      totalAmt = filteredCollections.reduce((s, c) => s + (c.amount || 0), 0);
                      count = filteredCollections.length;
                    } else if (tabValue === 1) {
                      totalAmt = filteredRptCollections.reduce((s, c) => s + (c.amount || 0), 0);
                      count = filteredRptCollections.length;
                    } else if (tabValue === 2) {
                      totalAmt = filteredCtcCollections.reduce((s, c) => s + (c.amount || 0), 0);
                      count = filteredCtcCollections.length;
                    }
                  } else {
                    totalAmt = collections.reduce((s, c) => s + (c.amount || 0), 0) + rptCollections.reduce((s, c) => s + (c.amount || 0), 0) + communityTaxCollections.reduce((s, c) => s + (c.amount || 0), 0);
                    count = collections.length + rptCollections.length + communityTaxCollections.length;
                  }

                  return (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>Total Records: {count}</Typography>
                        <Typography variant="caption" color="text.secondary">Collector: {certAccountableName || user?.name || 'Collector'}</Typography>
                      </Box>
                      <Typography variant="h6" fontWeight={800} color="#059669">
                        ₱ {totalAmt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                  );
                })()}
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0', gap: 1 }}>
          <Button onClick={() => setSubmitDialogOpen(false)} sx={{ color: '#64748b' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <TaskAlt />}
            onClick={handleExecuteSubmitReport}
            disabled={isSubmitting || !submitReportNumber.trim()}
            sx={{ bgcolor: '#059669', fontWeight: 700, '&:hover': { bgcolor: '#047857' } }}
          >
            {isSubmitting ? 'Submitting...' : 'Confirm & Submit Report'}
          </Button>
        </DialogActions>
      </Dialog>

      <Notification
        open={notification.open}
        message={notification.message}
        severity={notification.severity}
        onClose={() => setNotification(prev => ({ ...prev, open: false }))}
      />
    </Box>
  );
};
