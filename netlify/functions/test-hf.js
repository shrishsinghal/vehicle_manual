// netlify/functions/test-hf.js
exports.handler = async () => {
  const HF_TOKEN = process.env.HF_API_KEY;
  
  const MODEL_ID = 'sentence-transformers/all-MiniLM-L6-v2';
  const API_URL = `https://router.huggingface.co/hf-inference/models/${MODEL_ID}`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: ["test query"],  // ARRAY format for feature extraction
        options: { 
          wait_for_model: true,
          use_cache: false
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        statusCode: response.status,
        body: JSON.stringify({ 
          error: "HF API Error", 
          status: response.status,
          details: errorText 
        })
      };
    }

    const result = await response.json();
    
    // Result is [[embedding]] - array of arrays
    const embedding = result[0];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 200,
        success: true,
        embedding_length: embedding.length,
        sample: embedding.slice(0, 5)
      }, null, 2)
    };
    
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};