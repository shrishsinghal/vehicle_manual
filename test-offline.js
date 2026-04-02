// Test fuzzy path matching
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
  
  // 4. Try fuzzy scoring
  const scored = availablePathNames.map(path => {
    const pathLower = path.toLowerCase();
    const reqParts = req.split(/\s+/);
    const pathParts = pathLower.split(/[\s_-]+/);
    
    let score = 0;
    
    let matched = 0;
    for (const char of req) {
      if (pathLower.includes(char)) matched++;
    }
    score += matched * 2;
    
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

// Test cases
const testPaths = ["JayGPS2", "JayGPS3", "Path_One", "PathTwo", "test-mission"];

console.log("Testing fuzzy path matching:");
console.log("Match 'jay gps 3':", findMatchingPath("jay gps 3", testPaths));
console.log("Match 'JayGPS2':", findMatchingPath("JayGPS2", testPaths));
console.log("Match 'gps2':", findMatchingPath("gps2", testPaths));
console.log("Match 'mission':", findMatchingPath("mission", testPaths));
console.log("Match 'unknown':", findMatchingPath("unknown", testPaths));
