import { z } from 'zod';

// Configuration schema with validation
export const ConfigSchema = z.object({
    apiKey: z.string().min(1, 'API Key is required'),
    apiSecretKey: z.string().min(1, 'API Secret Key is required'),
    accessToken: z.string().min(1, 'Access Token is required'),
    accessTokenSecret: z.string().min(1, 'Access Token Secret is required')
});

export type Config = z.infer<typeof ConfigSchema>;

// Tool input schemas
export const PostTweetSchema = z.object({
    text: z.string()
        .min(1, 'Tweet text cannot be empty')
        .max(280, 'Tweet cannot exceed 280 characters'),
    reply_to_tweet_id: z.string().optional()
});

export const SearchTweetsSchema = z.object({
    query: z.string().min(1, 'Search query cannot be empty'),
    count: z.number()
        .int('Count must be an integer')
        .min(10, 'Minimum count is 10')
        .max(100, 'Maximum count is 100')
});

// Media upload schemas
export const MediaUploadSchema = z.object({
    file_path: z.string().optional(),
    file_url: z.string().url().optional(),
    file_base64: z.string().optional(),
    media_type: z.enum(['image', 'video', 'gif']).optional(),
    alt_text: z.string().max(1000).optional()
}).refine(
    (data) => data.file_path || data.file_url || data.file_base64,
    { message: 'At least one of file_path, file_url, or file_base64 must be provided' }
);

// Poll schemas
// Twitter API v2 expects poll options as array of strings, not objects
export const PollSchema = z.object({
    options: z.array(z.string().min(1).max(25)).min(2).max(4),
    duration_minutes: z.number().int().min(5).max(10080)
});

// Update PostTweetSchema to include new options
export const PostTweetSchemaUpdated = z.object({
    text: z.string()
        .min(1, 'Tweet text cannot be empty')
        .max(280, 'Tweet cannot exceed 280 characters'),
    reply_to_tweet_id: z.string().optional(),
    quote_tweet_id: z.string().optional(),
    media_ids: z.array(z.string()).max(4).optional(),
    poll: PollSchema.optional()
}).refine(
    (data) => !(data.media_ids && data.poll),
    { message: 'Cannot include both media and poll in the same tweet' }
);

// New operation schemas
export const UploadMediaSchema = MediaUploadSchema;

export const CreateThreadSchema = z.object({
    tweets: z.array(z.string().min(1).max(280)).min(2).max(25)
});

export const DeleteTweetSchema = z.object({
    tweet_id: z.string().min(1)
});

export const LikeTweetSchema = z.object({
    tweet_id: z.string().min(1)
});

export const UnlikeTweetSchema = z.object({
    tweet_id: z.string().min(1)
});

export const RetweetSchema = z.object({
    tweet_id: z.string().min(1)
});

export const UnretweetSchema = z.object({
    tweet_id: z.string().min(1)
});

export const BookmarkTweetSchema = z.object({
    tweet_id: z.string().min(1)
});

export const UnbookmarkTweetSchema = z.object({
    tweet_id: z.string().min(1)
});

export const UserLookupSchema = z.object({
    username: z.string().optional(),
    user_id: z.string().optional()
}).refine(
    (data) => data.username || data.user_id,
    { message: 'Either username or user_id must be provided' }
);

export const FollowUserSchema = z.object({
    user_id: z.string().min(1)
});

export const UnfollowUserSchema = z.object({
    user_id: z.string().min(1)
});

export const UserTimelineSchema = z.object({
    user_id: z.string().min(1),
    max_results: z.number().int().min(5).max(100).default(10)
});

export type PostTweetArgs = z.infer<typeof PostTweetSchema>;
export type PostTweetArgsUpdated = z.infer<typeof PostTweetSchemaUpdated>;
export type UploadMediaArgs = z.infer<typeof UploadMediaSchema>;
export type CreateThreadArgs = z.infer<typeof CreateThreadSchema>;
export type DeleteTweetArgs = z.infer<typeof DeleteTweetSchema>;
export type LikeTweetArgs = z.infer<typeof LikeTweetSchema>;
export type UnlikeTweetArgs = z.infer<typeof UnlikeTweetSchema>;
export type RetweetArgs = z.infer<typeof RetweetSchema>;
export type UnretweetArgs = z.infer<typeof UnretweetSchema>;
export type BookmarkTweetArgs = z.infer<typeof BookmarkTweetSchema>;
export type UnbookmarkTweetArgs = z.infer<typeof UnbookmarkTweetSchema>;
export type UserLookupArgs = z.infer<typeof UserLookupSchema>;
export type FollowUserArgs = z.infer<typeof FollowUserSchema>;
export type UnfollowUserArgs = z.infer<typeof UnfollowUserSchema>;
export type UserTimelineArgs = z.infer<typeof UserTimelineSchema>;
export type SearchTweetsArgs = z.infer<typeof SearchTweetsSchema>;

// API Response types
export interface TweetMetrics {
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
}

export interface PostedTweet {
    id: string;
    text: string;
    url?: string;
}

export interface PostedThread {
    tweets: PostedTweet[];
    thread_url: string;
}

export interface MediaUploadResult {
    media_id: string;
    media_id_string: string;
    size: number;
    expires_after_secs?: number;
}

export interface Tweet {
    id: string;
    text: string;
    authorId: string;
    metrics: TweetMetrics;
    createdAt: string;
}

export interface TwitterUser {
    id: string;
    username: string;
    name?: string;
    verified?: boolean;
    followers_count?: number;
    following_count?: number;
    tweet_count?: number;
}

// Error types
export class TwitterError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly status?: number
    ) {
        super(message);
        this.name = 'TwitterError';
    }

    static isRateLimit(error: unknown): error is TwitterError {
        return error instanceof TwitterError && error.code === 'rate_limit_exceeded';
    }
}

// Response formatter types
export interface FormattedTweet {
    position: number;
    author: {
        username: string;
    };
    content: string;
    metrics: TweetMetrics;
    url: string;
}

export interface SearchResponse {
    query: string;
    count: number;
    tweets: FormattedTweet[];
}