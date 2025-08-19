import React, { useState } from 'react';
import { usePhoto } from '../../contexts/PhotoContext';
import { useAuth } from '../../contexts/AuthContext';
import { Category, createCategory, deleteCategoryAndPhotos } from '../../firebase/firestore';
import { deletePhoto as deletePhotoFromStorage } from '../../firebase/storage';

const Sidebar: React.FC = () => {
  const { state, dispatch } = usePhoto();
  const { user } = useAuth();
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#007AFF');
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);

  const handleCategorySelect = (categoryId: string | null) => {
    dispatch({ type: 'SET_SELECTED_CATEGORY', payload: categoryId });
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Creating category...', { newCategoryName, newCategoryColor, user: user?.uid });
    
    if (!newCategoryName.trim()) {
      console.log('Category name is empty');
      return;
    }
    
    if (!user?.uid) {
      console.error('No user logged in');
      return;
    }

    try {
      const categoryData = {
        name: newCategoryName.trim(),
        color: newCategoryColor,
        userId: user.uid
      };
      
      console.log('Calling createCategory with:', categoryData);
      const categoryId = await createCategory(categoryData);
      console.log('Category created with ID:', categoryId);
      
      dispatch({
        type: 'ADD_CATEGORY',
        payload: { id: categoryId, ...categoryData, createdAt: new Date(), photoCount: 0 }
      });
      console.log('Category added to state');
      
      setNewCategoryName('');
      setNewCategoryColor('#007AFF');
      setShowCategoryForm(false);
    } catch (error) {
      console.error('Error creating category:', error);
      alert('Failed to create category: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const getCategoryPhotoCount = (categoryId: string) => {
    const count = state.photos.filter(photo => photo.categoryId === categoryId).length;
    console.log(`Category ${categoryId} has ${count} photos`);
    return count;
  };

  const handleDeleteCategory = async (category: Category, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent category selection
    
    if (!user?.uid) return;
    
    const photoCount = getCategoryPhotoCount(category.id!);
    const confirmMessage = photoCount > 0 
      ? `Are you sure you want to delete "${category.name}" and all ${photoCount} photos in it? This action cannot be undone.`
      : `Are you sure you want to delete "${category.name}"?`;
    
    const confirmDelete = window.confirm(confirmMessage);
    if (!confirmDelete) return;
    
    setDeletingCategory(category.id!);
    
    try {
      // Get photos in this category for storage cleanup
      const photosInCategory = state.photos.filter(photo => photo.categoryId === category.id);
      
      // Delete category and all photos in it from Firestore first
      await deleteCategoryAndPhotos(category.id!, user.uid);
      
      // Delete photos from storage (handle missing files gracefully)
      for (const photo of photosInCategory) {
        try {
          await deletePhotoFromStorage(user.uid, photo.filename);
        } catch (error: any) {
          if (error?.code !== 'storage/object-not-found') {
            console.error(`Error deleting storage file ${photo.filename}:`, error);
          }
        }
      }
      
      // Clear selection if this category was selected
      if (state.selectedCategory === category.id) {
        dispatch({ type: 'SET_SELECTED_CATEGORY', payload: null });
      }
      
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Failed to delete category. Please try again.');
    } finally {
      setDeletingCategory(null);
    }
  };

  const colors = [
    '#007AFF', '#5856D6', '#AF52DE', '#FF2D92',
    '#FF3B30', '#FF9500', '#FFCC02', '#34C759',
    '#00C7BE', '#32ADE6'
  ];

  return (
    <aside className={`sidebar ${state.isMobileMenuOpen ? 'open' : ''}`}>
      <div className="p-lg">
        <div className="mb-lg">
          <div className="flex items-center justify-between mb-md">
            <h2 className="text-lg font-bold">Categories</h2>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowCategoryForm(!showCategoryForm)}
            >
              + Add
            </button>
          </div>
          
          {showCategoryForm && (
            <form onSubmit={handleCreateCategory} className="mb-md">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Category name"
                className="w-full p-sm border border-gray-300 rounded mb-sm"
                autoFocus
              />
              <div className="flex gap-sm mb-sm">
                {colors.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`w-6 h-6 rounded-full border-2 ${
                      newCategoryColor === color ? 'border-black' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewCategoryColor(color)}
                  />
                ))}
              </div>
              <div className="flex gap-sm">
                <button type="submit" className="btn btn-primary btn-sm">
                  Create
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowCategoryForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="category-list">
          <button
            className={`category-item ${
              state.selectedCategory === null ? 'active' : ''
            }`}
            onClick={() => handleCategorySelect(null)}
          >
            <div className="flex items-center gap-sm">
              <div className="category-color" style={{ backgroundColor: '#8E8E93' }} />
              <span>All Photos</span>
            </div>
            <span className="count">{state.photos.length}</span>
          </button>

          {state.categories.map((category) => (
            <div
              key={category.id}
              className={`category-item-wrapper ${
                state.selectedCategory === category.id ? 'active' : ''
              }`}
            >
              <button
                className="category-item"
                onClick={() => handleCategorySelect(category.id!)}
              >
                <div className="flex items-center gap-sm">
                  <div 
                    className="category-color" 
                    style={{ backgroundColor: category.color }} 
                  />
                  <span>{category.name}</span>
                </div>
                <span className="count">{getCategoryPhotoCount(category.id!)}</span>
              </button>
              <button
                className="category-delete-btn"
                onClick={(e) => handleDeleteCategory(category, e)}
                disabled={deletingCategory === category.id}
                title="Delete category"
              >
                {deletingCategory === category.id ? '⏳' : '🗑️'}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-lg">
          <h3 className="text-md font-medium mb-md">Smart Collections</h3>
          <div className="smart-collections">
            <button className="category-item">
              <div className="flex items-center gap-sm">
                <span>📸</span>
                <span>Recent</span>
              </div>
              <span className="count">
                {state.photos.filter(p => {
                  const date = new Date(p.createdAt?.toDate?.() || p.createdAt);
                  const weekAgo = new Date();
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  return date > weekAgo;
                }).length}
              </span>
            </button>
            
            <button className="category-item">
              <div className="flex items-center gap-sm">
                <span>⭐</span>
                <span>Favorites</span>
              </div>
              <span className="count">
                {state.photos.filter(p => p.tags.includes('favorite')).length}
              </span>
            </button>
            
            <button className="category-item">
              <div className="flex items-center gap-sm">
                <span>📏</span>
                <span>Large Files</span>
              </div>
              <span className="count">
                {state.photos.filter(p => p.metadata.size > 5 * 1024 * 1024).length}
              </span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;