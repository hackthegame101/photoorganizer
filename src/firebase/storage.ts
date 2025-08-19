import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { storage } from './config';

export const uploadPhoto = async (file: File, userId: string, photoId: string): Promise<string> => {
  const photoRef = ref(storage, `photos/${userId}/${photoId}`);
  const snapshot = await uploadBytes(photoRef, file);
  return await getDownloadURL(snapshot.ref);
};

export const deletePhoto = async (userId: string, photoId: string): Promise<void> => {
  const photoRef = ref(storage, `photos/${userId}/${photoId}`);
  await deleteObject(photoRef);
};

export const listUserPhotos = async (userId: string) => {
  const photosRef = ref(storage, `photos/${userId}`);
  return await listAll(photosRef);
};