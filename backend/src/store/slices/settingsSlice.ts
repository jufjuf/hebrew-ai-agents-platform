import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SettingsState {
  language: string;
  theme: 'light' | 'dark';
  notifications: {
    email: boolean;
    push: boolean;
    sound: boolean;
  };
  display: {
    compactMode: boolean;
    showAvatars: boolean;
    animationsEnabled: boolean;
  };
}

const initialState: SettingsState = {
  language: 'he',
  theme: 'light',
  notifications: {
    email: true,
    push: true,
    sound: true,
  },
  display: {
    compactMode: false,
    showAvatars: true,
    animationsEnabled: true,
  },
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setLanguage: (state, action: PayloadAction<string>) => {
      state.language = action.payload;
      localStorage.setItem('language', action.payload);
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
      localStorage.setItem('theme', action.payload);
    },
    updateNotificationSettings: (state, action: PayloadAction<Partial<SettingsState['notifications']>>) => {
      state.notifications = { ...state.notifications, ...action.payload };
      localStorage.setItem('notifications', JSON.stringify(state.notifications));
    },
    updateDisplaySettings: (state, action: PayloadAction<Partial<SettingsState['display']>>) => {
      state.display = { ...state.display, ...action.payload };
      localStorage.setItem('display', JSON.stringify(state.display));
    },
    loadSettings: (state) => {
      // Load from localStorage
      const language = localStorage.getItem('language');
      const theme = localStorage.getItem('theme') as 'light' | 'dark';
      const notifications = localStorage.getItem('notifications');
      const display = localStorage.getItem('display');

      if (language) state.language = language;
      if (theme) state.theme = theme;
      if (notifications) state.notifications = JSON.parse(notifications);
      if (display) state.display = JSON.parse(display);
    },
  },
});

export const {
  setLanguage,
  setTheme,
  updateNotificationSettings,
  updateDisplaySettings,
  loadSettings,
} = settingsSlice.actions;

export default settingsSlice.reducer;