import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePhoto } from '../../contexts/PhotoContext';
import { Photo } from '../../firebase/firestore';
import { getLocationName, getTimeBasedCategory } from '../../utils/imageProcessing';
import PhotoCard from './PhotoCard';
import PhotoModal from './PhotoModal';

interface PhotoGroup {
  title: string;
  photos: Photo[];
  type: 'location' | 'time' | 'category';
}

const PhotoGroups: React.FC = () => {
  const { state, dispatch } = usePhoto();
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [locationNames, setLocationNames] = useState<{ [key: string]: string }>({});

  const photoGroups = useMemo(() => {
    const groups: PhotoGroup[] = [];
    const locationGroups: { [key: string]: Photo[] } = {};
    const timeGroups: { [key: string]: Photo[] } = {};

    // Group by location and time
    console.log('Grouping photos:', state.photos.length, 'total photos');
    
    state.photos.forEach(photo => {
      console.log('Processing photo:', photo.originalName, 'metadata:', photo.metadata);
      
      // Location grouping
      if (photo.metadata?.location) {
        console.log('Photo has location:', photo.metadata.location);
        const locationKey = `${photo.metadata.location.lat.toFixed(2)},${photo.metadata.location.lng.toFixed(2)}`;
        if (!locationGroups[locationKey]) {
          locationGroups[locationKey] = [];
        }
        locationGroups[locationKey].push(photo);
      } else {
        console.log('Photo has no location data');
      }

      // Time grouping - prioritize EXIF date taken over upload date
      let date: Date;
      if (photo.metadata?.dateTaken && photo.metadata.dateTaken instanceof Date) {
        date = photo.metadata.dateTaken;
      } else if (photo.metadata?.dateTaken) {
        date = new Date(photo.metadata.dateTaken);
      } else {
        // Fallback to upload date if no EXIF date
        date = new Date(photo.createdAt?.toDate?.() || photo.createdAt);
      }
      const timeCategory = getTimeBasedCategory(date);
      if (!timeGroups[timeCategory]) {
        timeGroups[timeCategory] = [];
      }
      timeGroups[timeCategory].push(photo);
    });

    // Convert location groups to PhotoGroup objects
    console.log('Location groups found:', Object.keys(locationGroups).length);
    Object.entries(locationGroups).forEach(([locationKey, photos]) => {
      console.log(`Location group ${locationKey}:`, photos.length, 'photos');
      if (photos.length > 0) {
        const firstPhoto = photos[0];
        if (firstPhoto.metadata?.location) {
          const locationTitle = locationNames[locationKey] || `Location ${locationKey}`;
          console.log(`Creating location group: ${locationTitle}`);
          groups.push({
            title: locationTitle,
            photos,
            type: 'location'
          });
        }
      }
    });

    // Convert time groups to PhotoGroup objects
    Object.entries(timeGroups).forEach(([timeCategory, photos]) => {
      groups.push({
        title: timeCategory,
        photos,
        type: 'time'
      });
    });

    // Sort groups by photo count (largest first)
    return groups.sort((a, b) => b.photos.length - a.photos.length);
  }, [state.photos, locationNames]);

  // Resolve location names asynchronously
  useEffect(() => {
    const resolveLocationNames = async () => {
      const locationGroups: { [key: string]: Photo[] } = {};
      
      state.photos.forEach(photo => {
        if (photo.metadata?.location) {
          const locationKey = `${photo.metadata.location.lat.toFixed(2)},${photo.metadata.location.lng.toFixed(2)}`;
          if (!locationGroups[locationKey]) {
            locationGroups[locationKey] = [];
          }
          locationGroups[locationKey].push(photo);
        }
      });

      for (const [locationKey, photos] of Object.entries(locationGroups)) {
        if (photos.length > 0 && !locationNames[locationKey]) {
          const firstPhoto = photos[0];
          if (firstPhoto.metadata?.location) {
            try {
              const locationName = await getLocationName(
                firstPhoto.metadata.location.lat,
                firstPhoto.metadata.location.lng
              );
              if (locationName) {
                setLocationNames(prev => ({ ...prev, [locationKey]: locationName }));
              }
            } catch (error) {
              console.error('Error getting location name:', error);
            }
          }
        }
      }
    };

    if (state.photos.length > 0) {
      resolveLocationNames();
    }
  }, [state.photos, locationNames]);

  const toggleGroupExpansion = (groupTitle: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupTitle)) {
      newExpanded.delete(groupTitle);
    } else {
      newExpanded.add(groupTitle);
    }
    setExpandedGroups(newExpanded);
  };

  const handlePhotoClick = (photo: Photo) => {
    setSelectedPhoto(photo);
  };

  if (state.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner">Loading photos...</div>
      </div>
    );
  }

  if (photoGroups.length === 0) {
    return (
      <div className="empty-state">
        <div className="text-center">
          <div className="empty-icon">📷</div>
          <h3 className="text-xl font-medium mb-sm">No photos found</h3>
          <p className="text-sm opacity-75 mb-lg">
            Upload your first photos to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="photo-groups">
        {photoGroups.map((group, groupIndex) => (
          <motion.div
            key={group.title}
            className="photo-group"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: groupIndex * 0.1 }}
          >
            <div className="photo-group-header">
              <button
                className="group-toggle-btn"
                onClick={() => toggleGroupExpansion(group.title)}
              >
                <h2 className="group-title">
                  {group.title}
                  {group.type === 'location' && ' 📍'}
                  {group.type === 'time' && ' 📅'}
                </h2>
                <div className="group-meta">
                  <span className="photo-count">{group.photos.length} photos</span>
                  <span className="expand-icon">
                    {expandedGroups.has(group.title) ? '▼' : '▶'}
                  </span>
                </div>
              </button>
            </div>
            
            <AnimatePresence>
              {!expandedGroups.has(group.title) && (
                <motion.div
                  className="photo-group-grid preview-grid"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {group.photos.slice(0, 12).map((photo) => (
                    <motion.div
                      key={photo.id}
                      className="photo-grid-item"
                      layoutId={`photo-${photo.id}`}
                      whileHover={{ scale: 1.02 }}
                    >
                      <PhotoCard
                        photo={photo}
                        isSelected={false}
                        showSelection={false}
                        onClick={() => handlePhotoClick(photo)}
                        onSelect={() => {}}
                        viewMode="preview"
                      />
                    </motion.div>
                  ))}
                  {group.photos.length > 12 && (
                    <button
                      className="expand-group-btn"
                      onClick={() => toggleGroupExpansion(group.title)}
                    >
                      <span>+{group.photos.length - 12}</span>
                      <span>View All</span>
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {expandedGroups.has(group.title) && (
                <motion.div
                  className="photo-group-grid expanded-grid"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {group.photos.map((photo) => (
                    <motion.div
                      key={photo.id}
                      className="photo-grid-item"
                      layoutId={`photo-${photo.id}`}
                      whileHover={{ scale: 1.02 }}
                    >
                      <PhotoCard
                        photo={photo}
                        isSelected={false}
                        showSelection={false}
                        onClick={() => handlePhotoClick(photo)}
                        onSelect={() => {}}
                        viewMode="preview"
                      />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedPhoto && (
          <PhotoModal
            photo={selectedPhoto}
            photos={state.photos}
            onClose={() => setSelectedPhoto(null)}
            onNext={() => {
              const currentIndex = state.photos.findIndex(p => p.id === selectedPhoto.id);
              const nextIndex = (currentIndex + 1) % state.photos.length;
              setSelectedPhoto(state.photos[nextIndex]);
            }}
            onPrevious={() => {
              const currentIndex = state.photos.findIndex(p => p.id === selectedPhoto.id);
              const prevIndex = currentIndex === 0 ? state.photos.length - 1 : currentIndex - 1;
              setSelectedPhoto(state.photos[prevIndex]);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default PhotoGroups;