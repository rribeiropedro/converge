import User from '../models/User.js';
import jwt from 'jsonwebtoken';

// Helper function to generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'nexhacks-secret-key',
    { expiresIn: '7d' } // 7 days for hackathon
  );
};

// Helper function to set auth cookie
const setAuthCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  });
};

// Get all users
export const getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password -__v');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get user by ID
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -__v');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create new user (signup with auto-login)
export const createUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const user = new User({ email, password });
    await user.save(); // Password will be hashed by pre-save hook
    
    // Generate JWT token
    const token = generateToken(user._id);
    
    // Set httpOnly cookie
    setAuthCookie(res, token);
    
    res.status(201).json({ 
      user: {
        id: user._id,
        email: user.email,
        createdAt: user.createdAt
      },
      token // Still send token for localStorage fallback
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update user
export const updateUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user first
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update fields
    if (email) {
      user.email = email;
    }
    
    if (password) {
      // Validate password length
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      user.password = password; // Will be hashed by pre-save hook
    }
    
    await user.save();
    
    // Return user without password
    res.json({
      id: user._id,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Login user (email and password authentication)
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Generate JWT token
    const token = generateToken(user._id);
    
    // Set httpOnly cookie
    setAuthCookie(res, token);
    
    res.json({ 
      user: {
        id: user._id,
        email: user.email,
        createdAt: user.createdAt
      },
      token // Still send token for localStorage fallback
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get current authenticated user
export const getCurrentUser = async (req, res) => {
  try {
    // req.user is already attached by auth middleware
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    res.json({ 
      user: {
        id: req.user._id,
        email: req.user.email,
        createdAt: req.user.createdAt,
        updatedAt: req.user.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Logout user (clear httpOnly cookie)
export const logoutUser = async (req, res) => {
  try {
    // Clear the httpOnly cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

