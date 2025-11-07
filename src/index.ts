#!/usr/bin/env node
/**
 * Twitter MCP Server
 * 
 * NOTE: Some Twitter API v2 endpoints are not implemented due to requirements:
 * 
 * 1. like_tweet, unlike_tweet, follow_user, unfollow_user - Not implemented
 *    Reason: Twitter API v2 requires the app to be attached to a Project in the Developer Portal.
 *    Error: "When authenticating requests to the Twitter API v2 endpoints, you must use keys and tokens
 *    from a Twitter developer App that is attached to a Project."
 *    Unlike/unfollow cannot be verified to work since we cannot like/follow in the first place.
 *    See: 403_ERROR_SOLUTION.md for details
 * 
 * 2. bookmark_tweet and unbookmark_tweet - Not implemented
 *    Reason: Twitter API v2 bookmark endpoints require OAuth 2.0 User Context authentication,
 *    not OAuth 1.0a which is currently used by this server.
 *    Error: "Authenticating with OAuth 1.0a User Context is forbidden for this endpoint.
 *    Supported authentication types are [OAuth 2.0 User Context]."
 *    See: 403_ERROR_SOLUTION.md for details
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  Tool,
  ErrorCode,
  McpError,
  TextContent
} from '@modelcontextprotocol/sdk/types.js';
import { TwitterClient } from './twitter-api.js';
import { ResponseFormatter } from './formatter.js';
import {
  Config, ConfigSchema,
  PostTweetSchema, PostTweetSchemaUpdated, SearchTweetsSchema,
  UploadMediaSchema, CreateThreadSchema, DeleteTweetSchema,
  // LikeTweetSchema, UnlikeTweetSchema removed - like/unlike tools not implemented (require Project attachment)
  RetweetSchema, UnretweetSchema,
  // BookmarkTweetSchema, UnbookmarkTweetSchema removed - bookmark tools not implemented (require OAuth 2.0)
  UserLookupSchema,
  // FollowUserSchema, UnfollowUserSchema removed - follow/unfollow tools not implemented (require Project attachment)
  UserTimelineSchema,
  TwitterError
} from './types.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

export class TwitterServer {
  private server: Server;
  private client: TwitterClient;

  constructor(config: Config) {
    // Validate config
    const result = ConfigSchema.safeParse(config);
    if (!result.success) {
      throw new Error(`Invalid configuration: ${result.error.message}`);
    }

    this.client = new TwitterClient(config);
    this.server = new Server({
      name: 'twitter-mcp',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Error handler
    this.server.onerror = (error) => {
      console.error('[MCP Error]:', error);
    };

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.error('Shutting down server...');
      await this.server.close();
      process.exit(0);
    });

    // Register tool handlers
    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'post_tweet',
          description: 'Post a new tweet to Twitter. Supports text, media, polls, replies, and quote tweets.',
          inputSchema: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: 'The content of your tweet',
                maxLength: 280
              },
              reply_to_tweet_id: {
                type: 'string',
                description: 'Optional: ID of the tweet to reply to'
              },
              quote_tweet_id: {
                type: 'string',
                description: 'Optional: ID of the tweet to quote'
              },
              media_ids: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional: Array of media IDs (max 4) from upload_media',
                maxItems: 4
              },
              poll: {
                type: 'object',
                description: 'Optional: Poll options (cannot be used with media). Options should be array of strings.',
                properties: {
                  options: {
                    type: 'array',
                    items: { type: 'string', maxLength: 25 },
                    description: 'Array of poll option labels (2-4 options)',
                    minItems: 2,
                    maxItems: 4
                  },
                  duration_minutes: {
                    type: 'number',
                    minimum: 5,
                    maximum: 10080,
                    description: 'Poll duration in minutes (5-10080)'
                  }
                },
                required: ['options', 'duration_minutes']
              }
            },
            required: ['text']
          }
        } as Tool,
        {
          name: 'upload_media',
          description: 'Upload media (image, video, or GIF) to Twitter. Returns media_id for use in post_tweet.',
          inputSchema: {
            type: 'object',
            properties: {
              file_path: {
                type: 'string',
                description: 'Path to local media file'
              },
              file_url: {
                type: 'string',
                description: 'URL to download media from'
              },
              file_base64: {
                type: 'string',
                description: 'Base64-encoded media data'
              },
              media_type: {
                type: 'string',
                enum: ['image', 'video', 'gif'],
                description: 'Type of media (auto-detected if not provided)'
              },
              alt_text: {
                type: 'string',
                maxLength: 1000,
                description: 'Optional: Alt text for accessibility'
              }
            },
            required: []
          }
        } as Tool,
        {
          name: 'create_thread',
          description: 'Create a Twitter thread by posting multiple connected tweets',
          inputSchema: {
            type: 'object',
            properties: {
              tweets: {
                type: 'array',
                items: { type: 'string', maxLength: 280 },
                description: 'Array of tweet texts (2-25 tweets)',
                minItems: 2,
                maxItems: 25
              }
            },
            required: ['tweets']
          }
        } as Tool,
        {
          name: 'delete_tweet',
          description: 'Delete a tweet by its ID',
          inputSchema: {
            type: 'object',
            properties: {
              tweet_id: {
                type: 'string',
                description: 'ID of the tweet to delete'
              }
            },
            required: ['tweet_id']
          }
        } as Tool,
        // NOTE: like_tweet and unlike_tweet are not implemented
        // Reason: Twitter API v2 requires the app to be attached to a Project in the Developer Portal.
        // Error: "When authenticating requests to the Twitter API v2 endpoints, you must use keys and tokens
        // from a Twitter developer App that is attached to a Project."
        // Unlike/unfollow cannot be verified to work since we cannot like/follow in the first place.
        // See: 403_ERROR_SOLUTION.md for details
        {
          name: 'retweet',
          description: 'Retweet a tweet',
          inputSchema: {
            type: 'object',
            properties: {
              tweet_id: { type: 'string', description: 'ID of the tweet to retweet' }
            },
            required: ['tweet_id']
          }
        } as Tool,
        {
          name: 'unretweet',
          description: 'Unretweet a tweet',
          inputSchema: {
            type: 'object',
            properties: {
              tweet_id: { type: 'string', description: 'ID of the tweet to unretweet' }
            },
            required: ['tweet_id']
          }
        } as Tool,
        // NOTE: bookmark_tweet and unbookmark_tweet are not implemented
        // Reason: Twitter API v2 bookmark endpoints require OAuth 2.0 User Context authentication,
        // not OAuth 1.0a which is currently used by this server.
        // Error: "Authenticating with OAuth 1.0a User Context is forbidden for this endpoint.
        // Supported authentication types are [OAuth 2.0 User Context]."
        // See: 403_ERROR_SOLUTION.md for details
        {
          name: 'get_user',
          description: 'Get user information by username or user ID',
          inputSchema: {
            type: 'object',
            properties: {
              username: {
                type: 'string',
                description: 'Username (without @)'
              },
              user_id: {
                type: 'string',
                description: 'User ID'
              }
            },
            required: []
          }
        } as Tool,
        // NOTE: follow_user and unfollow_user are not implemented
        // Reason: Twitter API v2 requires the app to be attached to a Project in the Developer Portal.
        // Error: "When authenticating requests to the Twitter API v2 endpoints, you must use keys and tokens
        // from a Twitter developer App that is attached to a Project."
        // Unlike/unfollow cannot be verified to work since we cannot like/follow in the first place.
        // See: 403_ERROR_SOLUTION.md for details
        {
          name: 'get_user_timeline',
          description: 'Get a user\'s timeline (their tweets)',
          inputSchema: {
            type: 'object',
            properties: {
              user_id: {
                type: 'string',
                description: 'ID of the user'
              },
              max_results: {
                type: 'number',
                minimum: 5,
                maximum: 100,
                default: 10,
                description: 'Number of tweets to return'
              }
            },
            required: ['user_id']
          }
        } as Tool,
        {
          name: 'search_tweets',
          description: 'Search for tweets on Twitter',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query'
              },
              count: {
                type: 'number',
                description: 'Number of tweets to return (10-100)',
                minimum: 10,
                maximum: 100
              }
            },
            required: ['query', 'count']
          }
        } as Tool
      ]
    }));

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      console.error(`Tool called: ${name}`, args);

      try {
        switch (name) {
          case 'post_tweet':
            return await this.handlePostTweet(args);
          case 'upload_media':
            return await this.handleUploadMedia(args);
          case 'create_thread':
            return await this.handleCreateThread(args);
          case 'delete_tweet':
            return await this.handleDeleteTweet(args);
          // like_tweet and unlike_tweet removed - require Project attachment (see 403_ERROR_SOLUTION.md)
          case 'retweet':
            return await this.handleRetweet(args);
          case 'unretweet':
            return await this.handleUnretweet(args);
          // bookmark_tweet and unbookmark_tweet removed - require OAuth 2.0 (see 403_ERROR_SOLUTION.md)
          case 'get_user':
            return await this.handleGetUser(args);
          // follow_user and unfollow_user removed - require Project attachment (see 403_ERROR_SOLUTION.md)
          case 'get_user_timeline':
            return await this.handleGetUserTimeline(args);
          case 'search_tweets':
            return await this.handleSearchTweets(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        return this.handleError(error);
      }
    });
  }

  private async handlePostTweet(args: unknown) {
    const result = PostTweetSchemaUpdated.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`
      );
    }

    const tweet = await this.client.postTweet(result.data.text, {
      replyToTweetId: result.data.reply_to_tweet_id,
      quoteTweetId: result.data.quote_tweet_id,
      mediaIds: result.data.media_ids,
      poll: result.data.poll ? {
        // Convert options to string array if needed
        options: result.data.poll.options.map((opt: any) => 
          typeof opt === 'string' ? opt : opt.label || opt
        ),
        duration_minutes: result.data.poll.duration_minutes
      } : undefined
    });
    
    return {
      content: [{
        type: 'text',
        text: `Tweet posted successfully!\nURL: ${tweet.url || `https://twitter.com/status/${tweet.id}`}`
      }] as TextContent[]
    };
  }

  private async handleUploadMedia(args: unknown) {
    const result = UploadMediaSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`
      );
    }

    const media = await this.client.uploadMedia(
      result.data.file_path,
      result.data.file_url,
      result.data.file_base64,
      result.data.media_type,
      result.data.alt_text
    );

    return {
      content: [{
        type: 'text',
        text: `Media uploaded successfully!\nMedia ID: ${media.media_id}\nSize: ${media.size} bytes\n\nUse this media_id in post_tweet with media_ids parameter.`
      }] as TextContent[]
    };
  }

  private async handleCreateThread(args: unknown) {
    const result = CreateThreadSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`
      );
    }

    const thread = await this.client.createThread(result.data.tweets);

    const tweetList = thread.tweets.map((tweet, i) => 
      `${i + 1}. ${tweet.text}\n   URL: ${tweet.url}`
    ).join('\n\n');

    return {
      content: [{
        type: 'text',
        text: `Thread created successfully with ${thread.tweets.length} tweets!\n\n${tweetList}\n\nThread URL: ${thread.thread_url}`
      }] as TextContent[]
    };
  }

  private async handleDeleteTweet(args: unknown) {
    const result = DeleteTweetSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`
      );
    }

    await this.client.deleteTweet(result.data.tweet_id);

    return {
      content: [{
        type: 'text',
        text: `Tweet ${result.data.tweet_id} deleted successfully`
      }] as TextContent[]
    };
  }

  // NOTE: handleLikeTweet and handleUnlikeTweet removed
  // Reason: Twitter API v2 requires the app to be attached to a Project in the Developer Portal.
  // Error: "When authenticating requests to the Twitter API v2 endpoints, you must use keys and tokens
  // from a Twitter developer App that is attached to a Project."
  // Unlike cannot be verified to work since we cannot like in the first place.
  // See: 403_ERROR_SOLUTION.md for details

  private async handleRetweet(args: unknown) {
    const result = RetweetSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`
      );
    }

    await this.client.retweet(result.data.tweet_id);

    return {
      content: [{
        type: 'text',
        text: `Tweet ${result.data.tweet_id} retweeted successfully`
      }] as TextContent[]
    };
  }

  private async handleUnretweet(args: unknown) {
    const result = UnretweetSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`
      );
    }

    await this.client.unretweet(result.data.tweet_id);

    return {
      content: [{
        type: 'text',
        text: `Tweet ${result.data.tweet_id} unretweeted successfully`
      }] as TextContent[]
    };
  }

  // NOTE: handleBookmarkTweet and handleUnbookmarkTweet removed
  // Reason: Twitter API v2 bookmark endpoints require OAuth 2.0 User Context authentication,
  // not OAuth 1.0a which is currently used by this server.
  // Error: "Authenticating with OAuth 1.0a User Context is forbidden for this endpoint.
  // Supported authentication types are [OAuth 2.0 User Context]."
  // See: 403_ERROR_SOLUTION.md for details

  private async handleGetUser(args: unknown) {
    const result = UserLookupSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`
      );
    }

    const user = result.data.username
      ? await this.client.getUserByUsername(result.data.username)
      : await this.client.getUserById(result.data.user_id!);

    const userInfo = [
      `User: @${user.username}`,
      `Name: ${user.name || 'N/A'}`,
      `ID: ${user.id}`,
      user.verified ? 'Verified: Yes' : '',
      user.followers_count !== undefined ? `Followers: ${user.followers_count.toLocaleString()}` : '',
      user.following_count !== undefined ? `Following: ${user.following_count.toLocaleString()}` : '',
      user.tweet_count !== undefined ? `Tweets: ${user.tweet_count.toLocaleString()}` : ''
    ].filter(Boolean).join('\n');

    return {
      content: [{
        type: 'text',
        text: userInfo
      }] as TextContent[]
    };
  }

  // NOTE: handleFollowUser and handleUnfollowUser removed
  // Reason: Twitter API v2 requires the app to be attached to a Project in the Developer Portal.
  // Error: "When authenticating requests to the Twitter API v2 endpoints, you must use keys and tokens
  // from a Twitter developer App that is attached to a Project."
  // Unfollow cannot be verified to work since we cannot follow in the first place.
  // See: 403_ERROR_SOLUTION.md for details

  private async handleGetUserTimeline(args: unknown) {
    const result = UserTimelineSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`
      );
    }

    const { tweets, users } = await this.client.getUserTimeline(
      result.data.user_id,
      result.data.max_results
    );

    const formattedResponse = ResponseFormatter.formatSearchResponse(
      `User ${result.data.user_id} timeline`,
      tweets,
      users
    );

    return {
      content: [{
        type: 'text',
        text: ResponseFormatter.toMcpResponse(formattedResponse)
      }] as TextContent[]
    };
  }

  private async handleSearchTweets(args: unknown) {
    const result = SearchTweetsSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`
      );
    }

    const { tweets, users } = await this.client.searchTweets(
      result.data.query,
      result.data.count
    );

    const formattedResponse = ResponseFormatter.formatSearchResponse(
      result.data.query,
      tweets,
      users
    );

    return {
      content: [{
        type: 'text',
        text: ResponseFormatter.toMcpResponse(formattedResponse)
      }] as TextContent[]
    };
  }

  private handleError(error: unknown) {
    if (error instanceof McpError) {
      throw error;
    }

    if (error instanceof TwitterError) {
      if (TwitterError.isRateLimit(error)) {
        return {
          content: [{
            type: 'text',
            text: 'Rate limit exceeded. Please wait a moment before trying again.',
            isError: true
          }] as TextContent[]
        };
      }

      return {
        content: [{
          type: 'text',
          text: `Twitter API error: ${(error as TwitterError).message}`,
          isError: true
        }] as TextContent[]
      };
    }

    console.error('Unexpected error:', error);
    throw new McpError(
      ErrorCode.InternalError,
      'An unexpected error occurred'
    );
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Twitter MCP server running on stdio');
  }
}

// Start the server
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const config = {
  apiKey: process.env.API_KEY!,
  apiSecretKey: process.env.API_SECRET_KEY!,
  accessToken: process.env.ACCESS_TOKEN!,
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET!
};

const server = new TwitterServer(config);
server.start().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});