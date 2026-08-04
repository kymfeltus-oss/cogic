"use client";

type PublicCountdownDigitProps = {
  value: string;
  digitClass: string;
};

export default function PublicCountdownDigit({ value, digitClass }: PublicCountdownDigitProps) {
  return (
    <span
      className={["public-countdown-unit__digit font-headline", digitClass].join(" ")}
      suppressHydrationWarning
    >
      {value}
    </span>
  );
}
