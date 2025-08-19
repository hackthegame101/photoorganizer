import heic2any from 'heic2any';
// @ts-ignore
import EXIF from 'exif-js';

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
      try {
        // Extract EXIF data
        EXIF.getData(img as any, function(this: any) {
          const dateTaken = EXIF.getTag(this, 'DateTime') || EXIF.getTag(this, 'DateTimeOriginal');
          const lat = EXIF.getTag(this, 'GPSLatitude');
          const lon = EXIF.getTag(this, 'GPSLongitude');
          const latRef = EXIF.getTag(this, 'GPSLatitudeRef');
          const lonRef = EXIF.getTag(this, 'GPSLongitudeRef');
          
          let location: { lat: number; lng: number } | undefined;
          if (lat && lon && latRef && lonRef) {
            try {
              const latDecimal = convertDMSToDD(lat, latRef);
              const lonDecimal = convertDMSToDD(lon, lonRef);
              
              // Validate coordinates are reasonable
              if (!isNaN(latDecimal) && !isNaN(lonDecimal) && 
                  latDecimal >= -90 && latDecimal <= 90 && 
                  lonDecimal >= -180 && lonDecimal <= 180) {
                location = { lat: latDecimal, lng: lonDecimal };
              } else {
                console.warn('Invalid GPS coordinates, skipping:', { lat: latDecimal, lng: lonDecimal });
              }
            } catch (error) {
              console.warn('Error parsing GPS coordinates:', { lat, lon, latRef, lonRef }, error);
            }
          }
          
          let dateObject: Date | undefined;
          if (dateTaken) {
            try {
              // Handle various date formats from EXIF
              if (typeof dateTaken === 'string') {
                // EXIF dates are often in format "YYYY:MM:DD HH:MM:SS"
                const normalizedDate = dateTaken.replace(/:/g, '-').replace(/(\d{4})-(\d{2})-(\d{2})-/, '$1-$2-$3 ');
                dateObject = new Date(normalizedDate);
                
                // Check if date is valid
                if (isNaN(dateObject.getTime())) {
                  console.warn('Invalid EXIF date format, skipping date:', dateTaken);
                  dateObject = undefined;
                }
              } else {
                dateObject = new Date(dateTaken);
                if (isNaN(dateObject.getTime())) {
                  console.warn('Invalid date object, skipping:', dateTaken);
                  dateObject = undefined;
                }
              }
            } catch (error) {
              console.warn('Error parsing EXIF date:', dateTaken, error);
              dateObject = undefined;
            }
          }
          
          URL.revokeObjectURL(url);
          resolve({
            width: img.naturalWidth,
            height: img.naturalHeight,
            size: file.size,
            type: file.type,
            dateTaken: dateObject,
            location,
          });
        });
      } catch (error) {
        // If EXIF extraction fails, just return basic metadata
        URL.revokeObjectURL(url);
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
          size: file.size,
          type: file.type,
        });
      }
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
};

const convertDMSToDD = (dms: number[], ref: string): number => {
  try {
    if (!Array.isArray(dms) || dms.length < 3) {
      throw new Error('Invalid DMS array format');
    }
    
    const degrees = Number(dms[0]) || 0;
    const minutes = Number(dms[1]) || 0;
    const seconds = Number(dms[2]) || 0;
    
    let dd = degrees + (minutes / 60) + (seconds / 3600);
    if (ref === 'S' || ref === 'W') dd = dd * -1;
    
    return dd;
  } catch (error) {
    console.warn('Error converting DMS to DD:', dms, ref, error);
    return NaN;
  }
};

export const getLocationName = async (lat: number, lng: number): Promise<string | null> => {
  try {
    // Use a free reverse geocoding service
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    );
    const data = await response.json();
    
    if (data.city) {
      return data.city;
    } else if (data.locality) {
      return data.locality;
    } else if (data.principalSubdivision) {
      return data.principalSubdivision;
    }
    return null;
  } catch (error) {
    console.error('Error getting location name:', error);
    return null;
  }
};

export const getTimeBasedCategory = (date: Date): string => {
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 7) {
    return 'This Week';
  } else if (diffDays <= 30) {
    return 'This Month';
  } else if (diffDays <= 90) {
    return 'Last 3 Months';
  } else if (diffDays <= 365) {
    return 'This Year';
  } else {
    const year = date.getFullYear();
    return `${year}`;
  }
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