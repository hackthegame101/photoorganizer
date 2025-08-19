import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { Photo, Category } from '../firebase/firestore';

interface PhotoState {
  photos: Photo[];
  categories: Category[];
  selectedPhotos: string[];
  currentView: 'edit' | 'preview' | 'premium';
  searchQuery: string;
  selectedCategory: string | null;
  theme: 'light' | 'dark';
  loading: boolean;
  isMobileMenuOpen: boolean;
}

type PhotoAction =
  | { type: 'SET_PHOTOS'; payload: Photo[] }
  | { type: 'ADD_PHOTO'; payload: Photo }
  | { type: 'UPDATE_PHOTO'; payload: { id: string; updates: Partial<Photo> } }
  | { type: 'DELETE_PHOTO'; payload: string }
  | { type: 'SET_CATEGORIES'; payload: Category[] }
  | { type: 'ADD_CATEGORY'; payload: Category }
  | { type: 'UPDATE_CATEGORY'; payload: { id: string; updates: Partial<Category> } }
  | { type: 'DELETE_CATEGORY'; payload: string }
  | { type: 'SET_SELECTED_PHOTOS'; payload: string[] }
  | { type: 'TOGGLE_PHOTO_SELECTION'; payload: string }
  | { type: 'SET_VIEW'; payload: 'edit' | 'preview' | 'premium' }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SELECTED_CATEGORY'; payload: string | null }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_MOBILE_MENU_OPEN'; payload: boolean };

const initialState: PhotoState = {
  photos: [],
  categories: [],
  selectedPhotos: [],
  currentView: 'preview',
  searchQuery: '',
  selectedCategory: null,
  theme: 'dark',
  loading: false,
  isMobileMenuOpen: false,
};

const photoReducer = (state: PhotoState, action: PhotoAction): PhotoState => {
  switch (action.type) {
    case 'SET_PHOTOS':
      return { ...state, photos: action.payload };
    case 'ADD_PHOTO':
      return { ...state, photos: [action.payload, ...state.photos] };
    case 'UPDATE_PHOTO':
      return {
        ...state,
        photos: state.photos.map(photo =>
          photo.id === action.payload.id
            ? { ...photo, ...action.payload.updates }
            : photo
        ),
      };
    case 'DELETE_PHOTO':
      return {
        ...state,
        photos: state.photos.filter(photo => photo.id !== action.payload),
        selectedPhotos: state.selectedPhotos.filter(id => id !== action.payload),
      };
    case 'SET_CATEGORIES':
      return { ...state, categories: action.payload };
    case 'ADD_CATEGORY':
      return { ...state, categories: [...state.categories, action.payload] };
    case 'UPDATE_CATEGORY':
      return {
        ...state,
        categories: state.categories.map(category =>
          category.id === action.payload.id
            ? { ...category, ...action.payload.updates }
            : category
        ),
      };
    case 'DELETE_CATEGORY':
      return {
        ...state,
        categories: state.categories.filter(category => category.id !== action.payload),
      };
    case 'SET_SELECTED_PHOTOS':
      return { ...state, selectedPhotos: action.payload };
    case 'TOGGLE_PHOTO_SELECTION':
      return {
        ...state,
        selectedPhotos: state.selectedPhotos.includes(action.payload)
          ? state.selectedPhotos.filter(id => id !== action.payload)
          : [...state.selectedPhotos, action.payload],
      };
    case 'SET_VIEW':
      return { ...state, currentView: action.payload };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };
    case 'SET_SELECTED_CATEGORY':
      return { ...state, selectedCategory: action.payload };
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_MOBILE_MENU_OPEN':
      return { ...state, isMobileMenuOpen: action.payload };
    default:
      return state;
  }
};

interface PhotoContextType {
  state: PhotoState;
  dispatch: React.Dispatch<PhotoAction>;
}

const PhotoContext = createContext<PhotoContextType | undefined>(undefined);

export const usePhoto = () => {
  const context = useContext(PhotoContext);
  if (!context) {
    throw new Error('usePhoto must be used within a PhotoProvider');
  }
  return context;
};

export const PhotoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(photoReducer, initialState);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      dispatch({ type: 'SET_THEME', payload: savedTheme });
    } else {
      // Default to dark theme
      dispatch({ type: 'SET_THEME', payload: 'dark' });
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', state.theme);
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  return (
    <PhotoContext.Provider value={{ state, dispatch }}>
      {children}
    </PhotoContext.Provider>
  );
};