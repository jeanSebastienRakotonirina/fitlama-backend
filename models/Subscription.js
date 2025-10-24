const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  period: {
    type: String,
    enum: ['week', 'month', 'year'],
    required: true
  },
  startDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  orderID: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'canceled'],
    default: 'active'
  }
}, {
  timestamps: true // createdAt, updatedAt
});

// Index pour vérifier rapidement les abonnements actifs
subscriptionSchema.index({ userId: 1, endDate: 1 });

// Méthode virtuelle : abonnement actif ?
subscriptionSchema.virtual('isActive').get(function() {
  return this.status === 'active' && this.endDate > new Date();
});

module.exports = mongoose.model('Subscription', subscriptionSchema);