import { Section } from "../components/Section";
import { Container } from "../components/Container";

const FEATURE_SLOTS = ["feature-1", "feature-2", "feature-3", "feature-4", "feature-5", "feature-6"] as const;

export function Features() {
  return (
    <Section id="features" ariaLabel="Features">
      <Container>
        <header className="pp-section-head">
          <p className="pp-eyebrow" data-slot="features-eyebrow">{/* t3 */}</p>
          <h2 className="pp-h2" data-slot="features-headline">{/* t3 */}</h2>
          <p className="pp-lede" data-slot="features-sub">{/* t3 */}</p>
        </header>

        <ul className="pp-feature-grid">
          {FEATURE_SLOTS.map((slot) => (
            <li key={slot} className="pp-feature-card" data-slot={slot}>
              <div className="pp-feature-card__icon" aria-hidden="true">
                {/* asset slot (t2): icon for {slot} */}
                <span data-slot={`${slot}-icon`} />
              </div>
              <h3 className="pp-h3" data-slot={`${slot}-title`}>{/* t3 */}</h3>
              <p className="pp-body" data-slot={`${slot}-body`}>{/* t3 */}</p>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
