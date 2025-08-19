import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PhotoProvider, usePhoto } from './contexts/PhotoContext';
import Header from './components/Layout/Header';
import Sidebar from './components/Layout/Sidebar';
import PhotoUpload from './components/Upload/PhotoUpload';
import PhotoGrid from './components/Photos/PhotoGrid';
import SearchBar from './components/Search/SearchBar';
import Login from './components/Auth/Login';
import { subscribeToUserPhotos, subscribeToUserCategories } from './firebase/firestore';
import './styles/globals.css';

const MainApp: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { state, dispatch } = usePhoto();

  useEffect(() => {
    if (!user) return;

    dispatch({ type: 'SET_LOADING', payload: true });

    // Set up real-time listeners
    const unsubscribePhotos = subscribeToUserPhotos(user.uid, (photos) => {
      dispatch({ type: 'SET_PHOTOS', payload: photos });
      dispatch({ type: 'SET_LOADING', payload: false });
    });

    const unsubscribeCategories = subscribeToUserCategories(user.uid, (categories) => {
      dispatch({ type: 'SET_CATEGORIES', payload: categories });
    });

    // Cleanup listeners on unmount
    return () => {
      unsubscribePhotos();
      unsubscribeCategories();
    };
  }, [user, dispatch]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="app">
      <Header />
      <div className="main-layout">
        {state.isMobileMenuOpen && (
          <div 
            className="mobile-overlay"
            onClick={() => dispatch({ type: 'SET_MOBILE_MENU_OPEN', payload: false })}
          />
        )}
        <Sidebar />
        <main className="main-content">
          {state.currentView === 'edit' && (
            <>
              <div className="content-header flex items-center justify-between mb-lg">
                <SearchBar />
                <div className="header-actions">
                  <button className="btn btn-secondary btn-sm">
                    Import
                  </button>
                  <button className="btn btn-secondary btn-sm">
                    Export
                  </button>
                </div>
              </div>
              <PhotoUpload />
            </>
          )}
          
          <PhotoGrid />
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <PhotoProvider>
        <MainApp />
      </PhotoProvider>
    </AuthProvider>
  );
}

export default App;
