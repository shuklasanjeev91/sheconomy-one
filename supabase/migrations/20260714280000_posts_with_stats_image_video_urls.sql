-- Expose posts.image_urls and posts.video_urls on posts_with_stats
-- so feed/select queries can load carousel media without a second posts fetch.
-- New columns are appended so CREATE OR REPLACE VIEW stays valid in Postgres.

CREATE OR REPLACE VIEW public.posts_with_stats AS
SELECT
  p.id,
  p.user_id,
  p.content,
  p.image_url,
  p.video_url,
  p.media_urls,
  p.link_preview_data,
  p.created_at,
  p.updated_at,
  p.is_pinned,
  p.is_deleted,
  p.visibility,
  p.post_type,
  p.post_data,
  p.celebration_data,
  p.original_post_id,
  p.repost_comment,
  p.repost_count,
  p.allow_comments,
  p.allow_reactions,
  p.engagement_score,
  p.published_at,
  p.event_title,
  p.event_description,
  p.event_location,
  p.event_start_time,
  p.event_end_time,
  p.event_rsvp_enabled,
  p.tags,
  p.mentions,
  p.language,
  p.content_warning,
  pr.full_name AS author_name,
  pr.avatar_url AS author_avatar,
  pr.headline AS author_headline,
  pr.is_verified AS author_verified,
  COALESCE(reaction_stats.total_reactions, 0::bigint) AS total_reactions,
  COALESCE(reaction_stats.like_count, 0::bigint) AS like_count,
  COALESCE(reaction_stats.love_count, 0::bigint) AS love_count,
  COALESCE(reaction_stats.celebrate_count, 0::bigint) AS celebrate_count,
  COALESCE(reaction_stats.support_count, 0::bigint) AS support_count,
  COALESCE(reaction_stats.insightful_count, 0::bigint) AS insightful_count,
  COALESCE(reaction_stats.funny_count, 0::bigint) AS funny_count,
  COALESCE(comment_stats.total_comments, 0::bigint) AS total_comments,
  COALESCE(view_stats.total_views, 0::bigint) AS total_views,
  COALESCE(view_stats.unique_views, 0::bigint) AS unique_views,
  p.image_urls,
  p.video_urls
FROM posts p
LEFT JOIN profiles pr ON p.user_id = pr.id
LEFT JOIN (
  SELECT
    post_reactions.post_id,
    count(*) AS total_reactions,
    count(CASE WHEN post_reactions.reaction_type::text = 'like'::text THEN 1 ELSE NULL::integer END) AS like_count,
    count(CASE WHEN post_reactions.reaction_type::text = 'love'::text THEN 1 ELSE NULL::integer END) AS love_count,
    count(CASE WHEN post_reactions.reaction_type::text = 'celebrate'::text THEN 1 ELSE NULL::integer END) AS celebrate_count,
    count(CASE WHEN post_reactions.reaction_type::text = 'support'::text THEN 1 ELSE NULL::integer END) AS support_count,
    count(CASE WHEN post_reactions.reaction_type::text = 'insightful'::text THEN 1 ELSE NULL::integer END) AS insightful_count,
    count(CASE WHEN post_reactions.reaction_type::text = 'funny'::text THEN 1 ELSE NULL::integer END) AS funny_count
  FROM post_reactions
  GROUP BY post_reactions.post_id
) reaction_stats ON p.id = reaction_stats.post_id
LEFT JOIN (
  SELECT comments.post_id, count(*) AS total_comments
  FROM comments
  WHERE comments.is_deleted = false
  GROUP BY comments.post_id
) comment_stats ON p.id = comment_stats.post_id
LEFT JOIN (
  SELECT
    post_views.post_id,
    count(*) AS total_views,
    count(DISTINCT post_views.user_id) AS unique_views
  FROM post_views
  GROUP BY post_views.post_id
) view_stats ON p.id = view_stats.post_id
WHERE p.is_deleted = false;
