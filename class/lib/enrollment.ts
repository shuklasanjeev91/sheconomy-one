import { INVALIDATION_TOPICS, invalidateCache } from '~/lib/cache/invalidation'
import { supabase } from '~/lib/supabase/client'

/**
 * Enroll the signed-in user in a class course.
 * A DB trigger sends `class_enrollment_confirmed` via the shared notification pipeline
 * (in-app + email + push on web / iOS / Android).
 */
export async function enrollInCourse(input: {
  courseId: string
  userId: string
}): Promise<{ enrollmentId: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('class_enrollment')
    .upsert(
      {
        course_id: input.courseId,
        user_id: input.userId,
      },
      { onConflict: 'user_id,course_id', ignoreDuplicates: true },
    )
    .select('id')
    .maybeSingle()

  if (error) return { enrollmentId: null, error: error.message }
  invalidateCache(INVALIDATION_TOPICS.classEnrollments)
  return { enrollmentId: data?.id ?? null, error: null }
}

/** Publish a lesson row; trigger notifies enrolled students via `class_lesson_published`. */
export async function publishClassLesson(input: {
  courseId: string
  title: string
  content?: string | null
  sortOrder?: number
}): Promise<{ lessonId: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('class_lesson')
    .insert({
      course_id: input.courseId,
      title: input.title,
      content: input.content ?? null,
      sort_order: input.sortOrder ?? 0,
    })
    .select('id')
    .maybeSingle()

  if (error) return { lessonId: null, error: error.message }
  return { lessonId: data?.id ?? null, error: null }
}
