import axios from 'axios';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_IMAGE_URL = 'https://api.openai.com/v1/images/generations';

export async function generateDalleImage(
  basePrompt: string,
  productNames?: string[]
): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required');
  let imagePrompt = '';
  if (productNames && productNames.length > 0) {
    imagePrompt = `A creative, eye-catching social media post image featuring ${productNames.join(', ')}, with a clean background and a modern, slightly artistic style. The image should be visually engaging, imaginative, and suitable for sharing on Instagram, Facebook, or LinkedIn. No charts, diagrams, or text—just the products/services presented in a unique, attractive way for marketing.`;
  } else {
    imagePrompt = 'A creative, eye-catching social media post image with a clean background and a modern, slightly artistic style. The image should be visually engaging, imaginative, and suitable for sharing on Instagram, Facebook, or LinkedIn. No charts, diagrams, or text—just attractive products or services presented in a unique, marketing-focused way.';
  }
  if (basePrompt && basePrompt.trim().length > 0) {
    imagePrompt = `${imagePrompt} ${basePrompt}`;
  }
  try {
    const response = await axios.post(
      OPENAI_IMAGE_URL,
      {
        model: 'dall-e-3',
        prompt: imagePrompt,
        n: 1,
        size: '1024x1024',
        response_format: 'url'
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const url = response.data.data[0]?.url;
    if (!url) throw new Error('No image URL returned from OpenAI');
    return url;
  } catch (error: any) {
    console.error('DALL-E image generation error:', error?.response?.data || error.message);
    throw new Error('Failed to generate image with DALL-E 3');
  }
} 