import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePhoto } from '../../contexts/PhotoContext';
import { useAuth } from '../../contexts/AuthContext';
import { Photo, deleteMultiplePhotos } from '../../firebase/firestore';
import { deletePhoto as deletePhotoFromStorage } from '../../firebase/storage';
import PhotoCard from './PhotoCard';
import PhotoModal from './PhotoModal';
import PremiumView from './PremiumView';

const PhotoGrid: React.FC = () => {
  const { state, dispatch } = usePhoto();
  const { user } = useAuth();
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'masonry' | 'list'>('grid');
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredPhotos = useMemo(() => {
    let photos = state.photos;
    
    console.log('Filtering photos:', {
      totalPhotos: photos.length,
      selectedCategory: state.selectedCategory,
      photosWithCategories: photos.filter(p => p.categoryId).length
    });

    if (state.selectedCategory) {
      photos = photos.filter(photo => {
        const matches = photo.categoryId === state.selectedCategory;
        if (!matches) {
          console.log('Photo filtered out:', { 
            photoName: photo.originalName, 
            photoCategoryId: photo.categoryId, 
            selectedCategory: state.selectedCategory 
          });
        }
        return matches;
      });
      console.log(`Filtered to ${photos.length} photos for category ${state.selectedCategory}`);
    }

    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      photos = photos.filter(photo =>
        photo.originalName.toLowerCase().includes(query) ||
        photo.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return photos;
  }, [state.photos, state.selectedCategory, state.searchQuery]);

  const handlePhotoSelect = (photoId: string) => {
    dispatch({ type: 'TOGGLE_PHOTO_SELECTION', payload: photoId });
  };

  const handleSelectAll = () => {
    const visiblePhotoIds = filteredPhotos.map(photo => photo.id!);
    dispatch({ type: 'SET_SELECTED_PHOTOS', payload: visiblePhotoIds });
  };

  const handleDeselectAll = () => {
    dispatch({ type: 'SET_SELECTED_PHOTOS', payload: [] });
  };

  const handleDeleteSelected = async () => {
    if (!user || state.selectedPhotos.length === 0) return;
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${state.selectedPhotos.length} photo(s)? This action cannot be undone.`
    );
    
    if (!confirmDelete) return;
    
    setIsDeleting(true);
    
    try {
      // Get the photos to delete for storage cleanup
      const photosToDelete = state.photos.filter(photo => 
        state.selectedPhotos.includes(photo.id!)
      );
      
      // Delete from Firestore first (real-time listener will update UI)
      await deleteMultiplePhotos(state.selectedPhotos);
      
      // Then delete from storage (handle missing files gracefully)
      for (const photo of photosToDelete) {
        try {
          await deletePhotoFromStorage(user.uid, photo.filename);
        } catch (error: any) {
          if (error?.code !== 'storage/object-not-found') {
            console.error(`Error deleting storage file ${photo.filename}:`, error);
          }
        }
      }
      
      // Clear selection
      dispatch({ type: 'SET_SELECTED_PHOTOS', payload: [] });
      
    } catch (error) {
      console.error('Error deleting photos:', error);
      alert('Failed to delete photos. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePhotoClick = (photo: Photo) => {
    if (state.currentView === 'preview') {
      setSelectedPhoto(photo);
    } else {
      handlePhotoSelect(photo.id!);
    }
  };

  const gridVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const photoVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1 }
  };

  if (state.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner">Loading photos...</div>
      </div>
    );
  }

  if (filteredPhotos.length === 0) {
    return (
      <div className="empty-state">
        <div className="text-center">
          <div className="empty-icon">📷</div>
          <h3 className="text-xl font-medium mb-sm">No photos found</h3>
          <p className="text-sm opacity-75 mb-lg">
            {state.searchQuery 
              ? 'Try adjusting your search terms'
              : 'Upload your first photos to get started'
            }
          </p>
        </div>
      </div>
    );
  }

  // Show Premium View if that mode is selected
  if (state.currentView === 'premium') {
    return (
      <PremiumView 
        onExit={() => dispatch({ type: 'SET_VIEW', payload: 'preview' })}
      />
    );
  }

  return (
    <>
      {state.currentView === 'edit' && (
        <div className="photo-grid-header">
          <div className="flex items-center justify-between mb-lg">
            <div className="photo-count flex items-center gap-md">
              <div>
                <span className="text-lg font-medium">
                  {filteredPhotos.length} {filteredPhotos.length === 1 ? 'photo' : 'photos'}
                </span>
                {state.selectedPhotos.length > 0 && (
                  <span className="text-sm opacity-75 ml-sm">
                    ({state.selectedPhotos.length} selected)
                  </span>
                )}
              </div>
              {filteredPhotos.length > 0 && (
                <div className="flex gap-sm">
                  {state.selectedPhotos.length === filteredPhotos.length ? (
                    <button 
                      className="btn btn-sm btn-secondary"
                      onClick={handleDeselectAll}
                    >
                      Deselect All
                    </button>
                  ) : (
                    <button 
                      className="btn btn-sm btn-secondary"
                      onClick={handleSelectAll}
                    >
                      Select All
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="view-controls flex gap-sm">
              <button
                className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setViewMode('grid')}
                title="Grid view"
              >
                ⊞
              </button>
              <button
                className={`btn btn-sm ${viewMode === 'masonry' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setViewMode('masonry')}
                title="Masonry view"
              >
                ⊟
              </button>
              <button
                className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setViewMode('list')}
                title="List view"
              >
                ☰
              </button>
            </div>
          </div>

          {state.selectedPhotos.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bulk-actions card p-md mb-lg"
            >
              <div className="flex items-center gap-md">
                <span className="text-sm font-medium">
                  {state.selectedPhotos.length} selected
                </span>
                <div className="flex gap-sm">
                  <button className="btn btn-sm btn-secondary">
                    Add to Category
                  </button>
                  <button className="btn btn-sm btn-secondary">
                    Add Tags
                  </button>
                  <button className="btn btn-sm btn-secondary">
                    Download
                  </button>
                  <button 
                    className="btn btn-sm btn-danger"
                    onClick={handleDeleteSelected}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
                <button
                  className="btn btn-sm btn-secondary ml-auto"
                  onClick={() => dispatch({ type: 'SET_SELECTED_PHOTOS', payload: [] })}
                >
                  Clear Selection
                </button>
              </div>
            </motion.div>
          )}
        </div>
      )}

      <motion.div
        className={`photo-grid ${state.currentView === 'preview' ? 'preview' : viewMode}`}
        variants={gridVariants}
        initial="hidden"
        animate="visible"
      >
        <AnimatePresence>
          {filteredPhotos.map((photo) => (
            <motion.div
              key={photo.id}
              variants={photoVariants}
              layout
              className="photo-grid-item"
            >
              <PhotoCard
                photo={photo}
                isSelected={state.selectedPhotos.includes(photo.id!)}
                showSelection={state.currentView === 'edit'}
                onClick={() => handlePhotoClick(photo)}
                onSelect={() => handlePhotoSelect(photo.id!)}
                viewMode={state.currentView}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {selectedPhoto && (
          <PhotoModal
            photo={selectedPhoto}
            photos={filteredPhotos}
            onClose={() => setSelectedPhoto(null)}
            onNext={() => {
              const currentIndex = filteredPhotos.findIndex(p => p.id === selectedPhoto.id);
              const nextIndex = (currentIndex + 1) % filteredPhotos.length;
              setSelectedPhoto(filteredPhotos[nextIndex]);
            }}
            onPrevious={() => {
              const currentIndex = filteredPhotos.findIndex(p => p.id === selectedPhoto.id);
              const prevIndex = currentIndex === 0 ? filteredPhotos.length - 1 : currentIndex - 1;
              setSelectedPhoto(filteredPhotos[prevIndex]);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default PhotoGrid;