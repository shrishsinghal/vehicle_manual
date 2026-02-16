// netlify/functions/test-hf.js
exports.handler = async () => {
  const HF_TOKEN = process.env.HF_API_KEY;
  
  console.log('Token exists:', !!HF_TOKEN);
  console.log('Token length:', HF_TOKEN?.length);
  
  try {
    const response = await fetch(
      'https://router.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',  // FIXED URL
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: "test query",
          options: {
            wait_for_model: true
          }
        })
      }
    );
    
    console.log('Status:', response.status);
    
    const result = await response.text();
    console.log('Result:', result);
    
    let parsedResult;
    try {
      parsedResult = JSON.parse(result);
    } catch (e) {
      parsedResult = result;
    }
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: response.status,
        success: response.ok,
        embedding_length: Array.isArray(parsedResult) ? parsedResult[0]?.length : parsedResult?.length || 'unknown'
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