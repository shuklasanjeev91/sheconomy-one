-- Enable realtime for co-work meeting tables
alter publication supabase_realtime add table public.meeting_participants;
alter publication supabase_realtime add table public.meeting_chat_messages;
alter publication supabase_realtime add table public.meetings;
