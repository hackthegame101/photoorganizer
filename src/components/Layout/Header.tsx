import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePhoto } from '../../contexts/PhotoContext';
import { signOutUser } from '../../firebase/auth';

const Header: React.FC = () => {
  const { user } = useAuth();
  const { state, dispatch } = usePhoto();

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const toggleTheme = () => {
    dispatch({ 
      type: 'SET_THEME', 
      payload: state.theme === 'light' ? 'dark' : 'light' 
    });
  };

  const setView = (view: 'edit' | 'preview' | 'premium') => {
    dispatch({ type: 'SET_VIEW', payload: view });
  };

  return (
    <header className="header">
      <div className="container">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-lg">
            <button
              className="mobile-menu-toggle btn btn-secondary btn-sm"
              onClick={() => dispatch({ type: 'SET_MOBILE_MENU_OPEN', payload: !state.isMobileMenuOpen })}
              aria-label="Toggle sidebar"
            >
              ☰
            </button>
            <h1 className="text-xl font-bold">Photo Organizer</h1>
            
            <nav className="desktop-nav flex gap-md">
              <button
                className={`btn ${state.currentView === 'edit' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setView('edit')}
              >
                Edit
              </button>
              <button
                className={`btn ${state.currentView === 'preview' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setView('preview')}
              >
                Preview
              </button>
              <button
                className={`btn premium-btn ${state.currentView === 'premium' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setView('premium')}
              >
                Premium
              </button>
            </nav>

            {/* Mobile Navigation */}
            <nav className="mobile-nav flex gap-sm">
              <button
                className={`btn btn-sm ${state.currentView === 'edit' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setView('edit')}
              >
                ✏️
              </button>
              <button
                className={`btn btn-sm ${state.currentView === 'preview' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setView('preview')}
              >
                👁️
              </button>
              <button
                className={`btn btn-sm mobile-premium-btn ${state.currentView === 'premium' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setView('premium')}
              >
                ✨
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-md">
            <button
              className="btn btn-secondary"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {state.theme === 'light' ? '🌙' : '☀️'}
            </button>
            
            {user && (
              <div className="flex items-center gap-sm">
                <span className="text-sm user-email">{user.email}</span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleSignOut}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;