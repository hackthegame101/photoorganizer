import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { storage } from './config';

export const uploadPhoto = async (file: File, userId: string, photoId: string): Promise<string> => {
  const photoRef = ref(storage, `photos/${userId}/${photoId}`);
  const snapshot = await uploadBytes(photoRef, file);
  return await getDownloadURL(snapshot.ref);
};

export const uploadThumbnail = async (thumbnailBlob: Blob, userId: string, photoId: string): Promise<string> => {
  const thumbnailRef = ref(storage, `thumbnails/${userId}/${photoId}`);
  const snapshot = await uploadBytes(thumbnailRef, thumbnailBlob);
  return await getDownloadURL(snapshot.ref);
};

export const uploadCompressedPhoto = async (compressedBlob: Blob, userId: string, photoId: string): Promise<string> => {
  const compressedRef = ref(storage, `compressed/${userId}/${photoId}`);
  const snapshot = await uploadBytes(compressedRef, compressedBlob);
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