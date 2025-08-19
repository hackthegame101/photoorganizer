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
  locationName?: string;
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

// Group coordinates by proximity (neighborhood-level clustering)
export const getLocationClusterKey = (lat: number, lng: number): string => {
  // Use higher precision for neighborhood-level clustering
  // Round to approximately 2km precision to capture neighborhoods/districts
  const latRounded = Math.round(lat * 50) / 50;  // ~2.2km precision
  const lngRounded = Math.round(lng * 50) / 50;  // ~2.2km precision at equator
  return `${latRounded},${lngRounded}`;
};

// Cache for location names to avoid repeated API calls
const locationNameCache = new Map<string, string | null>();

// Rate limiting for Nominatim API (max 1 request per second)
let lastRequestTime = 0;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getLocationName = async (lat: number, lng: number): Promise<string | null> => {
  // Create cache key using cluster key for consistent caching
  const cacheKey = getLocationClusterKey(lat, lng);
  
  // Check cache first
  if (locationNameCache.has(cacheKey)) {
    return locationNameCache.get(cacheKey) || null;
  }
  
  try {
    // Rate limiting: ensure at least 1 second between requests
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < 1000) {
      await delay(1000 - timeSinceLastRequest);
    }
    lastRequestTime = Date.now();
    
    // Use OpenStreetMap Nominatim API (free and reliable)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=en`,
      {
        headers: {
          'User-Agent': 'PhotoOrganizer/1.0 (Contact: user@example.com)' // Required by Nominatim
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    let locationName: string | null = null;
    
    // Create more specific location names from Nominatim data
    if (data.address) {
      const addr = data.address;
      let specificParts: string[] = [];
      
      // Add specific landmarks, attractions, or neighborhoods first
      if (addr.tourism) {
        specificParts.push(addr.tourism);
      }
      if (addr.historic) {
        specificParts.push(addr.historic);
      }
      if (addr.attraction) {
        specificParts.push(addr.attraction);
      }
      if (addr.amenity) {
        specificParts.push(addr.amenity);
      }
      
      // Add neighborhood/area information
      if (addr.neighbourhood) {
        specificParts.push(addr.neighbourhood);
      } else if (addr.suburb) {
        specificParts.push(addr.suburb);
      } else if (addr.quarter) {
        specificParts.push(addr.quarter);
      }
      
      // Add city/town as the base location
      let baseLocation = '';
      if (addr.city) {
        baseLocation = addr.city;
      } else if (addr.town) {
        baseLocation = addr.town;
      } else if (addr.village) {
        baseLocation = addr.village;
      } else if (addr.state) {
        baseLocation = addr.state;
      } else if (addr.country) {
        baseLocation = addr.country;
      }
      
      // Combine specific parts with base location
      if (specificParts.length > 0 && baseLocation) {
        // Take the most specific part + city
        locationName = `${specificParts[0]}, ${baseLocation}`;
      } else if (baseLocation) {
        locationName = baseLocation;
      }
    }
    
    console.log(`📍 Resolved ${lat.toFixed(3)}, ${lng.toFixed(3)} → ${locationName || 'Unknown'}`);
    
    // Cache the result (even if null)
    locationNameCache.set(cacheKey, locationName);
    
    return locationName;
  } catch (error) {
    console.error(`Error getting location name for ${lat}, ${lng}:`, error);
    
    // Create a fallback location name based on coordinates
    const fallbackName = `Location (${lat.toFixed(2)}°, ${lng.toFixed(2)}°)`;
    
    // Cache the fallback result to avoid repeated failed requests
    locationNameCache.set(cacheKey, fallbackName);
    return fallbackName;
  }
};

// Calculate distance between two coordinates in kilometers
export const getDistanceBetweenCoordinates = (
  lat1: number, lng1: number, 
  lat2: number, lng2: number
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
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

export const compressImage = (file: File, maxWidth: number = 1920, maxHeight: number = 1080, quality: number = 0.8): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Canvas context not supported'));
      return;
    }
    
    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      let { width, height } = img;
      
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Use better image scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(img.src);
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create compressed image blob'));
        }
      }, 'image/jpeg', quality);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(file);
  });
};

export const generateThumbnail = (file: File, maxSize: number = 300): Promise<Blob> => {
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
      
      // Use better image scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(img.src);
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create thumbnail blob'));
        }
      }, 'image/jpeg', 0.7);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
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