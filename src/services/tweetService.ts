const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-backend-url.com' 
  : 'http://localhost:3001';

export interface TweetResponse {
  success: boolean;
  tweetId?: string;
  tweetUrl?: string;
  error?: string;
}

export async function postTweet(tweetText: string): Promise<TweetResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tweet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tweetText }),
    });

    const result: TweetResponse = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to post tweet');
    }

    return result;
  } catch (error) {
    console.error('Tweet service error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}