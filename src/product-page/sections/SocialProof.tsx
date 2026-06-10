import { Section } from "../components/Section";
import { Container } from "../components/Container";

export function SocialProof() {
  return (
    <Section id="social-proof" variant="muted" ariaLabel="Trusted by">
      <Container>
        <p className="pp-eyebrow pp-eyebrow--center" data-slot="proof-eyebrow">
          {/* t3: e.g. "Trusted by builders at" */}
        </p>
        <ul className="pp-logo-row" aria-label="Customer logos">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="pp-logo-row__item">
              {/* asset slot (t2): logo #{i + 1} */}
              <span className="pp-logo-row__slot" data-slot={`logo-${i + 1}`} />
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
