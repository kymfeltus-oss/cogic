import "server-only";
import type { ProviderStatus, TravelSearchKind } from "./types";

export interface TravelProvider { id:string; searchHotels(input:unknown):Promise<unknown[]>; getHotel(id:string):Promise<unknown|null>; searchFlights(input:unknown):Promise<unknown[]>; searchCars(input:unknown):Promise<unknown[]>; createBooking(input:unknown):Promise<unknown>; getBooking(id:string):Promise<unknown|null>; cancelBooking(id:string):Promise<boolean> }

const providers = [
  { id:"expedia-rapid", name:"Expedia Rapid", env:"EXPEDIA_RAPID_API_KEY" },
  { id:"amadeus", name:"Amadeus", env:"AMADEUS_API_KEY" },
  { id:"duffel", name:"Duffel", env:"DUFFEL_ACCESS_TOKEN" },
] as const;
export function providerStatuses():ProviderStatus[]{ return providers.map(p=>({id:p.id,name:p.name,configured:Boolean(process.env[p.env])})); }
export function providerAvailable(kind:TravelSearchKind){ void kind; return providerStatuses().some(p=>p.configured); }
export function unavailableMessage(kind:TravelSearchKind){ return `Live ${kind} search is not available yet. No rates or availability are being displayed. You can still use official COGIC information and save reservations made elsewhere.`; }
