import { APIGatewayProxyEvent, APIGatewayProxyResult } from '../types';
import { successResponse, errorResponse, corsResponse } from '../lib/response';
import { requireAuth } from '../lib/auth';
import { z } from 'zod';

// Validation schema for OpenAI requests
const openaiRequestSchema = z.object({
  model: z.string(),
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string()
  })),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().min(1).max(4000).optional()
});

/**
 * OpenAI proxy endpoint for secure API calls
 */
export const openaiProxy = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Require authentication
    const user = requireAuth(event);
    
    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }

    const body = JSON.parse(event.body);
    
    // Validate input
    const validation = openaiRequestSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(
        `Validation failed: ${validation.error.errors.map(e => e.message).join(', ')}`, 
        422
      );
    }

    const { model, messages, temperature = 0.1, max_tokens = 2000 } = validation.data;

    // Check for OpenAI API key
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error('OpenAI API key not configured');
      return errorResponse('OpenAI service is not available', 503);
    }

    // Make request to OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      console.error('OpenAI API error:', errorData);
      return errorResponse(
        `OpenAI API error: ${openaiResponse.status} ${openaiResponse.statusText}`,
        openaiResponse.status
      );
    }

    const openaiData: any = await openaiResponse.json();

    // Validate OpenAI response structure
    if (!openaiData.choices || !openaiData.choices[0] || !openaiData.choices[0].message) {
      console.error('Invalid OpenAI response structure:', openaiData);
      return errorResponse('Invalid response from OpenAI API', 502);
    }

    // Log usage for monitoring (optional)
    console.log(`OpenAI request by user ${user.email}: ${model}, tokens: ${openaiData.usage?.total_tokens || 'unknown'}`);

    return successResponse(openaiData, 'OpenAI request completed successfully');

  } catch (error) {
    console.error('OpenAI proxy error:', error);
    return errorResponse('Internal server error', 500);
  }
}; 