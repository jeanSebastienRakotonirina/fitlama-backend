const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subscriptionId: { type: String, required: true, unique: true },
  plan: { type: String, enum: ['basic', 'premium'], required: true },
  isActive: { type: Boolean, default: false }
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
