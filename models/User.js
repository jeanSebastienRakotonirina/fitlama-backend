const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { Schema } = mongoose;

/**
 * User schema definition.
 * - email: unique identifier, required and validated with a simple regex.
 * - password: hashed before saving.
 * - role: defines access level, defaults to 'user'.
 * - timestamps: automatically adds `createdAt` and `updatedAt`.
 */
const userSchema = new Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        // Basic email validation pattern
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
  },
  {
    timestamps: true, // adds createdAt and updatedAt fields
    toJSON: {
      /**
       * Remove sensitive fields when converting documents to JSON.
       */
      transform(doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

/**
 * Pre-save hook to hash the password if it has been modified.
 */
userSchema.pre('save', async function (next) {
  try {
    if (this.isModified('password')) {
      // bcrypt salt rounds set to 10 (reasonable default)
      this.password = await bcrypt.hash(this.password, 10);
    }
    next();
  } catch (err) {
    next(err);
  }
});

/**
 * Instance method to compare a plain‑text password with the stored hash.
 *
 * @param {string} candidatePassword - Password supplied by the user.
 * @returns {Promise<boolean>} Result of bcrypt comparison.
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);