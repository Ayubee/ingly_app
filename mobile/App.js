/**
 * INGLY MOBILE APPLICATION
 * 4000 Essential English Words - React Native (Expo)
 *
 * Markaziy navigatsiya, UserProvider va Auth/Onboarding nazorati.
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, StatusBar, ActivityIndicator } from 'react-native';
import { colors } from './src/theme.js';
import { UserProvider, useUser } from './src/context/UserContext.js';
import { initAppSettings } from './src/services/appSettingsService.js';
import AuthScreen from './src/screens/AuthScreen.js';
import HomeScreen from './src/screens/HomeScreen.js';
import LearnScreen from './src/screens/LearnScreen.js';
import FlashcardScreen from './src/screens/FlashcardScreen.js';
import QuizScreen from './src/screens/QuizScreen.js';
import ProfileScreen from './src/screens/ProfileScreen.js';
import MyWordsScreen from './src/screens/MyWordsScreen.js';
import BottomNavigation from './src/components/BottomNavigation.js';

function MainAppContent() {
  const { user, isLoading } = useUser();
  const [currentTab, setCurrentTab] = useState('Home');

  useEffect(() => {
    initAppSettings();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
      </View>
    );
  }

  // Agar yangi foydalanuvchi bo'lsa yoki kirmagan bo'lsa -> Auth/Onboarding ekrani
  if (!user.isLoggedIn) {
    return <AuthScreen />;
  }

  const renderScreen = () => {
    switch (currentTab) {
      case 'Home':
        return <HomeScreen onNavigate={setCurrentTab} />;
      case 'Learn':
        return <LearnScreen onNavigate={setCurrentTab} />;
      case 'MyWords':
        return <MyWordsScreen onNavigate={setCurrentTab} />;
      case 'Flashcards':
        return <FlashcardScreen onNavigate={setCurrentTab} />;
      case 'Quiz':
        return <QuizScreen onNavigate={setCurrentTab} />;
      case 'Profile':
        return <ProfileScreen onNavigate={setCurrentTab} />;
      default:
        return <HomeScreen onNavigate={setCurrentTab} />;
    }
  };

  return (
    <View style={styles.appContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      {/* Active Screen View */}
      <View style={styles.screenContainer}>{renderScreen()}</View>

      {/* Persistent Bottom Tab Navigation Bar */}
      <BottomNavigation
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
      />
    </View>
  );
}

export default function App() {
  return (
    <UserProvider>
      <MainAppContent />
    </UserProvider>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  screenContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
