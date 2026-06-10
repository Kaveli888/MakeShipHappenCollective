import { Section } from "../components/Section";
import { Container } from "../components/Container";

export function CTA() {
  return (
    <Section id="cta" variant="accent" ariaLabel="Get started">
      <Container width="narrow">
        <div className="pp-cta">
          <h2 className="pp-h2" data-slot="cta-headline">{/* t3 */}</h2>
          <p className="pp-lede" data-slot="cta-sub">{/* t3 */}</p>

          {/* t6 form handler — uncontrolled markup so backend can attach */}
          <form
            className="pp-cta__form"
            action="#"
            method="post"
            data-action="signup"
            noValidate
          >
            <label className="pp-visually-hidden" htmlFor="cta-email">
              Email address
            </label>
            <input
              id="cta-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="pp-input"
              data-slot="cta-input"
              placeholder="" /* t3 fills placeholder */
            />
            <button
              type="submit"
              className="pp-btn pp-btn--primary pp-btn--lg"
              data-slot="cta-submit"
            >
              {/* t3 */}
            </button>
          </form>

          <p className="pp-cta__assurance" data-slot="cta-assurance">{/* t3 */}</p>
        </div>
      </Container>
    </Section>
  );
}
