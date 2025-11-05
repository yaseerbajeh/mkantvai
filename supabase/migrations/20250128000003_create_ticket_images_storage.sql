/*
  # Create Storage Bucket for Ticket Images
  Creates a public storage bucket for ticket message images
*/

-- Create storage bucket for ticket images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ticket-images',
  'ticket-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy: Authenticated users can upload
CREATE POLICY "Authenticated users can upload ticket images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ticket-images' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.tickets
  )
);

-- Create storage policy: Authenticated users can view ticket images
CREATE POLICY "Authenticated users can view ticket images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'ticket-images');

-- Create storage policy: Service role can manage all
CREATE POLICY "Service role can manage ticket images"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'ticket-images')
WITH CHECK (bucket_id = 'ticket-images');

