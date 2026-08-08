import { TravelShell } from "@/components/travel/TravelShell";
import { publicTravelInfo } from "@/lib/travel/repository";

export const dynamic = "force-dynamic";

type TravelInfoRow = {
  id: string;
  name?: string | null;
  title?: string | null;
  guidance?: string | null;
  description?: string | null;
  body?: string | null;
  url?: string | null;
};

export default async function Page() {
  const travelInfo = await publicTravelInfo();
  const sections: { title: string; rows: TravelInfoRow[] }[] = [
    { title: "Airport Information", rows: travelInfo.airports },
    { title: "Ground Transportation", rows: travelInfo.transport },
    { title: "Travel Announcements", rows: travelInfo.announcements },
  ];

  return (
    <TravelShell back>
      <div className="ct-route-heading">
        <p className="ct-travel-eyebrow">COGIC TRAVEL</p>
        <h1>Getting Around St. Louis</h1>
        <p>Airport, shuttle, transit, parking, and COGIC transportation guidance.</p>
      </div>

      {sections.map((section) => (
        <section key={section.title} className="ct-info-section">
          <h2>{section.title}</h2>
          <div className="ct-info-list">
            {section.rows.map((row) => (
              <article key={row.id} className="ct-card ct-card--feature ct-info-card">
                <h3>{row.name || row.title}</h3>
                <p>{row.guidance || row.description || row.body}</p>
                {row.url ? <a href={row.url}>Learn more</a> : null}
              </article>
            ))}
            {!section.rows.length ? <p className="ct-empty-info">No published information yet.</p> : null}
          </div>
        </section>
      ))}
    </TravelShell>
  );
}
