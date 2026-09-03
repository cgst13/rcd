import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  IconButton,
  Tooltip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  TablePagination,
  TableFooter,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  InputAdornment,
  Stack,
  Card,
  CardContent,
  Button
} from '@mui/material';
import {
  AccountBalance,
  Add,
  Edit,
  DeleteOutline,
  Search,
  Clear,
  Refresh,
  FileDownload,
  Print,
  AccountBalanceWallet,
  TrendingUp,
  ReceiptLong,
  Person
} from '@mui/icons-material';
import { useAuth } from '../context/useAuth';
import {
  getBankDeposits,
  saveBankDeposit,
  deleteBankDeposit,
  type BankDepositRecord,
  type BankDepositInput
} from '../services/supabaseService';
import { Notification } from '../components/Notification';
import { ConfirmDialog } from '../components/ConfirmDialog';

export const DepositsPage: React.FC = () => {
  const { user } = useAuth();

  // Data state
  const [deposits, setDeposits] = useState<BankDepositRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search and date filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Pagination
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  // Add / Edit Dialog State
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [currentId, setCurrentId] = useState<string | null>(null);

  const [formData, setFormData] = useState<BankDepositInput>({
    depositDate: new Date().toISOString().split('T')[0],
    depositControlNumber: '',
    amount: 0,
    depositorName: user?.name ? user.name.toUpperCase() : 'MUNICIPAL TREASURER'
  });

  // Print Summary Dialog State
  const [printSummaryOpen, setPrintSummaryOpen] = useState<boolean>(false);

  // Delete Confirmation Dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<boolean>(false);
  const [depositToDelete, setDepositToDelete] = useState<BankDepositRecord | null>(null);

  // Notification
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  const showNotification = (message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setNotification({ open: true, message, severity });
  };

  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

  // Load Data
  const loadDeposits = async () => {
    setLoading(true);
    try {
      const data = await getBankDeposits();
      setDeposits(data);
    } catch (e) {
      console.error('Error loading deposits:', e);
      showNotification('Failed to load bank deposits', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeposits();
  }, []);

  // Filtered Deposits
  const filteredDeposits = useMemo(() => {
    return deposits.filter(d => {
      // Search term: Deposit Control Number or Depositor Name
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchCtrl = (d.depositControlNumber || '').toLowerCase().includes(q);
        const matchName = (d.depositorName || '').toLowerCase().includes(q);
        if (!matchCtrl && !matchName) return false;
      }

      // Date range filter
      if (dateFrom && d.depositDate < dateFrom) return false;
      if (dateTo && d.depositDate > dateTo) return false;

      return true;
    });
  }, [deposits, searchTerm, dateFrom, dateTo]);

  // Executive KPI Metrics
  const metrics = useMemo(() => {
    const totalDeposited = deposits.reduce((sum, d) => sum + d.amount, 0);

    const currentMonthPrefix = new Date().toISOString().substring(0, 7); // YYYY-MM
    const thisMonthDeposits = deposits
      .filter(d => d.depositDate.startsWith(currentMonthPrefix))
      .reduce((sum, d) => sum + d.amount, 0);

    const latest = deposits.length > 0 ? deposits[0] : null;

    return {
      totalDeposited,
      thisMonthDeposits,
      totalCount: deposits.length,
      latestControlNo: latest ? latest.depositControlNumber : 'None'
    };
  }, [deposits]);

  // Filtered Total
  const filteredTotalAmount = useMemo(() => {
    return filteredDeposits.reduce((sum, d) => sum + d.amount, 0);
  }, [filteredDeposits]);

  // Open Dialog to Add
  const handleOpenAddDialog = () => {
    setIsEditing(false);
    setCurrentId(null);
    setFormData({
      depositDate: new Date().toISOString().split('T')[0],
      depositControlNumber: '',
      amount: 0,
      depositorName: user?.name ? user.name.toUpperCase() : 'MUNICIPAL TREASURER'
    });
    setOpenDialog(true);
  };

  // Open Dialog to Edit
  const handleOpenEditDialog = (deposit: BankDepositRecord) => {
    setIsEditing(true);
    setCurrentId(deposit.id);
    setFormData({
      depositDate: deposit.depositDate,
      depositControlNumber: deposit.depositControlNumber,
      amount: deposit.amount,
      depositorName: deposit.depositorName
    });
    setOpenDialog(true);
  };

  // Save Deposit
  const handleSaveDeposit = async () => {
    if (!formData.depositDate) {
      showNotification('Please enter Date of Deposit', 'warning');
      return;
    }
    if (!formData.depositControlNumber.trim()) {
      showNotification('Please enter Deposit Control Number', 'warning');
      return;
    }
    if (Number(formData.amount) <= 0) {
      showNotification('Amount must be greater than zero', 'warning');
      return;
    }
    if (!formData.depositorName.trim()) {
      showNotification('Please enter Name of Depositor', 'warning');
      return;
    }

    try {
      const payload: BankDepositInput = {
        depositDate: formData.depositDate,
        depositControlNumber: formData.depositControlNumber.trim(),
        amount: Number(formData.amount),
        depositorName: formData.depositorName.trim(),
        id: isEditing && currentId ? currentId : undefined
      };

      const result = await saveBankDeposit(payload);
      if (result) {
        showNotification(isEditing ? 'Deposit updated successfully' : 'Deposit recorded successfully', 'success');
        setOpenDialog(false);
        loadDeposits();
      } else {
        showNotification('Failed to save deposit record', 'error');
      }
    } catch (e) {
      console.error('Error saving deposit:', e);
      showNotification('Error occurred while saving deposit', 'error');
    }
  };

  // Delete Deposit
  const handleDeleteClick = (deposit: BankDepositRecord) => {
    setDepositToDelete(deposit);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!depositToDelete) return;
    try {
      await deleteBankDeposit(depositToDelete.id);
      showNotification(`Deposit Control No. ${depositToDelete.depositControlNumber} deleted`, 'info');
      setDeleteConfirmOpen(false);
      setDepositToDelete(null);
      loadDeposits();
    } catch (e) {
      console.error('Error deleting deposit:', e);
      showNotification('Failed to delete deposit record', 'error');
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredDeposits.length === 0) {
      showNotification('No deposit records to export', 'warning');
      return;
    }

    const exportRows: any[] = filteredDeposits.map((d, idx) => ({
      '#': idx + 1,
      'Date of Deposit': d.depositDate,
      'Deposit Control Number': d.depositControlNumber,
      'Amount (₱)': d.amount,
      'Name of Depositor': d.depositorName
    }));

    // Total row
    exportRows.push({
      '#': '',
      'Date of Deposit': 'TOTAL',
      'Deposit Control Number': '',
      'Amount (₱)': filteredTotalAmount,
      'Name of Depositor': ''
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Deposits');
    XLSX.writeFile(workbook, `Deposit_Management_${new Date().toISOString().split('T')[0]}.xlsx`);
    showNotification('Exported deposits to Excel', 'success');
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: '#f8fafc', minHeight: '100vh' }}>
      {/* 1. Header Section */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <Chip
            label="ADMINISTRATIVE MODULE • TREASURY"
            size="small"
            color="primary"
            sx={{ fontWeight: 800, fontSize: '0.68rem', letterSpacing: 0.5 }}
          />
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 46,
              height: 46,
              borderRadius: 2,
              bgcolor: '#0284c7',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
            }}>
              <AccountBalance sx={{ fontSize: 26 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight="900" sx={{ color: '#0f172a', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
                Deposit Management
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', mt: 0.3 }}>
                Record, track, and manage official bank deposits (Date of Deposit, Deposit Control Number, Amount, Name of Depositor)
              </Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={1.5} flexWrap="wrap">
            <Button
              variant="outlined"
              size="small"
              startIcon={<Refresh />}
              onClick={loadDeposits}
              disabled={loading}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, borderColor: '#cbd5e1', color: '#475569' }}
            >
              Refresh
            </Button>

            <Button
              variant="outlined"
              size="small"
              startIcon={<FileDownload />}
              onClick={handleExportExcel}
              disabled={filteredDeposits.length === 0}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, borderColor: '#0284c7', color: '#0284c7' }}
            >
              Export Excel
            </Button>

            <Button
              variant="outlined"
              size="small"
              startIcon={<Print />}
              onClick={() => setPrintSummaryOpen(true)}
              disabled={filteredDeposits.length === 0}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, borderColor: '#475569', color: '#475569' }}
            >
              Print Summary
            </Button>

            <Button
              variant="contained"
              size="small"
              startIcon={<Add />}
              onClick={handleOpenAddDialog}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 1.5,
                bgcolor: '#0284c7',
                '&:hover': { bgcolor: '#0369a1' }
              }}
            >
              Record New Deposit
            </Button>
          </Stack>
        </Box>
      </Box>

      {/* 2. Executive KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Total Cumulative */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Total Deposited
                </Typography>
                <Box sx={{ p: 0.8, borderRadius: 1, bgcolor: '#e0f2fe', color: '#0284c7' }}>
                  <AccountBalanceWallet sx={{ fontSize: 18 }} />
                </Box>
              </Box>
              <Typography variant="h6" fontWeight="900" sx={{ color: '#0f172a' }}>
                ₱ {metrics.totalDeposited.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </Typography>
              <Typography variant="caption" sx={{ color: '#0284c7', fontWeight: 600 }}>
                Cumulative total amount
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* This Month */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  This Month
                </Typography>
                <Box sx={{ p: 0.8, borderRadius: 1, bgcolor: '#f0fdf4', color: '#16a34a' }}>
                  <TrendingUp sx={{ fontSize: 18 }} />
                </Box>
              </Box>
              <Typography variant="h6" fontWeight="900" sx={{ color: '#16a34a' }}>
                ₱ {metrics.thisMonthDeposits.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                Current calendar month
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Total Count */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Total Deposits Count
                </Typography>
                <Box sx={{ p: 0.8, borderRadius: 1, bgcolor: '#f1f5f9', color: '#475569' }}>
                  <ReceiptLong sx={{ fontSize: 18 }} />
                </Box>
              </Box>
              <Typography variant="h6" fontWeight="900" sx={{ color: '#0f172a' }}>
                {metrics.totalCount}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                Recorded deposit transactions
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Latest Deposit Control Number */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Latest Control No.
                </Typography>
                <Box sx={{ p: 0.8, borderRadius: 1, bgcolor: '#f0fdf4', color: '#059669' }}>
                  <Person sx={{ fontSize: 18 }} />
                </Box>
              </Box>
              <Typography variant="h6" fontWeight="900" sx={{ color: '#0284c7', fontFamily: 'monospace' }} noWrap>
                {metrics.latestControlNo}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                Most recent transaction
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 3. Search and Date Filters Bar */}
      <Paper elevation={0} sx={{ p: 2, mb: 2.5, border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#ffffff' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by Deposit Control Number or Name of Depositor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: '#64748b', fontSize: 20 }} />
                  </InputAdornment>
                ),
                endAdornment: searchTerm ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchTerm('')}>
                      <Clear fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null
              }}
            />
          </Grid>

          <Grid size={{ xs: 6, md: 2.5 }}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="Date From"
              InputLabelProps={{ shrink: true }}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </Grid>

          <Grid size={{ xs: 6, md: 2.5 }}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="Date To"
              InputLabelProps={{ shrink: true }}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </Grid>

          {(searchTerm || dateFrom || dateTo) && (
            <Grid size={{ xs: 12, md: 1 }}>
              <Tooltip title="Reset filters" arrow>
                <Button
                  fullWidth
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setSearchTerm('');
                    setDateFrom('');
                    setDateTo('');
                  }}
                  sx={{ textTransform: 'none', color: '#64748b', borderColor: '#cbd5e1' }}
                >
                  Reset
                </Button>
              </Tooltip>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* 4. Deposits Table: Date of Deposit, Deposit Control Number, Amount, Name of Depositor */}
      <Paper elevation={0} sx={{ border: '1px solid #cbd5e1', borderRadius: 2, overflow: 'hidden', bgcolor: '#ffffff' }}>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow sx={{ '& th': { bgcolor: '#f1f5f9', fontWeight: 800, color: '#0f172a', py: 1.2 } }}>
                <TableCell align="center" sx={{ width: 60 }}>#</TableCell>
                <TableCell sx={{ width: 160 }}>Date of Deposit</TableCell>
                <TableCell sx={{ width: 220 }}>Deposit Control Number</TableCell>
                <TableCell align="right" sx={{ width: 180 }}>Amount (₱)</TableCell>
                <TableCell>Name of Depositor</TableCell>
                <TableCell align="right" sx={{ width: 120 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={32} sx={{ color: '#0284c7' }} />
                    <Typography variant="body2" sx={{ color: '#64748b', mt: 1 }}>
                      Loading deposit records...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : filteredDeposits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <AccountBalance sx={{ fontSize: 44, color: '#94a3b8', mb: 1 }} />
                    <Typography variant="body1" fontWeight="700" sx={{ color: '#334155' }}>
                      No deposits found
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
                      {deposits.length === 0
                        ? 'No deposit records have been added yet. Click below to record a new deposit.'
                        : 'No deposits matched your current search and date filters.'}
                    </Typography>
                    {deposits.length === 0 && (
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<Add />}
                        onClick={handleOpenAddDialog}
                        sx={{ bgcolor: '#0284c7', textTransform: 'none', fontWeight: 700 }}
                      >
                        Record First Deposit
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeposits
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((d, index) => {
                    const rowNumber = page * rowsPerPage + index + 1;
                    return (
                      <TableRow key={d.id} hover sx={{ '& td': { py: 1.2 } }}>
                        <TableCell align="center" sx={{ color: '#64748b', fontSize: '0.8rem' }}>
                          {rowNumber}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>
                          {d.depositDate}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={d.depositControlNumber}
                            size="small"
                            sx={{
                              bgcolor: '#f1f5f9',
                              color: '#0f172a',
                              fontFamily: 'monospace',
                              fontWeight: 800,
                              fontSize: '0.78rem',
                              border: '1px solid #cbd5e1'
                            }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 900, color: '#0284c7', fontSize: '0.92rem' }}>
                          ₱ {d.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#334155', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                          {d.depositorName}
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Tooltip title="Edit Deposit" arrow>
                              <IconButton
                                size="small"
                                onClick={() => handleOpenEditDialog(d)}
                                sx={{ bgcolor: '#f8fafc', color: '#475569', '&:hover': { bgcolor: '#f1f5f9', color: '#0284c7' } }}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            <Tooltip title="Delete Deposit" arrow>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteClick(d)}
                                sx={{ bgcolor: '#fef2f2', color: '#dc2626', '&:hover': { bgcolor: '#fee2e2' } }}
                              >
                                <DeleteOutline fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })
              )}
            </TableBody>
            {filteredDeposits.length > 0 && (
              <TableFooter>
                <TableRow sx={{ bgcolor: '#f8fafc', '& td': { fontWeight: 800, py: 1.2, color: '#0f172a' } }}>
                  <TableCell colSpan={3} align="right">
                    TOTAL FILTERED DEPOSITS ({filteredDeposits.length} Records):
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 900, fontSize: '0.98rem', color: '#0284c7' }}>
                    ₱ {filteredTotalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </TableContainer>

        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={filteredDeposits.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          sx={{ borderTop: '1px solid #e2e8f0', bgcolor: '#ffffff' }}
        />
      </Paper>

      {/* ======================================================================= */}
      {/* 5. ADD / EDIT DEPOSIT DIALOG                                            */}
      {/* ======================================================================= */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1.5, borderBottom: '1px solid #e2e8f0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AccountBalance sx={{ fontSize: 20 }} />
            </Box>
            <Typography variant="h6" fontWeight="800">
              {isEditing ? 'Edit Deposit Record' : 'Record New Deposit'}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setOpenDialog(false)}>
            <Clear fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 2.5 }}>
          <Grid container spacing={2.5}>
            {/* 1. Date of Deposit */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="Date of Deposit"
                InputLabelProps={{ shrink: true }}
                value={formData.depositDate}
                onChange={(e) => setFormData(prev => ({ ...prev, depositDate: e.target.value }))}
                required
              />
            </Grid>

            {/* 2. Deposit Control Number */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                size="small"
                label="Deposit Control Number"
                placeholder="e.g. DCN-2026-0001"
                value={formData.depositControlNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, depositControlNumber: e.target.value }))}
                required
              />
            </Grid>

            {/* 3. Amount */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Amount (₱)"
                value={formData.amount || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>
                }}
                required
              />
            </Grid>

            {/* 4. Name of Depositor */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                size="small"
                label="Name of Depositor"
                placeholder="e.g. MENARD A. HERRERA"
                value={formData.depositorName}
                onChange={(e) => setFormData(prev => ({ ...prev, depositorName: e.target.value }))}
                required
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
          <Button onClick={() => setOpenDialog(false)} sx={{ textTransform: 'none', color: '#64748b' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveDeposit}
            sx={{ bgcolor: '#0284c7', textTransform: 'none', fontWeight: 700, px: 3, '&:hover': { bgcolor: '#0369a1' } }}
          >
            {isEditing ? 'Update Deposit' : 'Save Deposit'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ======================================================================= */}
      {/* 6. PRINT SUMMARY REPORT DIALOG                                          */}
      {/* ======================================================================= */}
      <Dialog
        open={printSummaryOpen}
        onClose={() => setPrintSummaryOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1.5, borderBottom: '1px solid #e2e8f0' }}>
          <Typography variant="h6" fontWeight="800">
            Deposit Summary Report Preview
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
            <IconButton size="small" onClick={() => setPrintSummaryOpen(false)}>
              <Clear fontSize="small" />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {/* Document Header */}
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Typography sx={{ fontSize: '7.5pt', textTransform: 'uppercase', letterSpacing: 0.5, color: '#475569', fontWeight: 600 }}>
              Republic of the Philippines • Province of Romblon
            </Typography>
            <Typography sx={{ fontSize: '10.5pt', fontWeight: 900, color: '#0f172a' }}>
              MUNICIPALITY OF CONCEPCION
            </Typography>
            <Typography sx={{ fontSize: '8.5pt', fontWeight: 700, color: '#0284c7' }}>
              OFFICE OF THE MUNICIPAL TREASURER
            </Typography>
            <Typography sx={{ fontSize: '11pt', fontWeight: 900, mt: 0.5, color: '#0f172a', letterSpacing: 0.5 }}>
              SUMMARY REPORT OF DEPOSITS
            </Typography>
            <Typography sx={{ fontSize: '7.5pt', color: '#64748b', mt: 0.3 }}>
              Period: {dateFrom || 'Start'} to {dateTo || 'Present'} • Printed: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </Typography>
          </Box>

          {/* Printable Table */}
          <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #334155', borderRadius: 0 }}>
            <Table size="small" sx={{ width: '100%', borderCollapse: 'collapse' }}>
              <TableHead>
                <TableRow sx={{ '& th': { bgcolor: '#f1f5f9', fontWeight: 800, fontSize: '7.5pt', border: '0.5pt solid #334155', py: 0.6, px: 0.8, color: '#0f172a', textAlign: 'center' } }}>
                  <TableCell sx={{ width: '8%' }}>#</TableCell>
                  <TableCell sx={{ width: '22%' }}>Date of Deposit</TableCell>
                  <TableCell sx={{ width: '25%' }}>Deposit Control Number</TableCell>
                  <TableCell align="right" sx={{ width: '20%' }}>Amount (₱)</TableCell>
                  <TableCell sx={{ width: '25%' }}>Name of Depositor</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredDeposits.map((d, idx) => (
                  <TableRow key={d.id} sx={{ '& td': { py: 0.5, px: 0.8, fontSize: '7.5pt', border: '0.5pt solid #475569', color: '#000000' } }}>
                    <TableCell align="center">{idx + 1}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{d.depositDate}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{d.depositControlNumber}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {d.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell sx={{ textTransform: 'uppercase' }}>{d.depositorName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow sx={{ bgcolor: '#f8fafc', '& td': { fontWeight: 900, py: 0.6, px: 0.8, fontSize: '8pt', border: '1pt solid #000000' } }}>
                  <TableCell colSpan={3} align="right">
                    GRAND TOTAL DEPOSITS:
                  </TableCell>
                  <TableCell align="right">
                    ₱ {filteredTotalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </TableContainer>

          {/* Official Signatures */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3, pt: 1, px: 4, pageBreakInside: 'avoid' }}>
            <Box sx={{ textAlign: 'center', width: 220 }}>
              <Typography sx={{ fontSize: '7pt', color: '#475569', mb: 2.5 }}>Prepared by:</Typography>
              <Box sx={{ borderBottom: '1px solid #000000', mb: 0.3 }} />
              <Typography sx={{ fontSize: '8pt', fontWeight: 800, textTransform: 'uppercase' }}>
                {user?.name || 'COLLECTING OFFICER'}
              </Typography>
              <Typography sx={{ fontSize: '6.5pt', color: '#64748b' }}>Accountable Officer</Typography>
            </Box>
            <Box sx={{ textAlign: 'center', width: 220 }}>
              <Typography sx={{ fontSize: '7pt', color: '#475569', mb: 2.5 }}>Certified Correct:</Typography>
              <Box sx={{ borderBottom: '1px solid #000000', mb: 0.3 }} />
              <Typography sx={{ fontSize: '8pt', fontWeight: 800, textTransform: 'uppercase' }}>
                MENARD A. HERRERA
              </Typography>
              <Typography sx={{ fontSize: '6.5pt', color: '#64748b' }}>Municipal Treasurer</Typography>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete Deposit Record?"
        message={`Are you sure you want to delete deposit with Control No. "${depositToDelete?.depositControlNumber}" (₱${depositToDelete?.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })})? This action cannot be undone.`}
        confirmText="Delete Deposit"
        severity="error"
        onConfirm={handleConfirmDelete}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setDepositToDelete(null);
        }}
      />

      {/* Notification Snackbar */}
      <Notification
        open={notification.open}
        message={notification.message}
        severity={notification.severity}
        onClose={handleCloseNotification}
      />
    </Box>
  );
};
