import { Container } from "../components/Container";

const COLUMNS = ["product", "company", "resources", "legal"] as const;

export function Footer() {
  return (
    <footer className="pp-footer" role="contentinfo">
      <Container width="wide">
        <div className="pp-footer__grid">
          <div className="pp-footer__brand">
            <div data-slot="footer-brand-mark" aria-hidden="true" />
            <p className="pp-footer__tagline" data-slot="footer-tagline">{/* t3 */}</p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col} className="pp-footer__col" aria-label={col}>
              <h4 className="pp-footer__heading" data-slot={`footer-${col}-heading`}>
                {/* t3 */}
              </h4>
              <ul data-slot={`footer-${col}-links`}>
                {/* t3 fills <li><a/></li> entries */}
              </ul>
            </nav>
          ))}
        </div>

        <div className="pp-footer__base">
          <p data-slot="footer-copyright">{/* t3 */}</p>
          <ul className="pp-footer__social" aria-label="Social links" data-slot="footer-social">
            {/* t2 fills icon links */}
          </ul>
        </div>
      </Container>
    </footer>
  );
}
