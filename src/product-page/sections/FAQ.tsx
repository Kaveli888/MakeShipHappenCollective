import { Section } from "../components/Section";
import { Container } from "../components/Container";

const QUESTIONS = ["q-1", "q-2", "q-3", "q-4", "q-5", "q-6"] as const;

export function FAQ() {
  return (
    <Section id="faq" variant="muted" ariaLabel="Frequently asked questions">
      <Container width="narrow">
        <header className="pp-section-head">
          <p className="pp-eyebrow" data-slot="faq-eyebrow">{/* t3 */}</p>
          <h2 className="pp-h2" data-slot="faq-headline">{/* t3 */}</h2>
        </header>

        <dl className="pp-faq">
          {QUESTIONS.map((q) => (
            <div key={q} className="pp-faq__row" data-slot={q}>
              <dt>
                <details>
                  <summary className="pp-faq__q" data-slot={`${q}-question`}>
                    {/* t3 */}
                  </summary>
                  <dd className="pp-faq__a" data-slot={`${q}-answer`}>
                    {/* t3 */}
                  </dd>
                </details>
              </dt>
            </div>
          ))}
        </dl>
      </Container>
    </Section>
  );
}
