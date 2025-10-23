import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin', 'superadmin'], default: 'user' },
  subscription: {
    plan: { type: String, enum: ['none', 'basic', 'premium'], default: 'none' },
    isActive: { type: Boolean, default: false }
  },
  createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', userSchema);