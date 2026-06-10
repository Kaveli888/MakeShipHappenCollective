import { Section } from "../components/Section";
import { Container } from "../components/Container";

const STEPS = ["step-1", "step-2", "step-3"] as const;

export function HowItWorks() {
  return (
    <Section id="how-it-works" variant="muted" ariaLabel="How it works">
      <Container>
        <header className="pp-section-head">
          <p className="pp-eyebrow" data-slot="how-eyebrow">{/* t3 */}</p>
          <h2 className="pp-h2" data-slot="how-headline">{/* t3 */}</h2>
          <p className="pp-lede" data-slot="how-sub">{/* t3 */}</p>
        </header>

        <ol className="pp-steps">
          {STEPS.map((step, i) => (
            <li key={step} className="pp-step" data-slot={step}>
              <div className="pp-step__index" aria-hidden="true">{i + 1}</div>
              <div className="pp-step__body">
                <h3 className="pp-h3" data-slot={`${step}-title`}>{/* t3 */}</h3>
                <p className="pp-body" data-slot={`${step}-body`}>{/* t3 */}</p>
                <div className="pp-step__media" aria-hidden="true" data-slot={`${step}-media`}>
                  {/* asset slot (t2): step visual */}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
