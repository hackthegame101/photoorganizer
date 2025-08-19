import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { uploadThumbnail, uploadCompressedPhoto } from '../firebase/storage';
import { compressImage, generateThumbnail } from './imageProcessing';

interface PhotoDoc {
  id: string;
  url: string;
  originalUrl?: string;
  thumbnailUrl?: string;
  userId: string;
  filename: string;
}

// Helper function to convert URL to blob
const urlToBlob = async (url: string): Promise<Blob> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  return response.blob();
};

// Helper function to convert blob to file for processing
const blobToFile = (blob: Blob, filename: string): File => {
  return new File([blob], filename, { type: blob.type });
};

export const migratePhotoThumbnails = async (batchSize: number = 10): Promise<void> => {
  console.log('Starting photo migration to generate thumbnails and compressed versions...');
  
  try {
    // Get all photos from Firestore
    const photosCollection = collection(db, 'photos');
    const photosSnapshot = await getDocs(photosCollection);
    
    const photosToMigrate: PhotoDoc[] = [];
    
    photosSnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const photo: PhotoDoc = {
        id: docSnapshot.id,
        url: data.url,
        originalUrl: data.originalUrl,
        thumbnailUrl: data.thumbnailUrl,
        userId: data.userId,
        filename: data.filename
      };
      
      // Only migrate if missing thumbnailUrl or originalUrl
      if (!photo.thumbnailUrl || photo.url === photo.thumbnailUrl || !photo.originalUrl) {
        photosToMigrate.push(photo);
      }
    });
    
    console.log(`Found ${photosToMigrate.length} photos that need migration`);
    
    if (photosToMigrate.length === 0) {
      console.log('No photos need migration. All photos already have thumbnails and compressed versions.');
      return;
    }
    
    // Process photos in batches to avoid overwhelming the system
    for (let i = 0; i < photosToMigrate.length; i += batchSize) {
      const batch = photosToMigrate.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(photosToMigrate.length / batchSize)} (${batch.length} photos)`);
      
      await Promise.all(batch.map(async (photo) => {
        try {
          console.log(`Migrating photo: ${photo.filename}`);
          
          // Download original image
          const originalBlob = await urlToBlob(photo.url);
          const originalFile = blobToFile(originalBlob, photo.filename);
          
          // Generate compressed version and thumbnail
          const [compressedBlob, thumbnailBlob] = await Promise.all([
            compressImage(originalFile, 1920, 1080, 0.8),
            generateThumbnail(originalFile, 300)
          ]);
          
          // Upload new versions to Firebase Storage
          const [compressedUrl, thumbnailUrl] = await Promise.all([
            uploadCompressedPhoto(compressedBlob, photo.userId, photo.filename),
            uploadThumbnail(thumbnailBlob, photo.userId, photo.filename)
          ]);
          
          // Update Firestore document with new URLs
          const photoRef = doc(db, 'photos', photo.id);
          await updateDoc(photoRef, {
            originalUrl: photo.url, // Store current URL as original
            url: compressedUrl, // Use compressed as new default
            thumbnailUrl: thumbnailUrl
          });
          
          console.log(`✅ Successfully migrated photo: ${photo.filename}`);
          
        } catch (error) {
          console.error(`❌ Failed to migrate photo ${photo.filename}:`, error);
          // Continue with next photo even if one fails
        }
      }));
      
      // Add a small delay between batches to avoid rate limiting
      if (i + batchSize < photosToMigrate.length) {
        console.log('Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Function to check migration status
export const checkMigrationStatus = async (): Promise<{
  total: number;
  migrated: number;
  needsMigration: number;
}> => {
  const photosCollection = collection(db, 'photos');
  const photosSnapshot = await getDocs(photosCollection);
  
  let total = 0;
  let migrated = 0;
  let needsMigration = 0;
  
  photosSnapshot.forEach((docSnapshot) => {
    const data = docSnapshot.data();
    total++;
    
    if (data.thumbnailUrl && data.originalUrl && data.url !== data.thumbnailUrl) {
      migrated++;
    } else {
      needsMigration++;
    }
  });
  
  return { total, migrated, needsMigration };
};

// Utility function to run migration from console
export const runMigration = async () => {
  console.log('🚀 Starting photo migration...');
  
  const status = await checkMigrationStatus();
  console.log(`Migration status: ${status.migrated}/${status.total} photos migrated, ${status.needsMigration} need migration`);
  
  if (status.needsMigration === 0) {
    console.log('No migration needed!');
    return;
  }
  
  const confirmed = confirm(`This will migrate ${status.needsMigration} photos. Continue?`);
  if (!confirmed) {
    console.log('Migration cancelled');
    return;
  }
  
  await migratePhotoThumbnails(5); // Process 5 photos at a time
  
  const finalStatus = await checkMigrationStatus();
  console.log(`Final status: ${finalStatus.migrated}/${finalStatus.total} photos migrated`);
};