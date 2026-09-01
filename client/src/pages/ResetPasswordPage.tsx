import React, { useState, useEffect } from 'react';
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
  Button
} from '@mui/material';
import {
  Lock,
  Visibility,
  VisibilityOff,
  AccountBalance,
  CheckCircle,
  Security,
  Key,
  ArrowForward
} from '@mui/icons-material';
import { useAuth } from '../context/useAuth';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { isSupabaseConfigured } from '../services/supabaseClient';

export const ResetPasswordPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if recovery token is present or user is in recovery session
    if (isSupabaseConfigured()) {
      const hash = window.location.hash;
      if (hash && hash.includes('type=recovery')) {
        console.log('Password recovery mode detected');
      }
    }
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError('Please enter a new password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await updatePassword(password);
      if (result.success) {
        setIsSuccess(true);
      } else {
        setError(result.error || 'Failed to update password. Please log in or contact your system administrator.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
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
          maxWidth: 860,
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
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  bgcolor: '#0284c7',
                  color: '#ffffff',
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 3
                }}
              >
                <AccountBalance sx={{ fontSize: 28 }} />
              </Box>
              <Typography variant="h5" fontWeight="800" sx={{ color: '#0f172a', letterSpacing: -0.5, mb: 1 }}>
                Set Password
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', mb: 4, lineHeight: 1.6 }}>
                Secure your official account for the Municipality of Concepcion RCD System.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, bgcolor: '#ffffff', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                <Key sx={{ color: '#0284c7' }} />
                <Box>
                  <Typography variant="subtitle2" fontWeight="700" sx={{ color: '#0f172a' }}>
                    Personal Password
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    Choose a strong password with at least 6 characters.
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, bgcolor: '#ffffff', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                <Security sx={{ color: '#0284c7' }} />
                <Box>
                  <Typography variant="subtitle2" fontWeight="700" sx={{ color: '#0f172a' }}>
                    Account Security
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    Never share your password with anyone else.
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
              {isSuccess ? (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      bgcolor: '#dcfce7',
                      color: '#16a34a',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2.5
                    }}
                  >
                    <CheckCircle sx={{ fontSize: 36 }} />
                  </Box>
                  <Typography variant="h5" fontWeight="800" sx={{ color: '#0f172a', mb: 1 }}>
                    Password Set Successfully!
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 4, lineHeight: 1.6 }}>
                    Your password has been updated and your account is now ready for use.
                  </Typography>
                  <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    onClick={() => navigate('/dashboard')}
                    sx={{
                      py: 1.2,
                      bgcolor: '#0284c7',
                      fontWeight: 700,
                      borderRadius: 1,
                      textTransform: 'none',
                      boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
                      '&:hover': { bgcolor: '#0369a1' }
                    }}
                  >
                    Proceed to Dashboard
                  </Button>
                </Box>
              ) : (
                <>
                  <Box sx={{ mb: 3.5 }}>
                    <Typography variant="h5" fontWeight="800" sx={{ color: '#0f172a' }}>
                      Create Your Password
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
                      Enter and confirm your new personal account password below.
                    </Typography>
                  </Box>

                  {/* Feedback Alert */}
                  {error && (
                    <Alert severity="error" sx={{ mb: 3, borderRadius: 1, border: '1px solid #fee2e2' }}>
                      {error}
                    </Alert>
                  )}

                  <Box component="form" onSubmit={handleUpdatePassword}>
                    <TextField
                      margin="normal"
                      required
                      fullWidth
                      name="password"
                      label="New Password"
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      autoComplete="new-password"
                      autoFocus
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <Lock color="action" fontSize="small" />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                size="small"
                                onClick={() => setShowPassword(!showPassword)}
                                edge="end"
                              >
                                {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                              </IconButton>
                            </InputAdornment>
                          )
                        }
                      }}
                    />

                    <TextField
                      margin="normal"
                      required
                      fullWidth
                      name="confirmPassword"
                      label="Confirm New Password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your password"
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <Lock color="action" fontSize="small" />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                size="small"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                edge="end"
                              >
                                {showConfirmPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                              </IconButton>
                            </InputAdornment>
                          )
                        }
                      }}
                    />

                    <Box sx={{ mt: 3.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <RouterLink
                        to="/login"
                        style={{
                          textDecoration: 'none',
                          color: '#64748b',
                          fontSize: '0.875rem',
                          fontWeight: 600
                        }}
                      >
                        Back to Sign In
                      </RouterLink>

                      <Tooltip title="Save New Password" arrow>
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
    </Box>
  );
};
