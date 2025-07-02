import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { conversationsService } from '../../services/conversations.service';

interface Message {
  id: string;
  conversationId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'FUNCTION';
  content: string;
  metadata?: any;
  createdAt: string;
}

interface Conversation {
  id: string;
  agentId: string;
  userId?: string;
  channel: string;
  status: string;
  metadata?: any;
  startedAt: string;
  endedAt?: string;
  agent: {
    id: string;
    name: string;
    hebrewName?: string;
  };
  _count: {
    messages: number;
  };
  lastMessage?: Message;
  duration?: number;
}

interface ConversationsState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const initialState: ConversationsState = {
  conversations: [],
  currentConversation: null,
  messages: [],
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  },
};

// Async thunks
export const fetchConversations = createAsyncThunk(
  'conversations/fetchConversations',
  async (params: any) => {
    const response = await conversationsService.getConversations(params);
    return response.data;
  }
);

export const fetchConversation = createAsyncThunk(
  'conversations/fetchConversation',
  async (id: string) => {
    const response = await conversationsService.getConversation(id);
    return response.data;
  }
);

export const startConversation = createAsyncThunk(
  'conversations/startConversation',
  async (data: { agentId: string; channel?: string; metadata?: any }) => {
    const response = await conversationsService.startConversation(data);
    return response.data;
  }
);

export const sendMessage = createAsyncThunk(
  'conversations/sendMessage',
  async ({ conversationId, content, metadata }: { 
    conversationId: string; 
    content: string; 
    metadata?: any 
  }) => {
    const response = await conversationsService.sendMessage(conversationId, content, metadata);
    return response.data;
  }
);

export const endConversation = createAsyncThunk(
  'conversations/endConversation',
  async (id: string) => {
    const response = await conversationsService.endConversation(id);
    return response.data;
  }
);

const conversationsSlice = createSlice({
  name: 'conversations',
  initialState,
  reducers: {
    clearCurrentConversation: (state) => {
      state.currentConversation = null;
      state.messages = [];
    },
    clearError: (state) => {
      state.error = null;
    },
    addMessage: (state, action) => {
      state.messages.push(action.payload);
    },
    updateConversationStatus: (state, action) => {
      const { conversationId, status } = action.payload;
      const conversation = state.conversations.find(c => c.id === conversationId);
      if (conversation) {
        conversation.status = status;
      }
      if (state.currentConversation?.id === conversationId) {
        state.currentConversation.status = status;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch conversations
      .addCase(fetchConversations.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.isLoading = false;
        state.conversations = action.payload.conversations;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch conversations';
      })
      // Fetch single conversation
      .addCase(fetchConversation.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchConversation.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentConversation = action.payload.conversation;
        state.messages = action.payload.conversation.messages || [];
      })
      .addCase(fetchConversation.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch conversation';
      })
      // Start conversation
      .addCase(startConversation.fulfilled, (state, action) => {
        state.currentConversation = action.payload.conversation;
        state.conversations.unshift(action.payload.conversation);
      })
      // Send message
      .addCase(sendMessage.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(sendMessage.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to send message';
      })
      // End conversation
      .addCase(endConversation.fulfilled, (state, action) => {
        const { conversation, metrics } = action.payload;
        const index = state.conversations.findIndex(c => c.id === conversation.id);
        if (index !== -1) {
          state.conversations[index] = { ...conversation, ...metrics };
        }
        if (state.currentConversation?.id === conversation.id) {
          state.currentConversation = { ...conversation, ...metrics };
        }
      });
  },
});

export const { 
  clearCurrentConversation, 
  clearError, 
  addMessage, 
  updateConversationStatus 
} = conversationsSlice.actions;

export default conversationsSlice.reducer;