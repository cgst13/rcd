import React from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Chip,
  Container
} from '@mui/material';
import { 
  AdminPanelSettings,
  AssessmentOutlined,
  ConstructionOutlined
} from '@mui/icons-material';

export const AdminReportsPage: React.FC = () => {
  return (
    <Container maxWidth="xl" disableGutters>
      {/* Page Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Typography variant="h5" fontWeight="800" sx={{ color: '#0f172a', letterSpacing: '-0.5px' }}>
              Admin Reports
            </Typography>
            <Chip 
              icon={<AdminPanelSettings sx={{ fontSize: '15px !important' }} />}
              label="Admin Only" 
              size="small" 
              sx={{ bgcolor: '#e0f2fe', color: '#0284c7', fontWeight: 700, fontSize: '0.75rem', border: '1px solid #bae6fd' }} 
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            Consolidated Treasury reports, executive collection analytics, and administrative auditing.
          </Typography>
        </Box>
      </Box>

      {/* Blank / Placeholder Workspace */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: { xs: 4, sm: 6 }, 
          borderRadius: 2, 
          border: '1px dashed #cbd5e1', 
          bgcolor: '#ffffff',
          minHeight: 380,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center'
        }}
      >
        <Box 
          sx={{ 
            width: 64, 
            height: 64, 
            borderRadius: 2, 
            bgcolor: '#f0f9ff', 
            color: '#0284c7', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            mb: 2,
            border: '1px solid #bae6fd'
          }}
        >
          <AssessmentOutlined sx={{ fontSize: 36 }} />
        </Box>
        <Typography variant="h6" fontWeight="800" sx={{ color: '#0f172a', mb: 1 }}>
          Admin Reports Workspace
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460, mb: 2.5 }}>
          This dedicated administrative report view is configured and accessible exclusively to administrators.
        </Typography>
        <Chip 
          icon={<ConstructionOutlined sx={{ fontSize: '15px !important' }} />}
          label="Ready for Report Modules" 
          size="small" 
          sx={{ bgcolor: '#f8fafc', color: '#64748b', fontWeight: 600, border: '1px solid #e2e8f0' }} 
        />
      </Paper>
    </Container>
  );
};
