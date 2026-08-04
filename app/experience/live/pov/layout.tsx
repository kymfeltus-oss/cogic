export default function ViewerPovLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="h-dvh w-full overflow-hidden bg-brand-black">{children}</div>;
}
