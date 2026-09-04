import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink, IndianRupee, ShieldCheck } from "lucide-react";
import { useGetSettings } from "@workspace/api-client-react";

export function DepositLandingPage() {
  const { data: settings, isLoading } = useGetSettings();
  const initialAmount = new URLSearchParams(window.location.search).get("amount") || "500";
  const [amount, setAmount] = useState(initialAmount);
  const [selected, setSelected] = useState(0);
  const [copied, setCopied] = useState(false);
  const accounts = useMemo(() => [
    { id: settings?.platformUpiId, name: settings?.platformUpiName },
    { id: settings?.platformUpiId2, name: settings?.platformUpiName2 },
    { id: settings?.platformUpiId3, name: settings?.platformUpiName3 },
  ].filter((account): account is { id: string; name: string | undefined } => Boolean(account.id)), [settings]);
  const account = accounts[selected] || accounts[0];
  const numericAmount = Number(amount);
  const canPay = Boolean(account && numericAmount >= 200);

  const pay = () => {
    if (!account || !canPay) return;
    const params = new URLSearchParams({ pa: account.id, pn: account.name || "Jazment", am: numericAmount.toFixed(2), cu: "INR" });
    window.location.href = `upi://pay?${params.toString()}`;
  };

  const copy = async () => {
    if (!account) return;
    await navigator.clipboard.writeText(account.id);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="deposit-page">
      <section className="deposit-card">
        <a href="/" className="deposit-brand" data-testid="link-deposit-home">jazment</a>
        <span className="deposit-kicker">SECURE UPI PAYMENT</span>
        <h1>Add balance without leaving payment details behind.</h1>
        <p className="deposit-lead">Choose the amount, open your UPI app, then return to Jazment and upload the payment screenshot.</p>
        <label htmlFor="deposit-amount">Amount</label>
        <div className="deposit-amount">
          <IndianRupee size={22} />
          <input id="deposit-amount" type="number" min="200" value={amount} onChange={(event) => setAmount(event.target.value)} data-testid="input-deposit-amount" />
        </div>
        {Number(amount) < 200 && <p className="deposit-error" data-testid="status-minimum-amount">Minimum deposit is ₹200.</p>}
        <div className="deposit-accounts">
          {isLoading ? <p>Loading payment account…</p> : accounts.map((item, index) => (
            <button type="button" className={selected === index ? "selected" : ""} onClick={() => setSelected(index)} key={item.id} data-testid={`button-upi-account-${index}`}>
              <span>{selected === index && <Check size={14} />}</span>
              <div><strong>{item.name || "Jazment Cricket"}</strong><code>{item.id}</code></div>
            </button>
          ))}
        </div>
        {account && <button type="button" className="deposit-copy" onClick={copy} data-testid="button-copy-upi"><Copy size={17} /> {copied ? "UPI ID copied" : "Copy UPI ID"}</button>}
        <button type="button" className="deposit-pay" onClick={pay} disabled={!canPay} data-testid="button-open-upi"><ExternalLink size={18} /> Pay ₹{Number.isFinite(numericAmount) ? numericAmount : 0} with UPI</button>
        <div className="deposit-safe"><ShieldCheck size={18} /><p>Jazment never asks for your UPI PIN. If no app opens, copy the UPI ID and pay manually.</p></div>
      </section>
    </main>
  );
}