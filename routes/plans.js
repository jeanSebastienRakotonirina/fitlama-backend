router.post('/generate', authMiddleware(), async (req, res) => {
  const { type, profile } = req.body;

  // ── Validation ──────────────────────────────────────────────
  if (!['fitness', 'nutrition'].includes(type)) {
    return res.status(400).json({ message: 'Type de plan invalide' });
  }

  if (!profile?.age || !profile?.taille || !profile?.poids) {
    return res.status(400).json({ message: 'Profil incomplet' });
  }

  // Add more checks as needed...

  try {
    const planCount = await Plan.countDocuments({ userId: req.user.id });
    if (planCount >= 3) {
      return res.status(403).json({
        message: 'Vous avez déjà 3 plans. Abonnez-vous pour en créer davantage.'
      });
    }

    // ── Prompt building ─────────────────────────────────────────
    const prompt = type === 'fitness'
      ? `Générez un plan d'entraînement hebdomadaire (7 jours) pour une personne de ${profile.age} ans, ${profile.taille} cm, ${profile.poids} kg, objectif: ${profile.goal}, niveau: ${profile.level}. Fournissez UNIQUEMENT un objet JSON valide sans texte supplémentaire...`
      : `Générez un plan nutritionnel hebdomadaire ...`; // your existing prompt

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: process.env.OPENROUTER_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.25,           // ← lower = more deterministic JSON
        max_tokens: 2000
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // ── Robust JSON extraction ──────────────────────────────────
    let content = response.data.choices[0].message.content.trim();
    content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    const match = content.match(/\{[\s\S]*\}/);
    if (match) content = match[0];

    const planData = JSON.parse(content);

    // Optional: basic structural validation
    if (!planData?.jours?.length) {
      throw new Error('Structure JSON invalide');
    }

    const plan = new Plan({
      userId: req.user.id,
      type,
      profile,
      plan: planData,
      // createdAt: auto if timestamps: true
    });

    await plan.save();
    res.json(plan);
  } catch (err) {
    console.error('Erreur génération plan:', err);
    const status = err.response?.status || 500;
    res.status(status).json({
      message: status === 429 ? 'Limite de l’API atteinte' : 'Erreur lors de la génération',
      error: err.message
    });
  }
});
