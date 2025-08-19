import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  onSnapshot,
  Unsubscribe 
} from 'firebase/firestore';
import { db } from './config';

export interface Photo {
  id?: string;
  filename: string;
  originalName: string;
  url: string;
  thumbnailUrl?: string;
  userId: string;
  categoryId?: string;
  tags: string[];
  metadata: {
    size: number;
    type: string;
    width?: number;
    height?: number;
    dateTaken?: Date;
    location?: { lat: number; lng: number };
  };
  createdAt: any;
  updatedAt: any;
}

export interface Category {
  id?: string;
  name: string;
  color: string;
  icon?: string;
  userId: string;
  parentId?: string;
  createdAt: any;
  photoCount: number;
}

export const createPhoto = async (photoData: Omit<Photo, 'id' | 'createdAt' | 'updatedAt'>) => {
  try {
    console.log('Creating photo document with data:', photoData);
    const docRef = await addDoc(collection(db, 'photos'), {
      ...photoData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log('Photo document created successfully with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Firestore createPhoto error details:', {
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorCode: (error as any)?.code,
      photoData
    });
    
    // If it's a permission error, provide helpful guidance
    if ((error as any)?.code === 'permission-denied') {
      throw new Error('Permission denied. Please deploy Firestore rules or check authentication.');
    }
    
    throw error;
  }
};

export const updatePhoto = async (photoId: string, updates: Partial<Photo>) => {
  const photoRef = doc(db, 'photos', photoId);
  await updateDoc(photoRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
};

export const deletePhoto = async (photoId: string) => {
  await deleteDoc(doc(db, 'photos', photoId));
};

export const deleteMultiplePhotos = async (photoIds: string[]) => {
  const deletePromises = photoIds.map(photoId => 
    deleteDoc(doc(db, 'photos', photoId))
  );
  await Promise.all(deletePromises);
};

export const getUserPhotos = async (userId: string) => {
  const q = query(
    collection(db, 'photos'), 
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Photo));
};

export const createCategory = async (categoryData: Omit<Category, 'id' | 'createdAt' | 'photoCount'>) => {
  try {
    const docRef = await addDoc(collection(db, 'categories'), {
      ...categoryData,
      createdAt: serverTimestamp(),
      photoCount: 0
    });
    return docRef.id;
  } catch (error) {
    console.error('Firestore createCategory error:', error);
    throw error;
  }
};

export const updateCategory = async (categoryId: string, updates: Partial<Category>) => {
  const categoryRef = doc(db, 'categories', categoryId);
  await updateDoc(categoryRef, updates);
};

export const deleteCategory = async (categoryId: string) => {
  await deleteDoc(doc(db, 'categories', categoryId));
};

export const deleteCategoryAndPhotos = async (categoryId: string, userId: string) => {
  // First, get all photos in this category
  const photosQuery = query(
    collection(db, 'photos'),
    where('categoryId', '==', categoryId),
    where('userId', '==', userId)
  );
  const photosSnapshot = await getDocs(photosQuery);
  const photoIds = photosSnapshot.docs.map(doc => doc.id);
  
  // Delete all photos in the category
  if (photoIds.length > 0) {
    await deleteMultiplePhotos(photoIds);
  }
  
  // Delete the category itself
  await deleteCategory(categoryId);
  
  return photoIds; // Return deleted photo IDs for storage cleanup
};

export const getUserCategories = async (userId: string) => {
  const q = query(
    collection(db, 'categories'), 
    where('userId', '==', userId)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
};

// Real-time listeners
export const subscribeToUserPhotos = (userId: string, callback: (photos: Photo[]) => void): Unsubscribe => {
  const q = query(
    collection(db, 'photos'), 
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const photos = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Photo));
    callback(photos);
  });
};

export const subscribeToUserCategories = (userId: string, callback: (categories: Category[]) => void): Unsubscribe => {
  const q = query(
    collection(db, 'categories'), 
    where('userId', '==', userId)
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const categories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
    callback(categories);
  });
};