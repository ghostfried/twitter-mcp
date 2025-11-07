# Solution for 403 Errors on Like/Bookmark/Follow

## Root Cause Identified

After enhanced error logging, we now have the exact error messages from Twitter's API:

### 1. Like, Unlike, Follow, and Unfollow Endpoints
**Error:** `Client Forbidden`
**Message:** "When authenticating requests to the Twitter API v2 endpoints, you must use keys and tokens from a Twitter developer App that is attached to a Project. You can create a project via the developer portal."

**Solution:** The Twitter Developer App must be attached to a Project in the Twitter Developer Portal.

**Note:** Unlike and unfollow endpoints are also removed because they cannot be verified to work without the ability to like/follow in the first place.

### 2. Bookmark Endpoint
**Error:** `Unsupported Authentication`
**Message:** "Authenticating with OAuth 1.0a User Context is forbidden for this endpoint. Supported authentication types are [OAuth 2.0 User Context]."

**Solution:** Bookmark requires OAuth 2.0 User Context authentication, not OAuth 1.0a. This is a different authentication flow that requires:
- OAuth 2.0 Authorization Code with PKCE
- Different token generation process
- Different library methods

## Fixes Required

### Fix 1: Attach App to a Project (for Like/Follow)

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Navigate to your App settings
3. Check if your App is attached to a Project
4. If not:
   - Create a new Project (or use existing)
   - Attach your App to the Project
   - Regenerate Access Token and Secret after attaching
   - Update `mcp.json` with new tokens
   - Restart Cursor

### Fix 2: Implement OAuth 2.0 for Bookmark

The bookmark endpoint requires OAuth 2.0 User Context, which is different from OAuth 1.0a:

**Current Implementation:** OAuth 1.0a User Context
- Uses: `API_KEY`, `API_SECRET_KEY`, `ACCESS_TOKEN`, `ACCESS_TOKEN_SECRET`
- Works for: Most endpoints (tweet, retweet, like, follow, etc.)

**Required for Bookmark:** OAuth 2.0 User Context
- Requires: OAuth 2.0 Authorization Code flow with PKCE
- Different token generation process
- Different library initialization

**Options:**
1. **Implement OAuth 2.0 flow** - Full implementation with PKCE flow
2. **Skip bookmark functionality** - Document that bookmark requires OAuth 2.0
3. **Hybrid approach** - Use OAuth 1.0a for most endpoints, OAuth 2.0 for bookmark

## Current Status

- ✅ **Working with OAuth 1.0a:**
  - `post_tweet`
  - `retweet` / `unretweet`
  - `delete_tweet`
  - `search_tweets`
  - `get_user`
  - `get_user_timeline`
  - `upload_media`
  - `create_thread`

- ❌ **Removed - Requires Project Attachment:**
  - `like_tweet`
  - `unlike_tweet` (removed because cannot verify without like)
  - `follow_user`
  - `unfollow_user` (removed because cannot verify without follow)

- ❌ **Removed - Requires OAuth 2.0:**
  - `bookmark_tweet`
  - `unbookmark_tweet`

## Implementation Decision

These tools have been **removed** from the MCP server because:
1. **Like/Unlike/Follow/Unfollow:** Require Project attachment, and unlike/unfollow cannot be verified to work without the ability to like/follow first
2. **Bookmark/Unbookmark:** Require OAuth 2.0, which is a different authentication flow than the current OAuth 1.0a implementation

The remaining tools work correctly with OAuth 1.0a and do not require Project attachment.

