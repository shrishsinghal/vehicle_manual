// netlify/functions/chat.js

let manualData;
try {
  manualData = require('./manual_data.json');
  console.log('✅ Loaded', manualData.chunks?.length, 'chunks');
} catch (e) {
  console.error('❌ Failed to load data:', e.message);
}

function searchChunks(query, topK = 3) {
  if (!manualData?.chunks) return [];
  
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3);
  
  const scored = manualData.chunks.map(chunk => {
    const text = chunk.text.toLowerCase();
    let score = 0;
    
    queryWords.forEach(word => {
      const matches = (text.match(new RegExp(word, 'g')) || []).length;
      score += matches;
    });
    
    return { ...chunk, score };
  });
  
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).filter(c => c.score > 0);
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
    console.log('Question:', question);
    
    if (!question) {
      throw new Error('No question provided');
    }
    
    if (!manualData) {
      throw new Error('Manual data not loaded');
    }
    
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY not set');
    }
    
    // Search
    const chunks = searchChunks(question, 3);
    console.log('Found chunks:', chunks.length);
    
    if (chunks.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          answer: "I couldn't find relevant information. Try rephrasing your question.",
          sources: []
        })
      };
    }
    
    // Build context (LIMIT LENGTH!)
    const context = chunks
      .map(c => `[Page ${c.page}] ${c.text.substring(0, 500)}`)  // Limit each chunk
      .join('\n\n')
      .substring(0, 3000);  // Max 3000 chars total
    
    console.log('Context length:', context.length);
    
    // Call Groq with SMALLER model and SHORTER context
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',  // Smaller, faster model
        messages: [
          {
            role: 'system',
            content: 'Answer based on the manual context. Cite page numbers. Be concise.'
          },
          {
            role: 'user',
            content: `Context:\n${context}\n\nQ: ${question}`
          }
        ],
        temperature: 0.3,
        max_tokens: 300  // Shorter response
      })
    });
    
    console.log('Groq status:', groqResponse.status);
    
    if (!groqResponse.ok) {
      const errorBody = await groqResponse.text();
      console.error('Groq error body:', errorBody);
      throw new Error(`Groq returned ${groqResponse.status}: ${errorBody}`);
    }
    
    const groqData = await groqResponse.json();
    const answer = groqData.choices[0].message.content;
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        answer,
        sources: chunks.map(c => ({ page: c.page, score: c.score }))
      })
    };
    
  } catch (error) {
    console.error('ERROR:', error.message);
    console.error('Stack:', error.stack);
    
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