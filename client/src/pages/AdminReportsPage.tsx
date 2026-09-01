import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { Assessment } from '@mui/icons-material';

export const AdminReportsPage: React.FC = () => {
  return (
    <Box sx={{ width: '100%', pb: 4 }}>
      {/* Top Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight="800" sx={{ color: '#0f172a' }}>
          Reports Overview
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
          Consolidated Administrative Reports & Analytics
        </Typography>
      </Box>

      {/* Blank Workspace Card for Future Admin Reports */}
      <Paper
        elevation={0}
        sx={{
          minHeight: '60vh',
          borderRadius: 2,
          border: '1px dashed #cbd5e1',
          bgcolor: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 4
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            bgcolor: '#e0f2fe',
            color: '#0284c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2
          }}
        >
          <Assessment sx={{ fontSize: 32 }} />
        </Box>
        <Typography variant="h6" fontWeight="700" sx={{ color: '#334155', mb: 1 }}>
          Administrator Reports
        </Typography>
        <Typography variant="body2" sx={{ color: '#94a3b8', maxWidth: 420, textAlign: 'center' }}>
          This page is reserved for administrator reports and executive summaries.
        </Typography>
      </Paper>
    </Box>
  );
};
