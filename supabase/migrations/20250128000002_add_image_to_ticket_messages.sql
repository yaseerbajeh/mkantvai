/*
  # Add Image Support to Ticket Messages
  Adds image_url column to ticket_messages table for photo attachments
*/

-- Add image_url column to ticket_messages
ALTER TABLE public.ticket_messages
ADD COLUMN IF NOT EXISTS image_url text;

-- Create index for image_url queries (partial index for non-null values)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_ticket_messages_image_url'
    ) THEN
        CREATE INDEX idx_ticket_messages_image_url 
        ON public.ticket_messages(image_url) 
        WHERE image_url IS NOT NULL;
    END IF;
END $$;

