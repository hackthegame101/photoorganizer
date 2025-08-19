# Photo Organizer

A sophisticated, modern React photo organizer application with Firebase backend, featuring comprehensive photo management, categorization, and advanced viewing capabilities.

## Features

### Core Functionality
- **Photo Upload & Management**
  - Drag and drop upload with visual feedback
  - Support for all image formats (HEIC, JPEG, PNG, GIF, WEBP, BMP, TIFF)
  - Bulk upload with progress indicators
  - Auto-rotation based on EXIF data
  - Duplicate detection and handling

- **Category System**
  - Create, edit, and delete custom categories
  - Drag and drop photos between categories
  - Category color coding and custom icons
  - Smart auto-categorization suggestions
  - Category-based photo counts and statistics

- **Dual View Modes**
  - **Edit Mode**: Full management interface with categories and bulk operations
  - **Preview Mode**: Clean, gallery-focused view for browsing
  - **Album Mode**: Traditional photo album layout with page-turning effects

### Advanced Features
- **Search & Organization**
  - Advanced search by filename, date, category, metadata
  - Filter by date ranges, file types, dimensions
  - Smart collections (Recent, Favorites, Large files)
  - Tag system with auto-suggestions

- **Download & Print Features**
  - Individual photo downloads in original quality
  - Bulk category downloads as ZIP files
  - Print-ready sizing for standard dimensions
  - DPI optimization (300 DPI for print, 72 DPI for web)

- **User Interface**
  - Modern, responsive design with dark/light theme toggle
  - Smooth animations and micro-interactions
  - Mobile-optimized touch gestures
  - Keyboard shortcuts for power users

## Tech Stack

- **Frontend**: React 18+ with TypeScript
- **Backend**: Firebase (Firestore, Storage, Authentication)
- **Styling**: CSS Custom Properties with CSS-in-JS
- **Animation**: Framer Motion
- **Image Processing**: HEIC2ANY, Canvas API
- **File Handling**: React Dropzone, JSZip
- **State Management**: React Context + useReducer

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
cd photo-organizer
npm install
```

### 2. Firebase Setup

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)

2. Enable the following services:
   - **Authentication** (Email/Password and Google Sign-in)
   - **Firestore Database**
   - **Storage**

3. Get your Firebase configuration from Project Settings > General > Your apps

4. Update the Firebase configuration in `src/firebase/config.ts`:

```typescript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};
```

### 3. Firestore Security Rules

Set up the  security rules in Firestore:


### 4. Storage Security Rules

Set up the  security rules in Storage:

### 5. Authentication Setup

1. In Firebase Console, go to Authentication > Sign-in method
2. Enable Email/Password authentication
3. Enable Google authentication (optional)
4. Add your domain to authorized domains if deploying

### 6. Start Development Server

```bash
npm start
```

The application will open at `http://localhost:3000`

## Project Structure

```
src/
├── components/
│   ├── Auth/
│   │   └── Login.tsx
│   ├── Layout/
│   │   ├── Header.tsx
│   │   └── Sidebar.tsx
│   ├── Photos/
│   │   ├── PhotoCard.tsx
│   │   ├── PhotoGrid.tsx
│   │   └── PhotoModal.tsx
│   ├── Search/
│   │   └── SearchBar.tsx
│   └── Upload/
│       └── PhotoUpload.tsx
├── contexts/
│   ├── AuthContext.tsx
│   └── PhotoContext.tsx
├── firebase/
│   ├── auth.ts
│   ├── config.ts
│   ├── firestore.ts
│   └── storage.ts
├── styles/
│   └── globals.css
├── utils/
│   ├── downloadUtils.ts
│   └── imageProcessing.ts
├── App.tsx
└── index.tsx
```

## Available Scripts

- `npm start` - Runs the development server
- `npm build` - Builds the app for production
- `npm test` - Runs the test suite
- `npm run eject` - Ejects from Create React App (not recommended)

## Features Implementation Status

✅ **Completed**
- React project setup with TypeScript
- Firebase configuration and authentication
- Core project structure and components
- Photo upload with drag/drop and HEIC support
- Photo grid with multiple view modes
- Photo modal with zoom and navigation
- Search functionality
- Dark/light theme support
- Responsive design

🚧 **In Progress**
- Category management system
- Album view with themes
- Advanced search and filtering
- Download and print features

📋 **Planned**
- Bulk operations
- Tag management
- Advanced photo editing
- Sharing capabilities
- PWA functionality

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
