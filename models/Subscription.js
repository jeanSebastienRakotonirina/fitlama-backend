const mongoose = require('mongoose');

/**
 * Enum values for subscription periods.
 * @readonly
 * @enum {string}
 */
const PERIODS = Object.freeze({
  WEEK: 'week',
  MONTH: 'month',
  YEAR: 'year',
});

/**
 * Enum values for subscription statuses.
 * @readonly
 * @enum {string}
 */
const STATUSES = Object.freeze({
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELED: 'canceled',
});

/**
 * Subscription schema definition.
 *
 * @typedef {Object} Subscription
 * @property {mongoose.Types.ObjectId} userId   Reference to the user owning the subscription.
 * @property {number}                amount   Monetary amount of the subscription (>= 0).
 * @property {string}                period   Billing period – one of 'week', 'month', 'year'.
 * @property {Date}                  startDate Date when the subscription starts (defaults to now).
 * @property {Date}                  endDate   Date when the subscription ends.
 * @property {string}                orderID   Unique identifier for the related order.
 * @property {string}                status   Current status – 'active', 'expired' or 'canceled'.
 */
const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
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
      enum: Object.values(PERIODS),
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
      enum: Object.values(STATUSES),
      default: STATUSES.ACTIVE,
    },
  },
  {
    timestamps: true, // automatically adds createdAt and updatedAt fields
  }
);

/**
 * Compound index to quickly locate active subscriptions for a given user.
 * The index includes `userId` (first) to support queries filtered by user,
 * followed by `endDate` to allow range scans on expiration.
 */
subscriptionSchema.index({ userId: 1, endDate: 1 });

/**
 * Virtual property `isActive`.
 *
 * Returns `true` when the subscription status is 'active' and the current
 * date is before the `endDate`. This does not modify the document.
 */
subscriptionSchema.virtual('isActive').get(function () {
  return this.status === STATUSES.ACTIVE && this.endDate > new Date();
});

/**
 * Export the Mongoose model.
 *
 * @type {mongoose.Model<Subscription>}
 */
module.exports = mongoose.model('Subscription', subscriptionSchema);