ALTER TABLE public.mixers DROP CONSTRAINT IF EXISTS mixers_connection_type_check;
ALTER TABLE public.mixers
  DROP COLUMN IF EXISTS last_connection_method,
  DROP COLUMN IF EXISTS usb_device_id,
  DROP COLUMN IF EXISTS usb_device_name,
  DROP COLUMN IF EXISTS ethernet_ip_address,
  DROP COLUMN IF EXISTS connection_type;

NOTIFY pgrst, 'reload schema';
