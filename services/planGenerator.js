export function generateFitnessPlan(profile) {
  return {
    jours: [
      { description: `Day 1: Cardio - Run for ${profile.level === 'beginner' ? 20 : 30} minutes` },
      { description: `Day 2: Strength - ${profile.goal === 'weight loss' ? 'Bodyweight circuits' : 'Weight lifting'}` },
      { description: 'Day 3: Rest' }
    ]
  };
}

export function generateNutritionPlan(profile) {
  return {
    jours: [
      { description: `Day 1: ${profile.dietary_preference || 'Balanced'} breakfast - Oatmeal with fruits` },
      { description: `Day 2: Lunch - ${profile.dietary_preference || 'Balanced'} salad with protein` },
      { description: 'Day 3: Dinner - Grilled vegetables and lean meat' }
    ]
  };
}