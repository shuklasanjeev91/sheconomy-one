import { publishClassLesson } from '~/class/lib/enrollment'
import {
  createMeetingRecordingShare,
} from '~/co-work/lib/livekit-recording-client'
import { supabase } from '~/lib/supabase/client'

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

async function ensureClassCourse(input: {
  title: string
}): Promise<{ courseId: string | null; error: string | null }> {
  const title = input.title.trim() || 'Meeting recording course'
  const slug = `${slugify(title) || 'meeting-recording'}-${Date.now().toString(36)}`

  const { data: existing } = await supabase
    .from('class_course')
    .select('id')
    .ilike('title', title)
    .maybeSingle()

  if (existing?.id) return { courseId: existing.id, error: null }

  const { data, error } = await supabase
    .from('class_course')
    .insert({
      title,
      slug,
      is_published: true,
      description: 'Published from a Co-Work meeting recording.',
    })
    .select('id')
    .maybeSingle()

  if (error) return { courseId: null, error: error.message }
  return { courseId: data?.id ?? null, error: null }
}

/**
 * Publish a Co-Work recording as a Class lesson.
 * Stores the durable share path (not the short-lived signed playback URL).
 */
export async function publishRecordingAsClassLesson(input: {
  userId: string
  recordingId: string
  meetingTitle?: string | null
}): Promise<{ lessonId: string | null; courseId: string | null; sharePath: string | null; error: string | null }> {
  const share = await createMeetingRecordingShare(input.recordingId)
  if (!share.ok) {
    return {
      lessonId: null,
      courseId: null,
      sharePath: null,
      error: share.error ?? 'Could not create recording share link',
    }
  }

  const sharePath =
    share.sharePath ||
    (share.shareUrl ? new URL(share.shareUrl).pathname : null) ||
    null
  if (!sharePath) {
    return { lessonId: null, courseId: null, sharePath: null, error: 'Missing share path' }
  }

  const title = (input.meetingTitle?.trim() || 'Meeting recording').slice(0, 120)
  const { courseId, error: courseError } = await ensureClassCourse({
    title: `${title} (recordings)`,
  })
  if (!courseId) {
    return { lessonId: null, courseId: null, sharePath, error: courseError ?? 'Could not create course' }
  }

  const content = [
    `## ${title}`,
    '',
    'This lesson was published from a Co-Work meeting recording.',
    '',
    `[Watch recording](${sharePath})`,
    '',
    '_Recording links may require sign-in and expire for security — re-open from Co-Work if needed._',
  ].join('\n')

  const { lessonId, error } = await publishClassLesson({
    courseId,
    title,
    content,
    sortOrder: 0,
  })

  return { lessonId, courseId, sharePath, error }
}
