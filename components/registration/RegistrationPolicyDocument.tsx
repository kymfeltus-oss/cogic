export type RegistrationPolicyDocumentProps = {
  title: string;
  version: string;
  content: string;
  effectiveAt?: string | null;
  className?: string;
};

export default function RegistrationPolicyDocument({ title, version, content, effectiveAt, className = "" }: RegistrationPolicyDocumentProps) {
  return (
    <article className={`registration-policy-document ${className}`.trim()}>
      <header>
        <p className="registration-kicker">Registration policy</p>
        <h2>{title}</h2>
        <p>Version {version}{effectiveAt ? ` · Effective ${new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(effectiveAt))}` : ""}</p>
      </header>
      <div className="whitespace-pre-wrap">{content}</div>
    </article>
  );
}
