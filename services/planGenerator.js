export function generateFitnessPlan(profile) {
  console.log('generateFitnessPlan: Generating fitness plan', { profile });
  return {
    jours: [
      {
        exercices: [
          { nom: 'Squats', series: 3, repetitions: 12 },
          { nom: 'Pompes', series: 3, repetitions: 10 }
        ]
      },
      {
        exercices: [
          { nom: 'Fentes', series: 3, repetitions: 12 },
          { nom: 'Tractions', series: 3, repetitions: 8 }
        ]
      }
    ]
  };
}

export function generateNutritionPlan(profile) {
  console.log('generateNutritionPlan: Generating nutrition plan', { profile });
  return {
    jours: [
      {
        repas: [
          { type: 'Petit-déjeuner', description: 'Avoine avec fruits' },
          { type: 'Déjeuner', description: 'Salade de poulet' }
        ]
      },
      {
        repas: [
          { type: 'Petit-déjeuner', description: 'Smoothie protéiné' },
          { type: 'Déjeuner', description: 'Quinoa avec légumes' }
        ]
      }
    ]
  };
}