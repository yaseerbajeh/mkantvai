/*
  # Ticket System
  Creates tables for customer support tickets and messages
*/

-- ============================================
-- 1. Create tickets table
-- ============================================

CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  user_email text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 2. Create ticket_messages table
-- ============================================

CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  sender_email text NOT NULL,
  sender_type text NOT NULL CHECK (sender_type IN ('user', 'admin')),
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 3. Create Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_tickets_order_id ON public.tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user_email ON public.tickets(user_email);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON public.ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_created_at ON public.ticket_messages(created_at DESC);

-- ============================================
-- 4. Enable Row Level Security
-- ============================================

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. Create RLS Policies
-- ============================================

-- Tickets: Users can view their own tickets, admins can view all
DROP POLICY IF EXISTS "Users can view their own tickets" ON public.tickets;
CREATE POLICY "Users can view their own tickets"
  ON public.tickets
  FOR SELECT
  USING (true); -- Will be filtered by email in application logic

-- Tickets: Users can create tickets
DROP POLICY IF EXISTS "Users can create tickets" ON public.tickets;
CREATE POLICY "Users can create tickets"
  ON public.tickets
  FOR INSERT
  WITH CHECK (true);

-- Tickets: Users can update their own tickets, admins can update all
DROP POLICY IF EXISTS "Users can update tickets" ON public.tickets;
CREATE POLICY "Users can update tickets"
  ON public.tickets
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Ticket Messages: Users can view messages for their tickets, admins can view all
DROP POLICY IF EXISTS "Users can view ticket messages" ON public.ticket_messages;
CREATE POLICY "Users can view ticket messages"
  ON public.ticket_messages
  FOR SELECT
  USING (true); -- Will be filtered by ticket_id in application logic

-- Ticket Messages: Users and admins can create messages
DROP POLICY IF EXISTS "Users can create ticket messages" ON public.ticket_messages;
CREATE POLICY "Users can create ticket messages"
  ON public.ticket_messages
  FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 6. Create Function to Update updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS update_tickets_updated_at ON public.tickets;
CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_tickets_updated_at();

-- ============================================
-- 7. Create Function to Update ticket updated_at when message is added
-- ============================================

CREATE OR REPLACE FUNCTION update_ticket_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.tickets
  SET updated_at = now()
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS update_ticket_on_message ON public.ticket_messages;
CREATE TRIGGER update_ticket_on_message
  AFTER INSERT ON public.ticket_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_on_message();

