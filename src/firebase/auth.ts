import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { auth } from './config';

const getAuthErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case 'auth/user-not-found':
      return 'No account found with this email address.';
    case 'auth/wrong-password':
      return 'Incorrect password.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email address.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/operation-not-allowed':
      return 'Email/password authentication is not enabled. Please contact support.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    default:
      return `Authentication error: ${errorCode}`;
  }
};

export const createUser = async (email: string, password: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('User created successfully:', userCredential.user.email);
    return userCredential;
  } catch (error: any) {
    console.error('Create user error:', error.code, error.message);
    throw new Error(getAuthErrorMessage(error.code));
  }
};

export const signInUser = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('User signed in successfully:', userCredential.user.email);
    return userCredential;
  } catch (error: any) {
    console.error('Sign in error:', error.code, error.message);
    throw new Error(getAuthErrorMessage(error.code));
  }
};

export const signInWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    console.log('Google sign in successful:', userCredential.user.email);
    return userCredential;
  } catch (error: any) {
    console.error('Google sign in error:', error.code, error.message);
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in cancelled.');
    }
    throw new Error(getAuthErrorMessage(error.code));
  }
};

export const signOutUser = async () => {
  return await signOut(auth);
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};