import { configureStore, createSlice } from '@reduxjs/toolkit';

const operationsSlice = createSlice({
  name: 'operations',
  initialState: { selectedHubId: null, liveConnected: false },
  reducers: {
    selectHub(state, action) { state.selectedHubId = action.payload || null; },
    setLiveConnected(state, action) { state.liveConnected = Boolean(action.payload); },
  },
});

export const { selectHub, setLiveConnected } = operationsSlice.actions;
export const store = configureStore({ reducer: { operations: operationsSlice.reducer } });
