import express from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  loginUser,
  getCurrentUser,
  logoutUser
} from '../controllers/userController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Authentication routes (public)
// POST /api/users/login - Login user
router.post('/login', loginUser);

// POST /api/users/logout - Logout user
router.post('/logout', logoutUser);

// POST /api/users - Create new user (signup)
router.post('/', createUser);

// Protected route - requires authentication
// GET /api/users/me - Get current authenticated user
router.get('/me', auth, getCurrentUser);

// User management routes
// GET /api/users - Get all users
router.get('/', getUsers);

// GET /api/users/:id - Get user by ID
router.get('/:id', getUserById);

// PUT /api/users/:id - Update user
router.put('/:id', updateUser);

// DELETE /api/users/:id - Delete user
router.delete('/:id', deleteUser);

export default router;

