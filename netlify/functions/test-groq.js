// netlify/functions/test-groq.js
exports.handler = async () => {
  const apiKey = process.env.GROQ_API_KEY;
  
  console.log('API Key exists:', !!apiKey);
  console.log('API Key length:', apiKey?.length);
  console.log('API Key starts with:', apiKey?.substring(0, 10));
  
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'No API key found' })
    };
  }
  
  try {
    // Test with minimal request
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',  // Using smaller model
        messages: [
          { role: 'user', content: 'Say hello' }
        ],
        max_tokens: 10
      })
    });
    
    console.log('Response status:', response.status);
    
    const responseText = await response.text();
    console.log('Response body:', responseText);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: response.status,
        response: JSON.parse(responseText)
      }, null, 2)
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};