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
  InputAdornment
} from '@mui/material';
import { Download, Clear, Print, Search } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { 
  getRecentReports, 
  getCollectionEntries, 
  getSignatories, 
  getRPTCollections, 
  getCommunityTaxCollections,
  getAllManagedUsers,
  type CollectionItem, 
  type ManagedUser 
} from '../services/supabaseService';
import type { RCDReport, Signatory, RPTCollectionItem, CommunityTaxItem } from '../types/rcd';
import { useAuth } from '../context/useAuth';
import { Notification } from '../components/Notification';

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
  const [isLoading, setIsLoading] = useState(true);
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

  // Filters
  const [selectedAfNos, setSelectedAfNos] = useState<string[]>([]);
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>([]);
  const [selectedMainCategories, setSelectedMainCategories] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // RPT Filters
  const [rptFilterAf56Id, setRptFilterAf56Id] = useState<string | null>(null);
  const [rptStartDate, setRptStartDate] = useState<string>('');
  const [rptEndDate, setRptEndDate] = useState<string>('');
  
  // RPT OR Filters
  const [rptStartOr1, setRptStartOr1] = useState<string | null>(null);
  const [rptEndOr1, setRptEndOr1] = useState<string | null>(null);
  const [rptStartOr2, setRptStartOr2] = useState<string | null>(null);
  const [rptEndOr2, setRptEndOr2] = useState<string | null>(null);

  const [startOr1, setStartOr1] = useState<string | null>(null);
  const [endOr1, setEndOr1] = useState<string | null>(null);
  const [startOr2, setStartOr2] = useState<string | null>(null);
  const [endOr2, setEndOr2] = useState<string | null>(null);

  // Community Tax Filters
  const [ctcSearchTerm, setCtcSearchTerm] = useState('');
  const [ctcFilterType, setCtcFilterType] = useState('ALL');
  const [ctcFilterBarangay, setCtcFilterBarangay] = useState<string | null>(null);
  const [ctcStartDate, setCtcStartDate] = useState('');
  const [ctcEndDate, setCtcEndDate] = useState('');
  const [ctcStartOr1, setCtcStartOr1] = useState<string | null>(null);
  const [ctcEndOr1, setCtcEndOr1] = useState<string | null>(null);

  // Managed Users for Certification Signatory Selection
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);

  // Print Certification Modal State
  const [printDialogOpen, setPrintDialogOpen] = useState<boolean>(false);
  const [printTarget, setPrintTarget] = useState<'COLLECTIONS' | 'RPT_GENERAL' | 'RPT_SEF' | 'COMMUNITY_TAX' | null>(null);
  const [selectedUserDropdownId, setSelectedUserDropdownId] = useState<string>('current');
  const [certAccountableName, setCertAccountableName] = useState<string>('');
  const [certPosition, setCertPosition] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reportsData, collectionsData, signatoriesData, rptData, usersData, ctcData] = await Promise.all([
          getRecentReports(),
          getCollectionEntries(),
          getSignatories(),
          getRPTCollections(),
          getAllManagedUsers(),
          getCommunityTaxCollections()
        ]);
        setReports(reportsData);
        setCollections(collectionsData);
        setFilteredCollections(collectionsData);
        setSignatories(signatoriesData);
        setRptCollections(rptData);
        setFilteredRptCollections(rptData);
        setManagedUsers(usersData);
        setCommunityTaxCollections(ctcData);
        setFilteredCtcCollections(ctcData);
      } catch (error) {
        console.error('Failed to fetch data', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter Logic
  useEffect(() => {
    let result = collections;

    if (selectedAfNos.length > 0) {
      result = result.filter(item => selectedAfNos.includes(item.afNo));
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
  }, [collections, selectedAfNos, selectedSubCategories, selectedMainCategories, startDate, endDate, startOr1, endOr1, startOr2, endOr2]);

  const uniqueAfNos = Array.from(new Set(collections.map(c => c.afNo).filter(Boolean))).sort();
  const uniqueSubCategories = Array.from(new Set(collections.map(c => c.subCategory).filter(Boolean))).sort();
  const uniqueMainCategories = Array.from(new Set(collections.map(c => c.mainCategory).filter(Boolean))).sort();

  // RPT Filter Logic
  useEffect(() => {
    let result = rptCollections;

    if (rptFilterAf56Id) {
      result = result.filter(item => item.af56Id === rptFilterAf56Id);
    }

    if (rptStartDate) {
      result = result.filter(item => item.date >= rptStartDate);
    }

    if (rptEndDate) {
      result = result.filter(item => item.date <= rptEndDate);
    }

    setFilteredRptCollections(result);
    // Only reset page if we are on the RPT tab
    if (tabValue === 2) {
      setPage(0);
    }
  }, [rptCollections, rptFilterAf56Id, rptStartDate, rptEndDate, tabValue]);

  const uniqueRptAf56Ids = Array.from(new Set(rptCollections.map(c => c.af56Id).filter(Boolean))).sort();

  // Calculate valid RPT ORs when AF56 ID is selected
  const validRptOrs = React.useMemo(() => {
    if (!rptFilterAf56Id) return [];
    
    const ors = rptCollections
      .filter(c => c.af56Id === rptFilterAf56Id && c.orNumber)
      .map(c => c.orNumber)
      .filter(Boolean);
      
    return Array.from(new Set(ors)).sort((a, b) => {
      // Try numerical sort
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [rptCollections, rptFilterAf56Id]);

  // Reset RPT OR selection when AF56 ID changes
  useEffect(() => {
    setRptStartOr1(null);
    setRptEndOr1(null);
    setRptStartOr2(null);
    setRptEndOr2(null);
  }, [rptFilterAf56Id]);

  // Automatically set RPT Start OR 2 to the next available OR after End OR 1
  useEffect(() => {
    if (rptEndOr1 && validRptOrs.length > 0) {
      const currentIndex = validRptOrs.indexOf(rptEndOr1);
      if (currentIndex !== -1 && currentIndex < validRptOrs.length - 1) {
        setRptStartOr2(validRptOrs[currentIndex + 1]);
      } else if (currentIndex === validRptOrs.length - 1) {
        setRptStartOr2(null);
      }
    }
  }, [rptEndOr1, validRptOrs]);

  // Calculate valid ORs when exactly one AF No. is selected
  const validOrs = React.useMemo(() => {
    if (selectedAfNos.length !== 1) return [];
    
    const afNo = selectedAfNos[0];
    const ors = collections
      .filter(c => c.afNo === afNo && c.orNo)
      .map(c => c.orNo)
      .filter(Boolean);
      
    return Array.from(new Set(ors)).sort((a, b) => {
      // Try numerical sort
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [collections, selectedAfNos]);

  // Reset OR selection when AF selection changes (if no longer single AF or different AF)
  useEffect(() => {
    if (selectedAfNos.length !== 1) {
      setStartOr1(null);
      setEndOr1(null);
      setStartOr2(null);
      setEndOr2(null);
    }
  }, [selectedAfNos]);

  // Automatically set Start OR 2 to the next available OR after End OR 1
  useEffect(() => {
    if (endOr1 && validOrs.length > 0) {
      const currentIndex = validOrs.indexOf(endOr1);
      if (currentIndex !== -1 && currentIndex < validOrs.length - 1) {
        setStartOr2(validOrs[currentIndex + 1]);
      } else if (currentIndex === validOrs.length - 1) {
        setStartOr2(null);
      }
    }
  }, [endOr1, validOrs]);

  const totalFilteredAmount = filteredCollections.reduce((sum, item) => sum + (item.amount || 0), 0);

  // Community Tax Filter Logic
  useEffect(() => {
    let result = communityTaxCollections;

    if (ctcSearchTerm.trim()) {
      const term = ctcSearchTerm.toLowerCase();
      result = result.filter(item => 
        (item.taxpayerName || '').toLowerCase().includes(term) ||
        (item.ctcNo || '').toLowerCase().includes(term) ||
        (item.remarks || '').toLowerCase().includes(term) ||
        (item.barangay || '').toLowerCase().includes(term)
      );
    }

    if (ctcFilterType !== 'ALL') {
      result = result.filter(item => item.ctcType === ctcFilterType);
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
    if (tabValue === 3) {
      setPage(0);
    }
  }, [communityTaxCollections, ctcSearchTerm, ctcFilterType, ctcFilterBarangay, ctcStartDate, ctcEndDate, ctcStartOr1, ctcEndOr1, tabValue]);

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
      summary['A.F. NO. 0016'] = (summary['A.F. NO. 0016'] || 0) + totalCtc;
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
      const key = item.ctcType === 'Corporation' ? 'Community Tax - Corporation' : 'Community Tax - Individual';
      summary[key] = (summary[key] || 0) + (item.amount || 0);
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
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handlePrintCover = () => {
    if (selectedAfNos.length !== 1) return;
    const afNo = selectedAfNos[0];

    const filterByRange = (sOr: string | null, eOr: string | null) => {
      if (!sOr || !eOr) return [];
      return collections.filter(item => {
        if (item.afNo !== afNo || !item.orNo) return false;
        
        const itemOr = parseInt(item.orNo, 10);
        const start = parseInt(sOr, 10);
        const end = parseInt(eOr, 10);
        
        if (!isNaN(itemOr) && !isNaN(start) && !isNaN(end)) {
          return itemOr >= start && itemOr <= end;
        }
        return item.orNo >= sOr && item.orNo <= eOr;
      });
    };

    const range1Data = filterByRange(startOr1, endOr1);
    const range2Data = filterByRange(startOr2, endOr2);

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

    const printContent = (_rangeLabel: string, start: string | null, end: string | null, data: { summary: { subCategory: string; amount: number }[]; total: number }, dstItems: CollectionItem[]) => {
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
          <div class="label">OR Numbers</div>
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
            <title>Print Cover - A.F. NO. 51</title>
            <style>
              @page { size: Letter portrait; margin: 0.5in; }
              body { font-family: Arial, sans-serif; margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
              .container { display: flex; width: 100%; height: 100vh; }
              .column { flex: 1; padding: 0 20px; box-sizing: border-box; }
              .column:first-child { border-right: 1px dashed #ccc; }
              .section { margin-bottom: 30px; }
              .center-text { text-align: center; }
              .label { font-size: 14px; font-weight: bold; color: #666; text-transform: uppercase; margin-bottom: 5px; }
              .value { font-size: 18px; font-weight: bold; text-decoration: underline; }
              .header-box { 
                background-color: #f0f0f0; 
                padding: 10px; 
                text-align: center; 
                font-weight: bold; 
                border: 1px solid #000;
                margin-bottom: 15px;
              }
              .summary-table { width: 100%; border-collapse: collapse; font-size: 14px; }
              .summary-table td, .summary-table th { padding: 5px 0; border-bottom: 1px solid #eee; }
              .summary-table .text-right { text-align: right; }
              .summary-table .total-row td { font-weight: bold; border-top: 1px solid #000; border-bottom: none; padding-top: 10px; }
            </style>
          </head>
          <body>
            <div class="container">
              ${printContent('Range 1', startOr1, endOr1, r1, r1DstItems)}
              ${printContent('Range 2', startOr2, endOr2, r2, r2DstItems)}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
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
    if ((target === 'RPT_GENERAL' || target === 'RPT_SEF') && (!rptStartOr1 || !rptEndOr1)) {
      setNotification({
        open: true,
        message: 'Please specify the RPT OR Number Range 1 before printing.',
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

  const handlePrintReport = (accountableOfficerName?: string, accountableOfficerPosition?: string) => {
    // 1. Prepare Data
    const reportData = filteredCollections;
    const totalAmount = reportData.reduce((sum, item) => sum + (item.amount || 0), 0);
    
    // Group items by AF No
    const itemsByAf: Record<string, typeof reportData> = {};
    const accountEntries: Record<string, { code: string, name: string, amount: number }> = {};

    reportData.forEach(item => {
      const af = item.afNo || '51';
      if (!itemsByAf[af]) itemsByAf[af] = [];
      itemsByAf[af].push(item);

      // Accounting Entries Particulars & COA Code
      const code = item.accountCode || 'No Code';
      let name = item.mainCategory || item.subCategory || 'General Collection';
      if (item.mainCategory && item.subCategory && item.mainCategory !== item.subCategory) {
        name = item.mainCategory.includes(item.subCategory) ? item.mainCategory : `${item.mainCategory}/${item.subCategory}`;
      }
      const amt = item.amount || 0;
      
      const key = `${code}__${name}`;
      if (!accountEntries[key]) {
        accountEntries[key] = { code, name, amount: 0 };
      }
      accountEntries[key].amount += amt;
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

    if ((startOr1 && endOr1) || (startOr2 && endOr2)) {
      const getRangeData = (s: string, e: string) => {
        const start = parseInt(s, 10);
        const end = parseInt(e, 10);
        const matched = reportData.filter(item => {
          if (!item.orNo) return false;
          const itemOr = parseInt(item.orNo, 10);
          if (!isNaN(itemOr) && !isNaN(start) && !isNaN(end)) {
            return itemOr >= start && itemOr <= end;
          }
          return item.orNo >= s && item.orNo <= e;
        });
        const total = matched.reduce((sum, item) => sum + (item.amount || 0), 0);
        return { total, count: matched.length };
      };

      if (startOr1 && endOr1) {
        const r1 = getRangeData(startOr1, endOr1);
        const minN = parseInt(startOr1, 10);
        const maxN = parseInt(endOr1, 10);
        afRanges.push({
          name: 'A.F. NO. 51',
          minOr: startOr1,
          maxOr: endOr1,
          amount: r1.total,
          qty: !isNaN(minN) && !isNaN(maxN) ? Math.max(1, maxN - minN + 1) : r1.count,
          minNum: minN,
          maxNum: maxN
        });
      }

      if (startOr2 && endOr2) {
        const r2 = getRangeData(startOr2, endOr2);
        const minN = parseInt(startOr2, 10);
        const maxN = parseInt(endOr2, 10);
        afRanges.push({
          name: 'A.F. NO. 51',
          minOr: startOr2,
          maxOr: endOr2,
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
              name: 'A.F. NO. 51',
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
          name: 'A.F. NO. 51',
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
      const formName = 'A.F. NO. 51';
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

    // 2. VERIFICATION AND ACKNOWLEDGMENT: Municipal Treasurer
    const treasurer = signatories.find(s => 
      s.position.toLowerCase() === 'municipal treasurer' || 
      (s.position.toLowerCase().includes('treasurer') && !s.position.toLowerCase().includes('staff') && !s.position.toLowerCase().includes('clerk'))
    ) || signatories.find(s => s.remarks?.toLowerCase().includes('verification') || s.remarks?.toLowerCase().includes('acknowledgment')) || { fullName: 'MENARD A. HERRERA', position: 'Municipal Treasurer' };

    // 3. Prepared by: Accounting Staff
    const preparer = signatories.find(s =>
      s.remarks?.toLowerCase().includes('prepared') ||
      (s.department.toLowerCase().includes('account') && (s.position.toLowerCase().includes('staff') || s.position.toLowerCase().includes('aide') || s.position.toLowerCase().includes('aa') || s.position.toLowerCase().includes('clerk'))) ||
      s.fullName.toLowerCase().includes('fanoga')
    ) || { fullName: 'HESTHER F. FANOGA', position: 'AA II' };

    // 4. Certified Correct: Accountant
    const accountant = signatories.find(s =>
      s.remarks?.toLowerCase().includes('certified') ||
      s.position.toLowerCase() === 'municipal accountant' ||
      s.fullName.toLowerCase().includes('paz')
    ) || { fullName: 'LEON F. PAZ, JR.', position: 'Municipal Accountant' };

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html> 
        <html lang="en"> 
        <head> 
        <meta charset="UTF-8"> 
        <title>Report of Collections and Deposits - A.F. NO. 51</title> 
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
                    <td>A.F. NO. 51</td>
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

  const handlePrintRptCover = () => {
    if (!rptFilterAf56Id) return;
    const afNo = rptFilterAf56Id;

    const filterByRange = (sOr: string | null, eOr: string | null) => {
      if (!sOr || !eOr) return [];
      return rptCollections.filter(item => {
        if (item.af56Id !== afNo || !item.orNumber) return false;
        
        const itemOr = parseInt(item.orNumber, 10);
        const start = parseInt(sOr, 10);
        const end = parseInt(eOr, 10);
        
        if (!isNaN(itemOr) && !isNaN(start) && !isNaN(end)) {
          return itemOr >= start && itemOr <= end;
        }
        return item.orNumber >= sOr && item.orNumber <= eOr;
      });
    };

    const range1Data = filterByRange(rptStartOr1, rptEndOr1);
    const range2Data = filterByRange(rptStartOr2, rptEndOr2);

    const calculateTotal = (data: RPTCollectionItem[]) => {
      return data.reduce((sum, item) => sum + (item.amount || 0), 0);
    };

    const r1Total = calculateTotal(range1Data);
    const r2Total = calculateTotal(range2Data);

    const printContent = (_rangeLabel: string, start: string | null, end: string | null, total: number) => {
      if (!start || !end) return '';

      const totalCents = Math.round((total || 0) * 100);
      const basicCents = Math.ceil(totalCents / 2);
      const sefCents = totalCents - basicCents;
      const basic = basicCents / 100;
      const sef = sefCents / 100;

      return `
      <div class="column">
        <div class="header-box">
          ACCOUNTABLE FORM NO. 56
        </div>

        <div class="section">
          <div class="label">OR NO.</div>
          <div class="value">${start} - ${end}</div>
        </div>
        
        <div class="section">
          <div class="label">TOTAL AMOUNT:</div>
          <div class="value">${total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
        </div>

        <div class="section breakdown">
          <div class="breakdown-item">
            <span class="red-label">BASIC:</span> <span class="amount-val">${basic.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>
          <div class="breakdown-item">
            <span class="red-label">SEF:</span> <span class="amount-val">${sef.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
    `;
    };

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print RPT Cover - A.F. NO. 56</title>
            <style>
              @page { size: Letter portrait; margin: 0.5in; }
              body { font-family: Arial, sans-serif; margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
              .container { display: flex; width: 100%; height: 100vh; }
              .column { flex: 1; padding: 0 40px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; }
              .column:first-child { border-right: 1px dashed #ccc; }
              
              .header-box { 
                border: 3px double black; 
                padding: 5px 20px; 
                color: red; 
                font-weight: bold; 
                font-size: 18px;
                text-align: center; 
                margin-bottom: 50px;
                margin-top: 50px;
                width: 100%;
                box-sizing: border-box;
              }
              
              .section { margin-bottom: 40px; text-align: center; width: 100%; }
              
              .label { 
                font-size: 16px; 
                text-transform: uppercase; 
                margin-bottom: 15px; 
                color: black;
              }
              
              .value { 
                font-size: 28px; 
                font-weight: bold; 
                text-decoration: underline; 
              }

              .breakdown {
                font-size: 24px;
                display: flex;
                flex-direction: column;
                gap: 20px;
                margin-top: 20px;
              }

              .breakdown-item {
                display: flex;
                justify-content: center;
                gap: 10px;
              }

              .red-label {
                color: red;
                font-weight: bold;
              }

              .amount-val {
                color: black;
              }
            </style>
          </head>
          <body>
            <div class="container">
              ${printContent('Range 1', rptStartOr1, rptEndOr1, r1Total)}
              ${printContent('Range 2', rptStartOr2, rptEndOr2, r2Total)}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const handlePrintRptReport = (fundType: 'GENERAL' | 'SEF' = 'GENERAL', accountableOfficerName?: string, accountableOfficerPosition?: string) => {
    if (!rptFilterAf56Id) return;
    const afNo = rptFilterAf56Id;

    const filterByRange = (sOr: string | null, eOr: string | null) => {
      if (!sOr || !eOr) return [];
      return rptCollections.filter(item => {
        if (item.af56Id !== afNo || !item.orNumber) return false;
        
        const itemOr = parseInt(item.orNumber, 10);
        const start = parseInt(sOr, 10);
        const end = parseInt(eOr, 10);
        
        if (!isNaN(itemOr) && !isNaN(start) && !isNaN(end)) {
          return itemOr >= start && itemOr <= end;
        }
        return item.orNumber >= sOr && item.orNumber <= eOr;
      });
    };

    const range1Data = filterByRange(rptStartOr1, rptEndOr1);
    const range2Data = filterByRange(rptStartOr2, rptEndOr2);
    
    // Merge data and sort by OR
    const allData = [...range1Data, ...range2Data].sort((a, b) => {
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
    const reportItems = allData.map(item => {
      const { basic, sef } = splitAmount(item.amount || 0);
      return {
        ...item,
        amount: isGeneral ? basic : sef
      };
    });
    
    const rawTotalAmount = allData.reduce((sum, item) => sum + (item.amount || 0), 0);
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

    // 2. VERIFICATION AND ACKNOWLEDGMENT: Municipal Treasurer
    const treasurer = signatories.find(s => 
      s.position.toLowerCase() === 'municipal treasurer' || 
      (s.position.toLowerCase().includes('treasurer') && !s.position.toLowerCase().includes('staff') && !s.position.toLowerCase().includes('clerk'))
    ) || signatories.find(s => s.remarks?.toLowerCase().includes('verification') || s.remarks?.toLowerCase().includes('acknowledgment')) || { fullName: 'MENARD A. HERRERA', position: 'Municipal Treasurer' };

    // 3. Prepared by: Accounting Staff
    const preparer = signatories.find(s =>
      s.remarks?.toLowerCase().includes('prepared') ||
      (s.department.toLowerCase().includes('account') && (s.position.toLowerCase().includes('staff') || s.position.toLowerCase().includes('aide') || s.position.toLowerCase().includes('aa') || s.position.toLowerCase().includes('clerk'))) ||
      s.fullName.toLowerCase().includes('fanoga')
    ) || { fullName: 'HESTHER F. FANOGA', position: 'AA II' };

    // 4. Certified Correct: Accountant
    const accountant = signatories.find(s =>
      s.remarks?.toLowerCase().includes('certified') ||
      s.position.toLowerCase() === 'municipal accountant' ||
      s.fullName.toLowerCase().includes('paz')
    ) || { fullName: 'LEON F. PAZ, JR.', position: 'Municipal Accountant' };

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

    if (rptStartOr1 && rptEndOr1) {
      const r1ItemsRaw = range1Data;
      const r1RawTotal = r1ItemsRaw.reduce((sum, i) => sum + (i.amount || 0), 0);
      const { basic: r1Basic, sef: r1Sef } = splitAmount(r1RawTotal);
      const r1Tot = isGeneral ? r1Basic : r1Sef;
      const minN = parseInt(rptStartOr1, 10);
      const maxN = parseInt(rptEndOr1, 10);
      rptRanges.push({
        minOr: rptStartOr1,
        maxOr: rptEndOr1,
        amount: r1Tot,
        qty: !isNaN(minN) && !isNaN(maxN) ? Math.max(1, maxN - minN + 1) : r1ItemsRaw.length,
        minNum: minN,
        maxNum: maxN
      });
    }

    if (rptStartOr2 && rptEndOr2) {
      const r2ItemsRaw = range2Data;
      const r2RawTotal = r2ItemsRaw.reduce((sum, i) => sum + (i.amount || 0), 0);
      const { basic: r2Basic, sef: r2Sef } = splitAmount(r2RawTotal);
      const r2Tot = isGeneral ? r2Basic : r2Sef;
      const minN = parseInt(rptStartOr2, 10);
      const maxN = parseInt(rptEndOr2, 10);
      rptRanges.push({
        minOr: rptStartOr2,
        maxOr: rptEndOr2,
        amount: r2Tot,
        qty: !isNaN(minN) && !isNaN(maxN) ? Math.max(1, maxN - minN + 1) : r2ItemsRaw.length,
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

  const handlePrintCtcCover = () => {
    const data = filteredCtcCollections;
    if (data.length === 0) return;

    let minCtc = ctcStartOr1 || '';
    let maxCtc = ctcEndOr1 || '';
    if (!minCtc || !maxCtc) {
      const sorted = [...data].sort((a, b) => (a.ctcNo || '').localeCompare(b.ctcNo || '', undefined, { numeric: true }));
      minCtc = sorted[0]?.ctcNo || '';
      maxCtc = sorted[sorted.length - 1]?.ctcNo || '';
    }

    const total = data.reduce((s, i) => s + (i.amount || 0), 0);
    const indTotal = data.filter(i => i.ctcType === 'Individual').reduce((s, i) => s + (i.amount || 0), 0);
    const corpTotal = data.filter(i => i.ctcType === 'Corporation').reduce((s, i) => s + (i.amount || 0), 0);

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
        <head>
          <title>Print Community Tax Cover - A.F. NO. 0016</title>
          <style>
            @page { size: Letter portrait; margin: 0.5in; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
            .container { display: flex; width: 100%; height: 100vh; justify-content: center; align-items: center; }
            .column { width: 85%; padding: 30px; border: 3px double #000; text-align: center; }
            .header-box { font-size: 20px; font-weight: bold; color: #dc2626; margin-bottom: 25px; border-bottom: 2px solid #000; padding-bottom: 10px; }
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
                ACCOUNTABLE FORM NO. 0016<br/>
                <span style="font-size: 14px; color: #000;">COMMUNITY TAX CERTIFICATE (CEDULA)</span>
              </div>
              <div class="label">CTC / CERTIFICATE NO. RANGE</div>
              <div class="value">${minCtc} — ${maxCtc}</div>

              <div class="label">TOTAL REMITTANCE AMOUNT</div>
              <div class="value" style="color: #0284c7;">₱ ${total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>

              <div class="breakdown">
                <div class="breakdown-item">INDIVIDUAL: ₱ ${indTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                <div class="breakdown-item">CORPORATION: ₱ ${corpTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
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

  const handlePrintCommunityTaxReport = (accountableOfficerName?: string, accountableOfficerPosition?: string) => {
    const reportData = filteredCtcCollections;
    const totalAmount = reportData.reduce((sum, item) => sum + (item.amount || 0), 0);

    const individualItems = reportData.filter(i => i.ctcType === 'Individual');
    const corporateItems = reportData.filter(i => i.ctcType === 'Corporation');
    const individualTotal = individualItems.reduce((s, i) => s + (i.amount || 0), 0);
    const corporateTotal = corporateItems.reduce((s, i) => s + (i.amount || 0), 0);

    let minCtc = '';
    let maxCtc = '';
    if (reportData.length > 0) {
      const sortedCtc = [...reportData].sort((a, b) => (a.ctcNo || '').localeCompare(b.ctcNo || '', undefined, { numeric: true }));
      minCtc = sortedCtc[0]?.ctcNo || '';
      maxCtc = sortedCtc[sortedCtc.length - 1]?.ctcNo || '';
    }

    const minNum = parseInt(minCtc.replace(/\D/g, ''), 10);
    const maxNum = parseInt(maxCtc.replace(/\D/g, ''), 10);
    const qty = (!isNaN(minNum) && !isNaN(maxNum) && maxNum >= minNum) ? (maxNum - minNum + 1) : reportData.length;

    const dateStr = new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
    const certificationDateStr = new Date().toLocaleDateString('en-US');

    const collector = {
      fullName: (accountableOfficerName || user?.name || 'ACCOUNTABLE OFFICER').toUpperCase(),
      position: accountableOfficerPosition || user?.position || 'Revenue Collection Clerk I'
    };
    const treasurer = signatories.find(s => s.position.toLowerCase().includes('treasurer')) || {
      fullName: 'ERMA N. ANDRADE',
      position: 'Municipal Treasurer'
    };
    const preparer = signatories.find(s => s.remarks?.toLowerCase().includes('prepared')) || {
      fullName: 'JOY M. PEREZ',
      position: "Municipal Treasurer's Staff"
    };
    const accountant = signatories.find(s => s.position.toLowerCase().includes('accountant')) || {
      fullName: 'DEXTER M. BAUTISTA, CPA',
      position: 'Municipal Accountant'
    };

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
    const intPart = Math.floor(totalAmount);
    const centPart = Math.round((totalAmount - intPart) * 100);
    let words = '';
    if (intPart === 0) {
      words = 'Zero';
    } else {
      const millions = Math.floor(intPart / 1000000);
      const thousands = Math.floor((intPart % 1000000) / 1000);
      const remainder = intPart % 1000;
      if (millions > 0) words += convertLessThanOneThousand(millions).trim() + ' Million ';
      if (thousands > 0) words += convertLessThanOneThousand(thousands).trim() + ' Thousand ';
      if (remainder > 0) words += convertLessThanOneThousand(remainder).trim() + ' ';
    }
    words = words.trim() + ' Pesos';
    if (centPart > 0) {
      let centWords = centPart >= 20 ? (b[Math.floor(centPart / 10)] + (centPart % 10 !== 0 ? '-' + a[centPart % 10] : '')) : a[centPart];
      words += ' & ' + centWords.trim() + ' Cents Only';
    } else {
      words += ' Only';
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
        <head>
          <title>RCD Report - Community Tax (A.F. NO. 0016)</title>
          <style>
            @page { size: Letter portrait; margin: 8mm 10mm; }
            body { font-family: Arial, sans-serif; font-size: 11px; margin: 0; padding: 0; color: #000; -webkit-print-color-adjust: exact; }
            .header-text { text-align: center; line-height: 1.25; margin-bottom: 8px; }
            .report-title { font-size: 13px; font-weight: bold; margin-top: 4px; text-decoration: underline; }
            .meta-grid { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 6px; }
            .grid-table { width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 10.5px; }
            .grid-table th, .grid-table td { border: 1px solid #000; padding: 3px 4px; }
            .grid-table th { background: #f0f0f0; font-weight: bold; text-align: center; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .text-left { text-align: left; }
            .sec-title { font-weight: bold; font-size: 11px; margin-top: 6px; margin-bottom: 2px; }
            .summary-box { border: 1.5px solid #000; padding: 6px; margin-top: 8px; }
            .cert-grid { display: flex; gap: 15px; margin-top: 10px; }
            .cert-col { flex: 1; border: 1px solid #000; padding: 6px; font-size: 10px; }
            .sig-name { font-weight: bold; text-decoration: underline; text-align: center; margin-top: 18px; }
            .sig-pos { font-size: 9.5px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header-text">
            <div>Republic of the Philippines</div>
            <div>Province of Romblon</div>
            <div style="font-weight: bold;">MUNICIPALITY OF CONCEPCION</div>
            <div class="report-title">REPORT OF COLLECTIONS AND DEPOSITS</div>
            <div style="font-size: 10px; font-style: italic;">Accountable Form No. 0016 — Community Tax Certificate</div>
          </div>

          <div class="meta-grid">
            <div><strong>Fund:</strong> General Fund</div>
            <div><strong>Date:</strong> ${dateStr}</div>
            <div><strong>Report No.:</strong> CTC-${new Date().toISOString().slice(2, 7).replace('-', '')}-001</div>
          </div>
          <div class="meta-grid" style="margin-bottom: 8px;">
            <div><strong>Accountable Officer:</strong> ${collector.fullName} (${collector.position})</div>
          </div>

          <div class="sec-title">A. COLLECTIONS</div>
          <div style="font-size: 10px; margin-bottom: 3px;">1. For which official receipts were issued:</div>
          <table class="grid-table">
            <thead>
              <tr>
                <th style="width: 40%;">Official Receipt / Serial No.</th>
                <th style="width: 30%;">Accountable Form</th>
                <th style="width: 30%;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="text-center">${minCtc || '-'} — ${maxCtc || '-'} (${reportData.length} issued)</td>
                <td class="text-center">A.F. NO. 0016</td>
                <td class="text-right">₱ ${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr style="font-weight: bold; background: #fafafa;">
                <td colspan="2" class="text-right">TOTAL COLLECTIONS:</td>
                <td class="text-right">₱ ${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>

          <div class="sec-title" style="margin-top: 8px;">B. REMITTANCES / DEPOSITS TO TREASURER</div>
          <table class="grid-table">
            <thead>
              <tr>
                <th style="width: 40%;">Reference / Validation No.</th>
                <th style="width: 30%;">Date</th>
                <th style="width: 30%;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="text-center">Remitted to Municipal Treasurer</td>
                <td class="text-center">${dateStr}</td>
                <td class="text-right">₱ ${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>

          <div class="sec-title" style="margin-top: 8px;">C. ACCOUNTABILITY FOR ACCOUNTABLE FORMS</div>
          <table class="grid-table" style="font-size: 9.5px;">
            <thead>
              <tr>
                <th rowspan="2" style="width: 30%;">Name of Form</th>
                <th colspan="3">Beginning Balance</th>
                <th colspan="3">Issued</th>
                <th colspan="3">Ending Balance</th>
              </tr>
              <tr>
                <th>Qty</th><th>From</th><th>To</th>
                <th>Qty</th><th>From</th><th>To</th>
                <th>Qty</th><th>From</th><th>To</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Community Tax (A.F. 0016)</td>
                <td class="text-center">${qty}</td>
                <td class="text-center">${minCtc}</td>
                <td class="text-center">${maxCtc}</td>
                <td class="text-center">${qty}</td>
                <td class="text-center">${minCtc}</td>
                <td class="text-center">${maxCtc}</td>
                <td class="text-center">0</td>
                <td class="text-center">-</td>
                <td class="text-center">-</td>
              </tr>
            </tbody>
          </table>

          <div class="summary-box">
            <div style="font-weight: bold; font-size: 11px; margin-bottom: 6px;">D. SUMMARY OF COLLECTIONS</div>
            <div style="display: flex; justify-content: space-between; font-size: 10px;">
              <div>Beginning Balance: ₱ 0.00</div>
              <div>Add: Collections: ₱ ${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
              <div>Less: Remittance: ₱ ${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
              <div><strong>Ending Balance: ₱ 0.00</strong></div>
            </div>

            <div class="cert-grid">
              <div class="cert-col">
                <div><strong>CERTIFICATION:</strong></div>
                <div style="margin-top: 4px; line-height: 1.3;">
                  I hereby certify that the foregoing report of collections and deposits, and accountability for accountable forms is true and correct.
                </div>
                <div class="sig-name">${collector.fullName}</div>
                <div class="sig-pos">${collector.position}</div>
                <div style="text-align: center; font-size: 9px; margin-top: 3px;">${certificationDateStr}</div>
              </div>

              <div class="cert-col">
                <div><strong>VERIFICATION AND ACKNOWLEDGMENT:</strong></div>
                <div style="margin-top: 4px; line-height: 1.3;">
                  I hereby certify that the foregoing report has been verified and acknowledge receipt of (₱ ${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}) ${words}.
                </div>
                <div class="sig-name">${treasurer.fullName}</div>
                <div class="sig-pos">${treasurer.position}</div>
                <div style="text-align: center; font-size: 9px; margin-top: 3px;">Date: ____________</div>
              </div>
            </div>
          </div>

          <div class="sec-title" style="margin-top: 8px;">E. ACCOUNTING ENTRIES</div>
          <table class="grid-table" style="font-size: 10px;">
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
              ${individualTotal > 0 ? `
              <tr>
                <td class="text-left">Community Tax - Individual</td>
                <td class="text-center">4-01-01-050</td>
                <td></td>
                <td class="text-right">₱ ${individualTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
              </tr>
              ` : ''}
              ${corporateTotal > 0 ? `
              <tr>
                <td class="text-left">Community Tax - Corporation</td>
                <td class="text-center">4-01-01-060</td>
                <td></td>
                <td class="text-right">₱ ${corporateTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
              </tr>
              ` : ''}
              <tr style="font-weight: bold; background: #fafafa;">
                <td colspan="2" class="text-right">TOTAL:</td>
                <td class="text-right">₱ ${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                <td class="text-right">₱ ${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>

          <div style="display: flex; justify-content: space-between; margin-top: 14px; font-size: 10px;">
            <div style="width: 45%;">
              <div>Prepared by:</div>
              <div style="margin-top: 18px; font-weight: bold; font-size: 10.5px;">${preparer.fullName}</div>
              <div>${preparer.position}</div>
            </div>
            <div style="width: 45%;">
              <div>Certified Correct:</div>
              <div style="margin-top: 18px; font-weight: bold; font-size: 10.5px;">${accountant.fullName}</div>
              <div>${accountant.position}</div>
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

  const handleExportToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // 1. Collections Details Sheet (filtered or all)
      const dataToExport = filteredCollections.length > 0 ? filteredCollections : collections;
      if (dataToExport.length > 0) {
        const collectionsSheetData = dataToExport.map((item, idx) => ({
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
      const rptDataToExport = filteredRptCollections.length > 0 ? filteredRptCollections : rptCollections;
      if (rptDataToExport.length > 0) {
        const rptSheetData = rptDataToExport.map((item, idx) => ({
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

      // 7. Community Tax Sheet (AF 0016)
      const ctcDataToExport = filteredCtcCollections.length > 0 ? filteredCtcCollections : communityTaxCollections;
      if (ctcDataToExport.length > 0) {
        const ctcSheetData = ctcDataToExport.map((item, idx) => ({
          '#': idx + 1,
          'Date': item.date || '',
          'Form No.': item.afNo || 'AF 0016',
          'CTC Number': item.ctcNo || '',
          'Taxpayer Name': item.taxpayerName || '',
          'Classification': item.ctcType || 'Individual',
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
        XLSX.utils.book_append_sheet(wb, wsCtc, 'Community Tax (AF 0016)');
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

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3.5, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" component="h1" fontWeight="800" sx={{ color: '#0f172a' }}>
            Reports & Summaries
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Consolidated collection reports, accountable forms summary, and official RCD printouts.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          {tabValue === 1 && selectedAfNos.length === 1 && (
            <>
              <Box sx={{ minWidth: 165, width: 175 }}>
                <Autocomplete
                  size="small"
                  options={validOrs}
                  value={startOr1}
                  onChange={(_, newValue) => setStartOr1(newValue)}
                  renderInput={(params) => <TextField {...params} label="Start OR 1" sx={{ '& .MuiInputBase-input': { fontSize: '0.86rem', fontWeight: 600 } }} />}
                />
              </Box>
              <Box sx={{ minWidth: 165, width: 175 }}>
                <Autocomplete
                  size="small"
                  options={validOrs}
                  value={endOr1}
                  onChange={(_, newValue) => setEndOr1(newValue)}
                  renderInput={(params) => <TextField {...params} label="End OR 1" sx={{ '& .MuiInputBase-input': { fontSize: '0.86rem', fontWeight: 600 } }} />}
                />
              </Box>
              <Box sx={{ minWidth: 165, width: 175 }}>
                <Autocomplete
                  size="small"
                  options={validOrs}
                  value={startOr2}
                  onChange={(_, newValue) => setStartOr2(newValue)}
                  renderInput={(params) => <TextField {...params} label="Start OR 2" sx={{ '& .MuiInputBase-input': { fontSize: '0.86rem', fontWeight: 600 } }} />}
                />
              </Box>
              <Box sx={{ minWidth: 165, width: 175 }}>
                <Autocomplete
                  size="small"
                  options={validOrs}
                  value={endOr2}
                  onChange={(_, newValue) => setEndOr2(newValue)}
                  renderInput={(params) => <TextField {...params} label="End OR 2" sx={{ '& .MuiInputBase-input': { fontSize: '0.86rem', fontWeight: 600 } }} />}
                />
              </Box>
              <Tooltip title="Print Cover" arrow>
                <IconButton 
                  color="primary"
                  disabled={!((startOr1 && endOr1) || (startOr2 && endOr2))}
                  onClick={handlePrintCover}
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
            </>
          )}
          {tabValue !== 2 && (
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

          {tabValue === 2 && (
            <>
              {rptFilterAf56Id && (
                <>
                  <Box sx={{ minWidth: 165, width: 175 }}>
                    <Autocomplete
                      size="small"
                      options={validRptOrs}
                      value={rptStartOr1}
                      onChange={(_, newValue) => setRptStartOr1(newValue)}
                      renderInput={(params) => <TextField {...params} label="Start OR 1" sx={{ '& .MuiInputBase-input': { fontSize: '0.86rem', fontWeight: 600 } }} />}
                    />
                  </Box>
                  <Box sx={{ minWidth: 165, width: 175 }}>
                    <Autocomplete
                      size="small"
                      options={validRptOrs}
                      value={rptEndOr1}
                      onChange={(_, newValue) => setRptEndOr1(newValue)}
                      renderInput={(params) => <TextField {...params} label="End OR 1" sx={{ '& .MuiInputBase-input': { fontSize: '0.86rem', fontWeight: 600 } }} />}
                    />
                  </Box>
                  <Box sx={{ minWidth: 165, width: 175 }}>
                    <Autocomplete
                      size="small"
                      options={validRptOrs}
                      value={rptStartOr2}
                      onChange={(_, newValue) => setRptStartOr2(newValue)}
                      renderInput={(params) => <TextField {...params} label="Start OR 2" sx={{ '& .MuiInputBase-input': { fontSize: '0.86rem', fontWeight: 600 } }} />}
                    />
                  </Box>
                  <Box sx={{ minWidth: 165, width: 175 }}>
                    <Autocomplete
                      size="small"
                      options={validRptOrs}
                      value={rptEndOr2}
                      onChange={(_, newValue) => setRptEndOr2(newValue)}
                      renderInput={(params) => <TextField {...params} label="End OR 2" sx={{ '& .MuiInputBase-input': { fontSize: '0.86rem', fontWeight: 600 } }} />}
                    />
                  </Box>
                  <Tooltip title="Print RPT Cover" arrow>
                    <IconButton
                      color="primary"
                      onClick={handlePrintRptCover}
                      disabled={!rptStartOr1 || !rptEndOr1}
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
                      disabled={!rptStartOr1 || !rptEndOr1}
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
                      disabled={!rptStartOr1 || !rptEndOr1}
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
                </>
              )}
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

          {tabValue === 3 && (
            <>
              <Box sx={{ minWidth: 165, width: 175 }}>
                <Autocomplete
                  size="small"
                  options={validCtcOrs}
                  value={ctcStartOr1}
                  onChange={(_, newValue) => setCtcStartOr1(newValue)}
                  renderInput={(params) => <TextField {...params} label="Start CTC No." sx={{ '& .MuiInputBase-input': { fontSize: '0.86rem', fontWeight: 600 } }} />}
                />
              </Box>
              <Box sx={{ minWidth: 165, width: 175 }}>
                <Autocomplete
                  size="small"
                  options={validCtcOrs}
                  value={ctcEndOr1}
                  onChange={(_, newValue) => setCtcEndOr1(newValue)}
                  renderInput={(params) => <TextField {...params} label="End CTC No." sx={{ '& .MuiInputBase-input': { fontSize: '0.86rem', fontWeight: 600 } }} />}
                />
              </Box>
              <Tooltip title="Print Community Tax Cover" arrow>
                <IconButton
                  color="primary"
                  onClick={handlePrintCtcCover}
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
              <Tooltip title="Print Official Community Tax RCD (A.F. NO. 0016)" arrow>
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
          <Tab label="RCD Summaries" />
          <Tab label="Collection Details" />
          <Tab label="RPT Collections" />
          <Tab label="Community Tax" />
        </Tabs>

        {isLoading ? (
          <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {tabValue === 0 && (
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

            {tabValue === 1 && (
              <>
                <Box sx={{ p: 2, borderBottom: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
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
                          <TableCell colSpan={4} align="center" sx={{ py: 8 }}>
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

            {tabValue === 2 && (
              <>
                <Box sx={{ p: 2, borderBottom: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
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
                          <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
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

            {tabValue === 3 && (
              <Box sx={{ p: 3 }}>
                {/* Search & Filter Controls */}
                <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid #e2e8f0', borderRadius: 1.5, bgcolor: '#f8fafc' }}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid size={{ xs: 12, sm: 4, md: 3 }}>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="Search Taxpayer, CTC No., Remarks..."
                        value={ctcSearchTerm}
                        onChange={(e) => setCtcSearchTerm(e.target.value)}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <Search fontSize="small" sx={{ color: '#64748b' }} />
                              </InputAdornment>
                            )
                          }
                        }}
                      />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Classification</InputLabel>
                        <Select
                          value={ctcFilterType}
                          label="Classification"
                          onChange={(e) => setCtcFilterType(e.target.value)}
                        >
                          <MenuItem value="ALL">All Classifications</MenuItem>
                          <MenuItem value="Individual">Individual (₱5 base)</MenuItem>
                          <MenuItem value="Corporation">Corporation (₱500 base)</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4, md: 2.5 }}>
                      <Autocomplete
                        size="small"
                        options={['Agbun-od', 'Bachawan', 'Calabogo', 'Concepcion', 'Corcuera', 'Guintiguiban', 'Ilijan', 'Labnig', 'Mabini', 'Poblacion', 'San Agustin', 'San Pedro']}
                        value={ctcFilterBarangay}
                        onChange={(_, val) => setCtcFilterBarangay(val)}
                        renderInput={(params) => <TextField {...params} label="Filter Barangay" />}
                      />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 6, md: 2.25 }}>
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
                    <Grid size={{ xs: 6, sm: 6, md: 2.25 }}>
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

                  {(ctcSearchTerm || ctcFilterType !== 'ALL' || ctcFilterBarangay || ctcStartDate || ctcEndDate || ctcStartOr1 || ctcEndOr1) && (
                    <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        Showing {filteredCtcCollections.length} of {communityTaxCollections.length} records
                      </Typography>
                      <Button
                        size="small"
                        sx={{ fontSize: '0.75rem', py: 0 }}
                        onClick={() => {
                          setCtcSearchTerm('');
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
                        <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Date</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Form No.</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#334155' }}>CTC No.</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Taxpayer Name</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Classification</TableCell>
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
                          <TableCell colSpan={11} align="center" sx={{ py: 4, color: '#64748b' }}>
                            No Community Tax records found matching the filter criteria.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCtcCollections
                          .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                          .map((item) => (
                            <TableRow key={item.id} hover>
                              <TableCell>{item.date || '-'}</TableCell>
                              <TableCell>
                                <Chip label={item.afNo || 'AF 0016'} size="small" sx={{ height: 20, fontSize: '0.72rem', bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 700 }} />
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#0284c7' }}>{item.ctcNo || '-'}</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>{item.taxpayerName || '-'}</TableCell>
                              <TableCell>
                                <Chip
                                  label={item.ctcType || 'Individual'}
                                  size="small"
                                  color={item.ctcType === 'Corporation' ? 'warning' : 'default'}
                                  sx={{ height: 20, fontSize: '0.72rem', fontWeight: 600 }}
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
                : 'Community Tax (A.F. NO. 0016)'
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

      <Notification
        open={notification.open}
        message={notification.message}
        severity={notification.severity}
        onClose={() => setNotification(prev => ({ ...prev, open: false }))}
      />
    </Box>
  );
};
