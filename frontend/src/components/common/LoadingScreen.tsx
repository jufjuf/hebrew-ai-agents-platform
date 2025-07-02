import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

const LoadingScreen: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'background.default',
      }}
    >
      <CircularProgress size={60} thickness={4} />
      <Typography
        variant="h6"
        sx={{ mt: 3, color: 'text.secondary' }}
      >
        {t('common.loading')}
      </Typography>
    </Box>
  );
};

export default LoadingScreen;