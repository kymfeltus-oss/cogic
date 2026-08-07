import RegistrationProductAccessClient from "@/components/owner/RegistrationProductAccessClient";
import OwnerProductionSideMenu from "@/components/owner/OwnerProductionSideMenu";

export const dynamic = "force-dynamic";
export default function OwnerRegistrationProductsPage(){return <main className="min-h-dvh bg-[#020203] p-2 text-white"><div className="mx-auto grid max-w-[112rem] gap-2 xl:grid-cols-[12rem_minmax(0,1fr)]"><OwnerProductionSideMenu active="registrations"/><div><header className="mb-2 rounded border border-white/10 bg-[#050814] p-4"><h1 className="font-headline text-3xl uppercase"><span className="text-[#00a8ff]">Registration</span> <span className="text-[#ff2faf]">Products & Access</span></h1><p className="mt-1 text-xs uppercase tracking-wider text-white/60">Products → entitlements → confirmed attendees → credentials → server access decisions</p></header><RegistrationProductAccessClient/></div></div></main>}
