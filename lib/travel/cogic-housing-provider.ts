import "server-only";
export interface CogicHousingReservationProvider{findReservation(input:{userId:string;confirmationNumber?:string}):Promise<unknown|null>;importReservation(input:unknown):Promise<unknown>;syncReservationStatus(reservationId:string):Promise<"confirmed"|"canceled"|"awaiting_confirmation">}
export function cogicHousingAutomationAvailable(){return false;}
