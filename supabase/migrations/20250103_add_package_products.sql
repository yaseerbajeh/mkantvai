/*
  # Add Package Products to Database
  
  This migration adds two new package products:
  - SUB-PACKAGE-PREMIUM (البكج الفاخر) - Netflix + Shahid + IPTV
  - SUB-PACKAGE-LEGENDARY (البكج الاسطوري) - Netflix + Shahid
  
  These are premium bundle packages with multiple services.
*/

-- Add package subscriptions for SUB-PACKAGE-PREMIUM (البكج الفاخر)
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-PACKAGE-PREMIUM-001', '{"duration":"باقة متكاملة","type":"package","services":["Netflix Premium","Shahid VIP","IPTV Premium"],"features":["دعم فني 24/7","جودة 4K فائقة","مشاهدة متعددة الأجهزة"]}', 'SUB-PACKAGE-PREMIUM'),
  ('SUB-PACKAGE-PREMIUM-002', '{"duration":"باقة متكاملة","type":"package","services":["Netflix Premium","Shahid VIP","IPTV Premium"],"features":["دعم فني 24/7","جودة 4K فائقة","مشاهدة متعددة الأجهزة"]}', 'SUB-PACKAGE-PREMIUM'),
  ('SUB-PACKAGE-PREMIUM-003', '{"duration":"باقة متكاملة","type":"package","services":["Netflix Premium","Shahid VIP","IPTV Premium"],"features":["دعم فني 24/7","جودة 4K فائقة","مشاهدة متعددة الأجهزة"]}', 'SUB-PACKAGE-PREMIUM'),
  ('SUB-PACKAGE-PREMIUM-004', '{"duration":"باقة متكاملة","type":"package","services":["Netflix Premium","Shahid VIP","IPTV Premium"],"features":["دعم فني 24/7","جودة 4K فائقة","مشاهدة متعددة الأجهزة"]}', 'SUB-PACKAGE-PREMIUM'),
  ('SUB-PACKAGE-PREMIUM-005', '{"duration":"باقة متكاملة","type":"package","services":["Netflix Premium","Shahid VIP","IPTV Premium"],"features":["دعم فني 24/7","جودة 4K فائقة","مشاهدة متعددة الأجهزة"]}', 'SUB-PACKAGE-PREMIUM')
ON CONFLICT (subscription_code) DO NOTHING;

-- Add package subscriptions for SUB-PACKAGE-LEGENDARY (البكج الاسطوري)
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-PACKAGE-LEGENDARY-001', '{"duration":"باقة مميزة","type":"package","services":["Netflix Premium","Shahid VIP"],"features":["محتوى حصري","دعم فني متقدم","جودة HD فائقة"]}', 'SUB-PACKAGE-LEGENDARY'),
  ('SUB-PACKAGE-LEGENDARY-002', '{"duration":"باقة مميزة","type":"package","services":["Netflix Premium","Shahid VIP"],"features":["محتوى حصري","دعم فني متقدم","جودة HD فائقة"]}', 'SUB-PACKAGE-LEGENDARY'),
  ('SUB-PACKAGE-LEGENDARY-003', '{"duration":"باقة مميزة","type":"package","services":["Netflix Premium","Shahid VIP"],"features":["محتوى حصري","دعم فني متقدم","جودة HD فائقة"]}', 'SUB-PACKAGE-LEGENDARY'),
  ('SUB-PACKAGE-LEGENDARY-004', '{"duration":"باقة مميزة","type":"package","services":["Netflix Premium","Shahid VIP"],"features":["محتوى حصري","دعم فني متقدم","جودة HD فائقة"]}', 'SUB-PACKAGE-LEGENDARY'),
  ('SUB-PACKAGE-LEGENDARY-005', '{"duration":"باقة مميزة","type":"package","services":["Netflix Premium","Shahid VIP"],"features":["محتوى حصري","دعم فني متقدم","جودة HD فائقة"]}', 'SUB-PACKAGE-LEGENDARY')
ON CONFLICT (subscription_code) DO NOTHING;

-- Verify the subscriptions were added
SELECT 
  product_code,
  COUNT(*) as available_count,
  subscription_meta->>'type' as package_type
FROM public.subscriptions
WHERE product_code IN ('SUB-PACKAGE-PREMIUM', 'SUB-PACKAGE-LEGENDARY')
GROUP BY product_code, subscription_meta->>'type';


