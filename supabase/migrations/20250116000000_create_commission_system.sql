/*
  # Commission System
  
  Creates tables and functions for managing commissioners, commission earnings, and payouts.
  
  1. commissioners table - Stores commissioner profiles with configurable commission rates
  2. commission_earnings table - Tracks individual commission earnings from orders
  3. commission_payouts table - Tracks payout transactions
  4. Modifications to orders table - Add commissioner tracking fields
*/

-- ============================================
-- 1. Create commissioners table
-- ============================================

CREATE TABLE IF NOT EXISTS public.commissioners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text,
  promo_code text UNIQUE NOT NULL,
  commission_rate numeric NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 1),
  is_active boolean DEFAULT true,
  total_earnings numeric DEFAULT 0,
  pending_payouts numeric DEFAULT 0,
  paid_out numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 2. Create commission_earnings table
-- ============================================

CREATE TABLE IF NOT EXISTS public.commission_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commissioner_id uuid NOT NULL REFERENCES public.commissioners(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_amount numeric NOT NULL,
  commission_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  payout_date timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 3. Create commission_payouts table
-- ============================================

CREATE TABLE IF NOT EXISTS public.commission_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commissioner_id uuid NOT NULL REFERENCES public.commissioners(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  processed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 4. Modify orders table
-- ============================================

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS commissioner_promo_code text,
ADD COLUMN IF NOT EXISTS commissioner_id uuid REFERENCES public.commissioners(id) ON DELETE SET NULL;

-- ============================================
-- 5. Create Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_commissioners_email ON public.commissioners(email);
CREATE INDEX IF NOT EXISTS idx_commissioners_promo_code ON public.commissioners(promo_code);
CREATE INDEX IF NOT EXISTS idx_commissioners_is_active ON public.commissioners(is_active);
CREATE INDEX IF NOT EXISTS idx_commission_earnings_commissioner_id ON public.commission_earnings(commissioner_id);
CREATE INDEX IF NOT EXISTS idx_commission_earnings_order_id ON public.commission_earnings(order_id);
CREATE INDEX IF NOT EXISTS idx_commission_earnings_status ON public.commission_earnings(status);
CREATE INDEX IF NOT EXISTS idx_commission_earnings_created_at ON public.commission_earnings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_commissioner_id ON public.orders(commissioner_id);
CREATE INDEX IF NOT EXISTS idx_commission_payouts_commissioner_id ON public.commission_payouts(commissioner_id);
CREATE INDEX IF NOT EXISTS idx_commission_payouts_status ON public.commission_payouts(status);

-- ============================================
-- 6. Create Functions
-- ============================================

-- Function to update commissioner totals
CREATE OR REPLACE FUNCTION update_commissioner_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Update commissioner totals when new earnings are created
    UPDATE public.commissioners
    SET 
      total_earnings = total_earnings + NEW.commission_amount,
      pending_payouts = pending_payouts + NEW.commission_amount,
      updated_at = now()
    WHERE id = NEW.commissioner_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle status changes (e.g., when earnings are paid)
    IF OLD.status = 'pending' AND NEW.status = 'paid' THEN
      -- Already counted in pending_payouts, no change needed
      RETURN NEW;
    ELSIF OLD.status = 'paid' AND NEW.status = 'cancelled' THEN
      -- Reverse the earnings
      UPDATE public.commissioners
      SET 
        total_earnings = total_earnings - OLD.commission_amount,
        pending_payouts = pending_payouts - OLD.commission_amount,
        updated_at = now()
      WHERE id = NEW.commissioner_id;
      RETURN NEW;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to update commissioner totals when payout is completed
CREATE OR REPLACE FUNCTION update_commissioner_on_payout()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'completed' THEN
    -- Update commissioner paid_out and pending_payouts
    UPDATE public.commissioners
    SET 
      paid_out = paid_out + NEW.amount,
      pending_payouts = pending_payouts - NEW.amount,
      updated_at = now()
    WHERE id = NEW.commissioner_id;
    
    -- Mark related earnings as paid
    UPDATE public.commission_earnings
    SET 
      status = 'paid',
      payout_date = NEW.processed_at
    WHERE commissioner_id = NEW.commissioner_id 
      AND status = 'pending'
      AND created_at <= NEW.processed_at;
    
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_commissioners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. Create Triggers
-- ============================================

-- Trigger for updating commissioner totals on earnings changes
DROP TRIGGER IF EXISTS trigger_update_commissioner_totals ON public.commission_earnings;
CREATE TRIGGER trigger_update_commissioner_totals
  AFTER INSERT OR UPDATE ON public.commission_earnings
  FOR EACH ROW
  EXECUTE FUNCTION update_commissioner_totals();

-- Trigger for updating commissioner on payout completion
DROP TRIGGER IF EXISTS trigger_update_commissioner_on_payout ON public.commission_payouts;
CREATE TRIGGER trigger_update_commissioner_on_payout
  AFTER UPDATE ON public.commission_payouts
  FOR EACH ROW
  EXECUTE FUNCTION update_commissioner_on_payout();

-- Trigger for updating updated_at on commissioners
DROP TRIGGER IF EXISTS trigger_update_commissioners_updated_at ON public.commissioners;
CREATE TRIGGER trigger_update_commissioners_updated_at
  BEFORE UPDATE ON public.commissioners
  FOR EACH ROW
  EXECUTE FUNCTION update_commissioners_updated_at();

-- ============================================
-- 8. Enable Row Level Security
-- ============================================

ALTER TABLE public.commissioners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_payouts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 9. Create RLS Policies
-- ============================================

-- Commissioners: Only admins can view/manage (handled via API with service role)
-- For now, allow authenticated users to view their own commissioner record
CREATE POLICY "Commissioners can view their own record"
  ON public.commissioners
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = commissioners.email
    )
  );

-- Commission earnings: Commissioners can view their own earnings
CREATE POLICY "Commissioners can view their own earnings"
  ON public.commission_earnings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.commissioners
      WHERE commissioners.id = commission_earnings.commissioner_id
      AND commissioners.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Commission payouts: Commissioners can view their own payouts
CREATE POLICY "Commissioners can view their own payouts"
  ON public.commission_payouts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.commissioners
      WHERE commissioners.id = commission_payouts.commissioner_id
      AND commissioners.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Admin operations will use service role key in API routes, bypassing RLS

-- ============================================
-- 10. Comments
-- ============================================

COMMENT ON TABLE public.commissioners IS 'Stores commissioner profiles with configurable commission rates';
COMMENT ON TABLE public.commission_earnings IS 'Tracks individual commission earnings from orders';
COMMENT ON TABLE public.commission_payouts IS 'Tracks payout transactions for commissioners';
COMMENT ON COLUMN public.commissioners.commission_rate IS 'Commission rate as decimal (e.g., 0.10 for 10%, 0.12 for 12%)';
COMMENT ON COLUMN public.orders.commissioner_id IS 'Reference to the commissioner who referred this order';
COMMENT ON COLUMN public.orders.commissioner_promo_code IS 'The promo code used for this commission';

