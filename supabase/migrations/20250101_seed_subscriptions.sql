/*
  # Seed example subscriptions

  Insert sample subscription codes for testing.
  Adjust subscription codes and metadata as needed.
*/

INSERT INTO public.subscriptions (subscription_code, subscription_meta)
VALUES
  ('SUB-001-ABC', '{"duration":"3 أشهر","type":"premium"}'),
  ('SUB-002-DEF', '{"duration":"6 أشهر","type":"premium"}'),
  ('SUB-003-GHI', '{"duration":"12 شهر","type":"premium"}'),
  ('SUB-004-JKL', '{"duration":"3 أشهر","type":"standard"}'),
  ('SUB-005-MNO', '{"duration":"6 أشهر","type":"standard"}')
ON CONFLICT (subscription_code) DO NOTHING;


