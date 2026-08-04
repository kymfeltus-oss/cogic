DROP TABLE IF EXISTS public.service_broadcast_destinations;

ALTER TABLE public.tenant_equipment_profiles DROP CONSTRAINT IF EXISTS tenant_equipment_profiles_recommended_broadcast_platform_check;
ALTER TABLE public.tenant_equipment_profiles DROP COLUMN IF EXISTS recommended_broadcast_platform;

NOTIFY pgrst, 'reload schema';
