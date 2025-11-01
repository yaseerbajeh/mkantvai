-- Seed subscriptions with product_code matching the product codes from subscribe page
-- Each subscription has a product_code that matches the order's product_code

-- Basic subscriptions (1 month)
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-BASIC-1M-001', '{"duration":"1 شهر","type":"basic"}', 'SUB-BASIC-1M'),
  ('SUB-BASIC-1M-002', '{"duration":"1 شهر","type":"basic"}', 'SUB-BASIC-1M'),
  ('SUB-BASIC-1M-003', '{"duration":"1 شهر","type":"basic"}', 'SUB-BASIC-1M')
ON CONFLICT (subscription_code) DO NOTHING;

-- Basic subscriptions (3 months)
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-BASIC-3M-001', '{"duration":"3 أشهر","type":"basic"}', 'SUB-BASIC-3M'),
  ('SUB-BASIC-3M-002', '{"duration":"3 أشهر","type":"basic"}', 'SUB-BASIC-3M'),
  ('SUB-BASIC-3M-003', '{"duration":"3 أشهر","type":"basic"}', 'SUB-BASIC-3M')
ON CONFLICT (subscription_code) DO NOTHING;

-- Basic subscriptions (6 months)
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-BASIC-6M-001', '{"duration":"6 أشهر","type":"basic"}', 'SUB-BASIC-6M'),
  ('SUB-BASIC-6M-002', '{"duration":"6 أشهر","type":"basic"}', 'SUB-BASIC-6M'),
  ('SUB-BASIC-6M-003', '{"duration":"6 أشهر","type":"basic"}', 'SUB-BASIC-6M')
ON CONFLICT (subscription_code) DO NOTHING;

-- Premium subscriptions (1 month)
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-PREMIUM-1M-001', '{"duration":"1 شهر","type":"premium"}', 'SUB-PREMIUM-1M'),
  ('SUB-PREMIUM-1M-002', '{"duration":"1 شهر","type":"premium"}', 'SUB-PREMIUM-1M'),
  ('SUB-PREMIUM-1M-003', '{"duration":"1 شهر","type":"premium"}', 'SUB-PREMIUM-1M')
ON CONFLICT (subscription_code) DO NOTHING;

-- Premium subscriptions (3 months)
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-PREMIUM-3M-001', '{"duration":"3 أشهر","type":"premium"}', 'SUB-PREMIUM-3M'),
  ('SUB-PREMIUM-3M-002', '{"duration":"3 أشهر","type":"premium"}', 'SUB-PREMIUM-3M'),
  ('SUB-PREMIUM-3M-003', '{"duration":"3 أشهر","type":"premium"}', 'SUB-PREMIUM-3M')
ON CONFLICT (subscription_code) DO NOTHING;

-- Premium subscriptions (6 months)
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-PREMIUM-6M-001', '{"duration":"6 أشهر","type":"premium"}', 'SUB-PREMIUM-6M'),
  ('SUB-PREMIUM-6M-002', '{"duration":"6 أشهر","type":"premium"}', 'SUB-PREMIUM-6M'),
  ('SUB-PREMIUM-6M-003', '{"duration":"6 أشهر","type":"premium"}', 'SUB-PREMIUM-6M')
ON CONFLICT (subscription_code) DO NOTHING;

-- Plus subscriptions (1 month)
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-PLUS-1M-001', '{"duration":"1 شهر","type":"plus"}', 'SUB-PLUS-1M'),
  ('SUB-PLUS-1M-002', '{"duration":"1 شهر","type":"plus"}', 'SUB-PLUS-1M'),
  ('SUB-PLUS-1M-003', '{"duration":"1 شهر","type":"plus"}', 'SUB-PLUS-1M')
ON CONFLICT (subscription_code) DO NOTHING;

-- Plus subscriptions (3 months)
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-PLUS-3M-001', '{"duration":"3 أشهر","type":"plus"}', 'SUB-PLUS-3M'),
  ('SUB-PLUS-3M-002', '{"duration":"3 أشهر","type":"plus"}', 'SUB-PLUS-3M'),
  ('SUB-PLUS-3M-003', '{"duration":"3 أشهر","type":"plus"}', 'SUB-PLUS-3M')
ON CONFLICT (subscription_code) DO NOTHING;

-- Plus subscriptions (6 months)
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-PLUS-6M-001', '{"duration":"6 أشهر","type":"plus"}', 'SUB-PLUS-6M'),
  ('SUB-PLUS-6M-002', '{"duration":"6 أشهر","type":"plus"}', 'SUB-PLUS-6M'),
  ('SUB-PLUS-6M-003', '{"duration":"6 أشهر","type":"plus"}', 'SUB-PLUS-6M')
ON CONFLICT (subscription_code) DO NOTHING;

-- VIP subscriptions (1 month)
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-VIP-1M-001', '{"duration":"1 شهر","type":"vip"}', 'SUB-VIP-1M'),
  ('SUB-VIP-1M-002', '{"duration":"1 شهر","type":"vip"}', 'SUB-VIP-1M'),
  ('SUB-VIP-1M-003', '{"duration":"1 شهر","type":"vip"}', 'SUB-VIP-1M')
ON CONFLICT (subscription_code) DO NOTHING;

-- VIP subscriptions (3 months)
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-VIP-3M-001', '{"duration":"3 أشهر","type":"vip"}', 'SUB-VIP-3M'),
  ('SUB-VIP-3M-002', '{"duration":"3 أشهر","type":"vip"}', 'SUB-VIP-3M'),
  ('SUB-VIP-3M-003', '{"duration":"3 أشهر","type":"vip"}', 'SUB-VIP-3M')
ON CONFLICT (subscription_code) DO NOTHING;

-- VIP subscriptions (6 months)
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-VIP-6M-001', '{"duration":"6 أشهر","type":"vip"}', 'SUB-VIP-6M'),
  ('SUB-VIP-6M-002', '{"duration":"6 أشهر","type":"vip"}', 'SUB-VIP-6M'),
  ('SUB-VIP-6M-003', '{"duration":"6 أشهر","type":"vip"}', 'SUB-VIP-6M')
ON CONFLICT (subscription_code) DO NOTHING;

-- Annual Basic subscriptions
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-ANNUAL-BASIC-001', '{"duration":"12 شهر","type":"basic"}', 'SUB-ANNUAL-BASIC'),
  ('SUB-ANNUAL-BASIC-002', '{"duration":"12 شهر","type":"basic"}', 'SUB-ANNUAL-BASIC'),
  ('SUB-ANNUAL-BASIC-003', '{"duration":"12 شهر","type":"basic"}', 'SUB-ANNUAL-BASIC')
ON CONFLICT (subscription_code) DO NOTHING;

-- Annual Premium subscriptions
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-ANNUAL-PREMIUM-001', '{"duration":"12 شهر","type":"premium"}', 'SUB-ANNUAL-PREMIUM'),
  ('SUB-ANNUAL-PREMIUM-002', '{"duration":"12 شهر","type":"premium"}', 'SUB-ANNUAL-PREMIUM'),
  ('SUB-ANNUAL-PREMIUM-003', '{"duration":"12 شهر","type":"premium"}', 'SUB-ANNUAL-PREMIUM')
ON CONFLICT (subscription_code) DO NOTHING;

-- Annual VIP subscriptions
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-ANNUAL-VIP-001', '{"duration":"12 شهر","type":"vip"}', 'SUB-ANNUAL-VIP'),
  ('SUB-ANNUAL-VIP-002', '{"duration":"12 شهر","type":"vip"}', 'SUB-ANNUAL-VIP'),
  ('SUB-ANNUAL-VIP-003', '{"duration":"12 شهر","type":"vip"}', 'SUB-ANNUAL-VIP')
ON CONFLICT (subscription_code) DO NOTHING;


