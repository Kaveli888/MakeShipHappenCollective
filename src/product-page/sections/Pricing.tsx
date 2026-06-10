import { Section } from "../components/Section";
import { Container } from "../components/Container";

const TIERS = ["tier-free", "tier-pro", "tier-team"] as const;

export function Pricing() {
  return (
    <Section id="pricing" ariaLabel="Pricing">
      <Container>
        <header className="pp-section-head">
          <p className="pp-eyebrow" data-slot="pricing-eyebrow">{/* t3 */}</p>
          <h2 className="pp-h2" data-slot="pricing-headline">{/* t3 */}</h2>
          <p className="pp-lede" data-slot="pricing-sub">{/* t3 */}</p>
        </header>

        <div className="pp-pricing-grid" role="list">
          {TIERS.map((tier) => (
            <article key={tier} className="pp-price-card" role="listitem" data-slot={tier}>
              <header>
                <h3 className="pp-h3" data-slot={`${tier}-name`}>{/* t3 */}</h3>
                <p className="pp-price" data-slot={`${tier}-price`}>{/* t3 */}</p>
                <p className="pp-body" data-slot={`${tier}-tagline`}>{/* t3 */}</p>
              </header>

              <ul className="pp-price-features" data-slot={`${tier}-features`}>
                {/* t3 fills <li> items */}
              </ul>

              <a
                className="pp-btn pp-btn--primary pp-btn--block"
                href="#cta"
                data-action={`select-${tier}`}
                data-slot={`${tier}-cta`}
              >
                {/* t3 label, t6 wires checkout */}
              </a>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}
