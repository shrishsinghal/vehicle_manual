// netlify/functions/chat.js
const manualData = require('./manual_data.json');

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  
  try {
    const { question } = JSON.parse(event.body);

    // --- STEP 1: HUGGING FACE (384D EMBEDDING) ---
    const hfResponse = await fetch(
      'https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction',
      {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${process.env.HF_API_KEY}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ inputs: [question] })
      }
    );

    const hfData = await hfResponse.json();
    // HF returns [[...]] for batched inputs
    const queryEmbedding = Array.isArray(hfData[0]) ? hfData[0] : hfData;

    if (!queryEmbedding || queryEmbedding.length !== 384) {
      throw new Error("Invalid embedding returned from HF");
    }

    // --- STEP 2: VECTOR SEARCH ---
    const chunks = manualData.chunks.map(chunk => ({
      ...chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding)
    })).sort((a, b) => b.score - a.score).slice(0, 3);
    
    // --- STEP 3: GROQ CHAT ---
    const context = chunks.map(c => `[Page ${c.page}] ${c.text}`).join('\n\n');
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', 
            content: 'You are the Boson Motors Technical Assistant. \
            Use the provided manual context to answer clearly. Use Markdown for formatting: \
            - Use bullet points for steps or lists. \
            - Use bold for technical terms. \
            - Separate paragraphs with double newlines. \
            Always cite the [Page X] at the end of relevant sentences.' },
          { role: 'user', content: `Context:\n${context}\n\nQuestion: ${question}` }
        ]
      })
    });


    const groqData = await groqResponse.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        answer: groqData.choices[0].message.content,
        sources: chunks.map(c => ({ page: c.page }))
      })
    };

  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};