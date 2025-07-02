import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { agentsService } from '../../services/agents.service';

interface Agent {
  id: string;
  name: string;
  hebrewName?: string;
  description?: string;
  prompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  language: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    conversations: number;
    knowledgeBases: number;
    skills: number;
  };
}

interface AgentsState {
  agents: Agent[];
  currentAgent: Agent | null;
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const initialState: AgentsState = {
  agents: [],
  currentAgent: null,
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
export const fetchAgents = createAsyncThunk(
  'agents/fetchAgents',
  async (params: any) => {
    const response = await agentsService.getAgents(params);
    return response.data;
  }
);

export const fetchAgent = createAsyncThunk(
  'agents/fetchAgent',
  async (id: string) => {
    const response = await agentsService.getAgent(id);
    return response.data;
  }
);

export const createAgent = createAsyncThunk(
  'agents/createAgent',
  async (agentData: any) => {
    const response = await agentsService.createAgent(agentData);
    return response.data;
  }
);

export const updateAgent = createAsyncThunk(
  'agents/updateAgent',
  async ({ id, data }: { id: string; data: any }) => {
    const response = await agentsService.updateAgent(id, data);
    return response.data;
  }
);

export const deleteAgent = createAsyncThunk(
  'agents/deleteAgent',
  async (id: string) => {
    await agentsService.deleteAgent(id);
    return id;
  }
);

const agentsSlice = createSlice({
  name: 'agents',
  initialState,
  reducers: {
    clearCurrentAgent: (state) => {
      state.currentAgent = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch agents
      .addCase(fetchAgents.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAgents.fulfilled, (state, action) => {
        state.isLoading = false;
        state.agents = action.payload.agents;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchAgents.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch agents';
      })
      // Fetch single agent
      .addCase(fetchAgent.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAgent.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentAgent = action.payload.agent;
      })
      .addCase(fetchAgent.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch agent';
      })
      // Create agent
      .addCase(createAgent.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createAgent.fulfilled, (state, action) => {
        state.isLoading = false;
        state.agents.unshift(action.payload.agent);
      })
      .addCase(createAgent.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to create agent';
      })
      // Update agent
      .addCase(updateAgent.fulfilled, (state, action) => {
        const index = state.agents.findIndex(a => a.id === action.payload.agent.id);
        if (index !== -1) {
          state.agents[index] = action.payload.agent;
        }
        if (state.currentAgent?.id === action.payload.agent.id) {
          state.currentAgent = action.payload.agent;
        }
      })
      // Delete agent
      .addCase(deleteAgent.fulfilled, (state, action) => {
        state.agents = state.agents.filter(a => a.id !== action.payload);
        if (state.currentAgent?.id === action.payload) {
          state.currentAgent = null;
        }
      });
  },
});

export const { clearCurrentAgent, clearError } = agentsSlice.actions;
export default agentsSlice.reducer;