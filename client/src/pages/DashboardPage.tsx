import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { 
  Typography, 
  Grid, 
  Paper, 
  Box, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Chip, 
  CircularProgress, 
  FormControl, 
  Select, 
  MenuItem, 
  InputLabel, 
  Card, 
  IconButton, 
  Tooltip, 
  Button, 
  LinearProgress, 
  Stack 
} from '@mui/material';
import { 
  TrendingUp, 
  ArrowForward, 
  AdminPanelSettings, 
  Person, 
  Refresh, 
  Receipt, 
  HomeWork, 
  Assessment, 
  MonetizationOn, 
  ListAlt, 
  People, 
  CheckCircle, 
  AccountBalance, 
  ReceiptLong, 
  Security,
  SupervisorAccount
} from '@mui/icons-material';
import { 
  getRecentReports, 
  getCollectionEntries, 
  getRPTCollections, 
  getAccountCodes, 
  type CollectionItem 
} from '../services/supabaseService';
import type { RCDReport, AccountCode, RPTCollectionItem } from '../types/rcd';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [reports, setReports] = useState<RCDReport[]>([]);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [rptCollections, setRptCollections] = useState<RPTCollectionItem[]>([]);
  const [, setAccountCodes] = useState<AccountCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [selectedCollector, setSelectedCollector] = useState<string>('all');

  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'administrator';

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [reportsData, collectionsData, rptData, codesData] = await Promise.all([
        getRecentReports(),
        getCollectionEntries(),
        getRPTCollections(),
        getAccountCodes()
      ]);
      setReports(reportsData || []);
      setCollections(collectionsData || []);
      setRptCollections(rptData || []);
      setAccountCodes(codesData || []);
    } catch (error) {
      console.error('Failed to load dashboard data', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Filter General Collections by Time
  const filterByTime = <T extends { date?: string }>(items: T[]): T[] => {
    if (timeRange === 'all') return items;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return items.filter(item => {
      if (!item.date) return true;
      const d = new Date(item.date);
      if (isNaN(d.getTime())) return true;

      if (timeRange === 'today') {
        return d.toDateString() === today.toDateString();
      } else if (timeRange === 'week') {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return d >= weekAgo;
      } else if (timeRange === 'month') {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return d >= monthAgo;
      }
      return true;
    });
  };

  // Filtered collections
  const filteredGeneralCollections = useMemo(() => filterByTime(collections), [collections, timeRange]);
  const filteredRptCollections = useMemo(() => filterByTime(rptCollections), [rptCollections, timeRange]);
  const filteredReports = useMemo(() => {
    let res = filterByTime(reports);
    if (isAdmin && selectedCollector !== 'all') {
      res = res.filter(r => r.collectorName === selectedCollector);
    }
    return res;
  }, [reports, timeRange, selectedCollector, isAdmin]);

  // Aggregate totals
  const totalGeneralAmount = useMemo(() => {
    return filteredGeneralCollections.reduce((sum, c) => sum + (c.amount || 0), 0);
  }, [filteredGeneralCollections]);

  const totalRptAmount = useMemo(() => {
    return filteredRptCollections.reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [filteredRptCollections]);

  const grandTotalMunicipal = totalGeneralAmount + totalRptAmount;

  // Today's Intake
  const todayGeneralAmount = useMemo(() => {
    const todayStr = new Date().toDateString();
    return collections
      .filter(c => c.date && new Date(c.date).toDateString() === todayStr)
      .reduce((sum, c) => sum + (c.amount || 0), 0);
  }, [collections]);

  const todayRptAmount = useMemo(() => {
    const todayStr = new Date().toDateString();
    return rptCollections
      .filter(r => r.date && new Date(r.date).toDateString() === todayStr)
      .reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [rptCollections]);

  const todayTotalMunicipal = todayGeneralAmount + todayRptAmount;

  // Unique Collectors List
  const allCollectorsList = useMemo(() => {
    const names = new Set<string>();
    reports.forEach(r => { if (r.collectorName) names.add(r.collectorName); });
    collections.forEach(c => { if (c.payor) names.add(c.payor); });
    return Array.from(names);
  }, [reports, collections]);

  // Revenue By Category
  const categoryBreakdown = useMemo(() => {
    const catMap: Record<string, number> = {};
    filteredGeneralCollections.forEach(c => {
      const cat = c.mainCategory || 'Other Revenue';
      catMap[cat] = (catMap[cat] || 0) + (c.amount || 0);
    });
    // Add RPT
    if (totalRptAmount > 0) {
      catMap['Real Property Tax (Basic & SEF)'] = (catMap['Real Property Tax (Basic & SEF)'] || 0) + totalRptAmount;
    }
    return Object.entries(catMap).map(([name, amount]) => ({
      name,
      amount,
      percentage: grandTotalMunicipal > 0 ? (amount / grandTotalMunicipal) * 100 : 0
    })).sort((a, b) => b.amount - a.amount);
  }, [filteredGeneralCollections, totalRptAmount, grandTotalMunicipal]);

  // 7-Day Trend
  const trendData = useMemo(() => {
    const data: { date: string; genAmount: number; rptAmount: number; total: number }[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const genSum = collections
        .filter(c => c.date && new Date(c.date).toDateString() === d.toDateString())
        .reduce((sum, c) => sum + (c.amount || 0), 0);

      const rptSum = rptCollections
        .filter(r => r.date && new Date(r.date).toDateString() === d.toDateString())
        .reduce((sum, r) => sum + (r.amount || 0), 0);

      data.push({
        date: dateStr,
        genAmount: genSum,
        rptAmount: rptSum,
        total: genSum + rptSum
      });
    }
    return data;
  }, [collections, rptCollections]);

  const maxTrendValue = Math.max(...trendData.map(d => d.total), 1);

  // Collector-Specific Data (for non-admin view)
  const myGeneralCollections = useMemo(() => {
    return collections; // Personal collections
  }, [collections]);

  const myRptCollections = useMemo(() => {
    return rptCollections;
  }, [rptCollections]);

  const myTotalCollected = myGeneralCollections.reduce((sum, c) => sum + (c.amount || 0), 0) + myRptCollections.reduce((sum, r) => sum + (r.amount || 0), 0);
  const myTotalReceiptsCount = myGeneralCollections.length + myRptCollections.length;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress size={48} sx={{ color: '#0284c7' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 6 }}>
      
      {/* ========================================================================= */}
      {/* HEADER SECTION                                                            */}
      {/* ========================================================================= */}
      <Box sx={{ mb: 3.5, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h4" component="h1" fontWeight="800" sx={{ color: '#0f172a', letterSpacing: '-0.5px' }}>
              {isAdmin ? 'Municipal Executive Overview' : 'Collector Operational Desk'}
            </Typography>
            <Chip 
              icon={isAdmin ? <AdminPanelSettings sx={{ fontSize: 16 }} /> : <Person sx={{ fontSize: 16 }} />}
              label={isAdmin ? 'Executive Administrator' : 'Revenue Collector'} 
              size="small" 
              sx={{ 
                fontWeight: 700,
                bgcolor: isAdmin ? '#e0f2fe' : '#f0fdf4',
                color: isAdmin ? '#0284c7' : '#16a34a',
                border: isAdmin ? '1px solid rgba(14, 165, 233, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)'
              }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {isAdmin 
              ? `Real-time revenue monitoring, collection audit, and accountable forms reconciliation for LGU Concepcion.`
              : `Welcome, ${user?.name || 'Collector'}. Manage official receipt issuance and daily collection reports.`}
          </Typography>
        </Box>

        {/* Global Date & Collector Filter Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 140, bgcolor: '#ffffff', borderRadius: 2 }}>
            <InputLabel id="time-range-label">Period</InputLabel>
            <Select
              labelId="time-range-label"
              value={timeRange}
              label="Period"
              onChange={(e) => setTimeRange(e.target.value as any)}
              sx={{ borderRadius: 2 }}
            >
              <MenuItem value="all">All Time</MenuItem>
              <MenuItem value="today">Today</MenuItem>
              <MenuItem value="week">Past 7 Days</MenuItem>
              <MenuItem value="month">Past 30 Days</MenuItem>
            </Select>
          </FormControl>

          {isAdmin && allCollectorsList.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 160, bgcolor: '#ffffff', borderRadius: 2 }}>
              <InputLabel id="collector-filter-label">Collector</InputLabel>
              <Select
                labelId="collector-filter-label"
                value={selectedCollector}
                label="Collector"
                onChange={(e) => setSelectedCollector(e.target.value)}
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="all">All Collectors ({allCollectorsList.length})</MenuItem>
                {allCollectorsList.map((c) => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Tooltip title="Refresh Data" arrow>
            <IconButton 
              onClick={loadAllData} 
              sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', color: '#0284c7', '&:hover': { bgcolor: '#f0f9ff' } }}
            >
              <Refresh fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ========================================================================= */}
      {/* 1. ADMIN DASHBOARD VIEW                                                  */}
      {/* ========================================================================= */}
      {isAdmin ? (
        <Box>
          {/* Admin Hero Metric Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {/* Card 1: Total Municipal Collections */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 2.5, 
                  borderRadius: 1.5, 
                  border: '1px solid #e2e8f0',
                  bgcolor: '#ffffff',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AccountBalance sx={{ fontSize: 22 }} />
                  </Box>
                  <Chip label="Municipal Total" size="small" sx={{ bgcolor: '#f0f9ff', color: '#0284c7', fontWeight: 700, fontSize: '0.68rem', borderRadius: 1 }} />
                </Box>
                <Typography variant="caption" color="text.secondary" fontWeight="600" sx={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Total Municipal Revenue
                </Typography>
                <Typography variant="h5" fontWeight="800" sx={{ color: '#0f172a', mt: 0.5, letterSpacing: '-0.5px' }}>
                  ₱ {grandTotalMunicipal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1, fontSize: '0.72rem', color: '#64748b' }}>
                  <span>AF 51: ₱{totalGeneralAmount.toLocaleString('en-PH', { maximumFractionDigits: 0 })}</span>
                  <span>•</span>
                  <span>RPT: ₱{totalRptAmount.toLocaleString('en-PH', { maximumFractionDigits: 0 })}</span>
                </Box>
              </Paper>
            </Grid>

            {/* Card 2: Today's Total Intake */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 2.5, 
                  borderRadius: 1.5, 
                  border: '1px solid #e2e8f0',
                  bgcolor: '#ffffff'
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingUp sx={{ fontSize: 22 }} />
                  </Box>
                  <Chip label="Active Today" size="small" sx={{ bgcolor: '#f0fdf4', color: '#16a34a', fontWeight: 700, fontSize: '0.68rem', borderRadius: 1 }} />
                </Box>
                <Typography variant="caption" color="text.secondary" fontWeight="600" sx={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Today's Municipal Intake
                </Typography>
                <Typography variant="h5" fontWeight="800" sx={{ color: '#16a34a', mt: 0.5, letterSpacing: '-0.5px' }}>
                  ₱ {todayTotalMunicipal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Across all revenue collection counters
                </Typography>
              </Paper>
            </Grid>

            {/* Card 3: Total Receipts (ORs) */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 2.5, 
                  borderRadius: 1.5, 
                  border: '1px solid #e2e8f0',
                  bgcolor: '#ffffff'
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ReceiptLong sx={{ fontSize: 22 }} />
                  </Box>
                  <Chip label="Transactions" size="small" sx={{ bgcolor: '#fffbeb', color: '#d97706', fontWeight: 700, fontSize: '0.68rem', borderRadius: 1 }} />
                </Box>
                <Typography variant="caption" color="text.secondary" fontWeight="600" sx={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Total Official Receipts
                </Typography>
                <Typography variant="h5" fontWeight="800" sx={{ color: '#0f172a', mt: 0.5, letterSpacing: '-0.5px' }}>
                  {(filteredGeneralCollections.length + filteredRptCollections.length).toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  AF 51 ({filteredGeneralCollections.length}) & AF 56 ({filteredRptCollections.length})
                </Typography>
              </Paper>
            </Grid>

            {/* Card 4: Reports & Compliance */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 2.5, 
                  borderRadius: 1.5, 
                  border: '1px solid #e2e8f0',
                  bgcolor: '#ffffff'
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: '#f3e8ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Assessment sx={{ fontSize: 22 }} />
                  </Box>
                  <Chip label="Compliance" size="small" sx={{ bgcolor: '#faf5ff', color: '#7c3aed', fontWeight: 700, fontSize: '0.68rem', borderRadius: 1 }} />
                </Box>
                <Typography variant="caption" color="text.secondary" fontWeight="600" sx={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  RCD Reports Generated
                </Typography>
                <Typography variant="h5" fontWeight="800" sx={{ color: '#0f172a', mt: 0.5, letterSpacing: '-0.5px' }}>
                  {filteredReports.length}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Official Appendix 34 compliance
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Quick Management Actions Bar */}
          <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 1.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Typography variant="subtitle2" fontWeight="800" sx={{ color: '#0f172a', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Security fontSize="small" sx={{ color: '#0284c7' }} />
              Executive Quick Actions
            </Typography>
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 6, sm: 2.4 }}>
                <Button 
                  fullWidth 
                  variant="outlined" 
                  startIcon={<ListAlt />} 
                  onClick={() => navigate('/account-codes')}
                  sx={{ py: 0.8, borderRadius: 1, textTransform: 'none', fontWeight: 700, color: '#0284c7', borderColor: '#e2e8f0', '&:hover': { bgcolor: '#f0f9ff' } }}
                >
                  Chart of Accounts
                </Button>
              </Grid>
              <Grid size={{ xs: 6, sm: 2.4 }}>
                <Button 
                  fullWidth 
                  variant="outlined" 
                  startIcon={<People />} 
                  onClick={() => navigate('/signatories')}
                  sx={{ py: 0.8, borderRadius: 1, textTransform: 'none', fontWeight: 700, color: '#0284c7', borderColor: '#e2e8f0', '&:hover': { bgcolor: '#f0f9ff' } }}
                >
                  Signatories
                </Button>
              </Grid>
              <Grid size={{ xs: 6, sm: 2.4 }}>
                <Button 
                  fullWidth 
                  variant="outlined" 
                  startIcon={<SupervisorAccount />} 
                  onClick={() => navigate('/users')}
                  sx={{ py: 0.8, borderRadius: 1, textTransform: 'none', fontWeight: 700, color: '#0284c7', borderColor: '#e2e8f0', '&:hover': { bgcolor: '#f0f9ff' } }}
                >
                  User Accounts
                </Button>
              </Grid>
              <Grid size={{ xs: 6, sm: 2.4 }}>
                <Button 
                  fullWidth 
                  variant="outlined" 
                  startIcon={<Assessment />} 
                  onClick={() => navigate('/reports')}
                  sx={{ py: 0.8, borderRadius: 1, textTransform: 'none', fontWeight: 700, color: '#0284c7', borderColor: '#e2e8f0', '&:hover': { bgcolor: '#f0f9ff' } }}
                >
                  RCD Reports
                </Button>
              </Grid>
              <Grid size={{ xs: 12, sm: 2.4 }}>
                <Button 
                  fullWidth 
                  variant="contained" 
                  startIcon={<Receipt />} 
                  onClick={() => navigate('/collection')}
                  sx={{ py: 0.8, borderRadius: 1, textTransform: 'none', fontWeight: 700, bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' } }}
                >
                  Audit Collections
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {/* Main Visualizations & Distribution */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            {/* 7-Day Municipal Trend */}
            <Grid size={{ xs: 12, md: 7 }}>
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 1.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff', height: '100%' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0f172a' }}>
                      7-Day Municipal Collection Trend
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Daily consolidated intake trajectory
                    </Typography>
                  </Box>
                  <Chip label="Daily Intake" size="small" sx={{ bgcolor: '#f0f9ff', color: '#0284c7', fontWeight: 700, borderRadius: 1 }} />
                </Box>

                {/* Bar Chart Visualization */}
                <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 200, pt: 3, pb: 1 }}>
                  {trendData.map((d, idx) => {
                    const heightPercent = maxTrendValue > 0 ? (d.total / maxTrendValue) * 100 : 0;
                    return (
                      <Box key={idx} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, px: 0.5 }}>
                        <Tooltip title={`Total: ₱${d.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })} (Gen: ₱${d.genAmount.toLocaleString()}, RPT: ₱${d.rptAmount.toLocaleString()})`} arrow>
                          <Box 
                            sx={{ 
                              width: '80%', 
                              maxWidth: 36,
                              height: `${Math.max(6, heightPercent)}%`, 
                              bgcolor: d.total > 0 ? '#0284c7' : '#e2e8f0',
                              borderRadius: '4px 4px 0 0',
                              transition: 'all 0.3s ease',
                              cursor: 'pointer',
                              '&:hover': { bgcolor: '#0369a1', transform: 'scaleY(1.05)' }
                            }} 
                          />
                        </Tooltip>
                        <Typography variant="caption" sx={{ mt: 1, fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>
                          {d.date}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Paper>
            </Grid>

            {/* Revenue Distribution By Category */}
            <Grid size={{ xs: 12, md: 5 }}>
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 1.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff', height: '100%' }}>
                <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0f172a', mb: 0.5 }}>
                  Revenue Stream Breakdown
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  Major municipal revenue classifications
                </Typography>

                <Stack spacing={2}>
                  {categoryBreakdown.slice(0, 5).map((cat, idx) => (
                    <Box key={idx}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="body2" fontWeight="700" sx={{ color: '#334155', fontSize: '0.82rem' }} noWrap>
                          {cat.name}
                        </Typography>
                        <Typography variant="body2" fontWeight="800" sx={{ color: '#0284c7', fontSize: '0.82rem' }}>
                          ₱{cat.amount.toLocaleString('en-PH', { maximumFractionDigits: 0 })} ({cat.percentage.toFixed(1)}%)
                        </Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={cat.percentage} 
                        sx={{ 
                          height: 6, 
                          borderRadius: 1, 
                          bgcolor: '#f1f5f9',
                          '& .MuiLinearProgress-bar': { bgcolor: idx === 0 ? '#0284c7' : idx === 1 ? '#0ea5e9' : '#38bdf8' }
                        }} 
                      />
                    </Box>
                  ))}
                </Stack>
              </Paper>
            </Grid>
          </Grid>

          {/* Recent Consolidated Activity Log */}
          <Paper elevation={0} sx={{ borderRadius: 1.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff', overflow: 'hidden' }}>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
              <Box>
                <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0f172a' }}>
                  Recent Municipal Collection Reports
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Audited submissions from all revenue collectors
                </Typography>
              </Box>
              <Button 
                size="small" 
                endIcon={<ArrowForward />} 
                onClick={() => navigate('/reports')}
                sx={{ fontWeight: 700, color: '#0284c7', textTransform: 'none', borderRadius: 1 }}
              >
                View All Reports
              </Button>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Report No.</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Collector</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Fund Type</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }} align="right">Amount</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }} align="center">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredReports.slice(0, 6).map((report, idx) => (
                    <TableRow key={report.id || idx} hover sx={{ '&:last-child td': { border: 0 } }}>
                      <TableCell sx={{ fontWeight: 700, color: '#0284c7' }}>{report.reportNumber}</TableCell>
                      <TableCell>{report.date}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{report.collectorName || 'Collector'}</TableCell>
                      <TableCell>
                        <Chip label={report.fundType || 'General Fund'} size="small" sx={{ height: 20, fontSize: '0.68rem', bgcolor: '#f0f9ff', color: '#0284c7', borderRadius: 1 }} />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#0f172a' }}>
                        ₱ {(report.totalCollection || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={report.status || 'Verified'} 
                          size="small" 
                          sx={{ 
                            height: 20, 
                            fontSize: '0.68rem', 
                            fontWeight: 700,
                            borderRadius: 1,
                            bgcolor: report.status === 'Verified' ? '#f0fdf4' : '#fffbeb',
                            color: report.status === 'Verified' ? '#16a34a' : '#d97706'
                          }} 
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredReports.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 3, color: '#94a3b8' }}>
                        No collection reports found for the selected filter.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      ) : (
        /* ========================================================================= */
        /* 2. COLLECTOR / USER DASHBOARD VIEW                                        */
        /* ========================================================================= */
        <Box>
          {/* Collector KPI Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {/* Card 1: My Total Collections */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 2.5, 
                  borderRadius: 1.5, 
                  border: '1px solid #e2e8f0',
                  bgcolor: '#ffffff'
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MonetizationOn sx={{ fontSize: 22 }} />
                  </Box>
                  <Chip label="My Collections" size="small" sx={{ bgcolor: '#f0f9ff', color: '#0284c7', fontWeight: 700, fontSize: '0.68rem', borderRadius: 1 }} />
                </Box>
                <Typography variant="caption" color="text.secondary" fontWeight="600" sx={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  My Total Collections
                </Typography>
                <Typography variant="h5" fontWeight="800" sx={{ color: '#0f172a', mt: 0.5, letterSpacing: '-0.5px' }}>
                  ₱ {myTotalCollected.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Total collected at your counter
                </Typography>
              </Paper>
            </Grid>

            {/* Card 2: Today's Intake */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 2.5, 
                  borderRadius: 1.5, 
                  border: '1px solid #e2e8f0',
                  bgcolor: '#ffffff'
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingUp sx={{ fontSize: 22 }} />
                  </Box>
                  <Chip label="Today" size="small" sx={{ bgcolor: '#f0fdf4', color: '#16a34a', fontWeight: 700, fontSize: '0.68rem', borderRadius: 1 }} />
                </Box>
                <Typography variant="caption" color="text.secondary" fontWeight="600" sx={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Today's Intake
                </Typography>
                <Typography variant="h5" fontWeight="800" sx={{ color: '#16a34a', mt: 0.5, letterSpacing: '-0.5px' }}>
                  ₱ {todayTotalMunicipal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Collections recorded today
                </Typography>
              </Paper>
            </Grid>

            {/* Card 3: Receipts Issued */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 2.5, 
                  borderRadius: 1.5, 
                  border: '1px solid #e2e8f0',
                  bgcolor: '#ffffff'
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Receipt sx={{ fontSize: 22 }} />
                  </Box>
                  <Chip label="Receipts" size="small" sx={{ bgcolor: '#fffbeb', color: '#d97706', fontWeight: 700, fontSize: '0.68rem', borderRadius: 1 }} />
                </Box>
                <Typography variant="caption" color="text.secondary" fontWeight="600" sx={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Official Receipts Issued
                </Typography>
                <Typography variant="h5" fontWeight="800" sx={{ color: '#0f172a', mt: 0.5, letterSpacing: '-0.5px' }}>
                  {myTotalReceiptsCount.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Total valid OR receipts registered
                </Typography>
              </Paper>
            </Grid>

            {/* Card 4: Accountable Forms in Hand */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 2.5, 
                  borderRadius: 1.5, 
                  border: '1px solid #e2e8f0',
                  bgcolor: '#ffffff'
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: '#f3e8ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle sx={{ fontSize: 22 }} />
                  </Box>
                  <Chip label="Active Pads" size="small" sx={{ bgcolor: '#faf5ff', color: '#7c3aed', fontWeight: 700, fontSize: '0.68rem', borderRadius: 1 }} />
                </Box>
                <Typography variant="caption" color="text.secondary" fontWeight="600" sx={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Active Accountable Forms
                </Typography>
                <Typography variant="h5" fontWeight="800" sx={{ color: '#0f172a', mt: 0.5, letterSpacing: '-0.5px' }}>
                  AF 51 & AF 56
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  50 Receipts per booklet
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Collector Quick Action Cards */}
          <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0f172a', mb: 1.5 }}>
            Transaction Quick Actions
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card 
                elevation={0} 
                onClick={() => navigate('/collection')}
                sx={{ 
                  p: 2.5, 
                  borderRadius: 1.5, 
                  border: '1px solid #e2e8f0',
                  bgcolor: '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  '&:hover': { borderColor: '#0284c7', transform: 'translateY(-2px)' }
                }}
              >
                <Box sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1.5 }}>
                  <Receipt sx={{ fontSize: 24 }} />
                </Box>
                <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0f172a' }}>
                  New Collection Entry
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5, fontSize: '0.82rem' }}>
                  Record general collections, fees, and charges on Accountable Form No. 51.
                </Typography>
                <Button variant="contained" size="small" sx={{ bgcolor: '#0284c7', fontWeight: 700, borderRadius: 1, textTransform: 'none' }}>
                  Open AF 51 Desk
                </Button>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <Card 
                elevation={0} 
                onClick={() => navigate('/rpt-collection')}
                sx={{ 
                  p: 2.5, 
                  borderRadius: 1.5, 
                  border: '1px solid #e2e8f0',
                  bgcolor: '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  '&:hover': { borderColor: '#0284c7', transform: 'translateY(-2px)' }
                }}
              >
                <Box sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1.5 }}>
                  <HomeWork sx={{ fontSize: 24 }} />
                </Box>
                <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0f172a' }}>
                  New RPT Collection
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5, fontSize: '0.82rem' }}>
                  Record Real Property Tax collections and print AF No. 56 receipts.
                </Typography>
                <Button variant="contained" size="small" sx={{ bgcolor: '#0369a1', fontWeight: 700, borderRadius: 2, textTransform: 'none' }}>
                  Open RPT Desk
                </Button>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <Card 
                elevation={0} 
                onClick={() => navigate('/reports')}
                sx={{ 
                  p: 2.5, 
                  borderRadius: 3.5, 
                  border: '1.5px solid rgba(14, 165, 233, 0.3)',
                  bgcolor: '#f0f9ff',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 8px 24px rgba(2, 132, 199, 0.15)' }
                }}
              >
                <Box sx={{ width: 48, height: 48, borderRadius: 2.5, bgcolor: '#0284c7', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                  <Assessment sx={{ fontSize: 28 }} />
                </Box>
                <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0f172a' }}>
                  Print RCD Summary
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5, fontSize: '0.82rem' }}>
                  Generate and print your official 2-page Appendix 34 RCD report.
                </Typography>
                <Button variant="contained" size="small" sx={{ bgcolor: '#0284c7', fontWeight: 700, borderRadius: 2, textTransform: 'none' }}>
                  View Reports
                </Button>
              </Card>
            </Grid>
          </Grid>

          {/* Collector Recent Receipts Table */}
          <Paper elevation={0} sx={{ borderRadius: 3.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff', overflow: 'hidden' }}>
            <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
              <Box>
                <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0f172a' }}>
                  My Recent Collections (Official Receipts Register)
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Latest entries recorded at your counter
                </Typography>
              </Box>
              <Button 
                size="small" 
                endIcon={<ArrowForward />} 
                onClick={() => navigate('/collection')}
                sx={{ fontWeight: 700, color: '#0284c7', textTransform: 'none' }}
              >
                View Full Collection Table
              </Button>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>OR Number</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Form No.</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Payor</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Revenue Item</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }} align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {collections.slice(0, 8).map((item, idx) => (
                    <TableRow key={item.id || idx} hover sx={{ '&:last-child td': { border: 0 } }}>
                      <TableCell sx={{ fontWeight: 700, color: '#0284c7' }}>{item.orNo}</TableCell>
                      <TableCell>
                        <Chip label={item.afNo || 'AF 51'} size="small" sx={{ height: 20, fontSize: '0.68rem', bgcolor: '#f1f5f9', fontWeight: 700 }} />
                      </TableCell>
                      <TableCell>{item.date}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{item.payor}</TableCell>
                      <TableCell>{item.subCategory}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#0f172a' }}>
                        ₱ {(item.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                  {collections.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 3, color: '#94a3b8' }}>
                        No collections recorded yet. Click "New Collection Entry" to begin.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}

    </Box>
  );
};
