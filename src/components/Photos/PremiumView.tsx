import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePhoto } from '../../contexts/PhotoContext';
import { getLocationName } from '../../utils/imageProcessing';

interface PremiumViewProps {
  onExit: () => void;
}

const PremiumView: React.FC<PremiumViewProps> = ({ onExit }) => {
  const { state } = usePhoto();
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [currentLocationGroupIndex, setCurrentLocationGroupIndex] = useState(0);
  const [currentPhotoInGroupIndex, setCurrentPhotoInGroupIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [slideInterval, setSlideInterval] = useState(3000);
  const [showControls, setShowControls] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showPauseIndicator, setShowPauseIndicator] = useState(false);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [showLocationTitle, setShowLocationTitle] = useState(false);
  const [currentMusicIndex, setCurrentMusicIndex] = useState(0);
  const [isMusicPlaying, setIsMusicPlaying] = useState(true);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(new Set());
  const [isSlowDevice, setIsSlowDevice] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pauseIndicatorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const musicTracks = ['/kut.mp3', '/kut1.mp3', '/bmg.mp3'];

  const photosByLocation = React.useMemo(() => {
    let photos = state.photos;
    
    if (state.selectedCategory) {
      photos = photos.filter(photo => photo.categoryId === state.selectedCategory);
    }
    
    // Group photos by location
    const locationGroups: { [key: string]: typeof photos } = {};
    const noLocationPhotos: typeof photos = [];
    
    photos.forEach(photo => {
      if (photo.metadata?.location) {
        const locationKey = `${photo.metadata.location.lat.toFixed(3)},${photo.metadata.location.lng.toFixed(3)}`;
        if (!locationGroups[locationKey]) {
          locationGroups[locationKey] = [];
        }
        locationGroups[locationKey].push(photo);
      } else {
        noLocationPhotos.push(photo);
      }
    });
    
    // Convert to array and sort by photo count (descending)
    const sortedLocationGroups = Object.entries(locationGroups)
      .map(([key, photos]) => ({ key, photos, locationName: null as string | null }))
      .sort((a, b) => b.photos.length - a.photos.length);
    
    // Add no-location photos as a separate group if they exist
    if (noLocationPhotos.length > 0) {
      sortedLocationGroups.push({ key: 'no-location', photos: noLocationPhotos, locationName: 'Other Photos' as string | null });
    }
    
    return sortedLocationGroups;
  }, [state.photos, state.selectedCategory]);

  const filteredPhotos = React.useMemo(() => {
    return photosByLocation.flatMap(group => group.photos);
  }, [photosByLocation]);

  const currentLocationGroup = photosByLocation[currentLocationGroupIndex];
  const currentPhoto = currentLocationGroup?.photos[currentPhotoInGroupIndex];
  const totalPhotos = filteredPhotos.length;

  // Fetch location name when photo changes (skip on slow devices to improve performance)
  useEffect(() => {
    const fetchLocationName = async () => {
      if (currentPhoto?.metadata?.location && !isSlowDevice) {
        // Check if we already have a resolved location name
        if (currentPhoto.metadata.locationName) {
          setLocationName(currentPhoto.metadata.locationName);
          setLoadingLocation(false);
          return;
        }
        
        // Otherwise fetch it
        setLoadingLocation(true);
        try {
          const name = await getLocationName(
            currentPhoto.metadata.location.lat, 
            currentPhoto.metadata.location.lng
          );
          setLocationName(name);
        } catch (error) {
          console.error('Error fetching location name:', error);
          setLocationName(null);
        } finally {
          setLoadingLocation(false);
        }
      } else {
        // For slow devices, show simplified location or skip
        if (isSlowDevice && currentPhoto?.metadata?.location) {
          const lat = currentPhoto.metadata.location.lat.toFixed(2);
          const lng = currentPhoto.metadata.location.lng.toFixed(2);
          setLocationName(`${lat}°, ${lng}°`);
        } else {
          setLocationName(null);
        }
        setLoadingLocation(false);
      }
    };

    fetchLocationName();
  }, [currentPhoto?.id, currentPhoto?.metadata?.location, currentPhoto?.metadata?.locationName, isSlowDevice]);

  const navigatePhoto = useCallback((direction: number) => {
    const currentGroup = photosByLocation[currentLocationGroupIndex];
    if (!currentGroup) return;
    
    const newPhotoIndex = currentPhotoInGroupIndex + direction;
    
    if (newPhotoIndex < 0) {
      // Go to previous location group
      const prevGroupIndex = currentLocationGroupIndex - 1;
      if (prevGroupIndex < 0) {
        // Wrap to last group, last photo
        const lastGroupIndex = photosByLocation.length - 1;
        const lastGroup = photosByLocation[lastGroupIndex];
        setCurrentLocationGroupIndex(lastGroupIndex);
        setCurrentPhotoInGroupIndex(lastGroup.photos.length - 1);
      } else {
        const prevGroup = photosByLocation[prevGroupIndex];
        setCurrentLocationGroupIndex(prevGroupIndex);
        setCurrentPhotoInGroupIndex(prevGroup.photos.length - 1);
      }
    } else if (newPhotoIndex >= currentGroup.photos.length) {
      // Go to next location group
      const nextGroupIndex = currentLocationGroupIndex + 1;
      if (nextGroupIndex >= photosByLocation.length) {
        // Wrap to first group, first photo
        setCurrentLocationGroupIndex(0);
        setCurrentPhotoInGroupIndex(0);
      } else {
        setCurrentLocationGroupIndex(nextGroupIndex);
        setCurrentPhotoInGroupIndex(0);
      }
    } else {
      setCurrentPhotoInGroupIndex(newPhotoIndex);
    }
    
    // Update overall photo index for compatibility
    let totalIndex = 0;
    for (let i = 0; i < currentLocationGroupIndex; i++) {
      totalIndex += photosByLocation[i].photos.length;
    }
    totalIndex += Math.max(0, Math.min(newPhotoIndex, currentGroup.photos.length - 1));
    setCurrentPhotoIndex(totalIndex);
  }, [photosByLocation, currentLocationGroupIndex, currentPhotoInGroupIndex]);

  const handleExit = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    onExit();
  }, [onExit]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    
    // Clear existing timeout
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    // Set new timeout to hide controls after 3 seconds of inactivity
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  const toggleMusic = useCallback(() => {
    // Initialize audio on first user interaction
    if (!audioInitialized) {
      setAudioInitialized(true);
    }
    
    if (audioRef.current) {
      if (isMusicPlaying) {
        audioRef.current.pause();
        setIsMusicPlaying(false);
      } else {
        audioRef.current.play().then(() => {
          setIsMusicPlaying(true);
        }).catch(console.error);
      }
    }
  }, [isMusicPlaying, audioInitialized]);

  const togglePlayPause = useCallback(() => {
    const newPlayState = !isPlaying;
    setIsPlaying(newPlayState);
    
    // Show pause indicator for 2 seconds when pausing
    if (!newPlayState) {
      setShowPauseIndicator(true);
      
      // Clear any existing timeout
      if (pauseIndicatorTimeoutRef.current) {
        clearTimeout(pauseIndicatorTimeoutRef.current);
      }
      
      // Hide the indicator after 2 seconds
      pauseIndicatorTimeoutRef.current = setTimeout(() => {
        setShowPauseIndicator(false);
      }, 2000);
    } else {
      // Hide immediately when resuming
      setShowPauseIndicator(false);
      if (pauseIndicatorTimeoutRef.current) {
        clearTimeout(pauseIndicatorTimeoutRef.current);
      }
    }
  }, [isPlaying]);

  const handleScreenClick = useCallback((event: React.MouseEvent) => {
    // Initialize audio on first user interaction
    if (!audioInitialized && audioRef.current) {
      audioRef.current.play().then(() => {
        setAudioInitialized(true);
      }).catch(() => {
        setAudioInitialized(true); // Still mark as initialized even if play fails
      });
    }
    
    // Prevent pause/play when clicking on controls or buttons
    const target = event.target as HTMLElement;
    
    // Check if clicked element or its parent is a button or control
    if (target.closest('button') || 
        target.closest('.premium-controls') || 
        target.closest('.premium-top-controls') || 
        target.closest('.bottom-controls') || 
        target.closest('.progress-indicator')) {
      return;
    }
    
    togglePlayPause();
  }, [togglePlayPause, audioInitialized]);

  // Initialize and manage audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Set initial properties based on device performance
    audio.volume = 0.3;
    audio.preload = isSlowDevice ? 'metadata' : 'auto';
    if (isSlowDevice) {
      audio.crossOrigin = 'anonymous'; // Help with caching
    }
    
    const loadAndPlayTrack = (index: number) => {
      const track = musicTracks[index];
      if (track && audio.src !== window.location.origin + track) {
        audio.src = track;
        audio.load(); // Properly load the new source
        
        // Wait for audio to be ready before playing
        const playWhenReady = () => {
          if (isMusicPlaying && audioInitialized) {
            audio.play().catch(err => {
              console.log('Audio play failed:', err.message);
            });
          }
        };
        
        if (audio.readyState >= 2) { // HAVE_CURRENT_DATA
          playWhenReady();
        } else {
          audio.addEventListener('canplay', playWhenReady, { once: true });
        }
      }
    };

    const handleTrackEnd = () => {
      const nextIndex = (currentMusicIndex + 1) % musicTracks.length;
      setCurrentMusicIndex(nextIndex);
    };

    // Load initial track
    loadAndPlayTrack(currentMusicIndex);
    
    // Handle track end
    audio.addEventListener('ended', handleTrackEnd);

    return () => {
      audio.removeEventListener('ended', handleTrackEnd);
    };
  }, [currentMusicIndex, isMusicPlaying, musicTracks, audioInitialized]);

  // Handle play/pause state changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isMusicPlaying && audioInitialized) {
      if (audio.paused && audio.readyState >= 2) {
        audio.play().catch(err => {
          console.log('Audio play failed:', err.message);
        });
      }
    } else {
      if (!audio.paused) {
        audio.pause();
      }
    }
  }, [isMusicPlaying, audioInitialized]);

  // Auto-advance slideshow with location awareness
  useEffect(() => {
    if (isPlaying && totalPhotos > 1) {
      intervalRef.current = setInterval(() => {
        navigatePhoto(1);
      }, slideInterval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, slideInterval, totalPhotos, navigatePhoto]);

  // Show location title when entering new location group
  useEffect(() => {
    setShowLocationTitle(true);
    const timer = setTimeout(() => {
      setShowLocationTitle(false);
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [currentLocationGroupIndex]);

  // Device performance detection
  useEffect(() => {
    const detectSlowDevice = () => {
      // Check for slow device indicators
      const connection = (navigator as any).connection;
      const isSlowConnection = connection && connection.effectiveType && 
        ['slow-2g', '2g', '3g'].includes(connection.effectiveType);
      const deviceMemory = (navigator as any).deviceMemory;
      const isLowMemory = deviceMemory && deviceMemory < 4;
      const isSlowCPU = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
      
      // Additional check: if user agent suggests mobile device
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      return isSlowConnection || isLowMemory || isSlowCPU || (isMobile && window.innerWidth < 768);
    };
    
    setIsSlowDevice(detectSlowDevice());
  }, []);

  // Preload next images for smooth transitions
  useEffect(() => {
    if (isSlowDevice) return; // Skip preloading on slow devices
    
    const preloadImages = () => {
      const imagesToPreload: string[] = [];
      
      // Get next 2 images in sequence
      for (let i = 1; i <= 2; i++) {
        let nextGroupIndex = currentLocationGroupIndex;
        let nextPhotoIndex = currentPhotoInGroupIndex + i;
        
        // Handle group overflow
        while (nextPhotoIndex >= photosByLocation[nextGroupIndex]?.photos.length) {
          nextPhotoIndex -= photosByLocation[nextGroupIndex]?.photos.length || 0;
          nextGroupIndex = (nextGroupIndex + 1) % photosByLocation.length;
          if (nextGroupIndex === 0 && nextPhotoIndex === 0) break;
        }
        
        const nextPhoto = photosByLocation[nextGroupIndex]?.photos[nextPhotoIndex];
        if (nextPhoto && !preloadedImages.has(nextPhoto.url)) {
          imagesToPreload.push(nextPhoto.url);
        }
      }
      
      // Preload images
      imagesToPreload.forEach(url => {
        const img = new Image();
        img.src = url;
        img.onload = () => {
          setPreloadedImages(prev => new Set(prev).add(url));
        };
      });
    };
    
    const timeoutId = setTimeout(preloadImages, 500); // Delay to not interfere with current image
    return () => clearTimeout(timeoutId);
  }, [currentLocationGroupIndex, currentPhotoInGroupIndex, photosByLocation, preloadedImages, isSlowDevice]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          handleExit();
          break;
        case ' ':
          event.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          navigatePhoto(-1);
          break;
        case 'ArrowRight':
          navigatePhoto(1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [handleExit, navigatePhoto, togglePlayPause]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      if (pauseIndicatorTimeoutRef.current) {
        clearTimeout(pauseIndicatorTimeoutRef.current);
      }
    };
  }, []);

  if (!currentPhoto) {
    return (
      <div className="premium-view-empty">
        <div className="empty-message">
          <h2>No photos found</h2>
          <p>Please upload photos or select a different category</p>
          <button className="btn btn-primary" onClick={handleExit}>
            Exit Premium View
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="premium-view"
      style={{ cursor: showControls ? 'default' : 'none' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setShowControls(false)}
      onClick={handleScreenClick}
    >
      {/* Background Audio */}
      <audio ref={audioRef} />

      {/* Audio Start Hint */}
      <AnimatePresence>
        {!audioInitialized && (
          <motion.div
            className="audio-start-hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            <div className="hint-content">
              <span className="music-icon">🎵</span>
              <p>Click anywhere to start music</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Location Title Overlay */}
      <AnimatePresence>
        {showLocationTitle && currentLocationGroup && (
          <motion.div
            className="location-title-overlay"
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <div className="location-title">
              <h2>
                {loadingLocation ? 'Loading location...' : 
                 locationName || 
                 (currentLocationGroup.key === 'no-location' ? 'Other Photos' : 
                  `Location ${currentLocationGroupIndex + 1}`)}
              </h2>
              <p>{currentLocationGroup.photos.length} photos</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Photo Display */}
      <AnimatePresence>
        <motion.div
          key={currentPhoto.id}
          className="premium-photo-container"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: isSlowDevice ? 0.3 : 0.7, ease: "easeInOut" }}
        >
          <motion.img
            src={currentPhoto.url}
            alt={currentPhoto.originalName}
            className="premium-photo"
            loading="eager"
            decoding={isSlowDevice ? "sync" : "async"}
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 1 }}
            transition={{ duration: isSlowDevice ? 0.3 : 0.6 }}
            style={{
              willChange: isSlowDevice ? 'auto' : 'opacity',
              transform: 'translateZ(0)' // Force hardware acceleration
            }}
          />
          
          {/* Animated overlay effects */}
          <motion.div
            className="photo-overlay-effect"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2 }}
          />

          {/* Pause Indicator */}
          <AnimatePresence>
            {!isPlaying && showPauseIndicator && (
              <motion.div
                className="pause-indicator"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="pause-icon">⏸️</div>
                <div className="pause-text">Paused</div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      {/* Photo Information - Only show in edit mode */}
      {editMode && (
        <motion.div
          className="premium-photo-info"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: showControls ? 1 : 0, y: showControls ? 0 : 50 }}
          transition={{ duration: 0.3 }}
        >
          <h3>{currentPhoto.originalName}</h3>
          <p>{currentPhotoInGroupIndex + 1} of {currentLocationGroup?.photos.length || 0} in this location</p>
          <p className="overall-progress">{currentPhotoIndex + 1} of {totalPhotos} total</p>
          {currentPhoto.metadata?.dateTaken && (
            <p>📅 {new Date(currentPhoto.metadata.dateTaken).toLocaleDateString()}</p>
          )}
          {currentPhoto.metadata?.location && (
            <p>
              📍 {loadingLocation ? 'Loading location...' : 
                   locationName || 
                   `${currentPhoto.metadata.location.lat.toFixed(4)}, ${currentPhoto.metadata.location.lng.toFixed(4)}`}
            </p>
          )}
          {state.selectedCategory && (
            <p className="category-name">
              {state.categories.find(cat => cat.id === state.selectedCategory)?.name || 'Category'}
            </p>
          )}
        </motion.div>
      )}

      {/* Top Right Controls */}
      <motion.div
        className="premium-top-controls"
        initial={{ opacity: 0 }}
        animate={{ opacity: showControls ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      >
        <button
          className={`top-control-btn ${editMode ? 'active' : ''}`}
          onClick={() => setEditMode(!editMode)}
          title="Toggle edit mode"
        >
          ✏️
        </button>
        <button
          className="top-control-btn exit-btn-top"
          onClick={handleExit}
          title="Exit Premium View"
        >
          ✕
        </button>
      </motion.div>

      {/* Navigation Controls */}
      <motion.div
        className="premium-controls"
        initial={{ opacity: 0 }}
        animate={{ opacity: showControls ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Previous Button */}
        <button
          className="nav-btn nav-prev"
          onClick={() => navigatePhoto(-1)}
          disabled={totalPhotos <= 1}
        >
          ‹
        </button>

        {/* Next Button */}
        <button
          className="nav-btn nav-next"
          onClick={() => navigatePhoto(1)}
          disabled={totalPhotos <= 1}
        >
          ›
        </button>

        {/* Bottom Controls - Only show when edit mode is active */}
        {editMode && (
          <div className="bottom-controls">
            <div className="control-group">
              <button
                className="control-btn"
                onClick={togglePlayPause}
                title={isPlaying ? 'Pause slideshow' : 'Play slideshow'}
              >
                {isPlaying ? '⏸️' : '▶️'}
              </button>
              
              <select
                className="speed-control"
                value={slideInterval}
                onChange={(e) => setSlideInterval(Number(e.target.value))}
                title="Slideshow speed"
              >
                <option value={1000}>Fast (1s)</option>
                <option value={3000}>Normal (3s)</option>
                <option value={5000}>Slow (5s)</option>
                <option value={10000}>Very Slow (10s)</option>
              </select>

              <button
                className={`control-btn ${!isMusicPlaying ? 'muted' : ''}`}
                onClick={toggleMusic}
                title={isMusicPlaying ? 'Mute music' : 'Unmute music'}
              >
                {isMusicPlaying ? '🎵' : '🔇'}
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Progress Indicator - Only show when controls are visible */}
      <motion.div
        className="progress-indicator"
        initial={{ opacity: 0 }}
        animate={{ opacity: showControls ? 0.8 : 0.2 }}
        transition={{ duration: 0.3 }}
      >
        {photosByLocation.map((group, groupIndex) => (
          <div key={group.key} className="location-progress-group">
            {group.photos.map((_, photoIndex) => (
              <motion.div
                key={`${groupIndex}-${photoIndex}`}
                className={`progress-dot ${
                  groupIndex === currentLocationGroupIndex && photoIndex === currentPhotoInGroupIndex ? 'active' : ''
                } ${groupIndex === currentLocationGroupIndex ? 'current-location' : ''}`}
                onClick={() => {
                  setCurrentLocationGroupIndex(groupIndex);
                  setCurrentPhotoInGroupIndex(photoIndex);
                  // Update overall index
                  let totalIndex = 0;
                  for (let i = 0; i < groupIndex; i++) {
                    totalIndex += photosByLocation[i].photos.length;
                  }
                  totalIndex += photoIndex;
                  setCurrentPhotoIndex(totalIndex);
                }}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.8 }}
              />
            ))}
          </div>
        ))}
      </motion.div>

      {/* Animated background particles - reduced for slow devices */}
      {!isSlowDevice && (
        <div className="background-particles">
          {[...Array(isSlowDevice ? 8 : 20)].map((_, index) => (
            <motion.div
              key={index}
              className="particle"
              initial={{ 
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                opacity: 0
              }}
              animate={{
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                opacity: [0, 0.3, 0]
              }}
              transition={{
                duration: Math.random() * 15 + 10,
                repeat: Infinity,
                ease: "linear"
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PremiumView;