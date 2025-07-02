import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import agentsReducer from './slices/agentsSlice';
import conversationsReducer from './slices/conversationsSlice';
import settingsReducer from './slices/settingsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    agents: agentsReducer,
    conversations: conversationsReducer,
    settings: settingsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['auth/login/fulfilled', 'auth/logout'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;