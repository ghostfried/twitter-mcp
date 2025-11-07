# Debugging 403 Errors

## Current Situation
- ✅ App has "Read and write" permissions enabled
- ✅ App type is "Web App, Automated App or Bot" → "Confidential client"
- ✅ Using OAuth 1.0a User Context (correct method)
- ❌ Still getting 403 errors for: like, bookmark, follow, unbookmark

## Most Likely Cause: Token Regeneration

**Critical Issue**: OAuth tokens are created with specific permissions at generation time. If you:
1. Generated tokens BEFORE setting "Read and write" permissions
2. Then later changed app permissions to "Read and write"

**The existing tokens still have the OLD permissions!** They need to be regenerated.

### Solution: Regenerate Tokens

1. Go to Twitter Developer Portal → Your App → **Keys and tokens** tab
2. **Regenerate** the following:
   - **Access Token and Secret** (this is the critical one!)
   - Optionally regenerate API Key and Secret if needed
3. **Important**: After regenerating, the tokens will have the NEW permissions
4. Update `mcp.json` with the new tokens
5. Restart Cursor to reload MCP server

## Other Possible Causes

### 1. Account Restrictions
- Check if your Twitter account has any restrictions
- Suspended accounts can't use write endpoints
- Limited accounts may have restrictions

### 2. Token Mismatch
- Ensure tokens in `mcp.json` match the app in Developer Portal
- Tokens from different apps won't work

### 3. OAuth 2.0 Requirement (Unlikely)
- According to docs, OAuth 1.0a User Context should work
- But some endpoints might require OAuth 2.0 Authorization Code Flow with PKCE
- This would require significant code changes

## Enhanced Error Logging

I've updated the error handler to log more details. Check the MCP server console output for:
- Full error object
- Error codes
- Error messages
- Rate limit information

## Testing After Token Regeneration

After regenerating tokens:
1. Restart Cursor
2. Test these endpoints:
   - `like_tweet`
   - `bookmark_tweet`
   - `unbookmark_tweet`
   - `follow_user`

If they still fail, check the enhanced error logs for more details.


