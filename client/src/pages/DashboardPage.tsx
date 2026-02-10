import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { 
  Typography, 
  Grid, 
  Paper, 
  Box, 
  Button,
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
  CardContent,
  IconButton,
  Tooltip
} from '@mui/material';
import { 
  Description, 
  PieChart, 
  Group, 
  Add, 
  TrendingUp,
  MoreVert,
  FilterList
} from '@mui/icons-material';
import { getRecentReports } from '../services/googleSheets';
import type { RCDReport } from '../types/rcd';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<RCDReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'all'>('week');

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const data = await getRecentReports();
        setReports(data);
      } catch (error) {
        console.error('Failed to fetch reports', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReports();
  }, []);

  // Filter Reports Logic
  const filteredReports = useMemo(() => {
    if (timeRange === 'all') return reports;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return reports.filter(r => {
      const reportDate = new Date(r.date);
      if (isNaN(reportDate.getTime())) return true; // Keep if invalid date (legacy data)

      if (timeRange === 'today') {
        return reportDate.toDateString() === today.toDateString();
      } else if (timeRange === 'week') {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return reportDate >= weekAgo;
      } else if (timeRange === 'month') {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return reportDate >= monthAgo;
      }
      return true;
    });
  }, [reports, timeRange]);

  // Calculate Stats
  const totalCollections = filteredReports.reduce((sum, r) => sum + (r.totalCollection || 0), 0);
  const verifiedCount = filteredReports.filter(r => r.status === 'Verified').length;
  const uniqueCollectors = new Set(filteredReports.map(r => r.collectorName)).size;

  // Chart Data Preparation (Daily Collections for the last 7 days)
  const chartData = useMemo(() => {
    const data: { date: string, amount: number }[] = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      // Sum collections for this day
      const dailySum = reports
        .filter(r => {
            const rd = new Date(r.date);
            return !isNaN(rd.getTime()) && rd.toDateString() === d.toDateString();
        })
        .reduce((sum, r) => sum + (r.totalCollection || 0), 0);

      data.push({ date: dateStr, amount: dailySum });
    }
    return data;
  }, [reports]);

  const maxChartValue = Math.max(...chartData.map(d => d.amount), 1); // Avoid div by 0

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <Box>
          <Typography variant="h4" component="h2" gutterBottom fontWeight="bold">
            Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Welcome back, {user?.name}. Overview of your collections.
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Time Range</InputLabel>
          <Select
            value={timeRange}
            label="Time Range"
            onChange={(e) => setTimeRange(e.target.value as any)}
          >
            <MenuItem value="today">Today</MenuItem>
            <MenuItem value="week">This Week</MenuItem>
            <MenuItem value="month">This Month</MenuItem>
            <MenuItem value="all">All Time</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2, height: '100%' }}>
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'primary.light', color: 'primary.main' }}>
              <Description />
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Total Collections ({timeRange})</Typography>
              <Typography variant="h5" fontWeight="bold">
                ₱ {totalCollections.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </Typography>
            </Box>
          </Paper>
        </Grid>
        
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2, height: '100%' }}>
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'secondary.light', color: 'secondary.main' }}>
              <PieChart />
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Deposits Verified</Typography>
              <Typography variant="h5" fontWeight="bold">
                {verifiedCount}
              </Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2, height: '100%' }}>
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'info.light', color: 'info.main' }}>
              <Group />
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Active Collectors</Typography>
              <Typography variant="h5" fontWeight="bold">
                {uniqueCollectors}
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Chart Section */}
        <Grid size={{ xs: 12, md: 8 }}>
            <Paper sx={{ p: 3, height: '100%' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                    <Typography variant="h6" fontWeight="bold">Collections Trend (Last 7 Days)</Typography>
                    <TrendingUp color="action" />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'flex-end', height: 200, gap: 2, pt: 2 }}>
                    {chartData.map((d, i) => (
                        <Tooltip key={i} title={`₱ ${d.amount.toLocaleString()}`} placement="top">
                            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                                <Box sx={{ 
                                    width: '100%', 
                                    bgcolor: 'primary.main', 
                                    opacity: 0.8,
                                    borderRadius: '4px 4px 0 0',
                                    height: `${(d.amount / maxChartValue) * 100}%`,
                                    transition: 'height 0.5s ease',
                                    minHeight: 4,
                                    '&:hover': { opacity: 1 }
                                }} />
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, fontSize: '0.7rem' }}>
                                    {d.date}
                                </Typography>
                            </Box>
                        </Tooltip>
                    ))}
                </Box>
            </Paper>
        </Grid>

        {/* Quick Actions */}
        <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ height: '100%' }}>
                <CardContent>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>Quick Actions</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                        <Button 
                            variant="outlined" 
                            startIcon={<Add />} 
                            fullWidth 
                            onClick={() => navigate('/collection')}
                            sx={{ justifyContent: 'flex-start', py: 1.5 }}
                        >
                            New Collection Report
                        </Button>
                        <Button 
                            variant="outlined" 
                            startIcon={<Description />} 
                            fullWidth 
                            onClick={() => navigate('/reports')}
                            sx={{ justifyContent: 'flex-start', py: 1.5 }}
                        >
                            View Summary Reports
                        </Button>
                        <Button 
                            variant="outlined" 
                            startIcon={<PieChart />} 
                            fullWidth 
                            sx={{ justifyContent: 'flex-start', py: 1.5 }}
                        >
                            View Analytics
                        </Button>
                    </Box>
                </CardContent>
            </Card>
        </Grid>
      </Grid>

      {/* Recent Reports Section */}
      <Paper sx={{ overflow: 'hidden' }}>
        <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6" fontWeight="bold">Recent Reports</Typography>
          <Box>
            <Button startIcon={<FilterList />} sx={{ mr: 1 }}>Filter</Button>
            <Button 
                variant="contained" 
                startIcon={<Add />}
                onClick={() => navigate('/collection')}
            >
                New
            </Button>
          </Box>
        </Box>

        {isLoading ? (
            <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
            </Box>
        ) : reports.length === 0 ? (
            <Box sx={{ p: 8, textAlign: 'center' }}>
            <Box sx={{ 
                mx: 'auto', width: 48, height: 48, 
                bgcolor: 'action.hover', borderRadius: '50%', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 
            }}>
                <Description color="disabled" />
            </Box>
            <Typography variant="subtitle1" fontWeight="medium">No recent reports</Typography>
            <Typography variant="body2" color="text.secondary">
                Get started by creating a new collection report.
            </Typography>
            </Box>
        ) : (
            <TableContainer>
            <Table>
                <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Report No.</TableCell>
                    <TableCell>Fund</TableCell>
                    <TableCell>Collector</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="right">Action</TableCell>
                </TableRow>
                </TableHead>
                <TableBody>
                {filteredReports.slice(0, 10).map((report, idx) => (
                    <TableRow key={idx} hover>
                    <TableCell>{report.date}</TableCell>
                    <TableCell sx={{ color: 'primary.main', fontWeight: 'medium' }}>{report.reportNumber}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{report.fundType}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{report.collectorName}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'medium' }}>
                        ₱ {report.totalCollection?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell align="center">
                        <Chip 
                        label={report.status} 
                        size="small"
                        color={
                            report.status === 'Verified' ? 'success' : 
                            report.status === 'Submitted' ? 'primary' : 'default'
                        }
                        sx={{ 
                            fontWeight: 'bold',
                            bgcolor: report.status === 'Verified' ? 'success.light' : report.status === 'Submitted' ? 'primary.light' : 'action.selected',
                            color: report.status === 'Verified' ? 'success.dark' : report.status === 'Submitted' ? 'primary.dark' : 'text.primary'
                        }}
                        />
                    </TableCell>
                    <TableCell align="right">
                        <IconButton size="small">
                            <MoreVert fontSize="small" />
                        </IconButton>
                    </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
            </TableContainer>
        )}
      </Paper>
    </Box>
  );
};
