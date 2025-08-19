import heic2any from 'heic2any';

export interface ImageMetadata {
  width: number;
  height: number;
  size: number;
  type: string;
  dateTaken?: Date;
  location?: { lat: number; lng: number };
}

export const convertHeicToJpeg = async (file: File): Promise<File> => {
  if (file.type === 'image/heic' || file.type === 'image/heif') {
    const convertedBlob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.8,
    }) as Blob;
    
    return new File([convertedBlob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
      type: 'image/jpeg',
    });
  }
  return file;
};

export const getImageMetadata = (file: File): Promise<ImageMetadata> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        size: file.size,
        type: file.type,
      });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
};

export const generateThumbnail = (file: File, maxSize: number = 300): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Canvas context not supported'));
      return;
    }
    
    img.onload = () => {
      const ratio = Math.min(maxSize / img.width, maxSize / img.height);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

export const resizeImageForPrint = (
  file: File, 
  width: number, 
  height: number, 
  dpi: number = 300
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Canvas context not supported'));
      return;
    }
    
    img.onload = () => {
      canvas.width = width * (dpi / 72);
      canvas.height = height * (dpi / 72);
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      }, 'image/jpeg', 0.95);
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

export const detectDuplicates = (photos: Array<{ metadata: ImageMetadata; filename: string }>): Array<Array<number>> => {
  const duplicates: Array<Array<number>> = [];
  const processed = new Set<number>();
  
  for (let i = 0; i < photos.length; i++) {
    if (processed.has(i)) continue;
    
    const currentGroup: number[] = [i];
    
    for (let j = i + 1; j < photos.length; j++) {
      if (processed.has(j)) continue;
      
      const photo1 = photos[i];
      const photo2 = photos[j];
      
      if (
        photo1.metadata.size === photo2.metadata.size &&
        photo1.metadata.width === photo2.metadata.width &&
        photo1.metadata.height === photo2.metadata.height
      ) {
        currentGroup.push(j);
        processed.add(j);
      }
    }
    
    if (currentGroup.length > 1) {
      duplicates.push(currentGroup);
    }
    processed.add(i);
  }
  
  return duplicates;
};