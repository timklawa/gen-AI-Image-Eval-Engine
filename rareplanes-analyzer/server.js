const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const fetch = require('node-fetch').default;

const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Serve static files from the dataset directory
const datasetPath = path.join(__dirname, 'dataset');

// API endpoint to get paginated list of images for a subset
app.get('/api/images', (req, res) => {
  const { subset = 'train', page = 1, pageSize = 50 } = req.query;
  const imageDir = path.join(datasetPath, subset, 'images');
  const labelDir = path.join(datasetPath, subset, 'labels');
  
  try {
    if (!fs.existsSync(imageDir)) {
      return res.status(404).json({ error: 'Subset not found' });
    }
    
    const imageFiles = fs.readdirSync(imageDir).filter(file => file.endsWith('.jpg'));
    const total = imageFiles.length;
    const startIndex = (parseInt(page) - 1) * parseInt(pageSize);
    const endIndex = startIndex + parseInt(pageSize);
    const paginatedFiles = imageFiles.slice(startIndex, endIndex);
    
    const images = paginatedFiles.map(filename => {
      const baseName = filename.replace('.jpg', '');
      const labelFile = path.join(labelDir, `${baseName}.txt`);
      
      let annotations = [];
      let objectCount = 0;
      let classes = [];
      
      try {
        if (fs.existsSync(labelFile)) {
          const labelContent = fs.readFileSync(labelFile, 'utf8');
          const lines = labelContent.trim().split('\n').filter(line => line.trim());
          
          annotations = lines.map(line => {
            const parts = line.trim().split(' ');
            return {
              classId: parseInt(parts[0]),
              xCenter: parseFloat(parts[1]),
              yCenter: parseFloat(parts[2]),
              width: parseFloat(parts[3]),
              height: parseFloat(parts[4])
            };
          });
          
          objectCount = annotations.length;
          const uniqueClasses = Array.from(new Set(annotations.map(a => a.classId)));
          classes = uniqueClasses.sort((a, b) => a - b);
        }
      } catch (error) {
        console.warn(`Could not load labels for ${baseName}:`, error);
      }
      
      return {
        id: baseName,
        filename: filename,
        imagePath: `http://localhost:3001/dataset/${subset}/images/${filename}`,
        imageUrl: `http://localhost:3001/dataset/${subset}/images/${filename}`,
        labelPath: `http://localhost:3001/dataset/${subset}/labels/${baseName}.txt`,
        annotations: annotations,
        objectCount: objectCount,
        classes: classes
      };
    });
    
    res.json({
      images: images,
      total: total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      totalPages: Math.ceil(total / parseInt(pageSize))
    });
  } catch (error) {
    console.error('Error loading images:', error);
    res.status(500).json({ error: 'Failed to load images' });
  }
});

// API endpoint to get a single image by ID
app.get('/api/images/:subset/:imageId', (req, res) => {
  const { subset, imageId } = req.params;
  const imageDir = path.join(datasetPath, subset, 'images');
  const labelDir = path.join(datasetPath, subset, 'labels');
  
  try {
    const imageFile = `${imageId}.jpg`;
    const imagePath = path.join(imageDir, imageFile);
    const labelFile = path.join(labelDir, `${imageId}.txt`);
    
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    let annotations = [];
    let objectCount = 0;
    let classes = [];
    
    try {
      if (fs.existsSync(labelFile)) {
        const labelContent = fs.readFileSync(labelFile, 'utf8');
        const lines = labelContent.trim().split('\n').filter(line => line.trim());
        
        annotations = lines.map(line => {
          const parts = line.trim().split(' ');
          return {
            classId: parseInt(parts[0]),
            xCenter: parseFloat(parts[1]),
            yCenter: parseFloat(parts[2]),
            width: parseFloat(parts[3]),
            height: parseFloat(parts[4])
          };
        });
        
        objectCount = annotations.length;
        const uniqueClasses = Array.from(new Set(annotations.map(a => a.classId)));
        classes = uniqueClasses.sort((a, b) => a - b);
      }
    } catch (error) {
      console.warn(`Could not load labels for ${imageId}:`, error);
    }
    
    const imageData = {
      id: imageId,
      filename: imageFile,
      imagePath: `http://localhost:3001/dataset/${subset}/images/${imageFile}`,
      imageUrl: `http://localhost:3001/dataset/${subset}/images/${imageFile}`,
      labelPath: `http://localhost:3001/dataset/${subset}/labels/${imageId}.txt`,
      annotations: annotations,
      objectCount: objectCount,
      classes: classes
    };
    
    res.json(imageData);
  } catch (error) {
    console.error('Error loading image:', error);
    res.status(500).json({ error: 'Failed to load image' });
  }
});

// Serve static files from dataset directory
app.use('/dataset', express.static(datasetPath));

// Anthropic API Proxy endpoint (only for CORS)
app.post('/api/llm/anthropic', async (req, res) => {
  try {
    const { apiKey, model, systemPrompt, imageBase64 } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key not provided' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please analyze this image and identify all aircraft present. Respond with a valid JSON object containing "count" (total aircraft detected), "aircraft" (array with class_id 0-6 for each aircraft), and optional "confidence" score.'
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: imageBase64
                }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({ error: errorData.error?.message || response.statusText });
    }

    const data = await response.json();
    const content = data.content[0]?.text;
    if (!content) {
      return res.status(500).json({ error: 'No response from Anthropic' });
    }

    res.json({
      content,
      usage: data.usage
    });
  } catch (error) {
    console.error('Anthropic API error:', error);
    res.status(500).json({ error: 'Failed to call Anthropic API' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Dataset path: ${datasetPath}`);
  console.log(`API endpoints:`);
  console.log(`  GET /api/images?subset=train&page=1&pageSize=50`);
  console.log(`  GET /api/images/train/:imageId`);
  console.log(`  GET /api/health`);
});