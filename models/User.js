const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * @typedef {Object} UserDocument
 * @property {string} email - Unique email address of the user.
 * @property {string} password - Hashed password (not selected by default).
 * @property {string} role - User role, either 'user' or 'admin'.
 * @property {Date} createdAt - Timestamp of creation (managed by Mongoose).
 * @property {Date} updatedAt - Timestamp of last update (managed by Mongoose).
 * @property {function(string):Promise<boolean>} comparePassword - Compare a plain password with the stored hash.
 */

/**
 * Mongoose schema for a user.
 * Includes:
 *  - Email validation.
 *  - Password hashing before save.
 *  - Role enumeration.
 *  - Automatic timestamps.
 *  - Password exclusion from query results.
 */
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        // Simple email regex; adjust as needed for stricter validation.
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address.',
      ],
    },
    password: {
      type: String,
      required: true,
      select: false, // Exclude password from query results by default.
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields automatically.
  }
);

/**
 * Pre‑save hook to hash the password when it is created or modified.
 * Errors are passed to the next middleware to avoid unhandled rejections.
 */
userSchema.pre('save', async function (next) {
  try {
    if (this.isModified('password')) {
      const SALT_ROUNDS = 10;
      this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
    }
    next();
  } catch (err) {
    next(err);
  }
});

/**
 * Instance method to compare a plain‑text password with the stored hash.
 *
 * @param {string} candidatePassword - The password to verify.
 * @returns {Promise<boolean>} Resolves to true if the passwords match.
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  // `this.password` is not selected by default; ensure it is available when called.
  const hash = this.password;
  if (!hash) {
    return false;
  }
  return bcrypt.compare(candidatePassword, hash);
};

/**
 * Transform the output of toJSON / toObject to remove sensitive fields.
 */
function removeSensitiveInfo(doc, ret) {
  delete ret.password;
  return ret;
}

userSchema.set('toJSON', { transform: removeSensitiveInfo });
userSchema.set('toObject', { transform: removeSensitiveInfo });

module.exports = mongoose.model('User', userSchema);