import { TwitterApi } from 'twitter-api-v2';
import { 
    Config, 
    TwitterError, 
    Tweet, 
    TwitterUser, 
    PostedTweet,
    PostedThread,
    MediaUploadResult,
    PostTweetArgsUpdated
} from './types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

export class TwitterClient {
  private client: TwitterApi;
  private rateLimitMap = new Map<string, { count: number; resetAt: number }>();

  constructor(config: Config) {
    this.client = new TwitterApi({
      appKey: config.apiKey,
      appSecret: config.apiSecretKey,
      accessToken: config.accessToken,
      accessSecret: config.accessTokenSecret,
    });

    console.error('Twitter API client initialized');
  }

  async postTweet(
    text: string, 
    options?: {
      replyToTweetId?: string;
      quoteTweetId?: string;
      mediaIds?: string[];
      poll?: { options: Array<{ label: string; position: number }>; duration_minutes: number };
    }
  ): Promise<PostedTweet> {
    try {
      const endpoint = 'tweets/create';
      await this.checkRateLimit(endpoint);

      const tweetOptions: any = { text };
      
      if (options?.replyToTweetId) {
        tweetOptions.reply = { in_reply_to_tweet_id: options.replyToTweetId };
      }
      
      if (options?.quoteTweetId) {
        tweetOptions.quote_tweet_id = options.quoteTweetId;
      }
      
      if (options?.mediaIds && options.mediaIds.length > 0) {
        tweetOptions.media = { media_ids: options.mediaIds };
      }
      
      if (options?.poll) {
        // Twitter API v2 expects poll options as array of strings
        tweetOptions.poll = {
          options: options.poll.options.map((opt: any) => 
            typeof opt === 'string' ? opt : opt.label || opt
          ),
          duration_minutes: options.poll.duration_minutes
        };
      }

      const response = await this.client.v2.tweet(tweetOptions);
      
      console.error(`Tweet posted successfully with ID: ${response.data.id}`);
      
      return {
        id: response.data.id,
        text: response.data.text,
        url: `https://twitter.com/status/${response.data.id}`
      };
    } catch (error) {
      this.handleApiError(error);
    }
  }

  async searchTweets(query: string, count: number): Promise<{ tweets: Tweet[], users: TwitterUser[] }> {
    try {
      const endpoint = 'tweets/search';
      await this.checkRateLimit(endpoint);

      const response = await this.client.v2.search(query, {
        max_results: count,
        expansions: ['author_id'],
        'tweet.fields': ['public_metrics', 'created_at'],
        'user.fields': ['username', 'name', 'verified']
      });

      console.error(`Fetched ${response.tweets.length} tweets for query: "${query}"`);

      const tweets = response.tweets.map(tweet => ({
        id: tweet.id,
        text: tweet.text,
        authorId: tweet.author_id ?? '',
        metrics: {
          likes: tweet.public_metrics?.like_count ?? 0,
          retweets: tweet.public_metrics?.retweet_count ?? 0,
          replies: tweet.public_metrics?.reply_count ?? 0,
          quotes: tweet.public_metrics?.quote_count ?? 0
        },
        createdAt: tweet.created_at ?? ''
      }));

      const users = response.includes.users.map(user => ({
        id: user.id,
        username: user.username,
        name: user.name,
        verified: user.verified ?? false
      }));

      return { tweets, users };
    } catch (error) {
      this.handleApiError(error);
    }
  }

  async uploadMedia(
    filePath?: string,
    fileUrl?: string,
    fileBase64?: string,
    mediaType?: 'image' | 'video' | 'gif',
    altText?: string
  ): Promise<MediaUploadResult> {
    try {
      const endpoint = 'media/upload';
      await this.checkRateLimit(endpoint);

      let mediaBuffer: Buffer;
      let detectedType: string;

      // Handle different input types
      if (filePath) {
        if (!fs.existsSync(filePath)) {
          throw new TwitterError(`File not found: ${filePath}`, 'file_not_found', 404);
        }
        mediaBuffer = fs.readFileSync(filePath);
        detectedType = this.detectMediaType(filePath);
      } else if (fileUrl) {
        mediaBuffer = await this.downloadFile(fileUrl);
        detectedType = this.detectMediaTypeFromBuffer(mediaBuffer) || mediaType || 'image';
      } else if (fileBase64) {
        mediaBuffer = Buffer.from(fileBase64, 'base64');
        detectedType = mediaType || 'image';
      } else {
        throw new TwitterError('No media file provided', 'invalid_input', 400);
      }

      // Upload media using v1.1 endpoint (required for media uploads)
      const mediaId = await this.client.v1.uploadMedia(mediaBuffer, {
        mimeType: this.getMimeType(detectedType)
      });

      // Add alt text if provided
      if (altText && mediaId) {
        try {
          await this.client.v1.createMediaMetadata(mediaId, { alt_text: { text: altText } });
        } catch (error) {
          console.error('Warning: Failed to add alt text:', error);
          // Continue even if alt text fails
        }
      }

      console.error(`Media uploaded successfully with ID: ${mediaId}`);

      return {
        media_id: mediaId.toString(),
        media_id_string: mediaId.toString(),
        size: mediaBuffer.length
      };
    } catch (error) {
      this.handleApiError(error);
    }
  }

  async createThread(tweets: string[]): Promise<PostedThread> {
    try {
      const endpoint = 'tweets/create';
      const postedTweets: PostedTweet[] = [];
      let previousTweetId: string | undefined;

      for (let i = 0; i < tweets.length; i++) {
        await this.checkRateLimit(endpoint);
        
        const tweetOptions: any = { text: tweets[i] };
        if (previousTweetId) {
          tweetOptions.reply = { in_reply_to_tweet_id: previousTweetId };
        }

        const response = await this.client.v2.tweet(tweetOptions);
        const postedTweet: PostedTweet = {
          id: response.data.id,
          text: response.data.text,
          url: `https://twitter.com/status/${response.data.id}`
        };
        
        postedTweets.push(postedTweet);
        previousTweetId = response.data.id;

        // Small delay between tweets to avoid rate limits
        if (i < tweets.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const threadUrl = postedTweets[0]?.url || '';
      
      console.error(`Thread created successfully with ${postedTweets.length} tweets`);

      return {
        tweets: postedTweets,
        thread_url: threadUrl
      };
    } catch (error) {
      this.handleApiError(error);
    }
  }

  async deleteTweet(tweetId: string): Promise<void> {
    try {
      const endpoint = 'tweets/delete';
      await this.checkRateLimit(endpoint);

      await this.client.v2.deleteTweet(tweetId);
      console.error(`Tweet ${tweetId} deleted successfully`);
    } catch (error) {
      this.handleApiError(error);
    }
  }

  async likeTweet(tweetId: string): Promise<void> {
    try {
      const endpoint = 'likes/create';
      await this.checkRateLimit(endpoint);

      const me = await this.client.v2.me();
      console.error(`Like: Authenticated user ID: ${me.data.id}`);
      console.error(`Like: Attempting to like tweet: ${tweetId}`);
      const result = await this.client.v2.like(me.data.id, tweetId);
      console.error(`Like: Result:`, JSON.stringify(result, null, 2));
      console.error(`Tweet ${tweetId} liked successfully`);
    } catch (error) {
      console.error(`Like: Error caught:`, error);
      this.handleApiError(error);
    }
  }

  async unlikeTweet(tweetId: string): Promise<void> {
    try {
      const endpoint = 'likes/delete';
      await this.checkRateLimit(endpoint);

      const me = await this.client.v2.me();
      await this.client.v2.unlike(me.data.id, tweetId);
      console.error(`Tweet ${tweetId} unliked successfully`);
    } catch (error) {
      this.handleApiError(error);
    }
  }

  async retweet(tweetId: string): Promise<void> {
    try {
      const endpoint = 'retweets/create';
      await this.checkRateLimit(endpoint);

      const me = await this.client.v2.me();
      await this.client.v2.retweet(me.data.id, tweetId);
      console.error(`Tweet ${tweetId} retweeted successfully`);
    } catch (error) {
      this.handleApiError(error);
    }
  }

  async unretweet(tweetId: string): Promise<void> {
    try {
      const endpoint = 'retweets/delete';
      await this.checkRateLimit(endpoint);

      const me = await this.client.v2.me();
      await this.client.v2.unretweet(me.data.id, tweetId);
      console.error(`Tweet ${tweetId} unretweeted successfully`);
    } catch (error) {
      this.handleApiError(error);
    }
  }

  async bookmarkTweet(tweetId: string): Promise<void> {
    try {
      const endpoint = 'bookmarks/create';
      await this.checkRateLimit(endpoint);

      const me = await this.client.v2.me();
      console.error(`Bookmark: Authenticated user ID: ${me.data.id}`);
      console.error(`Bookmark: Attempting to bookmark tweet: ${tweetId}`);
      const result = await this.client.v2.bookmark(tweetId);
      console.error(`Bookmark: Result:`, JSON.stringify(result, null, 2));
      console.error(`Tweet ${tweetId} bookmarked successfully`);
    } catch (error) {
      console.error(`Bookmark: Error caught:`, error);
      this.handleApiError(error);
    }
  }

  async unbookmarkTweet(tweetId: string): Promise<void> {
    try {
      const endpoint = 'bookmarks/delete';
      await this.checkRateLimit(endpoint);

      // Use deleteBookmark method from library
      await this.client.v2.deleteBookmark(tweetId);
      console.error(`Tweet ${tweetId} unbookmarked successfully`);
    } catch (error) {
      this.handleApiError(error);
    }
  }

  async getUserByUsername(username: string): Promise<TwitterUser> {
    try {
      const endpoint = 'users/by/username';
      await this.checkRateLimit(endpoint);

      const response = await this.client.v2.userByUsername(username, {
        'user.fields': ['username', 'name', 'verified', 'public_metrics']
      });

      if (!response.data) {
        throw new TwitterError(`User not found: ${username}`, 'user_not_found', 404);
      }

      return {
        id: response.data.id,
        username: response.data.username,
        name: response.data.name,
        verified: response.data.verified,
        followers_count: response.data.public_metrics?.followers_count,
        following_count: response.data.public_metrics?.following_count,
        tweet_count: response.data.public_metrics?.tweet_count
      };
    } catch (error) {
      this.handleApiError(error);
    }
  }

  async getUserById(userId: string): Promise<TwitterUser> {
    try {
      const endpoint = 'users';
      await this.checkRateLimit(endpoint);

      const response = await this.client.v2.user(userId, {
        'user.fields': ['username', 'name', 'verified', 'public_metrics']
      });

      if (!response.data) {
        throw new TwitterError(`User not found: ${userId}`, 'user_not_found', 404);
      }

      return {
        id: response.data.id,
        username: response.data.username,
        name: response.data.name,
        verified: response.data.verified,
        followers_count: response.data.public_metrics?.followers_count,
        following_count: response.data.public_metrics?.following_count,
        tweet_count: response.data.public_metrics?.tweet_count
      };
    } catch (error) {
      this.handleApiError(error);
    }
  }

  async followUser(userId: string): Promise<void> {
    try {
      const endpoint = 'follows/create';
      await this.checkRateLimit(endpoint);

      const me = await this.client.v2.me();
      console.error(`Follow: Authenticated user ID: ${me.data.id}`);
      console.error(`Follow: Attempting to follow user: ${userId}`);
      const result = await this.client.v2.follow(me.data.id, userId);
      console.error(`Follow: Result:`, JSON.stringify(result, null, 2));
      console.error(`User ${userId} followed successfully`);
    } catch (error) {
      console.error(`Follow: Error caught:`, error);
      this.handleApiError(error);
    }
  }

  async unfollowUser(userId: string): Promise<void> {
    try {
      const endpoint = 'follows/delete';
      await this.checkRateLimit(endpoint);

      const me = await this.client.v2.me();
      await this.client.v2.unfollow(me.data.id, userId);
      console.error(`User ${userId} unfollowed successfully`);
    } catch (error) {
      this.handleApiError(error);
    }
  }

  async getUserTimeline(userId: string, maxResults: number = 10): Promise<{ tweets: Tweet[], users: TwitterUser[] }> {
    try {
      const endpoint = 'users/timeline';
      await this.checkRateLimit(endpoint);

      const response = await this.client.v2.userTimeline(userId, {
        max_results: maxResults,
        expansions: ['author_id'],
        'tweet.fields': ['public_metrics', 'created_at'],
        'user.fields': ['username', 'name', 'verified']
      });

      const tweets = response.tweets.map(tweet => ({
        id: tweet.id,
        text: tweet.text,
        authorId: tweet.author_id ?? '',
        metrics: {
          likes: tweet.public_metrics?.like_count ?? 0,
          retweets: tweet.public_metrics?.retweet_count ?? 0,
          replies: tweet.public_metrics?.reply_count ?? 0,
          quotes: tweet.public_metrics?.quote_count ?? 0
        },
        createdAt: tweet.created_at ?? ''
      }));

      const users = response.includes.users.map(user => ({
        id: user.id,
        username: user.username,
        name: user.name,
        verified: user.verified ?? false
      }));

      return { tweets, users };
    } catch (error) {
      this.handleApiError(error);
    }
  }

  // Helper methods
  private detectMediaType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const typeMap: Record<string, string> = {
      '.jpg': 'image',
      '.jpeg': 'image',
      '.png': 'image',
      '.gif': 'image',
      '.webp': 'image',
      '.mp4': 'video',
      '.mov': 'video',
      '.m4v': 'video'
    };
    return typeMap[ext] || 'image';
  }

  private detectMediaTypeFromBuffer(buffer: Buffer): string | null {
    // Check magic bytes
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) return 'image'; // JPEG
    if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image'; // PNG
    if (buffer.slice(0, 6).toString() === 'GIF89a' || buffer.slice(0, 6).toString() === 'GIF87a') return 'gif';
    if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) return 'video'; // MP4
    return null;
  }

  private getMimeType(mediaType: string): string {
    const mimeMap: Record<string, string> = {
      'image': 'image/jpeg',
      'gif': 'image/gif',
      'video': 'video/mp4'
    };
    return mimeMap[mediaType] || 'image/jpeg';
  }

  private async downloadFile(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      protocol.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new TwitterError(`Failed to download file: ${response.statusCode}`, 'download_failed', response.statusCode));
          return;
        }
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      }).on('error', reject);
    });
  }

  private async checkRateLimit(endpoint: string): Promise<void> {
    const limit = this.rateLimitMap.get(endpoint);
    const now = Date.now();

    if (limit) {
      if (now < limit.resetAt) {
        if (limit.count >= 100) { // Conservative limit
          const waitTime = limit.resetAt - now;
          throw new TwitterError(
            `Rate limit exceeded for ${endpoint}. Reset in ${Math.ceil(waitTime / 1000)}s`,
            'rate_limit_exceeded',
            429
          );
        }
      } else {
        // Reset expired
        this.rateLimitMap.delete(endpoint);
      }
    }

    // Update count
    if (!this.rateLimitMap.has(endpoint)) {
      this.rateLimitMap.set(endpoint, { count: 1, resetAt: now + 900000 }); // 15 min window
    } else {
      const current = this.rateLimitMap.get(endpoint)!;
      current.count++;
    }
  }

  private handleApiError(error: unknown): never {
    if (error instanceof TwitterError) {
      throw error;
    }

    // Handle twitter-api-v2 errors
    const apiError = error as any;
    
    // Log full error for debugging
    console.error('Twitter API Error Details:', {
      error,
      code: apiError.code,
      status: apiError.status,
      message: apiError.message,
      data: apiError.data,
      rateLimit: apiError.rateLimit,
      errors: apiError.errors,
      fullError: JSON.stringify(apiError, null, 2)
    });
    
    if (apiError.code || apiError.status) {
      const code = apiError.code || apiError.data?.title || 'api_error';
      const status = apiError.status || apiError.data?.status || 500;
      const message = apiError.message || apiError.data?.detail || apiError.data?.title || 'Twitter API error';
      
      // Include additional error details if available
      let detailedMessage = message;
      if (apiError.errors && Array.isArray(apiError.errors) && apiError.errors.length > 0) {
        const errorDetails = apiError.errors.map((e: any) => `${e.message || e.code || ''}`).join('; ');
        detailedMessage = `${message} - ${errorDetails}`;
      }
      
      // Include data.detail and data.title if available
      if (apiError.data) {
        if (apiError.data.detail && !detailedMessage.includes(apiError.data.detail)) {
          detailedMessage = `${detailedMessage} | Detail: ${apiError.data.detail}`;
        }
        if (apiError.data.title && !detailedMessage.includes(apiError.data.title)) {
          detailedMessage = `${detailedMessage} | Title: ${apiError.data.title}`;
        }
        if (apiError.data.type) {
          detailedMessage = `${detailedMessage} | Type: ${apiError.data.type}`;
        }
      }
      
      // Check for rate limit
      if (status === 429 || code === 'TooManyRequests') {
        throw new TwitterError(detailedMessage, 'rate_limit_exceeded', 429);
      }
      
      throw new TwitterError(detailedMessage, code, status);
    }

    // Handle unexpected errors
    console.error('Unexpected error in Twitter client:', error);
    throw new TwitterError(
      'An unexpected error occurred',
      'internal_error',
      500
    );
  }
}