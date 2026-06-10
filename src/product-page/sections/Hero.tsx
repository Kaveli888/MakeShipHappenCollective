import { Section } from "../components/Section";
import { Container } from "../components/Container";

export function Hero() {
  return (
    <Section id="hero" ariaLabel="Hero">
      <Container width="wide">
        <div className="pp-hero__grid">
          <div className="pp-hero__copy">
            <p className="pp-eyebrow" data-slot="hero-eyebrow">{/* t3: eyebrow */}</p>
            <h1 className="pp-h1" data-slot="hero-headline">{/* t3: headline */}</h1>
            <p className="pp-lede" data-slot="hero-sub">{/* t3: subheadline */}</p>

            <div className="pp-hero__cta-row">
              <a
                className="pp-btn pp-btn--primary pp-btn--lg"
                href="#cta"
                data-action="hero-primary"
                data-slot="hero-cta-primary"
              >
                {/* t3 + t6 wires action */}
              </a>
              <a
                className="pp-btn pp-btn--ghost pp-btn--lg"
                href="#how-it-works"
                data-action="hero-secondary"
                data-slot="hero-cta-secondary"
              >
                {/* t3 */}
              </a>
            </div>

            <p className="pp-hero__assurance" data-slot="hero-assurance">
              {/* t3: trust line (no credit card, free plan, etc.) */}
            </p>
          </div>

          <div className="pp-hero__media" aria-hidden="true">
            {/* asset slot (t2): hero animation / product still */}
            <div className="pp-hero__media-frame" data-slot="hero-media" />
          </div>
        </div>
      </Container>
    </Section>
  );
}
