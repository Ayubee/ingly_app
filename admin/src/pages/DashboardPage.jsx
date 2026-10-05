import React from 'react';
import { Dashboard } from '../components/RealDataPanels';

export default function DashboardPage({ setCurrentTab }) {
  return <Dashboard onNavigate={setCurrentTab} />;
}
