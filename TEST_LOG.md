# Twitter MCP Test Log

**Test Date:** 2025-01-31
**Test User:** ghost_fried
**User ID:** 1375111643634544652

## 🔍 Root Cause Analysis (2025-01-31)

After implementing enhanced error logging, we identified the exact causes of 403 errors:

### Like and Follow Endpoints
- **Error:** Client Forbidden
- **Cause:** App must be attached to a Project in Twitter Developer Portal
- **Fix:** Attach app to Project, regenerate tokens

### Bookmark Endpoint  
- **Error:** Unsupported Authentication
- **Cause:** Requires OAuth 2.0 User Context, not OAuth 1.0a
- **Fix:** Implement OAuth 2.0 flow or document limitation

See `403_ERROR_SOLUTION.md` for detailed fix instructions.

## Test Results

### ✅ TEST 1: get_user - Get user by username
**Status:** PASSED
**Action:** Retrieved user information for @ghost_fried
**Result:** 
- Username: @ghost_fried
- Name: Fried Ghost
- ID: 1375111643634544652
- Followers: 1,441
- Following: 1,710
- Tweets: 7,162
**Timestamp:** 2025-01-31

### ✅ TEST 2: get_user - Get user by user ID
**Status:** PASSED
**Action:** Retrieved user information using user ID
**Result:** Same as TEST 1 - verified user ID lookup works
**Timestamp:** 2025-01-31

### ✅ TEST 3: get_user_timeline - Get user timeline
**Status:** PASSED
**Action:** Retrieved 5 tweets from @ghost_fried's timeline
**Result:** Successfully retrieved 5 tweets
**Sample Tweet IDs:**
- 1976905886787682372
- 1976791662241407229
- 1976377324762484905
- 1976365954155061702
- 1973995156429820067
**Timestamp:** 2025-01-31

### ✅ TEST 4: post_tweet - Post simple text tweet
**Status:** PASSED
**Action:** Posted a simple text tweet
**Result:** Tweet posted successfully
**Tweet ID:** 1986547881583538282
**Tweet URL:** https://twitter.com/status/1986547881583538282
**Timestamp:** 2025-01-31

### ✅ TEST 5: post_tweet - Post reply tweet
**Status:** PASSED
**Action:** Posted a reply to the test tweet
**Result:** Reply posted successfully
**Tweet ID:** 1986547896250933283
**Tweet URL:** https://twitter.com/status/1986547896250933283
**Reply To:** 1986547881583538282
**Timestamp:** 2025-01-31

### ❌ TEST 6: post_tweet - Post tweet with poll
**Status:** FAILED
**Action:** Attempted to post a tweet with poll
**Result:** Twitter API error - Invalid Request (400)
**Error:** One or more parameters to your request was invalid
**Note:** Poll format may need adjustment - checking API requirements
**Timestamp:** 2025-01-31

### ✅ TEST 7: create_thread - Create 2-tweet thread
**Status:** PASSED
**Action:** Created a thread with 2 tweets
**Result:** Thread created successfully
**Tweet IDs:**
- 1986547922981310764 (Tweet 1)
- 1986547927980929210 (Tweet 2)
**Thread URL:** https://twitter.com/status/1986547922981310764
**Timestamp:** 2025-01-31

### ✅ TEST 8: search_tweets - Search for TypeScript tweets
**Status:** PASSED
**Action:** Searched for tweets about TypeScript
**Result:** Successfully retrieved 10 tweets
**Query:** TypeScript
**Count:** 10
**Timestamp:** 2025-01-31

### ⚠️ TEST 9: search_tweets - Search tweets from ghost_fried
**Status:** RATE LIMITED
**Action:** Attempted to search for tweets from @ghost_fried
**Result:** Rate limit exceeded
**Note:** Need to wait before retrying
**Timestamp:** 2025-01-31

### ❌ TEST 10: like_tweet - Like a tweet from ghost_fried
**Status:** FAILED
**Action:** Attempted to like tweet 1976905886787682372
**Result:** Twitter API error - Forbidden (403)
**Error:** Request failed with code 403
**Note:** May already be liked or permission issue
**Timestamp:** 2025-01-31

### ✅ TEST 11: retweet - Retweet a tweet from ghost_fried
**Status:** PASSED
**Action:** Retweeted tweet 1976905886787682372 from @ghost_fried
**Result:** Tweet retweeted successfully
**Tweet ID:** 1976905886787682372
**Timestamp:** 2025-01-31

### ✅ TEST 12: unretweet - Unretweet a tweet
**Status:** PASSED
**Action:** Unretweeted tweet 1976905886787682372
**Result:** Tweet unretweeted successfully
**Tweet ID:** 1976905886787682372
**Timestamp:** 2025-01-31

### ❌ TEST 13: bookmark_tweet - Bookmark a tweet
**Status:** FAILED
**Action:** Attempted to bookmark tweet 1976905886787682372
**Result:** Twitter API error - Forbidden (403)
**Error:** Request failed with code 403
**Note:** May require additional permissions or already bookmarked
**Timestamp:** 2025-01-31

### ❌ TEST 14: follow_user - Follow ghost_fried
**Status:** FAILED
**Action:** Attempted to follow @ghost_fried
**Result:** Twitter API error - Forbidden (403)
**Error:** Request failed with code 403
**Note:** May already be following or permission issue
**Timestamp:** 2025-01-31

### ✅ TEST 15: unfollow_user - Unfollow ghost_fried
**Status:** PASSED
**Action:** Unfollowed @ghost_fried
**Result:** User unfollowed successfully
**User ID:** 1375111643634544652
**Timestamp:** 2025-01-31

### ✅ TEST 16: unlike_tweet - Unlike a tweet
**Status:** PASSED
**Action:** Unliked tweet 1976905886787682372
**Result:** Tweet unliked successfully
**Tweet ID:** 1976905886787682372
**Timestamp:** 2025-01-31

### ✅ TEST 17: delete_tweet - Delete a tweet
**Status:** PASSED
**Action:** Deleted test tweet
**Result:** Tweet deleted successfully
**Tweet ID:** 1986547881583538282
**Timestamp:** 2025-01-31

### ❌ TEST 18: upload_media - Upload media from URL
**Status:** FAILED
**Action:** Attempted to upload media from URL
**Result:** Network error - getaddrinfo EAI_AGAIN via.placeholder.com
**Error:** DNS resolution failed for placeholder.com
**Note:** Network issue - may need to use a different test image URL
**Timestamp:** 2025-01-31

### ❌ TEST 19: unbookmark_tweet - Unbookmark a tweet
**Status:** FAILED (Expected - Not Implemented)
**Action:** Attempted to unbookmark tweet
**Result:** Not implemented in library version
**Error:** Unbookmark functionality may not be available in this library version
**Note:** This is expected - unbookmark is not implemented in twitter-api-v2 library
**Timestamp:** 2025-01-31

---

## Test Summary

**Total Tests:** 26
**✅ Passed:** 15
**❌ Failed:** 10
**⚠️ Rate Limited:** 1

**Success Rate:** 57.7% (15/26)

**After Fixes:**
- ✅ Poll format fixed and tested successfully
- ✅ Media upload working with local files
- ✅ Unbookmark fix applied (but 403 error persists - OAuth scope issue)
- ❌ Like/Bookmark/Follow still failing with 403 (OAuth scope issues)

### Passed Tests:
1. ✅ get_user - Get user by username
2. ✅ get_user - Get user by user ID
3. ✅ get_user_timeline - Get user timeline
4. ✅ post_tweet - Post simple text tweet
5. ✅ post_tweet - Post reply tweet
6. ✅ post_tweet - Post tweet with poll (FIXED)
7. ✅ create_thread - Create 2-tweet thread
8. ✅ search_tweets - Search for TypeScript tweets
9. ✅ retweet - Retweet a tweet
10. ✅ unretweet - Unretweet a tweet
11. ✅ unfollow_user - Unfollow user
12. ✅ unlike_tweet - Unlike a tweet
13. ✅ delete_tweet - Delete a tweet
14. ✅ upload_media - Upload media from local file
15. ✅ post_tweet - Post tweet with media

### Failed Tests:
1. ❌ like_tweet - Like a tweet (403 - Forbidden) - OAuth scope issue
2. ❌ bookmark_tweet - Bookmark a tweet (403 - Forbidden) - OAuth scope issue
3. ❌ follow_user - Follow user (403 - Forbidden) - OAuth scope issue
4. ❌ unbookmark_tweet - Unbookmark a tweet (403 - Forbidden) - OAuth scope issue
5. ❌ upload_media - Upload media from URL (Network error - DNS issue)

### Rate Limited:
1. ⚠️ search_tweets - Search tweets from ghost_fried (Rate limit exceeded)

### Issues Identified:
1. **Poll Format:** Poll format may need adjustment - API returned 400 error
2. **403 Errors:** Several operations returned 403 Forbidden - may need additional permissions or already performed
3. **Media Upload:** Network error with placeholder.com - need to use a different test image URL
4. **Unbookmark:** Not implemented in library - expected behavior

### Files Created/Modified:
- `twitter-mcp/TEST_LOG.md` - Created comprehensive test log file

### Test Tweets Created:
- 1986547881583538282 (DELETED)
- 1986547896250933283 (Reply tweet)
- 1986547922981310764 (Thread tweet 1)
- 1986547927980929210 (Thread tweet 2)
- 1986552429744177323 (Tweet with media)
- 1986553544309178488 (Tweet with poll - FIXED)

**Note:** Test tweets may need manual cleanup if desired.

---

## Investigation Results & Fixes Applied

### Issues Found and Fixed:

#### 1. ✅ Poll Format (400 Error) - FIXED
**Root Cause:** Twitter API v2 expects poll options as an array of strings, not objects with `label` and `position`.

**Fix Applied:**
- Updated `PollSchema` to accept `z.array(z.string())` instead of `z.array(PollOptionSchema)`
- Updated tool schema to reflect string array format
- Added conversion logic to handle both string and object formats for backward compatibility

**Files Modified:**
- `src/types.ts` - Updated PollSchema
- `src/index.ts` - Updated tool schema and handler
- `src/twitter-api.ts` - Added conversion logic

#### 2. ✅ Unbookmark (Not Implemented) - FIXED
**Root Cause:** Library has `deleteBookmark()` method, not `unbookmark()`.

**Fix Applied:**
- Changed `unbookmarkTweet()` to use `this.client.v2.deleteBookmark(tweetId)`

**Files Modified:**
- `src/twitter-api.ts` - Updated unbookmarkTweet method

#### 3. ⚠️ Like/Bookmark/Follow (403 Errors) - INVESTIGATED
**Root Cause:** These methods require specific OAuth2 scopes:
- **Like:** Requires user context authentication (OAuth 1.0a or OAuth 2.0 User Context)
- **Bookmark:** Requires OAuth2 scopes: `users.read`, `tweet.read`, `bookmark.write`
- **Follow:** Requires OAuth2 scope: `follows.write`

**Method Signatures (Verified):**
- `like(loggedUserId: string, targetTweetId: string)` ✅ Correct
- `bookmark(tweetId: string)` ✅ Correct (only takes tweetId, not userId)
- `follow(loggedUserId: string, targetUserId: string)` ✅ Correct

**Possible Causes of 403:**
1. Missing OAuth2 scopes in Twitter Developer Portal
2. Already performed action (already liked/followed/bookmarked)
3. Account restrictions or limitations

**Action Required:**
- Check Twitter Developer Portal for OAuth2 scopes
- Verify app has `bookmark.write` and `follows.write` scopes enabled
- May need to re-authenticate with new scopes
- **Note:** OAuth 1.0a (used by twitter-api-v2) may not support all OAuth2 scopes
- May need to check if app is using OAuth 1.0a or OAuth 2.0 User Context
- Verify app permissions in Twitter Developer Portal: Settings > User authentication settings

#### 4. ⚠️ Media Upload (Network Error) - READY TO TEST
**Root Cause:** DNS resolution failed for placeholder.com

**Fix Ready:**
- Image file found: `468409326_10106543331323576_6558303095620980805_n.jpg`
- Ready to test with local file path

---

## Next Steps for Testing

1. **Test Poll Fix:** Re-test poll creation with string array format
2. **Test Unbookmark Fix:** Re-test unbookmark functionality
3. **Test Media Upload:** Test with local image file
4. **Investigate 403 Errors:** Check OAuth scopes in Twitter Developer Portal

---

## Additional Test Results (After Fixes)

### ✅ TEST 20: upload_media - Upload media from local file
**Status:** PASSED
**Action:** Uploaded image from local file path
**Result:** Media uploaded successfully
**Media ID:** 1986552409452052480
**Size:** 136965 bytes
**File Path:** C:\Users\Calvin\Desktop\Cursor\468409326_10106543331323576_6558303095620980805_n.jpg
**Timestamp:** 2025-01-31

### ✅ TEST 21: post_tweet - Post tweet with media
**Status:** PASSED
**Action:** Posted tweet with uploaded media
**Result:** Tweet posted successfully
**Tweet ID:** 1986552429744177323
**Tweet URL:** https://twitter.com/status/1986552429744177323
**Media ID:** 1986552409452052480
**Timestamp:** 2025-01-31

---

## Retest Results (After Server Restart)

### ✅ TEST 22: post_tweet - Post tweet with poll (FIXED)
**Status:** PASSED
**Action:** Posted tweet with poll using string array format
**Result:** Tweet posted successfully
**Tweet ID:** 1986553544309178488
**Tweet URL:** https://twitter.com/status/1986553544309178488
**Poll Options:** ['Option A', 'Option B', 'Option C']
**Duration:** 60 minutes
**Note:** Poll format fix confirmed working - options must be array of strings
**Timestamp:** 2025-01-31

### ❌ TEST 23: unbookmark_tweet - Unbookmark a tweet (RETEST)
**Status:** FAILED (403 Forbidden)
**Action:** Attempted to unbookmark tweet 1976905886787682372
**Result:** Twitter API error - Forbidden (403)
**Error:** Request failed with code 403
**Note:** Fix applied (using deleteBookmark), but still getting 403 - likely OAuth scope issue
**Timestamp:** 2025-01-31

### ❌ TEST 24: like_tweet - Like a tweet (RETEST)
**Status:** FAILED (403 Forbidden)
**Action:** Attempted to like tweet 1976905886787682372
**Result:** Twitter API error - Forbidden (403)
**Error:** Request failed with code 403
**Note:** Method signature verified correct - likely OAuth scope or authentication issue
**Timestamp:** 2025-01-31

### ❌ TEST 25: bookmark_tweet - Bookmark a tweet (RETEST)
**Status:** FAILED (403 Forbidden)
**Action:** Attempted to bookmark tweet 1976905886787682372
**Result:** Twitter API error - Forbidden (403)
**Error:** Request failed with code 403
**Note:** Method signature verified correct - requires OAuth2 scopes: users.read, tweet.read, bookmark.write
**Timestamp:** 2025-01-31

### ❌ TEST 26: follow_user - Follow user (RETEST)
**Status:** FAILED (403 Forbidden)
**Action:** Attempted to follow user 1375111643634544652 (@ghost_fried)
**Result:** Twitter API error - Forbidden (403)
**Error:** Request failed with code 403
**Note:** Method signature verified correct - requires OAuth2 scope: follows.write
**Timestamp:** 2025-01-31

