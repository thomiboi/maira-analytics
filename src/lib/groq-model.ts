/** Modelo de Groq usado por los endpoints de análisis con IA. */
export const GROQ_MODEL = process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-20b';
