import React, { useState } from 'react';
import Layout from './components/layout/Layout';
import DashboardPage from './pages/DashboardPage';
import FinancePage from './pages/FinancePage';
import WordsPage from './pages/WordsPage';
import UsersPage from './pages/UsersPage';
import MonetizationPage from './pages/MonetizationPage';
import AdminsPage from './pages/AdminsPage';
import NotificationsPage from './pages/NotificationsPage';

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardPage setCurrentTab={setCurrentTab} />;
      case 'words':
        return <WordsPage />;
      case 'finances':
        return <FinancePage />;
      case 'users':
        return <UsersPage />;
      case 'monetization':
        return <MonetizationPage />;
      case 'admins':
        return <AdminsPage />;
      case 'notifications':
        return <NotificationsPage />;
      default:
        return <DashboardPage setCurrentTab={setCurrentTab} />;
    }
  };

  return (
    <Layout currentTab={currentTab} setCurrentTab={setCurrentTab}>
      {renderContent()}
    </Layout>
  );
}
