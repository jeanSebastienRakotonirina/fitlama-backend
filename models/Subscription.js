'use strict';

const { Schema, model } = require('mongoose');

/**
 * Subscription schema definition.
 *
 * @typedef {Object} Subscription
 * @property {ObjectId} userId   Reference to the user owning the subscription.
 * @property {number}   amount   Monetary amount of the subscription (must be >= 0).
 * @property {string}   period   Billing period – one of 'week', 'month', 'year'.
 * @property {Date}     startDate Date when the subscription starts (defaults to now).
 * @property {Date}     endDate   Date when the subscription ends.
 * @property {string}   orderID   Unique identifier for the related order.
 * @property {string}   status    Current status – 'active', 'expired' or 'canceled'.
 * @property {Date}     createdAt Timestamp of creation (managed by Mongoose).
 * @property {Date}     updatedAt Timestamp of last update (managed by Mongoose).
 */
const SubscriptionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    period: {
      type: String,
      enum: ['week', 'month', 'year'],
      required: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    orderID: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'canceled'],
      default: 'active',
    },
  },
  {
    timestamps: true, // automatically adds createdAt and updatedAt fields
  }
);

/**
 * Composite index to quickly locate active subscriptions for a user.
 * The index is on `userId` and `endDate` to support queries that filter by user
 * and check whether the subscription has not yet expired.
 */
SubscriptionSchema.index({ userId: 1, endDate: 1 });

/**
 * Virtual property `isActive`.
 *
 * Returns `true` when the subscription status is 'active' **and**
 * the `endDate` lies in the future.
 *
 * @returns {boolean}
 */
SubscriptionSchema.virtual('isActive').get(function () {
  return this.status === 'active' && this.endDate > new Date();
});

/**
 * Export the Mongoose model.
 *
 * @type {import('mongoose').Model<Subscription>}
 */
module.exports = model('Subscription', SubscriptionSchema);