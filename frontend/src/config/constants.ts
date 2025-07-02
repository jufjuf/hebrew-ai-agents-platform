export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
export const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:3001';

export const SUPPORTED_LANGUAGES = [
  { code: 'he', name: 'עברית', dir: 'rtl' },
  { code: 'en', name: 'English', dir: 'ltr' },
];

export const AI_MODELS = [
  { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI', maxTokens: 8192 },
  { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo', provider: 'OpenAI', maxTokens: 128000 },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI', maxTokens: 4096 },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic', maxTokens: 200000 },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic', maxTokens: 200000 },
];

export const CHANNELS = [
  { id: 'web', name: 'Web Chat', icon: 'web' },
  { id: 'whatsapp', name: 'WhatsApp', icon: 'whatsapp' },
  { id: 'telegram', name: 'Telegram', icon: 'telegram' },
  { id: 'facebook', name: 'Facebook Messenger', icon: 'facebook' },
  { id: 'slack', name: 'Slack', icon: 'slack' },
  { id: 'discord', name: 'Discord', icon: 'discord' },
  { id: 'sms', name: 'SMS', icon: 'sms' },
  { id: 'email', name: 'Email', icon: 'email' },
];

export const SKILL_TYPES = [
  { id: 'api_call', name: 'API Call', description: 'Call external APIs' },
  { id: 'database_query', name: 'Database Query', description: 'Query databases' },
  { id: 'calculation', name: 'Calculation', description: 'Perform calculations' },
  { id: 'translation', name: 'Translation', description: 'Translate text' },
  { id: 'sentiment_analysis', name: 'Sentiment Analysis', description: 'Analyze sentiment' },
  { id: 'entity_extraction', name: 'Entity Extraction', description: 'Extract entities' },
  { id: 'custom', name: 'Custom', description: 'Custom functionality' },
];

export const INTEGRATION_CATEGORIES = [
  { id: 'messaging', name: 'Messaging', icon: 'message' },
  { id: 'crm', name: 'CRM', icon: 'people' },
  { id: 'analytics', name: 'Analytics', icon: 'analytics' },
  { id: 'payment', name: 'Payment', icon: 'payment' },
  { id: 'productivity', name: 'Productivity', icon: 'work' },
  { id: 'custom', name: 'Custom', icon: 'build' },
];

export const DATE_FORMAT = 'DD/MM/YYYY';
export const TIME_FORMAT = 'HH:mm';
export const DATETIME_FORMAT = 'DD/MM/YYYY HH:mm';

export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export const FILE_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const HEBREW_REGEX = /[֐-׿]/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_REGEX = /^(\+972|0)([23489]|5[0248]|77)[1-9]\d{6}$/;