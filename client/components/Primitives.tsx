import type { ReactNode } from "react";
import type { Source, Assessment } from "../../shared/contracts";
import { date } from "../api";
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">◎</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function DemoBadge() {
  return <span className="badge demo">Fictional demo</span>;
}
export function Sources({
  sources,
  ids,
}: {
  sources: Source[];
  ids?: string[];
}) {
  return (
    <div className="source-links">
      {sources
        .filter((s) => !ids || ids.includes(s.id))
        .map((s) => (
          <span key={s.id}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.publisher} ↗
            </a>{" "}
            <small>Observed {date(s.retrievedAt)}</small>
          </span>
        ))}
    </div>
  );
}
export function Score({ assessment }: { assessment: Assessment }) {
  return (
    <div className="score-panel">
      <div className="score-total">
        <strong>{assessment.score}</strong>
        <span>opportunity score</span>
        <span>
          {assessment.confidence}% confidence · policy{" "}
          {assessment.policyVersion}
        </span>
      </div>
      <div className="score-components">
        {Object.entries(assessment.components).map(([key, c]) => (
          <div key={key}>
            <div className="row">
              <b>{key}</b>
              <span>{c.value}/100</span>
            </div>
            <progress max="100" value={c.value} />
            <p>{c.reason}</p>
          </div>
        ))}
      </div>
      {assessment.reasons.map((r) => (
        <p key={r} className="notice">
          {r}
        </p>
      ))}
    </div>
  );
}
