import { LLMConfig, OpenAIResponse } from '../types';
import { getProviderById, getModelById, getApiKey } from './llmProviders';
import { OntologyExampleImage, getAllExampleImages } from './ontologyImageService';
import { getTagsForClasses } from './ontologyTagsService';
import { aircraftOntology } from './ontologyService';

export interface LLMApiResponse {
  content: string;
  error?: string;
  duration?: number;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Build ontology content with images, text descriptions, and tags
 */
function buildOntologyContent(exampleImages?: OntologyExampleImage[]): {
  textContent: string;
  imageContent: OntologyExampleImage[];
} {
  const allExampleImages = exampleImages || getAllExampleImages();
  const exampleImagesMap = new Map<number, OntologyExampleImage>();
  allExampleImages.forEach(img => {
    exampleImagesMap.set(img.classId, img);
  });
  
  const tagsMap = getTagsForClasses([0, 1, 2, 3, 4, 5, 6]);
  
  // Build text description for all classes
  let ontologyText = 'Aircraft Classification Ontology:\n\n';
  
  aircraftOntology.forEach(aircraft => {
    const hasImage = exampleImagesMap.has(aircraft.id);
    const tags = tagsMap.get(aircraft.id) || [];
    
    ontologyText += `Class ${aircraft.id}: ${aircraft.name}\n`;
    ontologyText += `  Description: ${aircraft.description}\n`;
    
    if (aircraft.characteristics && aircraft.characteristics.length > 0) {
      ontologyText += `  Characteristics: ${aircraft.characteristics.join(', ')}\n`;
    }
    
    if (tags.length > 0) {
      ontologyText += `  Key Attributes: ${tags.join(', ')}\n`;
    }
    
    if (hasImage) {
      ontologyText += `  [Example image provided below]\n`;
    } else {
      ontologyText += `  [Text description only - no example image]\n`;
    }
    
    ontologyText += '\n';
  });
  
  return {
    textContent: ontologyText,
    imageContent: allExampleImages
  };
}

export async function analyzeImageWithLLM(
  config: LLMConfig,
  systemPrompt: string,
  imageBase64: string,
  exampleImages?: OntologyExampleImage[]
): Promise<LLMApiResponse> {
  const startTime = Date.now();
  
  try {
    const provider = getProviderById(config.provider);
    if (!provider) {
      throw new Error(`Provider not found: ${config.provider}`);
    }
    const model = getModelById(config.provider, config.model);
    const apiKey = getApiKey(config.provider);

    if (!apiKey) {
      throw new Error(`API key not found for provider: ${config.provider}`);
    }

    switch (config.provider) {
      case 'openai':
        return await callOpenAI(provider.baseUrl, apiKey, config.model, systemPrompt, imageBase64, startTime, exampleImages);
      case 'anthropic':
        return await callAnthropic(provider.baseUrl, apiKey, config.model, systemPrompt, imageBase64, startTime, exampleImages);
      case 'groq':
        return await callGroq(provider.baseUrl, apiKey, config.model, systemPrompt, imageBase64, startTime, exampleImages);
      case 'azure':
        return await callAzure(provider.baseUrl, apiKey, config.model, systemPrompt, imageBase64, startTime, exampleImages);
      case 'aws':
        return await callAWS(provider.baseUrl, apiKey, config.model, systemPrompt, imageBase64, startTime, exampleImages);
      case 'google':
        return await callGoogle(provider.baseUrl, apiKey, config.model, systemPrompt, imageBase64, startTime, exampleImages);
      case 'xai':
        return await callXAI(provider.baseUrl, apiKey, config.model, systemPrompt, imageBase64, startTime, exampleImages);
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  } catch (error) {
    console.error('Error analyzing image with LLM:', error);
    console.error('Error details:', {
      provider: config.provider,
      model: config.model,
      apiKey: config.apiKey ? 'Present' : 'Missing',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined
    });
    
    return {
      content: '',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime
    };
  }
}

// OpenAI API call
async function callOpenAI(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  imageBase64: string,
  startTime: number,
  exampleImages?: OntologyExampleImage[]
): Promise<LLMApiResponse> {
  // Build user content array
  const userContent: any[] = [];
  
  // Build ontology content with images and text descriptions
  const ontologyContent = buildOntologyContent(exampleImages);
  
  // Add ontology text description
  userContent.push({
    type: 'text',
    text: ontologyContent.textContent
  });
  
  // Add example images for classes that have them
  if (ontologyContent.imageContent.length > 0) {
    userContent.push({
      type: 'text',
      text: '\nExample Images for Reference:\n'
    });
    
    ontologyContent.imageContent.forEach(img => {
      userContent.push({
        type: 'text',
        text: `\nExample image for Class ${img.classId} (${img.className}):`
      });
      userContent.push({
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${img.imageBase64}`
        }
      });
    });
  }
  
  // Add instruction text
  userContent.push({
    type: 'text',
    text: '\n\nNow analyze the following image and identify all aircraft present. Use the ontology descriptions and example images (where available) as reference. For classes without example images, use the text descriptions provided. Respond with a valid JSON object containing "count" (total aircraft detected), "aircraft" (array with class_id 0-6 for each aircraft), and optional "confidence" score.'
  });
  
  // Add the main image to analyze
  userContent.push({
    type: 'image_url',
    image_url: {
      url: `data:image/jpeg;base64,${imageBase64}`
    }
  });

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userContent
        }
      ],
      max_tokens: 1000,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  const duration = Date.now() - startTime;
  return {
    content,
    duration,
    usage: data.usage
  };
}

// Anthropic API call
async function callAnthropic(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  imageBase64: string,
  startTime: number,
  exampleImages?: OntologyExampleImage[]
): Promise<LLMApiResponse> {
  // Build user content array
  const userContent: any[] = [];
  
  // Build ontology content with images and text descriptions
  const ontologyContent = buildOntologyContent(exampleImages);
  
  // Add ontology text description
  userContent.push({
    type: 'text',
    text: ontologyContent.textContent
  });
  
  // Add example images for classes that have them
  if (ontologyContent.imageContent.length > 0) {
    userContent.push({
      type: 'text',
      text: '\nExample Images for Reference:\n'
    });
    
    ontologyContent.imageContent.forEach(img => {
      userContent.push({
        type: 'text',
        text: `\nExample image for Class ${img.classId} (${img.className}):`
      });
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: img.imageBase64
        }
      });
    });
  }
  
  // Add instruction text
  userContent.push({
    type: 'text',
    text: '\n\nNow analyze the following image and identify all aircraft present. Use the ontology descriptions and example images (where available) as reference. For classes without example images, use the text descriptions provided. Respond with a valid JSON object containing "count" (total aircraft detected), "aircraft" (array with class_id 0-6 for each aircraft), and optional "confidence" score.'
  });
  
  // Add the main image to analyze
  userContent.push({
    type: 'image',
    source: {
      type: 'base64',
      media_type: 'image/jpeg',
      data: imageBase64
    }
  });

  const response = await fetch(`${baseUrl}/messages`, {
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
          content: userContent
        }
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Anthropic API error: ${errorData.error || response.statusText}`);
  }

  const data = await response.json();
  const content = data.content;
  if (!content) {
    throw new Error('No response from Anthropic');
  }

  const duration = Date.now() - startTime;
  return {
    content,
    duration,
    usage: data.usage
  };
}

// Groq API call
async function callGroq(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  imageBase64: string,
  startTime: number,
  exampleImages?: OntologyExampleImage[]
): Promise<LLMApiResponse> {
  // Build user content array
  const userContent: any[] = [];
  
  // Build ontology content with images and text descriptions
  const ontologyContent = buildOntologyContent(exampleImages);
  
  // Add ontology text description
  userContent.push({
    type: 'text',
    text: ontologyContent.textContent
  });
  
  // Add example images for classes that have them
  if (ontologyContent.imageContent.length > 0) {
    userContent.push({
      type: 'text',
      text: '\nExample Images for Reference:\n'
    });
    
    ontologyContent.imageContent.forEach(img => {
      userContent.push({
        type: 'text',
        text: `\nExample image for Class ${img.classId} (${img.className}):`
      });
      userContent.push({
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${img.imageBase64}`
        }
      });
    });
  }
  
  // Add instruction text
  userContent.push({
    type: 'text',
    text: '\n\nNow analyze the following image and identify all aircraft present. Use the ontology descriptions and example images (where available) as reference. For classes without example images, use the text descriptions provided. Respond with a valid JSON object containing "count" (total aircraft detected), "aircraft" (array with class_id 0-6 for each aircraft), and optional "confidence" score.'
  });
  
  // Add the main image to analyze
  userContent.push({
    type: 'image_url',
    image_url: {
      url: `data:image/jpeg;base64,${imageBase64}`
    }
  });
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userContent
        }
      ],
      max_tokens: 1000,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Groq API error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from Groq');
  }

  const duration = Date.now() - startTime;
  return {
    content,
    duration,
    usage: data.usage
  };
}

// Azure OpenAI API call
async function callAzure(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  imageBase64: string,
  startTime: number,
  exampleImages?: OntologyExampleImage[]
): Promise<LLMApiResponse> {
  // Build user content array
  const userContent: any[] = [];
  
  // Build ontology content with images and text descriptions
  const ontologyContent = buildOntologyContent(exampleImages);
  
  // Add ontology text description
  userContent.push({
    type: 'text',
    text: ontologyContent.textContent
  });
  
  // Add example images for classes that have them
  if (ontologyContent.imageContent.length > 0) {
    userContent.push({
      type: 'text',
      text: '\nExample Images for Reference:\n'
    });
    
    ontologyContent.imageContent.forEach(img => {
      userContent.push({
        type: 'text',
        text: `\nExample image for Class ${img.classId} (${img.className}):`
      });
      userContent.push({
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${img.imageBase64}`
        }
      });
    });
  }
  
  // Add instruction text
  userContent.push({
    type: 'text',
    text: '\n\nNow analyze the following image and identify all aircraft present. Use the ontology descriptions and example images (where available) as reference. For classes without example images, use the text descriptions provided. Respond with a valid JSON object containing "count" (total aircraft detected), "aircraft" (array with class_id 0-6 for each aircraft), and optional "confidence" score.'
  });
  
  // Add the main image to analyze
  userContent.push({
    type: 'image_url',
    image_url: {
      url: `data:image/jpeg;base64,${imageBase64}`
    }
  });
  const response = await fetch(`${baseUrl}/chat/completions?api-version=2024-02-15-preview`, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userContent
        }
      ],
      max_tokens: 1000,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Azure OpenAI API error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from Azure OpenAI');
  }

  const duration = Date.now() - startTime;
  return {
    content,
    duration,
    usage: data.usage
  };
}

// AWS Bedrock API call
async function callAWS(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  imageBase64: string,
  startTime: number,
  exampleImages?: OntologyExampleImage[]
): Promise<LLMApiResponse> {
  // Build user content array
  const userContent: any[] = [];
  
  // Build ontology content with images and text descriptions
  const ontologyContent = buildOntologyContent(exampleImages);
  
  // Add ontology text description
  userContent.push({
    type: 'text',
    text: ontologyContent.textContent
  });
  
  // Add example images for classes that have them
  if (ontologyContent.imageContent.length > 0) {
    userContent.push({
      type: 'text',
      text: '\nExample Images for Reference:\n'
    });
    
    ontologyContent.imageContent.forEach(img => {
      userContent.push({
        type: 'text',
        text: `\nExample image for Class ${img.classId} (${img.className}):`
      });
      userContent.push({
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${img.imageBase64}`
        }
      });
    });
  }
  
  // Add instruction text
  userContent.push({
    type: 'text',
    text: '\n\nNow analyze the following image and identify all aircraft present. Use the ontology descriptions and example images (where available) as reference. For classes without example images, use the text descriptions provided. Respond with a valid JSON object containing "count" (total aircraft detected), "aircraft" (array with class_id 0-6 for each aircraft), and optional "confidence" score.'
  });
  
  // Add the main image to analyze
  userContent.push({
    type: 'image_url',
    image_url: {
      url: `data:image/jpeg;base64,${imageBase64}`
    }
  });
  const response = await fetch(`${baseUrl}/model/${model}/invoke`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userContent
        }
      ],
      max_tokens: 1000,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`AWS Bedrock API error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const content = data.content[0]?.text;
  if (!content) {
    throw new Error('No response from AWS Bedrock');
  }

  const duration = Date.now() - startTime;
  return {
    content,
    duration,
    usage: data.usage
  };
}

// Google Gemini API call
async function callGoogle(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  imageBase64: string,
  startTime: number,
  exampleImages?: OntologyExampleImage[]
): Promise<LLMApiResponse> {
  // Build parts array
  const parts: any[] = [];
  
  // Build ontology content with images and text descriptions
  const ontologyContent = buildOntologyContent(exampleImages);
  
  // Add ontology text description
  let instructionText = `${systemPrompt}\n\n${ontologyContent.textContent}`;
  
  // Add example images for classes that have them
  if (ontologyContent.imageContent.length > 0) {
    instructionText += '\n\nExample Images for Reference:\n';
    parts.push({ text: instructionText });
    
    ontologyContent.imageContent.forEach(img => {
      parts.push({
        text: `\nExample image for Class ${img.classId} (${img.className}):`
      });
      parts.push({
        inline_data: {
          mime_type: 'image/jpeg',
          data: img.imageBase64
        }
      });
    });
  } else {
    parts.push({ text: instructionText });
  }
  
  // Add instruction text
  parts.push({
    text: '\n\nNow analyze the following image and identify all aircraft present. Use the ontology descriptions and example images (where available) as reference. For classes without example images, use the text descriptions provided. Respond with a valid JSON object containing "count" (total aircraft detected), "aircraft" (array with class_id 0-6 for each aircraft), and optional "confidence" score.'
  });
  
  // Add the main image to analyze
  parts.push({
    inline_data: {
      mime_type: 'image/jpeg',
      data: imageBase64
    }
  });

  const response = await fetch(`${baseUrl}/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: parts
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1000,
        topP: 0.8,
        topK: 10
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Google Gemini API error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  console.log('Google Gemini API Response:', JSON.stringify(data, null, 2));

  // Check for safety filtering or other finish reasons
  const candidate = data.candidates?.[0];
  if (candidate?.finishReason) {
    console.log('Google Gemini finish reason:', candidate.finishReason);
    if (candidate.finishReason === 'SAFETY') {
      throw new Error('Google Gemini: Response blocked by safety filters');
    }
    if (candidate.finishReason === 'RECITATION') {
      throw new Error('Google Gemini: Response blocked due to recitation concerns');
    }
    if (candidate.finishReason === 'OTHER') {
      throw new Error(`Google Gemini: Response blocked (reason: ${candidate.finishReason})`);
    }
  }

  // Try multiple content extraction paths
  const content = candidate?.content?.parts?.[0]?.text || 
                  candidate?.text ||
                  data.text ||
                  data.response?.text;

  if (!content) {
    console.log('No content found. Response structure:', {
      candidates: data.candidates,
      firstCandidate: candidate,
      content: candidate?.content,
      parts: candidate?.content?.parts,
      finishReason: candidate?.finishReason,
      fullResponse: data
    });
    throw new Error('No response from Google Gemini - check console for details');
  }

  const duration = Date.now() - startTime;
  
  // Improved token estimation for Google Gemini
  // Gemini uses a different tokenization than simple character counting
  const estimatedInputTokens = estimateGeminiTokens(systemPrompt, imageBase64);
  const estimatedOutputTokens = estimateGeminiTokens(content);
  
  return {
    content,
    duration,
    usage: {
      prompt_tokens: estimatedInputTokens,
      completion_tokens: estimatedOutputTokens,
      total_tokens: estimatedInputTokens + estimatedOutputTokens
    }
  };
}

// Improved token estimation for Google Gemini
function estimateGeminiTokens(text: string, imageBase64?: string): number {
  // Gemini tokenization is closer to 1 token per 3-4 characters for text
  // This is more accurate than the simple /4 division
  let textTokens = Math.ceil(text.length / 3.5);
  
  if (imageBase64) {
    // For images, Gemini uses a more complex calculation
    // Base64 images are roughly 1 token per 4 characters, but with overhead
    const imageTokens = Math.ceil(imageBase64.length / 4) + 100; // Add overhead for image processing
    textTokens += imageTokens;
  }
  
  return textTokens;
}

// xAI Grok API call
async function callXAI(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  imageBase64: string,
  startTime: number,
  exampleImages?: OntologyExampleImage[]
): Promise<LLMApiResponse> {
  // Build user content array
  const userContent: any[] = [];
  
  // Build ontology content with images and text descriptions
  const ontologyContent = buildOntologyContent(exampleImages);
  
  // Add ontology text description
  userContent.push({
    type: 'text',
    text: ontologyContent.textContent
  });
  
  // Add example images for classes that have them
  if (ontologyContent.imageContent.length > 0) {
    userContent.push({
      type: 'text',
      text: '\nExample Images for Reference:\n'
    });
    
    ontologyContent.imageContent.forEach(img => {
      userContent.push({
        type: 'text',
        text: `\nExample image for Class ${img.classId} (${img.className}):`
      });
      userContent.push({
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${img.imageBase64}`
        }
      });
    });
  }
  
  // Add instruction text
  userContent.push({
    type: 'text',
    text: '\n\nNow analyze the following image and identify all aircraft present. Use the ontology descriptions and example images (where available) as reference. For classes without example images, use the text descriptions provided. Respond with a valid JSON object containing "count" (total aircraft detected), "aircraft" (array with class_id 0-6 for each aircraft), and optional "confidence" score.'
  });
  
  // Add the main image to analyze
  userContent.push({
    type: 'image_url',
    image_url: {
      url: `data:image/jpeg;base64,${imageBase64}`
    }
  });
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userContent
        }
      ],
      max_tokens: 1000,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`xAI API error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from xAI');
  }

  const duration = Date.now() - startTime;
  return {
    content,
    duration,
    usage: data.usage
  };
}