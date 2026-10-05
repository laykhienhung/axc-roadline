import type { Plan, Target } from '../../shared/model';
import { nounFor } from '../../shared/noun';

/** "T1 - the shared tooling…" → chip "T1" + text; no prefix → no chip. */
export function splitDependency(text: string): { who: string | null; text: string } {
  const m = /^\s*([A-Za-z][\w&]{0,11})\s+[-–—]\s+(.+)$/.exec(text);
  if (!m) return { who: null, text };
  return { who: m[1], text: m[2].charAt(0).toUpperCase() + m[2].slice(1) };
}

const WarnIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--s-at_risk-fg)"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 3 2 20h20L12 3z" />
    <path d="M12 10v4M12 17h.01" />
  </svg>
);

const None = ({ text }: { text: string }) => <p className="none">{text}</p>;

export function TargetSections({ plan, target }: { plan: Plan; target: Target }) {
  const noun = nounFor(plan);
  // "Objective details" is the 4.2 details card, so the side column gets its own name there.
  const label = noun.one === 'target' ? 'Target details' : `More on this ${noun.one}`;
  return (
    <div className="side" aria-label={label}>
      <section className="card" aria-label="What this must achieve">
        <h3>What this must achieve</h3>
        {target.mustAchieve.length ? (
          <ol>
            {target.mustAchieve.map((x, i) => (
              <li key={i}>
                <span className="num">{String(i + 1).padStart(2, '0')}</span>
                {x}
              </li>
            ))}
          </ol>
        ) : (
          <None text="Not recorded" />
        )}
      </section>
      <section className="card" aria-label="Depends on">
        <h3>Depends on</h3>
        {target.dependsOn.length ? (
          <ul>
            {target.dependsOn.map((x, i) => {
              const d = splitDependency(x);
              return (
                <li key={i} className={d.who ? 'dep' : undefined}>
                  {d.who && <span className="chip">{d.who}</span>}
                  <span>{d.text}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <None text="Not recorded" />
        )}
      </section>
      <section className="card" aria-label="Risks">
        <h3>Risks &amp; mitigation</h3>
        {target.risks.length ? (
          target.risks.map((r, i) => (
            <div key={i} className="risk">
              <b>
                <WarnIcon />
                {r.risk}
              </b>
              {r.mitigation && <span>{r.mitigation}</span>}
            </div>
          ))
        ) : (
          <None text="No risks recorded" />
        )}
      </section>
      <section className="card" aria-label="How we will do it">
        <h3>How we will do it</h3>
        {target.how.length ? (
          <ul className="bullets">
            {target.how.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        ) : (
          <None text="Not recorded" />
        )}
      </section>
      <section className="card" aria-label="Change history">
        <h3>Change history</h3>
        {target.changes.length ? (
          <ul>
            {target.changes.map((c, i) => (
              <li key={i}>
                {[c.date, c.what, c.reason && `(${c.reason})`, c.by && `— ${c.by}`]
                  .filter(Boolean)
                  .join(' ')}
              </li>
            ))}
          </ul>
        ) : (
          <None text="No changes recorded" />
        )}
      </section>
    </div>
  );
}
