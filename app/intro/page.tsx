import VideoIntroExperience from "@/components/intro/VideoIntroExperience";

export const dynamic = "force-static";

export default function IntroPage() {
  return (
    <div className="fixed inset-0 h-dvh w-full overflow-hidden bg-brand-black">
      <VideoIntroExperience />
    </div>
  );
}
