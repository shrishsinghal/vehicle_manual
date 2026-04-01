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

// Function to find the best matching path name from available paths
async function findMatchingPath(requestedPath, availablePathNames) {
  if (!requestedPath) return null;
  
  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', 
            content: `You are a path matcher. Given a user-requested path and a list of available paths, find the best match.
Available paths: ${JSON.stringify(availablePathNames)}

Return ONLY a JSON object: {"matched_path": "path_name_or_null", "confidence": "high|medium|low"}

Rules:
- Match case-insensitively and handle variations (e.g., "jay gps 3" matches "JayGPS3")
- Handle abbreviations and typos intelligently
- If multiple matches are possible, pick the most likely one
- If no reasonable match, return null for matched_path

Return ONLY JSON, no markdown.` },
          { role: 'user', content: `Find path matching: "${requestedPath}"` }
        ]
      })
    });

    const groqData = await groqResponse.json();
    const content = groqData.choices[0].message.content.trim();
    const jsonStr = content.replace(/^```json\s*/, '').replace(/\s*```$/, '').replace(/```$/, '').trim();
    const result = JSON.parse(jsonStr);
    return result.matched_path;
  } catch (error) {
    console.error('Path matching error:', error);
    return null;
  }
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
  // data.data is a string like: "[PosixPath('/path/file1.json'), PosixPath('/path/file2.json')]"
  const dataStr = data.data;
  // Extract paths using regex
  const pathMatches = dataStr.match(/PosixPath\('([^']+)'\)/g);
  if (!pathMatches) throw new Error('Invalid mission files format');
  const paths = pathMatches.map(match => match.match(/PosixPath\('([^']+)'\)/)[1]);
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

// Function to parse command using LLM - comprehensive and robust
async function parseCommandWithLLM(question) {
  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', 
            content: `You are a command parser for vehicle control. Return ONLY a JSON object, nothing else.

KNOWN VEHICLES (map any variation to the standard key):
${Object.entries(vehicleMapping).map(([key, vin]) => `  - "${key}" (VIN: ${vin})`).join('\n')}

TASK: Extract intent and parameters from user query.
- intent: "list" (list mission files), "start" (start patrol), "stop" (stop patrol), or "null" (not a command)
- vehicle: the vehicle nickname as key from the known vehicles list (standardized, e.g., "p12", "p15", "black dragon")
- path: extracted path name for start commands (e.g., "JayGPS3", match to available paths case-insensitively)

RULES:
1. Match vehicle nicknames intelligently (e.g., "p12 vehicle", "P12", "p-12" all map to "p12")
2. For path names, extract just the name without file extensions or timestamps
3. If vehicle or path cannot be matched, return null for that field
4. Only return "start" intent if both vehicle AND path are provided

EXAMPLES:
- "list saved paths for p15" -> {"intent": "list", "vehicle": "p15", "path": null}
- "show mission files on P15 VEHICLE" -> {"intent": "list", "vehicle": "p15", "path": null}
- "start jaygps3 on p15" -> {"intent": "start", "vehicle": "p15", "path": "JayGPS3"}
- "start JayGPS 3 on p-15 vehicle" -> {"intent": "start", "vehicle": "p15", "path": "JayGPS3"}
- "stop patrol on black dragon" -> {"intent": "stop", "vehicle": "black dragon", "path": null}
- "how to start the vehicle" -> {"intent": null, "vehicle": null, "path": null}

RETURN ONLY VALID JSON, NO MARKDOWN, NO EXTRA TEXT.` },
          { role: 'user', content: question }
        ]
      })
    });

    const groqData = await groqResponse.json();
    const content = groqData.choices[0].message.content.trim();
    // Remove any markdown code blocks if present
    const jsonStr = content.replace(/^```json\s*/, '').replace(/\s*```$/, '').replace(/```$/, '').trim();
    const result = JSON.parse(jsonStr);
    console.log('Parsed command:', { question, result });
    return result;
  } catch (error) {
    console.error('LLM parsing error:', error);
    return { intent: null, vehicle: null, path: null };
  }
}

// Simple check: is this likely a command at all?
function isCommand(question) {
  const lower = question.toLowerCase();
  return lower.includes('list') || lower.includes('show') || 
         lower.includes('start') || lower.includes('stop') || 
         lower.includes('mission') || lower.includes('path');
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  
  try {
    const { question } = JSON.parse(event.body);
    
    // Check if it's a command
    if (isCommand(question)) {
      const command = await parseCommandWithLLM(question);
      if (!command || command.intent === 'null' || command.intent === null) {
        // Not a valid command, fall through to manual
      } else {
        // Handle command - vehicle is already extracted by LLM
        const vin = command.vehicle ? vehicleMapping[command.vehicle.toLowerCase()] : null;
        
        if (!vin) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              answer: `Sorry, I don't recognize the vehicle "${command.vehicle}". Known vehicles: ${Object.keys(vehicleMapping).join(', ')}`,
              sources: []
            })
          };
        }
        
        if (command.intent === 'list') {
          try {
            const { pathNames } = await getMissionFiles(vin);
            const answer = `**Mission files for ${command.vehicle} (${vin}):**\n\n` + pathNames.map(name => `- ${name}`).join('\n');
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({ answer, sources: [] })
            };
          } catch (error) {
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                answer: `Error fetching mission files: ${error.message}`,
                sources: []
              })
            };
          }
        } else if (command.intent === 'start') {
          if (!command.path) {
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                answer: `Please specify which path to start. Available paths can be listed with "list mission files for ${command.vehicle}".`,
                sources: []
              })
            };
          }
          
          try {
            const { filenames, pathNames } = await getMissionFiles(vin);
            // Use LLM to find the best match
            const matchedPath = await findMatchingPath(command.path, pathNames);
            
            if (!matchedPath) {
              return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                  answer: `Sorry, I couldn't find a mission file named "${command.path}" for ${command.vehicle}. Available paths: ${pathNames.join(', ')}`,
                  sources: []
                })
              };
            }
            
            const pathIndex = pathNames.indexOf(matchedPath);
            const filename = filenames[pathIndex];
            
            await startPatrol(vin, filename);
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                answer: `Patrol started successfully for ${matchedPath} on ${command.vehicle} (${vin}).`,
                sources: []
              })
            };
          } catch (error) {
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                answer: `Error starting patrol: ${error.message}`,
                sources: []
              })
            };
          }
        } else if (command.intent === 'stop') {
          try {
            await stopPatrol(vin);
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                answer: `Patrol stopped successfully on ${command.vehicle} (${vin}).`,
                sources: []
              })
            };
          } catch (error) {
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                answer: `Error stopping patrol: ${error.message}`,
                sources: []
              })
            };
          }
        }
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