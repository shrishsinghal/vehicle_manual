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

// Function to find the best matching path name from available paths using fuzzy matching
function findMatchingPath(requestedPath, availablePathNames) {
  if (!requestedPath || !availablePathNames || availablePathNames.length === 0) return null;
  
  const req = requestedPath.toLowerCase().trim();
  
  // 1. Try exact match (case-insensitive)
  for (const path of availablePathNames) {
    if (path.toLowerCase() === req) {
      return path;
    }
  }
  
  // 2. Try partial match (requested is substring of path)
  for (const path of availablePathNames) {
    if (path.toLowerCase().includes(req)) {
      return path;
    }
  }
  
  // 3. Try reverse partial (path name is substring of requested)
  for (const path of availablePathNames) {
    if (req.includes(path.toLowerCase())) {
      return path;
    }
  }
  
  // 4. Try fuzzy scoring (character overlap and word matching)
  const scored = availablePathNames.map(path => {
    const pathLower = path.toLowerCase();
    const reqParts = req.split(/\s+/);
    const pathParts = pathLower.split(/[\s_-]+/);
    
    let score = 0;
    
    // Match individual characters
    let matched = 0;
    for (const char of req) {
      if (pathLower.includes(char)) matched++;
    }
    score += matched * 2;
    
    // Match word parts
    for (const reqPart of reqParts) {
      for (const pathPart of pathParts) {
        if (pathPart.includes(reqPart) || reqPart.includes(pathPart)) {
          score += 10;
        }
      }
    }
    
    return { path, score };
  });
  
  const best = scored.sort((a, b) => b.score - a.score)[0];
  if (best && best.score > 0) {
    return best.path;
  }
  
  return null;
}

// Function to extract path name from filename
function extractPathName(filename) {
  // e.g., "JayGPS2___1774900304710.json" -> "JayGPS2"
  return filename.split('___')[0];
}

// Function to get mission files for a vehicle (with Workdrive fallback)
async function getMissionFiles(vin, vehicleId, token, workdriveFolder) {
  try {
    // Try primary API with 2 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    let primaryError = null;
    try {
      const response = await fetch(`https://botcontrol.bosonmotors.com/api/getmissionFiles/${vin}`, {
        headers: { 'Authorization': `${token}` },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        const dataStr = data.data;
        const pathMatches = dataStr.match(/PosixPath\('([^']+)'\)/g);
        if (!pathMatches) throw new Error('Invalid mission files format');
        const paths = pathMatches.map(match => match.match(/PosixPath\('([^']+)'\)/)[1]);
        const filenames = paths.map(p => p.split('/').pop());
        const pathNames = filenames.map(extractPathName);
        console.log('[getMissionFiles] Primary API success:', {vin, filenames});
        return { filenames, pathNames, offline: false };
      } else {
        primaryError = `Primary API error: ${response.status}`;
      }
    } catch (error) {
      clearTimeout(timeoutId);
      primaryError = error;
      if (error.name !== 'AbortError') {
        console.error('[getMissionFiles] Primary API error:', error);
      } else {
        console.warn('[getMissionFiles] Primary API timed out');
      }
    }
    // Fallback to Workdrive if primary fails or times out
    console.log('[getMissionFiles] Using Workdrive fallback', {vin, workdriveFolder, primaryError});
    if (!workdriveFolder) {
      console.error('[getMissionFiles] No workdriveFolder for vehicle', {vin, vehicleId});
      throw new Error('Vehicle offline (no Workdrive folder)');
    }
    const workdriveResponse = await fetch(
      `https://botcontrol.bosonmotors.com/api/teamfolders50/${workdriveFolder}/files`,
      { headers: { 'Authorization': `${token}` } }
    );
    if (!workdriveResponse.ok) {
      console.error('[getMissionFiles] Workdrive fetch failed', {status: workdriveResponse.status});
      throw new Error('Failed to fetch from Workdrive');
    }
    const workdriveData = await workdriveResponse.json();
    const pathNames = workdriveData.files
      ? workdriveData.files.slice(0, 50).map(f => extractPathName(f.name))
      : [];
    const filenames = workdriveData.files?.slice(0, 50).map(f => f.name) || [];
    console.log('[getMissionFiles] Workdrive fallback success', {vin, filenames});
    return { filenames, pathNames, offline: true };
  } catch (error) {
    console.error('[getMissionFiles] Error fetching mission files:', error);
    throw error;
  }
}

// Function to start patrol
async function startPatrol(vin, filename, token) {
  try {
    const response = await fetch(`https://botcontrol.bosonmotors.com/api/startPatrol/${vin}/${filename}`, {
      method: 'POST',
      headers: { 
        'Authorization': `${token}`,
        'Content-Type': 'application/json' 
      },
      body: '{}'
    });
    
    if (response.status === 503 || response.status === 504) {
      throw new Error('Vehicle is offline');
    }
    if (!response.ok) throw new Error(`Failed: ${response.status}`);
    return await response.json();
  } catch (error) {
    throw error;
  }
}

// Function to stop patrol
async function stopPatrol(vin, token) {
  try {
    const response = await fetch(`https://botcontrol.bosonmotors.com/api/stopPatrol/${vin}`, {
      method: 'POST',
      headers: { 
        'Authorization': `${token}`,
        'Content-Type': 'application/json' 
      },
      body: '{}'
    });
    
    if (response.status === 503 || response.status === 504) {
      throw new Error('Vehicle is offline');
    }
    if (!response.ok) throw new Error(`Failed: ${response.status}`);
    return await response.json();
  } catch (error) {
    throw error;
  }
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

TASK: Extract intent, vehicle query, and path from user message.
- intent: "list" (list mission files), "start" (start patrol), "stop" (stop patrol), or "null" (not a command)
- vehicle: the vehicle name/nickname EXACTLY as user said it (don't normalize, just extract it)
- path: extracted path name for start commands (just the path name, no extensions)

RULES:
1. Extract vehicle query EXACTLY as user stated - don't try to normalize
2. For path, extract just the name part
3. If vehicle or path cannot be extracted, return null
4. Only "start" if both vehicle AND path provided

EXAMPLES:
- "list mission files for t8" -> {"intent": "list", "vehicle": "t8", "path": null}
- "show paths on T8 VEHICLE" -> {"intent": "list", "vehicle": "T8 VEHICLE", "path": null}
- "start jaygps3 on p15" -> {"intent": "start", "vehicle": "p15", "path": "jaygps3"}
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

// Helper to get vehicle info from auth response
function getVehicleInfo(vehicleLabel, vehicleDetails) {
  if (!vehicleDetails || !Array.isArray(vehicleDetails)) return null;
  
  const queryNorm = vehicleLabel.toLowerCase().trim();
  
  // Try exact match first
  let vehicle = vehicleDetails.find(v => 
    v.label.toLowerCase() === queryNorm ||
    v.CustNickName.toLowerCase() === queryNorm ||
    v.VIN.toLowerCase() === queryNorm
  );
  
  if (vehicle) return vehicle;
  
  // Fuzzy matching: extract key parts
  // "T8 Vehicle" -> ["t8", "vehicle"]
  // "P12 Vehicle" -> ["p12", "vehicle"]
  // "Black Dragon" -> ["black", "dragon"]
  
  const queryParts = queryNorm.split(/\s+|-/).filter(p => p.length > 0);
  
  // Score each vehicle
  const scored = vehicleDetails.map(v => {
    const labelParts = v.label.toLowerCase().split(/\s+/).filter(p => p.length > 0);
    const nickParts = (v.CustNickName || '').toLowerCase().split(/\s+/).filter(p => p.length > 0);
    const vinParts = v.VIN.toLowerCase().split(/\s+/).filter(p => p.length > 0);
    
    const allParts = [...labelParts, ...nickParts];
    
    // Count how many query parts match
    let score = 0;
    for (const qPart of queryParts) {
      for (const vPart of allParts) {
        if (vPart.includes(qPart) || qPart.includes(vPart)) {
          score += 10;
        }
      }
    }
    
    return { vehicle: v, score };
  });
  
  // Get best match
  const bestMatch = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score)[0];
  return bestMatch ? bestMatch.vehicle : null;
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  
  try {
    const { question, token, vehicleDetails } = JSON.parse(event.body);
    
    if (!token) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authentication required. Please login first.' })
      };
    }
    
    // Check if it's a command
    if (isCommand(question)) {
      const command = await parseCommandWithLLM(question);
      if (!command || command.intent === 'null' || command.intent === null) {
        // Not a valid command, fall through to manual
      } else {
        // Handle command using vehicle details from auth
        const vehicleInfo = getVehicleInfo(command.vehicle, vehicleDetails);
        if (!vehicleInfo) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              answer: `Vehicle "${command.vehicle}" not found. Authorized vehicles: ${vehicleDetails.map(v => v.label).join(', ')}`,
              sources: []
            })
          };
        }
        
        if (command.intent === 'list') {
          try {
            const { pathNames, offline } = await getMissionFiles(
              vehicleInfo.VIN, 
              vehicleInfo.id, 
              token,
              vehicleInfo.workdriveFolder
            );
            const offlineNote = offline ? `\n\n**ℹ️ Note:** Vehicle is currently offline. These files are from Workdrive archive.` : '';
            // Number the mission files
            const answer = `**Mission files for ${command.vehicle}:**\n\n` + pathNames.map((name, idx) => `${idx+1}. ${name}`).join('\n') + offlineNote;
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
                answer: `Please specify which path to start. Example: "start JayGPS3 on ${command.vehicle}"`,
                sources: []
              })
            };
          }
          
          try {
            const { filenames, pathNames, offline } = await getMissionFiles(
              vehicleInfo.VIN,
              vehicleInfo.id,
              token,
              vehicleInfo.workdriveFolder
            );
            
            if (offline) {
              return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                  answer: `Cannot start patrol: Vehicle "${command.vehicle}" is offline. Please try when online.`,
                  sources: []
                })
              };
            }
            
            // Use fuzzy matching to find the best path
            const matchedPath = findMatchingPath(command.path, pathNames);
            
            if (!matchedPath) {
              return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                  answer: `Sorry, I couldn't find a mission file named "${command.path}". Available: ${pathNames.join(', ')}`,
                  sources: []
                })
              };
            }
            
            const pathIndex = pathNames.indexOf(matchedPath);
            const filename = filenames[pathIndex];
            
            await startPatrol(vehicleInfo.VIN, filename, token);
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                answer: `✅ Patrol started successfully for ${matchedPath} on ${command.vehicle}.`,
                sources: []
              })
            };
          } catch (error) {
            const isOffline = error.message.includes('offline');
            const answer = isOffline 
              ? `Cannot start patrol: Vehicle "${command.vehicle}" is offline.`
              : `Error: ${error.message}`;
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({ answer, sources: [] })
            };
          }
        } else if (command.intent === 'stop') {
          try {
            await stopPatrol(vehicleInfo.VIN, token);
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                answer: `✅ Patrol stopped successfully on ${command.vehicle}.`,
                sources: []
              })
            };
          } catch (error) {
            const isOffline = error.message.includes('offline');
            const answer = isOffline 
              ? `Cannot stop patrol: Vehicle "${command.vehicle}" is offline.`
              : `Error: ${error.message}`;
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({ answer, sources: [] })
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