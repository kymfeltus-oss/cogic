-- Official hotel photos saved under /public/hotels (filename matches property name).
update public.travel_hotels set image_url='/hotels/Hotel-Saint-Louis-Autograph-Collection.jpg',updated_at=now()
 where program_key='cogic-stream-2026' and slug='hotel-saint-louis';

update public.travel_hotels set image_url='/hotels/Hampton-Inn-St-Louis-Downtown---Exterior.jpg',updated_at=now()
 where program_key='cogic-stream-2026' and slug='hampton-inn-gateway-arch';

update public.travel_hotels set image_url='/hotels/Museum-Hotel-St-Louis.jpg',updated_at=now()
 where program_key='cogic-stream-2026' and slug='21c-museum-hotel';
