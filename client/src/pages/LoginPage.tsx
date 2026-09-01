import React, { useState } from 'react';
import { 
  Box, 
  TextField, 
  Typography, 
  Paper, 
  Grid, 
  InputAdornment, 
  CircularProgress,
  Alert,
  IconButton, 
  Tooltip,
  Button,
  Dialog,
  DialogContent,
  Chip,
  Stack,
  Divider
} from '@mui/material';
import { 
  Lock, 
  Email, 
  AccountBalance,
  ArrowForward,
  Security,
  AdminPanelSettings,
  ArrowBack,
  MarkEmailRead,
  GppBadRounded,
  Business,
  ReportProblemRounded
} from '@mui/icons-material';
import { useAuth } from '../context/useAuth';
import { useNavigate } from 'react-router-dom';

export const LoginPage: React.FC = () => {
  // Mode state: 'signin' | 'forgot'
  const [isResetMode, setIsResetMode] = useState(false);

  // Sign In state
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Reset Password state
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  
  // UI status
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Department Restriction Alert Modal State
  const [restrictedModalOpen, setRestrictedModalOpen] = useState<boolean>(false);
  const [restrictedDept, setRestrictedDept] = useState<string>('');
  const [restrictedName, setRestrictedName] = useState<string>('');
  
  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn(signInEmail, signInPassword);
      if (result.success) {
        navigate('/dashboard');
      } else {
        if (result.isDepartmentRestricted) {
          const deptName = result.userDepartment || 'Unauthorized Department';
          const userName = result.userName || signInEmail;
          setRestrictedDept(deptName);
          setRestrictedName(userName);
          setRestrictedModalOpen(true);
          setError(`Access Denied: Only personnel from the Municipal Treasurer Office are permitted to sign in. Your account belongs to: "${deptName}".`);
        } else {
          setError(result.error || 'Invalid email or password');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during sign in');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResetSuccess(null);

    try {
      const result = await resetPassword(resetEmail.trim());
      if (result.success) {
        setResetSuccess(result.message || 'Password reset link has been dispatched to your email address.');
      } else {
        setError(result.error || 'Failed to send password reset link. Please verify your email address.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while requesting password reset.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        bgcolor: '#f8fafc',
        backgroundImage: 'radial-gradient(at 0% 0%, #e0f2fe 0, transparent 50%), radial-gradient(at 100% 100%, #f0f9ff 0, transparent 50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 2, sm: 3, md: 4 }
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: 920,
          width: '100%',
          borderRadius: 1.5,
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          bgcolor: '#ffffff'
        }}
      >
        <Grid container>
          {/* Left Hero Side */}
          <Grid
            size={{ xs: 12, md: 5 }}
            sx={{
              bgcolor: '#f0f9ff',
              p: { xs: 4, sm: 5 },
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              borderRight: { md: '1px solid #e2e8f0' },
              position: 'relative'
            }}
          >
            <Box>
              <Box sx={{ 
                width: 48, 
                height: 48, 
                bgcolor: '#0284c7', 
                color: '#ffffff', 
                borderRadius: 1, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                mb: 3
              }}>
                <AccountBalance sx={{ fontSize: 28 }} />
              </Box>
              <Typography variant="h4" fontWeight="800" sx={{ color: '#0f172a', letterSpacing: -0.5, mb: 1 }}>
                RCD System
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', mb: 4, lineHeight: 1.6 }}>
                Report of Collections and Deposits System for LGU Concepcion, Romblon.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, bgcolor: '#ffffff', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                <Security sx={{ color: '#0284c7' }} />
                <Box>
                  <Typography variant="subtitle2" fontWeight="700" sx={{ color: '#0f172a' }}>
                    Role-Based Access
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    Isolated collector data & admin central monitoring.
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, bgcolor: '#ffffff', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                <AdminPanelSettings sx={{ color: '#0284c7' }} />
                <Box>
                  <Typography variant="subtitle2" fontWeight="700" sx={{ color: '#0f172a' }}>
                    Managed Accounts
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    User profiles and access are issued by System Administrators.
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Typography variant="caption" sx={{ color: '#94a3b8', mt: 4 }}>
              © 2026 Municipality of Concepcion. All rights reserved.
            </Typography>
          </Grid>

          {/* Right Form Side */}
          <Grid size={{ xs: 12, md: 7 }} sx={{ p: { xs: 4, sm: 6 }, display: 'flex', alignItems: 'center' }}>
            <Box sx={{ maxWidth: 420, width: '100%', mx: 'auto' }}>
              {isResetMode ? (
                /* FORGOT / RESET PASSWORD FORM */
                <>
                  <Box sx={{ mb: 3.5 }}>
                    <Typography variant="h5" fontWeight="800" sx={{ color: '#0f172a' }}>
                      Reset Password
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
                      Enter your account email to receive an activation link to set or reset your password.
                    </Typography>
                  </Box>

                  {/* Feedback Alerts */}
                  {error && (
                    <Alert severity="error" sx={{ mb: 3, borderRadius: 1, border: '1px solid #fee2e2' }}>
                      {error}
                    </Alert>
                  )}
                  {resetSuccess && (
                    <Alert 
                      severity="success" 
                      icon={<MarkEmailRead fontSize="inherit" />}
                      sx={{ mb: 3, borderRadius: 1, border: '1px solid #bbf7d0', bgcolor: '#f0fdf4' }}
                    >
                      {resetSuccess}
                    </Alert>
                  )}

                  <Box component="form" onSubmit={handleResetPassword}>
                    <TextField
                      margin="normal"
                      required
                      fullWidth
                      id="reset-email"
                      label="Registered Email Address"
                      name="reset-email"
                      autoComplete="email"
                      autoFocus
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="e.g. collector@rcd.gov.ph"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Email color="action" fontSize="small" />
                          </InputAdornment>
                        ),
                      }}
                    />

                    <Box sx={{ mt: 3.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Button
                        startIcon={<ArrowBack />}
                        onClick={() => {
                          setIsResetMode(false);
                          setError(null);
                          setResetSuccess(null);
                        }}
                        sx={{ textTransform: 'none', color: '#64748b', fontWeight: 600 }}
                      >
                        Back to Sign In
                      </Button>

                      <Tooltip title="Send Password Reset Link" arrow>
                        <IconButton
                          type="submit"
                          color="primary"
                          disabled={isLoading}
                          sx={{
                            width: 44,
                            height: 44,
                            bgcolor: '#0284c7',
                            color: '#ffffff',
                            borderRadius: 1,
                            '&:hover': {
                              bgcolor: '#0369a1',
                              color: '#ffffff'
                            }
                          }}
                        >
                          {isLoading ? <CircularProgress size={20} color="inherit" /> : <ArrowForward />}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </>
              ) : (
                /* SIGN IN FORM */
                <>
                  <Box sx={{ mb: 3.5 }}>
                    <Typography variant="h5" fontWeight="800" sx={{ color: '#0f172a' }}>
                      Sign In
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
                      Enter your authorized municipal credentials to access your account.
                    </Typography>
                  </Box>

                  {/* Feedback Alert */}
                  {error && (
                    <Alert severity="error" sx={{ mb: 3, borderRadius: 1, border: '1px solid #fee2e2' }}>
                      {error}
                    </Alert>
                  )}

                  <Box component="form" onSubmit={handleSignIn}>
                    <TextField
                      margin="normal"
                      required
                      fullWidth
                      id="email"
                      label="Email Address"
                      name="email"
                      autoComplete="email"
                      autoFocus
                      value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Email color="action" fontSize="small" />
                          </InputAdornment>
                        ),
                      }}
                    />
                    <TextField
                      margin="normal"
                      required
                      fullWidth
                      name="password"
                      label="Password"
                      type="password"
                      id="password"
                      autoComplete="current-password"
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Lock color="action" fontSize="small" />
                          </InputAdornment>
                        ),
                      }}
                    />

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                      <Button
                        variant="text"
                        size="small"
                        onClick={() => {
                          setIsResetMode(true);
                          setResetEmail(signInEmail);
                          setError(null);
                        }}
                        sx={{
                          textTransform: 'none',
                          color: '#0284c7',
                          fontWeight: 600,
                          fontSize: '0.82rem',
                          p: 0,
                          minWidth: 'auto',
                          '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' }
                        }}
                      >
                        Forgot password?
                      </Button>
                    </Box>

                    <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Sign In
                      </Typography>
                      <Tooltip title="Sign In to Account" arrow>
                        <IconButton
                          type="submit"
                          color="primary"
                          disabled={isLoading}
                          sx={{
                            width: 44,
                            height: 44,
                            bgcolor: '#0284c7',
                            color: '#ffffff',
                            borderRadius: 1,
                            '&:hover': {
                              bgcolor: '#0369a1',
                              color: '#ffffff'
                            }
                          }}
                        >
                          {isLoading ? <CircularProgress size={20} color="inherit" /> : <ArrowForward />}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </>
              )}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Big Center-Screen Alert Modal for Restricted Departments */}
      <Dialog
        open={restrictedModalOpen}
        onClose={() => setRestrictedModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            border: '2px solid #ef4444',
            boxShadow: '0 25px 50px -12px rgba(220, 38, 38, 0.45)',
            overflow: 'hidden',
            p: 0,
            animation: 'fadeIn 0.25s ease-out'
          }
        }}
        slotProps={{
          backdrop: {
            sx: {
              bgcolor: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(6px)'
            }
          }
        }}
      >
        <Box sx={{ bgcolor: '#dc2626', py: 2, px: 3, display: 'flex', alignItems: 'center', gap: 1.5, color: '#ffffff' }}>
          <ReportProblemRounded sx={{ fontSize: 28, color: '#fee2e2' }} />
          <Typography variant="h6" fontWeight="900" sx={{ letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            Access Restricted: Unauthorized Department
          </Typography>
        </Box>

        <DialogContent sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center' }}>
          {/* Centered Graphic Emblem */}
          <Box
            sx={{
              width: 86,
              height: 86,
              borderRadius: '50%',
              bgcolor: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2.5,
              border: '4px solid #fecaca',
              boxShadow: '0 0 28px rgba(239, 68, 68, 0.3)'
            }}
          >
            <GppBadRounded sx={{ fontSize: 56 }} />
          </Box>

          <Typography variant="h5" fontWeight="900" sx={{ color: '#0f172a', mb: 1, letterSpacing: '-0.5px' }}>
            Municipal Treasurer Office Only
          </Typography>

          <Typography variant="body1" sx={{ color: '#475569', mb: 3, fontSize: '0.96rem', lineHeight: 1.6 }}>
            Signing in is strictly restricted to authorized staff of the <strong>Municipal Treasurer Office</strong>.
            Users registered under other municipal departments are not permitted to access this portal.
          </Typography>

          {/* Account Details Box */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              mb: 3,
              bgcolor: '#fff1f2',
              border: '1px solid #fecdd3',
              borderRadius: 2,
              textAlign: 'left'
            }}
          >
            <Stack spacing={1.5}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="caption" sx={{ color: '#881337', fontWeight: 700, textTransform: 'uppercase' }}>
                  Attempted Account
                </Typography>
                <Typography variant="body2" fontWeight="700" sx={{ color: '#0f172a' }}>
                  {restrictedName || signInEmail}
                </Typography>
              </Box>

              <Divider sx={{ borderColor: '#fecdd3' }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Business sx={{ fontSize: 18, color: '#e11d48' }} />
                  <Typography variant="caption" sx={{ color: '#881337', fontWeight: 700, textTransform: 'uppercase' }}>
                    Detected Department
                  </Typography>
                </Box>
                <Chip
                  label={restrictedDept || 'Other Department'}
                  size="small"
                  sx={{
                    bgcolor: '#fee2e2',
                    color: '#991b1b',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    border: '1px solid #f87171'
                  }}
                />
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AccountBalance sx={{ fontSize: 18, color: '#0284c7' }} />
                  <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 700, textTransform: 'uppercase' }}>
                    Authorized Department
                  </Typography>
                </Box>
                <Chip
                  label="Municipal Treasurer Office"
                  size="small"
                  sx={{
                    bgcolor: '#e0f2fe',
                    color: '#0369a1',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    border: '1px solid #7dd3fc'
                  }}
                />
              </Box>
            </Stack>
          </Paper>

          <Typography variant="caption" sx={{ display: 'block', color: '#64748b', mb: 3, fontStyle: 'italic' }}>
            If you have been reassigned or believe this is an error, please contact your Municipal Treasurer or System Administrator to update your department record.
          </Typography>

          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={() => setRestrictedModalOpen(false)}
            sx={{
              py: 1.5,
              bgcolor: '#dc2626',
              fontWeight: 800,
              fontSize: '0.98rem',
              borderRadius: 1.5,
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
              '&:hover': { bgcolor: '#b91c1c' }
            }}
          >
            Understood — Return to Login
          </Button>
        </DialogContent>
      </Dialog>
    </Box>
  );
};
