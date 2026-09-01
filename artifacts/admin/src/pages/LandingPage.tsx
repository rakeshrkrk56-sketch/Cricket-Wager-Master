import { useMemo, useState } from 'react';
import { useGetSettings } from '@workspace/api-client-react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clipboard,
  Copy,
  Download,
  ExternalLink,
  Gamepad2,
  IndianRupee,
  Languages,
  LockKeyhole,
  Play,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  WalletCards,
  Zap,
} from 'lucide-react';

type PaymentAccount = {
  id: string;
  name: string;
};

const quickAmounts = [200, 500, 1000, 2500];

function formatAmount(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(amount);
}

function makeUpiLink(account: PaymentAccount, amount: number) {
  const params = new URLSearchParams({
    pa: account.id,
    pn: account.name,
    am: amount.toFixed(2),
    cu: 'INR',
  });
  return `upi://pay?${params.toString()}`;
}

function BrandMark() {
  return (
    <span className="jazment-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

export function LandingPage() {
  const { data: settings, isLoading, isError, refetch } = useGetSettings();
  const [amount, setAmount] = useState('500');
  const [selectedAccount, setSelectedAccount] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [amountError, setAmountError] = useState('');
  const [showAllAccounts, setShowAllAccounts] = useState(false);

  const accounts = useMemo<PaymentAccount[]>(() => {
    if (!settings) return [];
    return [
      { id: settings.platformUpiId, name: settings.platformUpiName || settings.platformName || 'Jazment Payments' },
      settings.platformUpiId2
        ? { id: settings.platformUpiId2, name: settings.platformUpiName2 || settings.platformName || 'Jazment Payments' }
        : null,
      settings.platformUpiId3
        ? { id: settings.platformUpiId3, name: settings.platformUpiName3 || settings.platformName || 'Jazment Payments' }
        : null,
    ].filter((account): account is PaymentAccount => Boolean(account?.id));
  }, [settings]);

  const numericAmount = Number(amount);
  const currentAccount = accounts[selectedAccount] || accounts[0];
  const canPay = Boolean(currentAccount && numericAmount >= 200);

  const chooseAmount = (value: number) => {
    setAmount(String(value));
    setAmountError('');
  };

  const validateAmount = () => {
    if (!amount || Number.isNaN(numericAmount) || numericAmount < 200) {
      setAmountError('Enter an amount of ₹200 or more to continue.');
      return false;
    }
    setAmountError('');
    return true;
  };

  const startPayment = () => {
    if (!validateAmount() || !currentAccount) return;
    window.location.href = makeUpiLink(currentAccount, numericAmount);
  };

  const copyUpiId = async (account: PaymentAccount) => {
    try {
      await navigator.clipboard.writeText(account.id);
      setCopiedId(account.id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setCopiedId(null);
    }
  };

  const visibleAccounts = showAllAccounts ? accounts : accounts.slice(0, 1);
  const platformName = settings?.platformName || 'Jazment';

  return (
    <main className="jazment-site">
      <div className="jazment-grid" aria-hidden="true" />
      <header className="jazment-header">
        <a className="jazment-logo" href="#top" data-testid="link-home">
          <BrandMark />
          <span>jazment</span>
        </a>
        <nav className="jazment-nav" aria-label="Main navigation">
          <a href="#how-it-works" data-testid="link-how-it-works">How it works</a>
          <a href="#add-balance" data-testid="link-add-balance">Add balance</a>
          <a href="#faq" data-testid="link-faq">FAQ</a>
        </nav>
        <a className="jazment-header-download" href="/downloads/jazment.apk" data-testid="link-download-header">
          <Download size={16} strokeWidth={2.4} />
          <span>Get the app</span>
        </a>
      </header>

      <section className="jazment-hero" id="top">
        <div className="jazment-hero-copy jazment-reveal">
          <div className="jazment-live-pill" data-testid="status-live-room">
            <span className="jazment-live-dot" />
            <span>Live game room</span>
            <span className="jazment-live-divider" />
            <span>अब खेलें</span>
          </div>
          <h1>
            Pick a side.
            <br />
            <em>Feel the room.</em>
          </h1>
          <p className="jazment-hero-text">
            Dragon Tiger for your Android phone — quick rounds, clear play, and a balance you can add through UPI.
            <strong> Hindi or English. You are in control.</strong>
          </p>
          <div className="jazment-hero-actions">
            <a className="jazment-primary-button" href="/downloads/jazment.apk" data-testid="link-download-hero">
              <Download size={19} />
              Download for Android
              <ArrowRight size={18} />
            </a>
            <a className="jazment-text-link" href="#how-it-works" data-testid="link-see-how-it-works">
              See how it works <ChevronDown size={16} />
            </a>
          </div>
          <div className="jazment-trust-row" data-testid="text-hero-trust">
            <span><ShieldCheck size={16} /> UPI enabled</span>
            <span><LockKeyhole size={15} /> Secure access</span>
            <span><Smartphone size={15} /> Android ready</span>
          </div>
        </div>

        <div className="jazment-room-art jazment-reveal jazment-reveal-delay" aria-label="Dragon Tiger game room preview">
          <div className="jazment-orbit orbit-one" />
          <div className="jazment-orbit orbit-two" />
          <div className="jazment-room-label"><span /> TABLE 07 <span>/</span> LIVE</div>
          <div className="jazment-card card-dragon">
            <span className="card-suit">D</span>
            <strong>Q</strong>
            <small>DRAGON</small>
          </div>
          <div className="jazment-vs">VS</div>
          <div className="jazment-card card-tiger">
            <span className="card-suit red-suit">T</span>
            <strong>7</strong>
            <small>TIGER</small>
          </div>
          <div className="jazment-room-status"><span className="jazment-live-dot" /> Next round opening</div>
          <div className="jazment-art-caption">
            <span>DRAGON</span>
            <b>VS</b>
            <span>TIGER</span>
          </div>
        </div>
      </section>

      <div className="jazment-ticker" aria-label="Jazment highlights">
        <div><Sparkles size={15} /> Fast rounds</div>
        <div><Languages size={15} /> Hindi + English</div>
        <div><Zap size={15} /> Simple to start</div>
        <div><WalletCards size={15} /> UPI balance</div>
        <div><Sparkles size={15} /> Fast rounds</div>
        <div><Languages size={15} /> Hindi + English</div>
      </div>

      <section className="jazment-story-section" id="how-it-works">
        <div className="jazment-section-kicker">NO GUESSWORK</div>
        <div className="jazment-story-heading">
          <h2>One room.<br /><span>Three moves.</span></h2>
          <p>From download to your first round, Jazment keeps every step visible. No clutter. No confusing menus.</p>
        </div>
        <div className="jazment-steps">
          <article className="jazment-step-card step-active">
            <div className="jazment-step-number">01</div>
            <Smartphone size={27} />
            <h3>Download</h3>
            <p>Get the Android app and sign in with your phone number.</p>
            <span className="jazment-step-note">Takes less than a minute</span>
          </article>
          <article className="jazment-step-card">
            <div className="jazment-step-number">02</div>
            <WalletCards size={27} />
            <h3>Add balance</h3>
            <p>Choose an amount from ₹200 and pay directly with your UPI app.</p>
            <span className="jazment-step-note">PhonePe, GPay, Paytm and more</span>
          </article>
          <article className="jazment-step-card">
            <div className="jazment-step-number">03</div>
            <Gamepad2 size={27} />
            <h3>Enter the room</h3>
            <p>Pick Dragon, Tiger, or Tie. See the round. Play your way.</p>
            <span className="jazment-step-note">Hindi or English — you choose</span>
          </article>
        </div>
      </section>

      <section className="jazment-balance-section" id="add-balance">
        <div className="jazment-balance-intro">
          <div className="jazment-section-kicker">READY WHEN YOU ARE</div>
          <h2>Add balance.<br /><span>Then make your call.</span></h2>
          <p>Use any UPI app on your phone. We show the payment details clearly, so your money goes to the right place.</p>
          <div className="jazment-security-note"><ShieldCheck size={18} /><span>Payments go through your chosen UPI app. Jazment never asks for your UPI PIN.</span></div>
        </div>

        <div className="jazment-payment-panel">
          <div className="jazment-panel-topline"><span>ADD BALANCE</span><span>MINIMUM ₹200</span></div>
          <label className="jazment-amount-label" htmlFor="balance-amount">How much do you want to add?</label>
          <div className={`jazment-amount-input ${amountError ? 'has-error' : ''}`}>
            <IndianRupee size={22} />
            <input
              id="balance-amount"
              type="number"
              min="200"
              inputMode="numeric"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                if (amountError) setAmountError('');
              }}
              onBlur={validateAmount}
              aria-describedby={amountError ? 'amount-error' : undefined}
              data-testid="input-balance-amount"
            />
          </div>
          {amountError && <p className="jazment-form-error" id="amount-error" data-testid="status-amount-error">{amountError}</p>}
          <div className="jazment-quick-amounts" aria-label="Quick amounts">
            {quickAmounts.map((quickAmount) => (
              <button
                type="button"
                className={Number(amount) === quickAmount ? 'selected' : ''}
                onClick={() => chooseAmount(quickAmount)}
                key={quickAmount}
                data-testid={`button-quick-amount-${quickAmount}`}
              >
                ₹{formatAmount(quickAmount)}
              </button>
            ))}
          </div>

          <div className="jazment-upi-heading">
            <span>Choose a UPI ID</span>
            <span className="jazment-upi-count">{accounts.length ? `${accounts.length} available` : 'Loading details'}</span>
          </div>

          {isLoading && (
            <div className="jazment-upi-loading" data-testid="status-upi-loading">
              <span /><span /><span />
              <p>Loading payment details…</p>
            </div>
          )}
          {isError && (
            <div className="jazment-upi-unavailable" data-testid="status-upi-unavailable">
              <p>Payment details are temporarily unavailable.</p>
              <button type="button" onClick={() => refetch()} data-testid="button-retry-upi">
                <RefreshCw size={15} /> Try again
              </button>
            </div>
          )}
          {!isLoading && !isError && accounts.length === 0 && (
            <div className="jazment-upi-unavailable" data-testid="status-upi-empty">
              <p>UPI payment is being prepared. Please try again shortly.</p>
            </div>
          )}
          {!isLoading && !isError && accounts.length > 0 && (
            <>
              <div className="jazment-upi-list">
                {visibleAccounts.map((account, index) => (
                  <div
                    className={`jazment-upi-option ${selectedAccount === index ? 'selected' : ''}`}
                    key={account.id}
                    onClick={() => setSelectedAccount(index)}
                    role="group"
                    aria-label={`Select ${account.name}`}
                    data-testid={`card-upi-account-${index + 1}`}
                  >
                    <span className="jazment-upi-radio">{selectedAccount === index && <Check size={13} />}</span>
                    <span className="jazment-upi-account-copy">
                      <strong>{account.name}</strong>
                      <code data-testid={`text-upi-id-${index + 1}`}>{account.id}</code>
                    </span>
                    <button
                      type="button"
                      className="jazment-copy-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        copyUpiId(account);
                      }}
                      aria-label={`Copy UPI ID ${account.id}`}
                      data-testid={`button-copy-upi-${index + 1}`}
                    >
                      {copiedId === account.id ? <Check size={16} /> : <Copy size={16} />}
                      <span>{copiedId === account.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                ))}
              </div>
              {accounts.length > 1 && (
                <button
                  type="button"
                  className="jazment-show-more"
                  onClick={() => setShowAllAccounts((visible) => !visible)}
                  data-testid="button-toggle-upi-accounts"
                >
                  {showAllAccounts ? 'Show one UPI ID' : `See all ${accounts.length} UPI IDs`} <ChevronDown className={showAllAccounts ? 'rotated' : ''} size={15} />
                </button>
              )}
              <button
                type="button"
                className="jazment-pay-button"
                onClick={startPayment}
                disabled={!canPay}
                data-testid="button-pay-upi"
              >
                <IndianRupee size={18} />
                Pay ₹{formatAmount(Number.isNaN(numericAmount) ? 0 : numericAmount)} with UPI
                <ExternalLink size={16} />
              </button>
            </>
          )}

          <div className="jazment-payment-next-step">
            <div className="jazment-next-step-icon"><Clipboard size={17} /></div>
            <div>
              <strong>Important next step</strong>
              <p>After you pay, open Jazment and submit your payment proof in the app. Your balance is added after the proof is reviewed.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="jazment-language-section">
        <div className="jazment-language-visual">
          <div className="jazment-language-chip chip-one">नमस्ते</div>
          <div className="jazment-language-chip chip-two">PLAY</div>
          <div className="jazment-language-chip chip-three">चलो</div>
          <div className="jazment-language-center"><Languages size={30} /><span>YOUR<br />LANGUAGE</span></div>
        </div>
        <div>
          <div className="jazment-section-kicker">MADE FOR INDIA</div>
          <h2>Play how<br /><span>you speak.</span></h2>
          <p>Switch between Hindi and English whenever you like. Game names, instructions, wallet — everything stays easy to follow.</p>
          <div className="jazment-language-pills"><span>हिन्दी</span><span>English</span><span>Simple words</span></div>
        </div>
      </section>

      <section className="jazment-faq-section" id="faq">
        <div className="jazment-faq-heading">
          <div className="jazment-section-kicker">GOOD TO KNOW</div>
          <h2>Clear answers.<br /><span>Before you play.</span></h2>
        </div>
        <div className="jazment-faq-list">
          <details open data-testid="faq-payment">
            <summary>How do I add balance? <ChevronDown size={18} /></summary>
            <p>Choose an amount above, select a UPI ID, and tap “Pay with UPI”. Complete the payment in your UPI app, then open Jazment to submit your payment proof.</p>
          </details>
          <details data-testid="faq-minimum">
            <summary>What is the minimum amount? <ChevronDown size={18} /></summary>
            <p>The minimum balance addition is ₹200. You can also use one of the quick amount buttons to get started faster.</p>
          </details>
          <details data-testid="faq-proof">
            <summary>Why do I need to submit payment proof? <ChevronDown size={18} /></summary>
            <p>Payment proof helps the Jazment team match your UPI payment to your account and review your balance addition safely.</p>
          </details>
          <details data-testid="faq-app">
            <summary>Where can I play? <ChevronDown size={18} /></summary>
            <p>Jazment is built for Android phones. Download the APK, install it, and sign in to enter the live game room.</p>
          </details>
        </div>
      </section>

      <section className="jazment-final-cta">
        <div className="jazment-final-glow" aria-hidden="true" />
        <div className="jazment-section-kicker">THE TABLE IS OPEN</div>
        <h2>Your next round<br /><em>starts here.</em></h2>
        <p>Download Jazment for Android and enter a cleaner, faster Dragon Tiger room.</p>
        <a className="jazment-primary-button" href="/downloads/jazment.apk" data-testid="link-download-final">
          <Download size={19} /> Download Jazment APK <ArrowRight size={18} />
        </a>
      </section>

      <footer className="jazment-footer">
        <a className="jazment-logo" href="#top" data-testid="link-footer-home"><BrandMark /><span>jazment</span></a>
        <p>{platformName} · Dragon Tiger for Android</p>
        <div><a href="#faq" data-testid="link-footer-faq">Questions</a><a href="#add-balance" data-testid="link-footer-balance">Add balance</a><a href="/downloads/jazment.apk" data-testid="link-footer-download">Download APK</a></div>
      </footer>
    </main>
  );
}