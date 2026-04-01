// netlify/functions/chat.js
const manualData = require('./manual_data.json');

// Vehicle nickname to VIN mapping
const vehicleMapping = {
  'us hc yuba': 'MD9GBUE22DC341006',
  'us hc fargo': 'MD9GBUE27DC341003',
  'p1': 'MD9GBUE27DC341048',
  'p1 vehicle': 'MD9GBUE27DC341048',
  'p53': 'MD9GBUE28FC341028',
  'p53 vehicle': 'MD9GBUE28FC341028',
  't8': 'MD9GBUE22DC341037',
  't8 vehicle': 'MD9GBUE22DC341037',
  'black dragon': 'MD9GBUE2XDC341030',
  'p12': 'MD9GBUE24DC341069',
  'p12 vehicle': 'MD9GBUE24DC341069',
  'yellow dragon': 'MD9GBUE28DC341012',
  't6': 'MD9GBUE25DC341033',
  't6 vehicle': 'MD9GBUE25DC341033',
  't7': 'MD9GBUE20DC341036',
  't7 vehicle': 'MD9GBUE20DC341036',
  'p15': 'MD9GBUE24DC341072',
  'p15 vehicle': 'MD9GBUE24DC341072',
  'p19': 'MD9GBUE21DC341076',
  'p19 vehicle': 'MD9GBUE21DC341076',
  'p7': 'MD9GBUE25DC341064',
  'p7 vehicle': 'MD9GBUE25DC341064',
  't9': 'MD9GBUE24DC341038',
  't9 vehicle': 'MD9GBUE24DC341038'
};

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

// Function to get VIN from nickname (case insensitive)
function getVIN(nickname) {
  const lowerNickname = nickname.toLowerCase().trim();
  return vehicleMapping[lowerNickname] || null;
}

// Function to normalize path name (remove spaces, capitalize)
function normalizePathName(name) {
  return name.replace(/\s+/g, '').replace(/^\w/, c => c.toUpperCase());
}

// Function to extract path name from filename
function extractPathName(filename) {
  // e.g., "JayGPS2___1774900304710.json" -> "JayGPS2"
  return filename.split('___')[0];
}

// Function to get mission files for a vehicle
async function getMissionFiles(vin) {
  const response = await fetch(`https://botcontrol.bosonmotors.com/api/getmissionFiles/${vin}`);
  if (!response.ok) throw new Error(`Failed to fetch mission files: ${response.status}`);
  const data = await response.json();
  // Parse the data string which contains PosixPath objects
  const paths = JSON.parse(data.data);
  const filenames = paths.map(p => p.split('/').pop());
  const pathNames = filenames.map(extractPathName);
  return { filenames, pathNames };
}

// Function to start patrol
async function startPatrol(vin, filename) {
  const response = await fetch(`https://botcontrol.bosonmotors.com/api/startPatrol/${vin}/${filename}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  if (!response.ok) throw new Error(`Failed to start patrol: ${response.status}`);
  return await response.json();
}

// Function to stop patrol
async function stopPatrol(vin) {
  const response = await fetch(`https://botcontrol.bosonmotors.com/api/stopPatrol/${vin}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  if (!response.ok) throw new Error(`Failed to stop patrol: ${response.status}`);
  return await response.json();
}

// Function to parse command using LLM
async function parseCommandWithLLM(question) {
  const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', 
          content: 'You are a command parser for vehicle control. Extract the intent and parameters from the user query. Intents: list (list mission files), start (start patrol), stop (stop patrol). Parameters: vehicle (nickname), path (for start). Return JSON: {"intent": "list|start|stop", "vehicle": "nickname", "path": "path name"} or null if not a command.' },
        { role: 'user', content: question }
      ],
      response_format: { type: "json_object" }
    })
  });

  const groqData = await groqResponse.json();
  const result = JSON.parse(groqData.choices[0].message.content);
  return result.intent ? result : null;
}

// Function to parse command from question (fallback or simple check)
function isCommand(question) {
  const lower = question.toLowerCase();
  return lower.includes('list') && (lower.includes('mission') || lower.includes('path')) ||
         lower.includes('start') && lower.includes('patrol') ||
         lower.includes('stop') && lower.includes('patrol');
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  
  try {
    const { question } = JSON.parse(event.body);
    
    // Check if it's a command
    if (isCommand(question)) {
      const command = await parseCommandWithLLM(question);
      if (!command) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            answer: `Sorry, I couldn't understand that command. Please try: "list mission files for [vehicle]", "start [path] on [vehicle]", or "stop patrol on [vehicle]".`,
            sources: []
          })
        };
      }
      
      const vin = getVIN(command.vehicle);
      if (!vin) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            answer: `Sorry, I don't recognize the vehicle "${command.vehicle}". Please use a valid nickname like p12, black dragon, etc.`,
            sources: []
          })
        };
      }
      
      if (command.intent === 'list') {
        const { pathNames } = await getMissionFiles(vin);
        const answer = `**Mission files for ${command.vehicle} (${vin}):**\n\n` + pathNames.map(name => `- ${name}`).join('\n');
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ answer, sources: [] })
        };
      } else if (command.intent === 'start') {
        const { filenames, pathNames } = await getMissionFiles(vin);
        const index = pathNames.findIndex(name => name.toLowerCase() === command.path.toLowerCase());
        if (index === -1) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              answer: `Sorry, I couldn't find a mission file named "${command.path}" for ${command.vehicle}. Available paths: ${pathNames.join(', ')}`,
              sources: []
            })
          };
        }
        await startPatrol(vin, filenames[index]);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            answer: `Patrol started successfully for ${command.path} on ${command.vehicle} (${vin}).`,
            sources: []
          })
        };
      } else if (command.intent === 'stop') {
        await stopPatrol(vin);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            answer: `Patrol stopped successfully on ${command.vehicle} (${vin}).`,
            sources: []
          })
        };
      }
    }
    
    // If not a command, proceed with manual Q&A
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