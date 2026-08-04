export type CountdownParts = {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
};

export function getCountdownParts(target: Date): CountdownParts {
  const diff = Math.max(0, target.getTime() - Date.now());
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  const pad = (value: number) => value.toString().padStart(2, "0");

  return {
    days: pad(days),
    hours: pad(hours),
    minutes: pad(minutes),
    seconds: pad(seconds),
  };
}

export const EVENT_START = new Date("2026-06-14T19:30:00-05:00");
export const UPDATES_EVENT_START = new Date("2026-05-24T19:00:00-05:00");
