const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * @typedef {Object} UserDocument
 * @property {string} email - Unique email address of the user.
 * @property {string} password - Hashed password.
 * @property {('user'|'admin')} role - Role of the user.
 * @property {Date} createdAt - Timestamp of creation.
 */

/**
 * Mongoose schema definition for a User.
 * Includes basic validation and a pre‑save hook to hash passwords.
 */
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        // Simple email regex; adjust as needed for stricter validation.
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address',
      ],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // Ensure virtuals are included when converting documents to JSON.
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const SALT_ROUNDS = 10;

/**
 * Pre‑save middleware to hash the password if it has been modified.
 *
 * @param {function} next - Callback to continue the middleware chain.
 */
userSchema.pre('save', async function (next) {
  try {
    if (this.isModified('password')) {
      this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
    }
    next();
  } catch (err) {
    // Propagate hashing errors to Mongoose.
    next(err);
  }
});

/**
 * Compare a plain‑text password with the stored hashed password.
 *
 * @param {string} candidatePassword - Password supplied for authentication.
 * @returns {Promise<boolean>} Resolves to true if passwords match.
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);