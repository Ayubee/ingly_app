import React from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function Layout({ currentTab, setCurrentTab, children }) {
  return (
    <div className="min-h-screen bg-inglyBg flex">
      {/* Sidebar */}
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      {/* Main Container */}
      <div className="flex-1 ml-64 flex flex-col min-w-0">
        {/* Navbar */}
        <Navbar currentTab={currentTab} />

        {/* Content Area */}
        <main className="flex-1 mt-18 p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
