import JSZip from 'jszip';
import { Photo } from '../firebase/firestore';

export const downloadSinglePhoto = async (photo: Photo, filename?: string) => {
  try {
    const response = await fetch(photo.url);
    const blob = await response.blob();
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || photo.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading photo:', error);
    throw error;
  }
};

export const downloadPhotosAsZip = async (photos: Photo[], categoryName?: string) => {
  try {
    const zip = new JSZip();
    const promises = photos.map(async (photo, index) => {
      try {
        const response = await fetch(photo.url);
        const blob = await response.blob();
        zip.file(photo.originalName || `photo_${index + 1}.jpg`, blob);
      } catch (error) {
        console.error(`Error adding photo ${photo.originalName} to zip:`, error);
      }
    });
    
    await Promise.all(promises);
    
    const content = await zip.generateAsync({ type: 'blob' });
    const url = window.URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = categoryName ? `${categoryName}_photos.zip` : 'photos.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error creating zip file:', error);
    throw error;
  }
};

export interface PrintSize {
  name: string;
  width: number;
  height: number;
  dpi: number;
}

export const printSizes: PrintSize[] = [
  { name: '4x6" (10x15cm)', width: 4, height: 6, dpi: 300 },
  { name: '5x7" (13x18cm)', width: 5, height: 7, dpi: 300 },
  { name: '8x10" (20x25cm)', width: 8, height: 10, dpi: 300 },
  { name: '11x14" (28x36cm)', width: 11, height: 14, dpi: 300 },
  { name: '16x20" (41x51cm)', width: 16, height: 20, dpi: 300 },
];

export const prepareForPrint = (photo: Photo, printSize: PrintSize): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context not supported'));
        return;
      }
      
      const targetWidth = printSize.width * printSize.dpi;
      const targetHeight = printSize.height * printSize.dpi;
      
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      
      const imageAspect = img.width / img.height;
      const targetAspect = targetWidth / targetHeight;
      
      let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
      
      if (imageAspect > targetAspect) {
        drawHeight = targetHeight;
        drawWidth = drawHeight * imageAspect;
        offsetX = (targetWidth - drawWidth) / 2;
      } else {
        drawWidth = targetWidth;
        drawHeight = drawWidth / imageAspect;
        offsetY = (targetHeight - drawHeight) / 2;
      }
      
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      
      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = photo.url;
  });
};