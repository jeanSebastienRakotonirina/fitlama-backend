'use strict';

const mongoose = require('mongoose');

/**
 * Subscription schema definition.
 *
 * Represents a recurring payment subscription for a user.
 */
const subscriptionSchema = new mongoose.Schema(
  {
    /**
     * Reference to the user owning the subscription.
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    /**
     * Monetary amount of the subscription (positive number).
     */
    amount: {
      type: Number,
      required: true,
      min: [0, 'Amount must be a positive number'],
    },

    /**
     * Billing period. Allowed values: week, month, year.
     */
    period: {
      type: String,
      enum: ['week', 'month', 'year'],
      required: true,
    },

    /**
     * Date when the subscription starts.
     * Defaults to the moment of document creation.
     */
    startDate: {
      type: Date,
      default: Date.now,
      required: true,
    },

    /**
     * Date when the subscription ends.
     * Must be provided explicitly to avoid indefinite subscriptions.
     */
    endDate: {
      type: Date,
      required: true,
    },

    /**
     * Unique identifier of the related order (e.g., from a payment provider).
     */
    orderID: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    /**
     * Current status of the subscription.
     * Defaults to 'active' when created.
     */
    status: {
      type: String,
      enum: ['active', 'expired', 'canceled'],
      default: 'active',
    },
  },
  {
    // Automatically adds `createdAt` and `updatedAt` fields.
    timestamps: true,
  }
);

/**
 * Compound index to quickly locate active subscriptions for a user.
 * The `endDate` field is included to allow range queries.
 */
subscriptionSchema.index({ userId: 1, endDate: 1 });

/**
 * Virtual property `isActive`.
 *
 * Returns `true` when the subscription status is 'active' and the
 * `endDate` lies in the future.
 */
subscriptionSchema.virtual('isActive').get(function () {
  return this.status === 'active' && this.endDate > new Date();
});

/**
 * Export the Mongoose model.
 *
 * @type {mongoose.Model}
 */
module.exports = mongoose.model('Subscription', subscriptionSchema);