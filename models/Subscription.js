import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subscriptionId: { type: String, required: true },
  plan: { type: String, enum: ['basic', 'premium'], required: true },
  isActive: { type: Boolean, default: true }
});

export const Subscription = mongoose.model('Subscription', subscriptionSchema);