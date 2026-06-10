import { Container } from "../components/Container";

export function Nav() {
  return (
    <header className="pp-nav" role="banner">
      <Container width="wide">
        <div className="pp-nav__row">
          <a className="pp-nav__brand" href="/" aria-label="Home">
            {/* asset slot (t2): brand mark */}
            <span data-slot="brand-mark" />
            <span className="pp-nav__brand-text" data-slot="brand-text">
              {/* copy slot (t3): brand wordmark */}
            </span>
          </a>

          <nav className="pp-nav__links" aria-label="Primary">
            <ul>
              <li><a href="#features" data-slot="nav-link-features">{/* t3 */}</a></li>
              <li><a href="#how-it-works" data-slot="nav-link-how">{/* t3 */}</a></li>
              <li><a href="#pricing" data-slot="nav-link-pricing">{/* t3 */}</a></li>
              <li><a href="#faq" data-slot="nav-link-faq">{/* t3 */}</a></li>
            </ul>
          </nav>

          <div className="pp-nav__actions">
            {/* action slot (t6): sign in */}
            <a className="pp-btn pp-btn--ghost" href="#sign-in" data-action="sign-in" data-slot="nav-signin">
              {/* t3 */}
            </a>
            {/* action slot (t6): primary CTA */}
            <a className="pp-btn pp-btn--primary" href="#cta" data-action="get-started" data-slot="nav-cta">
              {/* t3 */}
            </a>
          </div>
        </div>
      </Container>
    </header>
  );
}
