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
  TablePagination
} from '@mui/material';
import { Download, Clear, Print } from '@mui/icons-material';
import { getRecentReports, getCollectionEntries, getSignatories, getRPTCollections, type CollectionItem } from '../services/supabaseService';
import type { RCDReport, Signatory, RPTCollectionItem } from '../types/rcd';
import { useAuth } from '../context/useAuth';

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [, setReports] = useState<RCDReport[]>([]);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [rptCollections, setRptCollections] = useState<RPTCollectionItem[]>([]);
  const [filteredCollections, setFilteredCollections] = useState<CollectionItem[]>([]);
  const [filteredRptCollections, setFilteredRptCollections] = useState<RPTCollectionItem[]>([]);
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reportsData, collectionsData, signatoriesData, rptData] = await Promise.all([
          getRecentReports(),
          getCollectionEntries(),
          getSignatories(),
          getRPTCollections()
        ]);
        setReports(reportsData);
        setCollections(collectionsData);
        setFilteredCollections(collectionsData);
        setSignatories(signatoriesData);
        setRptCollections(rptData);
        setFilteredRptCollections(rptData);
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

  // Calculate Summaries for RCD Summaries Tab
  const afNoSummary = React.useMemo(() => {
    const summary: { [key: string]: number } = {};
    collections.forEach(item => {
      const afNo = item.afNo || 'Unspecified';
      summary[afNo] = (summary[afNo] || 0) + (item.amount || 0);
    });
    return Object.entries(summary)
      .map(([afNo, amount]) => ({ afNo, amount }))
      .sort((a, b) => a.afNo.localeCompare(b.afNo));
  }, [collections]);

  const monthlySummary = React.useMemo(() => {
    const summary: { [key: string]: number } = {};
    collections.forEach(item => {
      if (!item.date) return;
      const date = new Date(item.date);
      if (isNaN(date.getTime())) return;
      
      const monthYear = date.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
      summary[monthYear] = (summary[monthYear] || 0) + (item.amount || 0);
    });
    
    // Sort by date (parsing monthYear back to date for sorting)
    return Object.entries(summary)
      .map(([monthYear, amount]) => ({ monthYear, amount }))
      .sort((a, b) => {
        const dateA = new Date(a.monthYear);
        const dateB = new Date(b.monthYear);
        return dateB.getTime() - dateA.getTime(); // Descending order
      });
  }, [collections]);

  const subCategorySummary = React.useMemo(() => {
    const summary: { [key: string]: number } = {};
    collections.forEach(item => {
      const subCat = item.subCategory || 'Unspecified';
      summary[subCat] = (summary[subCat] || 0) + (item.amount || 0);
    });
    return Object.entries(summary)
      .map(([subCategory, amount]) => ({ subCategory, amount }))
      .sort((a, b) => a.subCategory.localeCompare(b.subCategory));
  }, [collections]);

  const mainCategorySummary = React.useMemo(() => {
    const summary: { [key: string]: number } = {};
    collections.forEach(item => {
      const mainCat = item.mainCategory || 'Unspecified';
      summary[mainCat] = (summary[mainCat] || 0) + (item.amount || 0);
    });
    return Object.entries(summary)
      .map(([mainCategory, amount]) => ({ mainCategory, amount }))
      .sort((a, b) => a.mainCategory.localeCompare(b.mainCategory));
  }, [collections]);

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
            <title>Print Cover - AF No. ${afNo}</title>
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

  const handlePrintReport = () => {
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
          name: selectedAfNos[0] ? (selectedAfNos[0].toLowerCase().startsWith('a.f.') ? selectedAfNos[0] : `A.F. NO. ${selectedAfNos[0]}`) : 'A.F. NO. 51',
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
          name: selectedAfNos[0] ? (selectedAfNos[0].toLowerCase().startsWith('a.f.') ? selectedAfNos[0] : `A.F. NO. ${selectedAfNos[0]}`) : 'A.F. NO. 51',
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
      Object.entries(itemsByAf).forEach(([af, itms]) => {
        const formName = af.toLowerCase().startsWith('a.f.') ? af.toUpperCase() : `A.F. NO. ${af}`;
        const sorted = [...itms].sort((a, b) => {
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
                name: formName,
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
            name: formName,
            minOr: curMinOr,
            maxOr: curMaxOr,
            amount: curAmount,
            qty: curQty,
            minNum: curMinN,
            maxNum: curLastN
          });
        }
      });
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
      const formName = range.name || 'A.F. NO. 51';
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
    const collectorCandidate = signatories.find(s => 
      s.remarks?.toLowerCase().includes('certification') || 
      s.position?.toLowerCase().includes('clerk') ||
      s.position?.toLowerCase().includes('collector') ||
      s.position?.toLowerCase().includes('rcc') ||
      (s.department?.toLowerCase().includes('treasurer') && !s.position?.toLowerCase().includes('municipal treasurer'))
    ) || signatories[0];

    const collector = {
      fullName: (collectorCandidate?.fullName && collectorCandidate.fullName !== 'ACCOUNTABLE OFFICER' 
        ? collectorCandidate.fullName 
        : (user?.name ? user.name.toUpperCase() : 'ACCOUNTABLE OFFICER')),
      position: collectorCandidate?.position || 'Revenue Collection Clerk I'
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
        <title>Report of Collections and Deposits</title> 
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
                    <td>${item.name}</td>
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
            <title>Print RPT Cover - AF No. ${afNo}</title>
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

  const handlePrintRptReport = (fundType: 'GENERAL' | 'SEF' = 'GENERAL') => {
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
    const collectorCandidate = signatories.find(s => 
      s.remarks?.toLowerCase().includes('certification') || 
      s.position?.toLowerCase().includes('clerk') ||
      s.position?.toLowerCase().includes('collector') ||
      s.position?.toLowerCase().includes('rcc') ||
      (s.department?.toLowerCase().includes('treasurer') && !s.position?.toLowerCase().includes('municipal treasurer'))
    ) || signatories[0];

    const collector = {
      fullName: (collectorCandidate?.fullName && collectorCandidate.fullName !== 'ACCOUNTABLE OFFICER' 
        ? collectorCandidate.fullName 
        : (user?.name ? user.name.toUpperCase() : 'ACCOUNTABLE OFFICER')),
      position: collectorCandidate?.position || 'Revenue Collection Clerk I'
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
        <title>${reportTitle} - AF No. 56</title> 
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

  return (
    <Box>
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
                  onClick={handlePrintReport}
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
              <Tooltip title="Export All Data" arrow>
                <IconButton color="secondary" sx={{ bgcolor: '#f0f9ff', borderRadius: 1, border: '1px solid rgba(14, 165, 233, 0.2)' }}>
                  <Download />
                </IconButton>
              </Tooltip>
            </>
          )}

          {tabValue === 2 && rptFilterAf56Id && (
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
                  onClick={() => handlePrintRptReport('GENERAL')}
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
                  onClick={() => handlePrintRptReport('SEF')}
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
          </>
        )}
      </Paper>
    </Box>
  );
};
