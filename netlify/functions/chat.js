// netlify/functions/chat.js

const manualData = require('./manual_data.json');

// Cosine similarity
function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Get query embedding from HuggingFace (FREE!)
async function getQueryEmbedding(query) {
  const HF_API_KEY = process.env.HF_API_KEY || 'hf_'; // Optional, works without
  
  const response = await fetch(
    'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: query,
        options: { wait_for_model: true }
      })
    }
  );
  
  if (!response.ok) {
    throw new Error(`HF API error: ${response.status}`);
  }
  
  const embedding = await response.json();
  return embedding;
}

// Vector search
async function vectorSearch(query, topK = 3) {
  console.log('🔍 Getting query embedding...');
  const queryEmbedding = await getQueryEmbedding(query);
  
  console.log('📊 Computing similarities...');
  const scored = manualData.chunks.map(chunk => ({
    ...chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding)
  }));
  
  scored.sort((a, b) => b.score - a.score);
  
  const results = scored.slice(0, topK);
  console.log('✅ Top results:', results.map(r => ({ 
    page: r.page, 
    score: r.score.toFixed(3) 
  })));
  
  return results;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  try {
    const { question } = JSON.parse(event.body);
    console.log('❓ Question:', question);
    
    if (!question) {
      throw new Error('No question provided');
    }
    
    // Vector search
    const chunks = await vectorSearch(question, 3);
    
    // Build context
    const context = chunks
      .map(c => `[Page ${c.page}]\n${c.text}`)
      .join('\n\n---\n\n')
      .substring(0, 4000);  // Keep it reasonable
    
    console.log('📝 Context length:', context.length);
    
    // Call Groq
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful Boson Motors vehicle assistant. Answer questions based ONLY on the provided manual excerpts. Always cite page numbers. Be concise and helpful.'
          },
          {
            role: 'user',
            content: `Manual context:\n${context}\n\nQuestion: ${question}`
          }
        ],
        temperature: 0.3,
        max_tokens: 400
      })
    });
    
    if (!groqResponse.ok) {
      const errorBody = await groqResponse.text();
      console.error('Groq error:', errorBody);
      throw new Error(`Groq error: ${groqResponse.status}`);
    }
    
    const groqData = await groqResponse.json();
    const answer = groqData.choices[0].message.content;
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        answer,
        sources: chunks.map(c => ({ 
          page: c.page, 
          score: parseFloat(c.score.toFixed(3))
        }))
      })
    };
    
  } catch (error) {
    console.error('💥 ERROR:', error.message);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message,
        answer: `Sorry, something went wrong: ${error.message}`
      })
    };
  }
};