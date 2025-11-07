# OAuth Configuration Fix Guide

Based on the [Twitter API v2 Authentication Mapping](https://docs.x.com/fundamentals/authentication/guides/v2-authentication-mapping), here's what we found:

## Key Finding: OAuth 1.0a User Context Should Work!

According to the documentation, **all three failing endpoints support OAuth 1.0a User Context**:

1. **Like a Tweet** (`POST /2/users/:id/likes`)
   - ✅ OAuth 1.0a User Context: **Supported**
   - ✅ OAuth 2.0 App Only: Supported (with scopes: `tweet.read`, `users.read`, `like.write`)

2. **Bookmark a Tweet** (`POST /2/tweets/:id/bookmarks`)
   - ✅ OAuth 1.0a User Context: **Supported** (requires scopes: `tweet.read`, `users.read`, `bookmark.write`)
   - ❌ OAuth 2.0 App Only: **Not supported**

3. **Follow a User** (`POST /2/users/:id/following`)
   - ✅ OAuth 1.0a User Context: **Supported**
   - ✅ OAuth 2.0 App Only: Supported (with scopes: `tweet.read`, `users.read`, `follows.write`)

## Current Setup

We're using **OAuth 1.0a User Context** (which is correct!):
```typescript
this.client = new TwitterApi({
  appKey: config.apiKey,
  appSecret: config.apiSecretKey,
  accessToken: config.accessToken,
  accessSecret: config.accessTokenSecret,
});
```

## The Problem

The 403 errors suggest that the **app permissions** in the Twitter Developer Portal aren't set correctly. Even though we're using OAuth 1.0a User Context, the app needs to have the right permissions enabled.

## Solution: Fix App Permissions in Twitter Developer Portal

### Step 1: Check App Type
1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/projects-and-apps)
2. Navigate to your app
3. Go to **Settings** → **User authentication settings**
4. Verify **App permissions** are set to **"Read and write"** (not just "Read")

### Step 2: Enable Required Permissions
The app needs these permissions enabled:
- ✅ **Read** (for `tweet.read`, `users.read`)
- ✅ **Write** (for `tweet.write`, `like.write`, `follows.write`)
- ✅ **Bookmark** (for `bookmark.write`)

### Step 3: Verify App Type
- **Type of App**: Should be set to **"Web App, Automated App or Bot"**
- **App environment**: Should be set to **"Confidential client"**

### Step 4: Regenerate Tokens (if needed)
After changing permissions:
1. Go to **Keys and tokens** tab
2. **Regenerate** the following (if prompted):
   - API Key and Secret
   - Access Token and Secret
3. Update `mcp.json` with new tokens

### Step 5: Update mcp.json
After regenerating tokens, update your `mcp.json`:
```json
{
  "mcpServers": {
    "twitter-mcp": {
      "env": {
        "API_KEY": "your_new_api_key",
        "API_SECRET_KEY": "your_new_api_secret",
        "ACCESS_TOKEN": "your_new_access_token",
        "ACCESS_TOKEN_SECRET": "your_new_access_token_secret"
      }
    }
  }
}
```

## Why This Should Work

According to the documentation:
- **Like**: Works with OAuth 1.0a User Context ✅
- **Bookmark**: Works with OAuth 1.0a User Context ✅ (requires `bookmark.write` permission)
- **Follow**: Works with OAuth 1.0a User Context ✅

**We don't need to switch to OAuth 2.0!** We just need to ensure the app has the right permissions enabled.

## Alternative: OAuth 2.0 App Only (If OAuth 1.0a doesn't work)

If fixing the OAuth 1.0a permissions doesn't work, we could switch to OAuth 2.0 App Only:

### What Would Change:
1. Initialize client with OAuth 2.0 Bearer Token instead of OAuth 1.0a tokens
2. Requires different token format
3. Some endpoints (like Bookmark) **don't support OAuth 2.0 App Only** - they only work with OAuth 1.0a User Context

### Code Changes Needed:
```typescript
// OAuth 2.0 App Only (would need Bearer Token)
this.client = new TwitterApi({
  clientId: config.clientId,
  clientSecret: config.clientSecret,
});
// Then get Bearer Token via OAuth 2.0 flow
```

**Note**: This is more complex and Bookmark won't work with OAuth 2.0 App Only anyway.

## Recommendation

**Try fixing OAuth 1.0a permissions first** - it's simpler and should work for all endpoints. Only switch to OAuth 2.0 if absolutely necessary.

## Testing After Fix

After updating permissions and tokens:
1. Restart Cursor (to reload MCP server)
2. Test the failing endpoints:
   - `like_tweet`
   - `bookmark_tweet`
   - `unbookmark_tweet`
   - `follow_user`

If they still fail with 403, the issue might be:
- App still doesn't have correct permissions
- Tokens weren't regenerated after permission change
- Account restrictions (suspended, limited, etc.)


