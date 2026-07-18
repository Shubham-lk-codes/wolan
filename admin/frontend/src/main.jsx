import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { Router } from './router/Router';
import { DemoProvider } from './state/DemoContext';
import { AuthProvider } from './state/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { store } from './state/store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><Provider store={store}><QueryClientProvider client={queryClient}><Router><AuthProvider><DemoProvider><App /></DemoProvider></AuthProvider></Router></QueryClientProvider></Provider></React.StrictMode>
);
