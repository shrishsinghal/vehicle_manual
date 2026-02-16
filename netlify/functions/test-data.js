// netlify/functions/test-data.js
exports.handler = async () => {
  try {
    const data = require('./manual_data.json');
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loaded: true,
        totalChunks: data.chunks?.length || 0,
        firstChunk: data.chunks?.[0],
        sampleText: data.chunks?.[0]?.text?.substring(0, 200)
      }, null, 2)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};