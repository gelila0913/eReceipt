import { useState, useEffect } from 'react';
import { LandingPage } from './features/Landing';
import { MerchantRegistration } from './features/merchant-registration';
import { LoginForm } from './features/auth';
import { Audit } from './features/audit';
import { Admin } from './features/admin';
import { ReceiptIssuance } from './features/receipt-issuance';
import { SESSION_EXPIRED_EVENT } from './services/apiClient';
import { ReceiptVerification } from './features/verification';
import { ReceiptImageView } from './features/receipt-image';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { clearStoredMerchantProfile } from './features/merchant-registration/profileStorage';
import './App.css';

type AppView =
  | 'landing'
  | 'signin'
  | 'login'
  | 'receipt-issuance'
  | 'merchant'
  | 'audit'
  | 'admin'
  | 'registration'
  | 'verify'
  | 'receipt-image';

const SESSION_VIEW_KEY = 'ereceipt_active_view';
const SESSION_SCREEN_KEY = 'ereceipt_active_screen';

export function isOfficerAuthenticated(): boolean {
  try {
    const token =
      window.localStorage.getItem('officer_token') ||
      window.sessionStorage.getItem('officer_token');
    return Boolean(token && token.trim().length > 10);
  } catch {
    return false;
  }
}

export function isMerchantAuthenticated(): boolean {
  try {
    const token =
      window.localStorage.getItem('ereceipt_token') ||
      window.localStorage.getItem('merchant_token') ||
      window.sessionStorage.getItem('ereceipt_token');
    const merchantRaw =
      window.localStorage.getItem('ereceipt_merchant') ||
      window.localStorage.getItem('merchant_user') ||
      window.sessionStorage.getItem('ereceipt_merchant');

    if (!token || token.trim().length < 8) return false;
    if (!merchantRaw) return false;

    const parsed = JSON.parse(merchantRaw);
    return Boolean(parsed && (parsed.tin || parsed.id));
  } catch {
    return false;
  }
}

function parseUrlState(): { view: AppView; merchantScreen: string } {
  const pathname = window.location.pathname.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  const viewParam = (params.get('view') || '').toLowerCase();
  const screenParam = (params.get('screen') || '').toLowerCase();

  const savedView = (window.localStorage.getItem(SESSION_VIEW_KEY) ||
    window.sessionStorage.getItem(SESSION_VIEW_KEY)) as AppView | null;
  const savedScreen =
    window.localStorage.getItem(SESSION_SCREEN_KEY) ||
    window.sessionStorage.getItem(SESSION_SCREEN_KEY) ||
    'dashboard';

  // Public receipt verification or image routes
  if (viewParam === 'receipt-image' || viewParam === 'image' || pathname.startsWith('/receipt-image')) {
    return { view: 'receipt-image', merchantScreen: 'dashboard' };
  }
  if (viewParam === 'verify' || pathname.startsWith('/verify') || params.get('irn')) {
    return { view: 'verify', merchantScreen: 'dashboard' };
  }

  // 1. Pathname-based detection (e.g. /admin, /registration, /signin)
  if (pathname.includes('/admin')) {
    return { view: 'admin', merchantScreen: 'dashboard' };
  }
  if (pathname.includes('/registration') || pathname.includes('/register')) {
    return { view: 'registration', merchantScreen: 'dashboard' };
  }
  if (pathname.includes('/signin') || pathname.includes('/login')) {
    return { view: 'signin', merchantScreen: 'dashboard' };
  }

  // Protected merchant pathnames: require active authenticated session
  if (pathname.includes('/pos') || pathname.includes('/receipt-issuance')) {
    if (!isMerchantAuthenticated()) {
      return { view: 'signin', merchantScreen: 'dashboard' };
    }
    return { view: 'receipt-issuance', merchantScreen: 'dashboard' };
  }
  if (pathname.includes('/merchant') || pathname.includes('/dashboard')) {
    if (!isMerchantAuthenticated()) {
      return { view: 'signin', merchantScreen: 'dashboard' };
    }
    let screen = 'dashboard';
    if (pathname.includes('/settings')) screen = 'settings';
    else if (pathname.includes('/transactions') || pathname.includes('/sales')) screen = 'sales';
    else if (pathname.includes('/audit')) screen = 'audit';
    else if (pathname.includes('/receipt') || pathname.includes('/invoice')) screen = 'receipt';
    else if (pathname.includes('/pos')) screen = 'pos';
    else if (screenParam) screen = screenParam;
    else if (savedScreen) screen = savedScreen;

    return { view: 'merchant', merchantScreen: screen };
  }

  // 2. Query parameter detection (e.g. ?view=signin, ?view=registration)
  if (viewParam === 'login' || viewParam === 'signin') {
    return { view: 'signin', merchantScreen: 'dashboard' };
  }
  if (viewParam === 'registration' || viewParam === 'register') {
    return { view: 'registration', merchantScreen: 'dashboard' };
  }
  if (viewParam === 'admin') {
    return { view: 'admin', merchantScreen: 'dashboard' };
  }

  // Protected query parameters: require active authentication
  if (viewParam === 'receipt-issuance' || viewParam === 'pos') {
    if (!isMerchantAuthenticated()) {
      return { view: 'signin', merchantScreen: 'dashboard' };
    }
    return { view: 'receipt-issuance', merchantScreen: 'dashboard' };
  }
  if (
    viewParam === 'merchant' ||
    viewParam === 'audit' ||
    viewParam === 'settings' ||
    viewParam === 'invoice' ||
    viewParam === 'dashboard' ||
    viewParam === 'sales' ||
    viewParam === 'transactions' ||
    viewParam === 'overview'
  ) {
    if (!isMerchantAuthenticated()) {
      return { view: 'signin', merchantScreen: 'dashboard' };
    }
    let screen = screenParam || 'dashboard';
    if (viewParam === 'invoice' || screenParam === 'receipt') screen = 'receipt';
    else if (viewParam === 'settings') screen = 'settings';
    else if (viewParam === 'sales' || viewParam === 'transactions') screen = 'sales';
    else if (viewParam === 'audit') screen = 'audit';
    else if (viewParam === 'dashboard' || viewParam === 'overview') screen = 'dashboard';

    return { view: 'merchant', merchantScreen: screen };
  }

  // 3. Saved state on refresh or app relaunch (if user is authenticated)
  if (savedView && savedView !== 'landing') {
    if (savedView === 'admin') {
      if (isOfficerAuthenticated()) {
        return { view: 'admin', merchantScreen: 'dashboard' };
      }
    } else if (savedView === 'receipt-issuance' || (savedView as string) === 'pos') {
      if (isMerchantAuthenticated()) {
        return { view: 'receipt-issuance', merchantScreen: 'dashboard' };
      }
    } else if (savedView === 'merchant') {
      if (isMerchantAuthenticated()) {
        return { view: 'merchant', merchantScreen: savedScreen };
      }
    } else {
      return { view: savedView, merchantScreen: savedScreen };
    }
  }

  // 4. Stay logged in on app restart / browser refresh when user is authenticated
  if (isMerchantAuthenticated()) {
    const defaultScreen =
      savedScreen && savedScreen !== 'signin' && savedScreen !== 'landing'
        ? savedScreen
        : 'dashboard';
    if (savedView === 'receipt-issuance') {
      return { view: 'receipt-issuance', merchantScreen: 'dashboard' };
    }
    return { view: 'merchant', merchantScreen: defaultScreen };
  }

  if (isOfficerAuthenticated() && (savedView === 'admin' || pathname.includes('admin'))) {
    return { view: 'admin', merchantScreen: 'dashboard' };
  }

  // 5. Default: Start from the Landing Page
  return { view: 'landing', merchantScreen: 'dashboard' };
}

function App() {
  const initialState = parseUrlState();
  const [currentView, setCurrentView] = useState<AppView>(initialState.view);
  const [merchantScreen, setMerchantScreen] = useState<string>(initialState.merchantScreen);

  // Sync state with browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const state = parseUrlState();
      setCurrentView(state.view);
      setMerchantScreen(state.merchantScreen);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Auto-redirect to sign-in when session expires (401 response from any API call)
  useEffect(() => {
    const handleSessionExpired = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      console.info('[Auth] Session expired:', detail?.message);
      try {
        window.sessionStorage.removeItem(SESSION_VIEW_KEY);
        window.sessionStorage.removeItem(SESSION_SCREEN_KEY);
        window.localStorage.removeItem(SESSION_VIEW_KEY);
        window.localStorage.removeItem(SESSION_SCREEN_KEY);
        window.localStorage.removeItem('ereceipt_token');
        window.localStorage.removeItem('merchant_token');
        window.localStorage.removeItem('merchant_user');
        window.localStorage.removeItem('ereceipt_merchant');
      } catch {}
      setCurrentView('signin');
      setMerchantScreen('dashboard');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  const handleNavigate = (screen: string, pushHistory = true) => {
    let targetView: AppView = 'landing';
    let targetMerchantScreen = 'dashboard';
    let urlQuery = '';

    if (screen === 'landing' || screen === 'home') {
      targetView = 'landing';
      urlQuery = '?view=landing';
    } else if (screen === 'registration' || screen === 'register') {
      targetView = 'registration';
      urlQuery = '?view=registration';
    } else if (screen === 'signout' || screen === 'logout') {
      clearStoredMerchantProfile();
      try {
        window.localStorage.removeItem('ereceipt_token');
        window.localStorage.removeItem('merchant_token');
        window.localStorage.removeItem('merchant_user');
        window.localStorage.removeItem('ereceipt_merchant');
        window.localStorage.removeItem(SESSION_VIEW_KEY);
        window.localStorage.removeItem(SESSION_SCREEN_KEY);
        window.sessionStorage.removeItem(SESSION_VIEW_KEY);
        window.sessionStorage.removeItem(SESSION_SCREEN_KEY);
      } catch {}
      targetView = 'landing';
      urlQuery = '?view=landing';
    } else if (screen === 'login' || screen === 'signin') {
      targetView = 'signin';
      urlQuery = '?view=signin';
    } else if (screen === 'admin') {
      targetView = 'admin';
      urlQuery = '?view=admin';
    } else if (screen === 'verify' || screen === 'verification') {
      targetView = 'verify';
      urlQuery = '?view=verify';
    } else if (screen === 'receipt-image' || screen === 'image') {
      targetView = 'receipt-image';
      urlQuery = '?view=receipt-image';
    } else if (screen === 'pos' || screen === 'receipt-issuance') {
      if (!isMerchantAuthenticated()) {
        targetView = 'signin';
        urlQuery = '?view=signin';
      } else {
        targetView = 'receipt-issuance';
        urlQuery = '?view=pos';
      }
    } else if (
      screen === 'merchant' ||
      screen === 'audit' ||
      screen === 'receipt' ||
      screen === 'settings' ||
      screen === 'sales' ||
      screen === 'dashboard'
    ) {
      if (!isMerchantAuthenticated()) {
        targetView = 'signin';
        urlQuery = '?view=signin';
      } else {
        targetView = 'merchant';
        targetMerchantScreen = screen === 'merchant' ? 'dashboard' : screen;
        urlQuery = `?view=merchant&screen=${targetMerchantScreen}`;
      }
    }

    // Persist active view and screen so refresh and closing/reopening the app stays right where user is
    try {
      window.localStorage.setItem(SESSION_VIEW_KEY, targetView);
      window.localStorage.setItem(SESSION_SCREEN_KEY, targetMerchantScreen);
      window.sessionStorage.setItem(SESSION_VIEW_KEY, targetView);
      window.sessionStorage.setItem(SESSION_SCREEN_KEY, targetMerchantScreen);
    } catch {}

    setCurrentView(targetView);
    setMerchantScreen(targetMerchantScreen);

    if (pushHistory) {
      const newUrl = `${window.location.pathname}${urlQuery}`;
      window.history.pushState({ view: targetView, screen: targetMerchantScreen }, '', newUrl);
    }
  };

  return (
    <div className="app-container">
      <ErrorBoundary>
        {currentView === 'receipt-image' ? (
          <ReceiptImageView onBack={() => handleNavigate('landing')} />
        ) : currentView === 'landing' ? (
          <LandingPage
            onNavigate={handleNavigate}
            onSignInClick={() => handleNavigate('signin')}
            onGetStartedClick={() => handleNavigate('registration')}
            onScanReceiptClick={() => handleNavigate('verify')}
            onMerchantPortalClick={() => {
              if (isMerchantAuthenticated()) {
                handleNavigate('dashboard');
              } else {
                handleNavigate('signin');
              }
            }}
          />
        ) : currentView === 'verify' ? (
          <ReceiptVerification onNavigate={handleNavigate} />
        ) : currentView === 'signin' || currentView === 'login' ? (
          <LoginForm
            onSuccess={() => handleNavigate('dashboard')}
            onLoginSuccess={(_merchant) => handleNavigate('dashboard')}
            onRegisterClick={() => handleNavigate('registration')}
            onNavigateToRegister={() => handleNavigate('registration')}
            onHomeClick={() => handleNavigate('landing')}
            onNavigateToHome={() => handleNavigate('landing')}
            onNavigateHome={() => handleNavigate('landing')}
          />
        ) : currentView === 'receipt-issuance' ? (
          isMerchantAuthenticated() ? (
            <ReceiptIssuance onNavigate={handleNavigate} />
          ) : (
            <LoginForm
              onSuccess={() => handleNavigate('dashboard')}
              onLoginSuccess={(_merchant) => handleNavigate('dashboard')}
              onRegisterClick={() => handleNavigate('registration')}
              onNavigateToRegister={() => handleNavigate('registration')}
              onHomeClick={() => handleNavigate('landing')}
              onNavigateToHome={() => handleNavigate('landing')}
              onNavigateHome={() => handleNavigate('landing')}
            />
          )
        ) : currentView === 'registration' ? (
          <MerchantRegistration
            onSignInClick={() => handleNavigate('signin')}
            onHomeClick={() => handleNavigate('landing')}
          />
        ) : currentView === 'admin' ? (
          <Admin onReturnToMerchant={(screen) => handleNavigate(screen || 'dashboard')} />
        ) : isMerchantAuthenticated() ? (
          <Audit initialScreen={merchantScreen} onNavigate={handleNavigate} />
        ) : (
          <LoginForm
            onSuccess={() => handleNavigate('dashboard')}
            onLoginSuccess={(_merchant) => handleNavigate('dashboard')}
            onRegisterClick={() => handleNavigate('registration')}
            onNavigateToRegister={() => handleNavigate('registration')}
            onHomeClick={() => handleNavigate('landing')}
            onNavigateToHome={() => handleNavigate('landing')}
            onNavigateHome={() => handleNavigate('landing')}
          />
        )}
      </ErrorBoundary>
    </div>
  );
}

export default App;
