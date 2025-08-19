import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { usePhoto } from '../../contexts/PhotoContext';
import { convertHeicToJpeg } from '../../utils/imageProcessing';
import { uploadPhoto } from '../../firebase/storage';
import { createPhoto } from '../../firebase/firestore';

interface UploadProgress {
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

const PhotoUpload: React.FC = () => {
  const { user } = useAuth();
  const { state } = usePhoto();
  const [uploadQueue, setUploadQueue] = useState<UploadProgress[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);

  const processFile = useCallback(async (file: File, retryCount = 0): Promise<void> => {
    if (!user) return;

    
    setUploadQueue(prev => [...prev, {
      file,
      progress: 0,
      status: 'processing'
    }]);

    try {
      let processedFile = file;
      
      if (file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic')) {
        setUploadQueue(prev => prev.map(item => 
          item.file === file ? { ...item, status: 'processing' } : item
        ));
        processedFile = await convertHeicToJpeg(file);
      }

      setUploadQueue(prev => prev.map(item => 
        item.file === file ? { ...item, status: 'uploading', progress: 10 } : item
      ));

      const photoId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Upload to Storage first
      console.log('Starting storage upload...');
      const downloadUrl = await uploadPhoto(processedFile, user.uid, photoId);
      console.log('Storage upload completed');

      setUploadQueue(prev => prev.map(item => 
        item.file === file ? { ...item, progress: 70 } : item
      ));

      const photoData: any = {
        filename: photoId,
        originalName: file.name,
        url: downloadUrl,
        thumbnailUrl: downloadUrl,
        userId: user.uid,
        tags: [],
        metadata: {
          size: file.size,
          type: processedFile.type,
          width: 0,
          height: 0,
        }
      };

      // Only add categoryId if a category is selected
      if (state.selectedCategory) {
        photoData.categoryId = state.selectedCategory;
      }
      
      console.log('Photo data prepared:', photoData);
      console.log('Selected category:', state.selectedCategory);
      console.log('Available categories:', state.categories);
      console.log('Categories length:', state.categories.length);
      console.log('User ID:', user.uid);
      
      // Debug: print all category info
      state.categories.forEach(cat => {
        console.log(`Category: ${cat.name} (ID: ${cat.id})`);
      });

      setUploadQueue(prev => prev.map(item => 
        item.file === file ? { ...item, progress: 80 } : item
      ));

      // Save to Firestore
      console.log('Starting Firestore save...', photoData);
      
      setUploadQueue(prev => prev.map(item => 
        item.file === file ? { ...item, progress: 90 } : item
      ));
      
      let docId;
      try {
        docId = await createPhoto(photoData);
        console.log('Firestore save completed with ID:', docId);
      } catch (firestoreError) {
        console.error('Firestore save failed:', firestoreError);
        
        setUploadQueue(prev => prev.map(item => 
          item.file === file ? { 
            ...item, 
            status: 'error', 
            error: `Firestore error: ${firestoreError instanceof Error ? firestoreError.message : 'Unknown error'}` 
          } : item
        ));
        
        // Try once more after a delay
        console.log('Retrying Firestore save...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
          docId = await createPhoto(photoData);
          console.log('Firestore retry successful with ID:', docId);
        } catch (retryError) {
          console.error('Firestore retry also failed:', retryError);
          throw retryError;
        }
      }
      
      console.log('Photo saved to Firestore with ID:', docId);
      // Note: Photo will be automatically added to state via real-time listener

      setUploadQueue(prev => prev.map(item => 
        item.file === file ? { ...item, status: 'completed', progress: 100 } : item
      ));

      setTimeout(() => {
        setUploadQueue(prev => prev.filter(item => item.file !== file));
      }, 1500);

    } catch (error) {
      console.error('Error uploading file:', error);
      
      // Retry logic for network errors
      if (retryCount < 2 && (
        error instanceof Error && (
          error.message.includes('network') ||
          error.message.includes('fetch') ||
          error.message.includes('connection') ||
          error.message.includes('timeout')
        )
      )) {
        console.log(`Retrying upload (attempt ${retryCount + 1})...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
        return processFile(file, retryCount + 1);
      }
      
      setUploadQueue(prev => prev.map(item => 
        item.file === file ? { 
          ...item, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Upload failed' 
        } : item
      ));
    }
  }, [state.selectedCategory, state.categories]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsDragActive(false);
    
    // Process files in parallel for faster uploads
    acceptedFiles.forEach(file => {
      processFile(file);
    });
  }, [user, processFile]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.heic', '.heif']
    },
    multiple: true
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const rootProps = getRootProps();

  return (
    <div className="photo-upload">
      <motion.div
        className={`dropzone ${isDragActive ? 'active' : ''}`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={rootProps.onClick}
        onKeyDown={rootProps.onKeyDown}
        tabIndex={rootProps.tabIndex}
        role={rootProps.role}
        aria-label={rootProps['aria-label']}
        style={{ ...rootProps.style }}
      >
        <input {...getInputProps()} />
        <div className="dropzone-content">
          <motion.div
            className="upload-icon"
            animate={{ y: isDragActive ? -10 : 0 }}
            transition={{ duration: 0.2 }}
          >
            📸
          </motion.div>
          <h3 className="text-lg font-medium mb-sm">
            {isDragActive ? 'Drop photos here' : 'Upload Photos'}
          </h3>
          <p className="text-sm opacity-75 mb-md">
            Drag and drop photos here, or click to select files
          </p>
          <p className="text-sm opacity-50">
            Supports JPEG, PNG, GIF, WEBP, BMP, TIFF, HEIC formats
          </p>
          {state.selectedCategory && (
            <div className="category-indicator mt-md">
              <span className="text-sm font-medium">
                📁 Will upload to: {state.categories.find(c => c.id === state.selectedCategory)?.name || 'Selected Category'}
              </span>
            </div>
          )}
          <button className="btn btn-primary mt-md">
            Choose Files
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {uploadQueue.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="upload-progress"
          >
            <h4 className="text-md font-medium mb-md">Uploading Photos</h4>
            
            {uploadQueue.map((upload, index) => (
              <motion.div
                key={`${upload.file.name}-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="upload-item"
              >
                <div className="upload-info">
                  <div className="flex items-center gap-sm">
                    <span className="upload-status">
                      {upload.status === 'processing' && '⚙️'}
                      {upload.status === 'uploading' && '📤'}
                      {upload.status === 'completed' && '✅'}
                      {upload.status === 'error' && '❌'}
                    </span>
                    <span className="filename">{upload.file.name}</span>
                    <span className="filesize text-sm opacity-75">
                      {formatFileSize(upload.file.size)}
                    </span>
                  </div>
                  
                  {upload.status === 'error' && upload.error && (
                    <p className="error-message">{upload.error}</p>
                  )}
                </div>
                
                {upload.status === 'uploading' && (
                  <div className="progress-bar">
                    <motion.div
                      className="progress-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${upload.progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PhotoUpload;