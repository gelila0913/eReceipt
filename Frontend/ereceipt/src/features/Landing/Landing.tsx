import React, { useState } from 'react';
import logoImg from '../../assets/logo.png';
import logoWhiteImg from '../../assets/logo-white.png';
import heroSceneImg from '../../assets/hero-scene.jpg';
import merchantPortraitImg from '../../assets/merchant-portrait.jpg';
import addisSkylineImg from '../../assets/addis-skyline.jpg';
import selamAvatarImg from '../../assets/selam-avatar.jpg';
import styles from './LandingPage.module.css';

export interface LandingPageProps {
  onNavigate?: (screen: string) => void;
  onSignInClick?: () => void;
  onGetStartedClick?: () => void;
  onScanReceiptClick?: () => void;
  onMerchantPortalClick?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onNavigate,
  onSignInClick,
  onGetStartedClick,
  onScanReceiptClick,
  onMerchantPortalClick,
}) => {
  const handleSignIn = onSignInClick || (() => onNavigate?.('signin'));
  const handleGetStarted = onGetStartedClick || (() => onNavigate?.('registration'));
  const handleScanReceipt = onScanReceiptClick || (() => onNavigate?.('receipt-issuance'));
  const handleMerchantPortal = onMerchantPortalClick || onSignInClick || (() => onNavigate?.('signin'));
  const [activeLang, setActiveLang] = useState<'EN' | 'አማ'>('EN');

  return (
    <div className={styles.pageWrapper}>
      {/* ─── 1. NAVBAR ────────────────────────────────────────── */}
      <header className={styles.navbar}>
        <div className={styles.navContainer}>
          <a
            href="/"
            className={styles.brandLogo}
            onClick={(e) => {
              e.preventDefault();
              if (onNavigate) {
                onNavigate('landing');
              } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
          >
            <img
              src={logoImg}
              alt="eReceipt - Digital Receipts. A Stronger Ethiopia."
              className={styles.logoImg}
            />
          </a>

          <nav className={styles.navLinks}>
            <a href="#home" className={`${styles.navLink} ${styles.navLinkActive}`}>Home</a>
            <a href="#how-it-works" className={styles.navLink}>How It Works</a>
            <a href="#customers" className={styles.navLink}>For Customers</a>
            <a href="#merchants" className={styles.navLink}>For Merchants</a>
            <a href="#about" className={styles.navLink}>About</a>
          </nav>

          <div className={styles.navActions}>
            <button
              type="button"
              className={styles.langSelector}
              onClick={() => setActiveLang(activeLang === 'EN' ? 'አማ' : 'EN')}
            >
              <span>{activeLang}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <a
              href="/login"
              className={styles.btnSecondary}
              onClick={(e) => {
                e.preventDefault();
                handleSignIn();
              }}
            >
              Sign In
            </a>
            <a
              href="/merchant/register"
              className={styles.btnPrimary}
              onClick={(e) => {
                e.preventDefault();
                handleGetStarted();
              }}
            >
              Get Started
            </a>
          </div>
        </div>
      </header>

      {/* ─── 2. HERO SECTION ─────────────────────────────────── */}
      <section id="home" className={styles.heroSection}>
        <div className={styles.heroContainer}>
          {/* Left Column: Headlines & Dual Portals */}
          <div className={styles.heroLeft}>
            <span className={styles.eyebrowBadge}>DIGITAL RECEIPTS FOR A SMARTER ETHIOPIA</span>
            <h1 className={styles.heroHeadline}>
              Every purchase <br />
              leaves a trace. <br />
              Make it digital.
            </h1>
            <p className={styles.heroDescription}>
              eReceipt helps you access your purchase receipts digitally, verify their authenticity,
              and manage your records — whether you’re a customer or a business owner.
            </p>

            {/* Dual Portal Cards */}
            <div className={styles.portalCardsRow}>
              {/* Customer Box */}
              <div className={styles.portalCard}>
                <div className={styles.portalCardHeader}>
                  <div className={styles.portalIconBox}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 7V4h3" />
                      <path d="M20 7V4h-3" />
                      <path d="M4 17v3h3" />
                      <path d="M20 17v3h-3" />
                      <line x1="9" y1="12" x2="15" y2="12" />
                    </svg>
                  </div>
                  <div>
                    <h3 className={styles.portalTitle}>I'm a Customer</h3>
                    <p className={styles.portalSubtitle}>
                      Scan a receipt QR code to view, verify, and keep your purchase records in one place.
                    </p>
                  </div>
                </div>
                <a
                  href="/scan"
                  className={styles.portalCtaBtnPrimary}
                  onClick={(e) => {
                    e.preventDefault();
                    handleScanReceipt();
                  }}
                >
                  <span>Scan Receipt</span>
                  <span className={styles.btnArrow}>→</span>
                </a>
              </div>

              {/* Merchant Box */}
              <div className={styles.portalCard}>
                <div className={styles.portalCardHeader}>
                  <div className={styles.portalIconBox}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  </div>
                  <div>
                    <h3 className={styles.portalTitle}>I'm a Merchant</h3>
                    <p className={styles.portalSubtitle}>
                      Register your business or sign in to manage your digital receipts.
                    </p>
                  </div>
                </div>
                <a
                  href="/merchant/login"
                  className={styles.portalCtaBtnSecondary}
                  onClick={(e) => {
                    e.preventDefault();
                    handleMerchantPortal();
                  }}
                >
                  <span>Merchant Portal</span>
                  <span className={styles.btnArrow}>→</span>
                </a>
              </div>
            </div>

            {/* Trust Badges Bar */}
            <div className={styles.heroTrustBadges}>
              <div className={styles.trustItem}>
                <span className={styles.trustIcon}>🌱</span>
                <div>
                  <strong>Paperless</strong>
                  <p>Reduce paper waste</p>
                </div>
              </div>
              <div className={styles.trustItem}>
                <span className={styles.trustIcon}>🛡️</span>
                <div>
                  <strong>Secure</strong>
                  <p>Your data is protected</p>
                </div>
              </div>
              <div className={styles.trustItem}>
                <span className={styles.trustIcon}>🔲</span>
                <div>
                  <strong>Efficient</strong>
                  <p>Save time and stay organized</p>
                </div>
              </div>
              <div className={styles.trustItem}>
                <span className={styles.trustIcon}>📄</span>
                <div>
                  <strong>Built for Ethiopia</strong>
                  <p>Designed for local businesses</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Scene with Realistic Digital & Paper Receipt */}
          <div className={styles.heroRight}>
            <div className={styles.heroSceneWrapper}>
              <img
                src={heroSceneImg}
                alt="Digital and paper receipts with Ethiopian traditional coffee setting"
                className={styles.heroSceneImg}
              />
              <div className={styles.heroScriptTag}>
                Verified receipts. Greater trust.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 3. HOW IT WORKS ─────────────────────────────────── */}
      <section id="how-it-works" className={styles.howItWorksSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionPre}>HOW IT WORKS</span>
          <h2 className={styles.sectionHeadline}>Simple steps. Real value.</h2>
          <p className={styles.sectionSub}>
            Getting your digital receipt is quick and easy. Follow these steps whether you're a customer or a merchant.
          </p>
        </div>

        <div className={styles.stepsTimelineRow}>
          {/* Step 1 */}
          <div className={styles.stepItem}>
            <div className={styles.stepCircleIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </div>
            <div className={styles.stepNumberBadge}>01</div>
            <h4 className={styles.stepTitle}>Shop</h4>
            <p className={styles.stepDesc}>Make a purchase from a participating merchant.</p>
          </div>

          <div className={styles.stepDividerArrow}>→</div>

          {/* Step 2 */}
          <div className={styles.stepItem}>
            <div className={styles.stepCircleIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
              </svg>
            </div>
            <div className={styles.stepNumberBadge}>02</div>
            <h4 className={styles.stepTitle}>Scan</h4>
            <p className={styles.stepDesc}>Scan the QR code on your receipt to access the digital record.</p>
          </div>

          <div className={styles.stepDividerArrow}>→</div>

          {/* Step 3 */}
          <div className={styles.stepItem}>
            <div className={styles.stepCircleIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div className={styles.stepNumberBadge}>03</div>
            <h4 className={styles.stepTitle}>View</h4>
            <p className={styles.stepDesc}>See your receipt details, verify the information, or save it to your account.</p>
          </div>

          <div className={styles.stepDividerArrow}>→</div>

          {/* Step 4 */}
          <div className={styles.stepItem}>
            <div className={styles.stepCircleIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
            </div>
            <div className={styles.stepNumberBadge}>04</div>
            <h4 className={styles.stepTitle}>Save / Manage</h4>
            <p className={styles.stepDesc}>Keep your receipts accessible for future reference.</p>
          </div>
        </div>
      </section>

      {/* ─── 4. DUAL AUDIENCE CARDS (FOR CUSTOMERS & FOR MERCHANTS) ─ */}
      <section className={styles.audienceSection}>
        <div className={styles.audienceGridContainer}>
          {/* 1. For Customers Card */}
          <div id="customers" className={styles.audienceCard}>
            <div className={styles.audienceCardContent}>
              <span className={styles.sectionPre}>FOR CUSTOMERS</span>
              <h3 className={styles.audienceHeadline}>More control. More convenience.</h3>
              <p className={styles.audienceDesc}>
                Access your receipts, verify their authenticity, and keep your purchase history organized — all in one place.
              </p>

              <ul className={styles.checklist}>
                <li>
                  <span className={styles.checkIcon}>✓</span>
                  <span>Scan QR codes to view digital receipts</span>
                </li>
                <li>
                  <span className={styles.checkIcon}>✓</span>
                  <span>Keep your purchase records organized</span>
                </li>
                <li>
                  <span className={styles.checkIcon}>✓</span>
                  <span>Retrieve previously saved receipts</span>
                </li>
                <li>
                  <span className={styles.checkIcon}>✓</span>
                  <span>Verify receipt details where supported</span>
                </li>
              </ul>

              <a
                href="/customers"
                className={styles.actionGreenBtn}
                onClick={(e) => {
                  if (onScanReceiptClick) {
                    e.preventDefault();
                    onScanReceiptClick();
                  }
                }}
              >
                <span>Explore Customer Features</span>
                <span className={styles.btnArrow}>→</span>
              </a>
            </div>

            {/* Right inside Card: Phone with Receipts List & Floating Badge */}
            <div className={styles.audienceCardVisual}>
              <div className={styles.customerPhoneMockup}>
                <div className={styles.phoneHeaderBar}>
                  <span className={styles.phoneHeaderTitle}>My Receipts</span>
                  <div className={styles.phoneTabsRow}>
                    <span className={styles.phoneTabActive}>All</span>
                    <span className={styles.phoneTab}>Recent</span>
                    <span className={styles.phoneTab}>Favorites</span>
                  </div>
                </div>
                <div className={styles.phoneReceiptList}>
                  <div className={styles.phoneReceiptItem}>
                    <div className={styles.receiptBrandDot}></div>
                    <div className={styles.receiptItemInfo}>
                      <strong>Addis Mart</strong>
                      <p>Apr 26, 2026 • ETB 241.50</p>
                    </div>
                    <span className={styles.receiptChevron}>›</span>
                  </div>
                  <div className={styles.phoneReceiptItem}>
                    <div className={styles.receiptBrandDot}></div>
                    <div className={styles.receiptItemInfo}>
                      <strong>Salem Supermarket</strong>
                      <p>Apr 24, 2026 • ETB 680.00</p>
                    </div>
                    <span className={styles.receiptChevron}>›</span>
                  </div>
                  <div className={styles.phoneReceiptItem}>
                    <div className={styles.receiptBrandDot}></div>
                    <div className={styles.receiptItemInfo}>
                      <strong>TechHouse</strong>
                      <p>Apr 20, 2026 • ETB 3,450.00</p>
                    </div>
                    <span className={styles.receiptChevron}>›</span>
                  </div>
                  <div className={styles.phoneReceiptItem}>
                    <div className={styles.receiptBrandDot}></div>
                    <div className={styles.receiptItemInfo}>
                      <strong>Kaldis Café</strong>
                      <p>Apr 19, 2026 • ETB 185.00</p>
                    </div>
                    <span className={styles.receiptChevron}>›</span>
                  </div>
                </div>
              </div>

              {/* Floating feature pills badge */}
              <div className={styles.floatingFeaturesBadge}>
                <div className={styles.badgeLine}><span className={styles.greenCheck}>✓</span> Organized</div>
                <div className={styles.badgeLine}><span className={styles.greenCheck}>✓</span> Secure</div>
                <div className={styles.badgeLine}><span className={styles.greenCheck}>✓</span> Always with you</div>
              </div>
            </div>
          </div>

          {/* 2. For Merchants Card */}
          <div id="merchants" className={styles.audienceCard}>
            <div className={styles.audienceCardContent}>
              <span className={styles.sectionPre}>FOR MERCHANTS</span>
              <h3 className={styles.audienceHeadline}>Register. Verify. Grow.</h3>
              <p className={styles.audienceDesc}>
                Join eReceipt to manage your business, issue digital receipts, and track your sales — with the right authorization.
              </p>

              <ul className={styles.checklist}>
                <li>
                  <span className={styles.checkIcon}>✓</span>
                  <span>Apply for merchant registration</span>
                </li>
                <li>
                  <span className={styles.checkIcon}>✓</span>
                  <span>Submit required business and tax documents</span>
                </li>
                <li>
                  <span className={styles.checkIcon}>✓</span>
                  <span>Track verification and approval status</span>
                </li>
                <li>
                  <span className={styles.checkIcon}>✓</span>
                  <span>Access receipt-management features after authorization</span>
                </li>
              </ul>

              <a
                href="/merchant/register"
                className={styles.actionGreenBtn}
                onClick={(e) => {
                  if (onGetStartedClick) {
                    e.preventDefault();
                    onGetStartedClick();
                  }
                }}
              >
                <span>Get Started as a Merchant</span>
                <span className={styles.btnArrow}>→</span>
              </a>
            </div>

            {/* Right inside Card: Merchant Photo with Floating Pill */}
            <div className={styles.audienceCardVisual}>
              <div className={styles.merchantPhotoCard}>
                <img
                  src={merchantPortraitImg}
                  alt="Ethiopian merchant in store"
                  className={styles.merchantPortraitPhoto}
                />
                <div className={styles.floatingMerchantPill}>
                  <div className={styles.pillIconBox}>🏪</div>
                  <div className={styles.pillTextCol}>
                    <strong>Simpler operations.</strong>
                    <p>Better records. More growth. ⌵</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 5. WHY ERECEIPT: 4 PILLARS ──────────────────────── */}
      <section id="about" className={styles.pillarsSection}>
        <div className={styles.pillarsContainer}>
          <div className={styles.pillarsHeaderRow}>
            <div className={styles.pillarsHeaderLeft}>
              <span className={styles.sectionPre}>WHY ERECEIPT?</span>
              <h2 className={styles.pillarsTitle}>Built for trust. Designed for impact.</h2>
              <p className={styles.pillarsDescription}>
                eReceipt is more than a digital receipt platform — it's a step toward a more transparent,
                efficient, and sustainable business ecosystem in Ethiopia. We make receipt access and record
                management easier for everyone, while supporting compliance and better tax reporting.
              </p>
            </div>
            <div className={styles.pillarsHeaderRight}>
              <a href="#about" className={styles.actionGreenBtn}>
                <span>Learn More About Us</span>
                <span className={styles.btnArrow}>→</span>
              </a>
            </div>
          </div>

          {/* 4 Cards in a Clean Horizontal Row */}
          <div className={styles.pillarsCardsRow}>
            {/* Card 1 */}
            <div className={styles.pillarCard}>
              <div className={styles.pillarIconBox}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#123D2C" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </div>
              <h4 className={styles.pillarTitle}>Verified Merchants</h4>
              <p className={styles.pillarText}>
                Merchant identity and business details are verified before full access is granted.
              </p>
            </div>

            {/* Card 2 */}
            <div className={styles.pillarCard}>
              <div className={styles.pillarIconBox}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#123D2C" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <line x1="7" y1="17" x2="7" y2="17.01" />
                  <line x1="17" y1="7" x2="17" y2="7.01" />
                </svg>
              </div>
              <h4 className={styles.pillarTitle}>Authentic Receipts</h4>
              <p className={styles.pillarText}>
                Every receipt has a unique identifier and QR code for verification.
              </p>
            </div>

            {/* Card 3 */}
            <div className={styles.pillarCard}>
              <div className={styles.pillarIconBox}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#123D2C" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <h4 className={styles.pillarTitle}>Data Privacy</h4>
              <p className={styles.pillarText}>
                Your information is protected with industry-standard security measures.
              </p>
            </div>

            {/* Card 4 */}
            <div className={styles.pillarCard}>
              <div className={styles.pillarIconBox}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#123D2C" strokeWidth="2">
                  <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                </svg>
              </div>
              <h4 className={styles.pillarTitle}>Secure Infrastructure</h4>
              <p className={styles.pillarText}>
                Reliable, scalable, and built for long-term growth.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 6. NATIONAL VISION BANNER & TESTIMONIAL ─────────── */}
      <section className={styles.visionSection}>
        <div className={styles.visionContainer}>
          {/* Left Dark Emerald Banner with Addis Ababa Background */}
          <div className={styles.visionHeroCard}>
            <div className={styles.visionImageCol}>
              <img
                src={addisSkylineImg}
                alt="Addis Ababa monument and cityscape at sunset"
                className={styles.visionBgPhoto}
              />
            </div>
            <div className={styles.visionContentCol}>
              <span className={styles.visionEyebrow}>A STRONGER DIGITAL ECONOMY</span>
              <h3 className={styles.visionHeading}>
                For a more transparent and efficient Ethiopia
              </h3>
              <p className={styles.visionText}>
                eReceipt helps businesses stay organized, empowers customers with easy access to their
                receipts, and supports a more transparent and accountable tax system.
              </p>

              <div className={styles.statsCountersRow}>
                <div className={styles.statBox}>
                  <span className={styles.statIcon}>🌱</span>
                  <div className={styles.statTextWrap}>
                    <strong className={styles.statMetric}>100%</strong>
                    <span className={styles.statLabel}>Digital receipts</span>
                  </div>
                </div>
                <div className={styles.statBox}>
                  <span className={styles.statIcon}>🍃</span>
                  <div className={styles.statTextWrap}>
                    <strong className={styles.statMetric}>Less</strong>
                    <span className={styles.statLabel}>paper waste</span>
                  </div>
                </div>
                <div className={styles.statBox}>
                  <span className={styles.statIcon}>📋</span>
                  <div className={styles.statTextWrap}>
                    <strong className={styles.statMetric}>More</strong>
                    <span className={styles.statLabel}>organized records</span>
                  </div>
                </div>
                <div className={styles.statBox}>
                  <span className={styles.statIcon}>⚖️</span>
                  <div className={styles.statTextWrap}>
                    <strong className={styles.statMetric}>A fairer</strong>
                    <span className={styles.statLabel}>tax ecosystem</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Customer Testimonial Card */}
          <div className={styles.testimonialCard}>
            <div className={styles.quoteMarkIcon}>“</div>
            <blockquote className={styles.quoteBody}>
              “eReceipt makes it so easy to keep track of my purchases. I can quickly scan a QR code
              and view all the details. It gives me confidence and peace of mind.”
            </blockquote>
            <div className={styles.authorRow}>
              <img
                src={selamAvatarImg}
                alt="Selam Tadesse"
                className={styles.authorPhoto}
              />
              <div className={styles.authorInfo}>
                <strong className={styles.authorName}>Selam Tadesse</strong>
                <p className={styles.authorRole}>Customer</p>
              </div>
            </div>
            <div className={styles.carouselDots}>
              <span className={`${styles.dot} ${styles.dotActive}`}></span>
              <span className={styles.dot}></span>
              <span className={styles.dot}></span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 7. FOOTER ───────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.footerContainer}>
          <div className={styles.footerBrandCol}>
            <div className={styles.footerLogo}>
              <img
                src={logoWhiteImg}
                alt="eReceipt - Digital Receipts. A Stronger Ethiopia."
                className={styles.footerLogoImg}
              />
            </div>
            <p className={styles.footerTagline}>
              Digital receipts. Stronger businesses. <br />
              A brighter Ethiopia.
            </p>
          </div>

          <div className={styles.footerNavGroup}>
            <h4>For Customers</h4>
            <ul>
              <li>
                <a
                  href="/scan"
                  onClick={(e) => {
                    if (onScanReceiptClick) {
                      e.preventDefault();
                      onScanReceiptClick();
                    }
                  }}
                >
                  Scan Receipt
                </a>
              </li>
              <li><a href="/saved">Saved Receipts</a></li>
              <li><a href="/help">Help</a></li>
            </ul>
          </div>

          <div className={styles.footerNavGroup}>
            <h4>For Merchants</h4>
            <ul>
              <li>
                <a
                  href="/merchant/register"
                  onClick={(e) => {
                    if (onGetStartedClick) {
                      e.preventDefault();
                      onGetStartedClick();
                    }
                  }}
                >
                  Register Business
                </a>
              </li>
              <li>
                <a
                  href="/merchant/login"
                  onClick={(e) => {
                    if (onSignInClick) {
                      e.preventDefault();
                      onSignInClick();
                    }
                  }}
                >
                  Merchant Sign In
                </a>
              </li>
              <li><a href="/guide">Verification Guide</a></li>
            </ul>
          </div>

          <div className={styles.footerNavGroup}>
            <h4>Company</h4>
            <ul>
              <li><a href="/about">About Us</a></li>
              <li><a href="/contact">Contact</a></li>
              <li><a href="/privacy">Privacy Policy</a></li>
              <li><a href="/terms">Terms of Service</a></li>
            </ul>
          </div>

          <div className={styles.footerRightCol}>
            <div className={styles.footerLangWrapper}>
              <button
                type="button"
                className={styles.footerLangBtn}
                onClick={() => setActiveLang(activeLang === 'EN' ? 'አማ' : 'EN')}
              >
                <span>{activeLang}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </div>
            <div className={styles.footerSocialIcons}>
              <a href="#fb" aria-label="Facebook">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95C18.05 21.45 22 17.19 22 12z"/>
                </svg>
              </a>
              <a href="#x" aria-label="X">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a href="#in" aria-label="LinkedIn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.64 1.64 0 1 0 0-3.28 1.64 1.64 0 0 0 0 3.28m1.39 9.74v-8.37H5.07v8.37h2.78z"/>
                </svg>
              </a>
              <a href="#yt" aria-label="YouTube">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21.58 7.19a2.5 2.5 0 0 0-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.82.42A2.5 2.5 0 0 0 2.42 7.19C2 8.76 2 12 2 12s0 3.24.42 4.81a2.5 2.5 0 0 0 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.82-.42a2.5 2.5 0 0 0 1.76-1.77C22 15.24 22 12 22 12s0-3.24-.42-4.81zM10 15V9l5.2 3-5.2 3z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar with Ethiopian Tibeb Geometric Border Accent */}
        <div className={styles.footerBottomBar}>
          <div className={styles.footerBottomInner}>
            <p>© 2026 eReceipt. All rights reserved.</p>
          </div>
          <div className={styles.tibebPatternStripe}></div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;