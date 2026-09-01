import React, { createContext, useContext, useCallback } from 'react';

// ─── Translations ─────────────────────────────────────────────────────────────

const translations = {
  en: {
    // Language selection
    lang_select_title: 'Choose Language',
    lang_select_subtitle: 'Select your preferred language to continue',
    lang_continue: 'Continue',
    lang_change: 'Change Language',
    lang_en: 'English',

    // Tabs
    tab_home: 'Home',
    tab_matches: 'Matches',
    tab_predictions: 'Predictions',
    tab_wallet: 'Wallet',
    tab_notifications: 'Notifications',
    tab_support: 'Support',
    tab_profile: 'Profile',

    // Login
    login_enter_mobile: 'Enter Mobile Number',
    login_otp_will_be_sent: 'OTP will be sent to your number',
    login_enter_otp: 'Enter OTP',
    login_otp_sent_to: 'Enter OTP sent to %s (Test: 1234)',
    login_mobile_placeholder: '10-digit mobile number',
    login_send_otp: 'Send OTP',
    login_verify_login: 'Login',
    login_change_number: 'Change Number',
    login_empty_number_title: 'Empty Number',
    login_empty_number_msg: 'Enter your mobile number',
    login_empty_otp_title: 'OTP Empty',
    login_empty_otp_msg: 'Enter OTP',
    login_wrong_otp_title: 'Wrong OTP',
    login_wrong_otp_msg: 'Enter correct OTP (1234)',
    login_send_failed: 'Failed to send OTP, please try again',

    // Home
    home_greeting: 'Hello %s 🏏',
    home_subtitle: 'Who will win today?',
    home_live: 'Live',
    home_upcoming: 'Upcoming',
    home_completed: 'Completed',
    home_live_badge: '● Live',
    home_no_matches: 'No matches found',
    home_live_predict: 'Live Match • Predict',
    home_markets_soon: 'Prediction markets coming soon',

    // Match detail
    match_yes: 'Yes',
    match_no: 'No',
    match_bets: 'bets',
    match_live: 'LIVE',
    score_loading: 'Loading live score…',
    score_unavailable: 'Live score unavailable',
    score_updated: 'Updated %s',
    match_no_markets: 'No markets available right now',
    match_answer_yes: 'Answer: Yes ✓',
    match_answer_no: 'Answer: No ✓',
    match_predict_title: 'Place Prediction',
    match_enter_amount: 'Enter amount (min ₹100)',
    match_min_amount_title: 'Minimum Amount',
    match_min_amount_msg: 'Place at least ₹100 bet',
    match_insufficient_title: 'Insufficient Balance',
    match_insufficient_msg: 'Not enough balance',
    match_success: 'Prediction placed!',
    match_error_title: 'Error',
    match_error_msg: 'Could not place prediction',
    match_stake: 'Stake',
    match_estimated_return: 'Estimated Return',
    match_platform_fee: 'Platform Fee (7.5%)',
    match_net_profit: 'Net Profit',
    match_wallet_balance: 'Wallet Balance: ₹%s',
    match_confirm: 'Confirm',
    match_not_found: 'Match not found',
    match_open: 'Open',
    match_paused: 'Paused',
    match_closed: 'Closed',
    match_settled: 'Settled',
    match_refunded: 'Refunded',
    match_cat_toss: '🪙 Toss',
    match_cat_innings: '🏏 Innings',
    match_cat_over: '⚡ Over',
    match_cat_batsman: '🏏 Batsman',
    match_cat_bowler: '🎯 Bowler',
    match_cat_winner: '🏆 Winner',

    // Predictions
    pred_title: 'My Predictions',
    pred_all: 'All',
    pred_pending: 'Pending',
    pred_won: 'Won',
    pred_lost: 'Lost',
    pred_refunded: 'Refunded',
    pred_yes: 'YES',
    pred_no: 'NO',
    pred_empty: 'No predictions yet',
    pred_empty_sub: 'Go to a match and place your prediction',

    // Wallet
    wallet_title: 'Wallet',
    wallet_balance_label: 'Available Balance',
    wallet_deposit_btn: 'Deposit',
    wallet_withdraw_btn: 'Withdraw',
    wallet_stat_deposit: 'Total Deposit',
    wallet_stat_withdraw: 'Total Withdrawal',
    wallet_stat_win: 'Winnings',
    wallet_tab_tx: 'Transactions',
    wallet_tab_deposits: 'Deposits',
    wallet_tab_withdrawals: 'Withdrawals',
    wallet_empty_tx: 'No transactions',
    wallet_empty_deposits: 'No deposits yet',
    wallet_empty_withdrawals: 'No withdrawals yet',
    wallet_tx_deposit: 'Deposit',
    wallet_tx_withdraw: 'Withdrawal',
    wallet_tx_win: 'Win',
    wallet_tx_loss: 'Bet',
    wallet_tx_bonus: 'Bonus',
    wallet_tx_refund: 'Refund',
    wallet_tx_bet_placed: 'Prediction Stake',
    wallet_status_pending: 'Pending',
    wallet_status_approved: 'Approved',
    wallet_status_rejected: 'Rejected',
    wallet_upi_label: 'UPI Option %s',
    wallet_copy_id: 'Copy ID',
    wallet_copied: 'Copied!',
    wallet_pay_now: 'Pay Now',
    wallet_utr_tab: 'Payment Proof',
    wallet_bank_tab: 'Bank Transfer',
    wallet_min_deposit_title: 'Minimum Deposit',
    wallet_min_deposit_msg: 'Enter at least ₹200',
    wallet_utr_required_title: 'Payment Reference Required',
    wallet_utr_required_msg: 'Enter your payment reference number',
    wallet_utr_label: 'Payment Reference Number (UTR)',
    wallet_utr_placeholder: 'Enter 12-digit payment reference number',
    wallet_screenshot_label: 'Payment Screenshot *',
    wallet_screenshot_required_title: 'Payment Screenshot Required',
    wallet_screenshot_required_msg: 'Upload your payment screenshot before submitting.',
    wallet_tap_upload: 'Tap to attach screenshot',
    wallet_file_types: 'PNG, JPG up to 5MB',
    wallet_submit_deposit: 'Submit Deposit Request',
    wallet_deposit_success_title: 'Deposit Request Sent',
    wallet_deposit_success_msg: 'Your request is under review. Update within 30 minutes.',
    wallet_no_upi_app_title: 'No UPI App Found',
    wallet_no_upi_app_msg: 'No UPI app installed. Copy the UPI ID and paste in your app.',
    wallet_after_payment_title: 'After Payment',
    wallet_after_payment_msg: 'After payment, open Payment Proof and upload your payment screenshot and payment reference number.',
    wallet_ok: 'OK',
    wallet_withdraw_title: 'Withdrawal Request',
    wallet_min_withdraw_title: 'Minimum Withdrawal',
    wallet_min_withdraw_msg: 'Withdraw at least ₹500',
    wallet_upi_required_title: 'UPI ID Required',
    wallet_upi_required_msg: 'Enter your UPI ID',
    wallet_bank_name_required: 'Bank Name Required',
    wallet_bank_name_msg: 'Enter bank name',
    wallet_holder_required: 'Account Holder Required',
    wallet_holder_msg: 'Enter account holder name',
    wallet_account_required: 'Account Number Required',
    wallet_account_msg: 'Enter bank account number',
    wallet_account_mismatch: "Account Numbers Don't Match",
    wallet_account_mismatch_msg: 'Both account numbers must match',
    wallet_ifsc_invalid: 'Invalid IFSC Code',
    wallet_ifsc_msg: 'Enter correct IFSC code (11 characters)',
    wallet_withdraw_success_title: 'Withdrawal Request Sent ✓',
    wallet_withdraw_upi_msg: 'Your withdrawal is under review. On approval, amount will be sent to your UPI.',
    wallet_withdraw_bank_msg: 'Your withdrawal is under review. On approval, amount will be sent to your bank account.',
    wallet_error_title: 'Error',
    wallet_amount_label: 'Amount (₹)',
    wallet_via_upi: 'Via UPI',
    wallet_via_bank: 'Via Bank',
    wallet_your_upi_id: 'Your UPI ID',
    wallet_upi_placeholder: 'yourname@upi',
    wallet_bank_name: 'Bank Name',
    wallet_holder_name: 'Account Holder Name',
    wallet_account_number: 'Account Number',
    wallet_confirm_account: 'Confirm Account Number',
    wallet_ifsc: 'IFSC Code',
    wallet_submit_withdraw: 'Submit Withdrawal',
    wallet_permission_title: 'Permission Required',
    wallet_permission_msg: 'Allow gallery access',

    // Dragon Tiger
    game_insufficient_title: 'Insufficient Balance',
    game_insufficient_message: 'You do not have enough balance to place this bet.',
    game_available_balance: 'Available balance',
    game_selected_bet: 'Selected bet',
    game_add_balance: 'Add Balance',
    game_not_now: 'Not now',

    // Notifications
    notif_title: 'Notifications',
    notif_unread: '%s unread',
    notif_mark_all: 'Mark all read',
    notif_empty_title: 'No notifications',
    notif_empty_sub: 'Your deposit, withdrawal and prediction notifications will appear here',
    notif_just_now: 'Just now',
    notif_min_ago: '%sm ago',
    notif_hour_ago: '%sh ago',

    // Support
    support_title: 'Support',
    support_subtitle: "We're here to help",
    support_help_center: 'Help Center',
    support_my_tickets: 'My Tickets',
    support_new_ticket: 'New Ticket',
    support_chat_now: 'Chat Now',
    support_contact_info: 'Contact Information',
    support_categories: 'Support Categories',
    support_faq: 'Frequently Asked Questions',
    support_ask_questions: 'Ask Questions',
    support_raise_ticket: 'Raise Ticket',
    support_no_tickets: 'No tickets yet',
    support_create_first: 'Create Your First Ticket',
    support_create_ticket: 'Create Support Ticket',
    support_category: 'Category *',
    support_description: 'Description *',
    support_desc_ph: 'Describe your issue in detail. Include relevant IDs, amounts, dates.',
    support_screenshot: 'Screenshot (optional)',
    support_tap_attach: 'Tap to attach screenshot',
    support_file_size: 'PNG, JPG up to 5MB',
    support_submit: 'Submit Ticket',
    support_required: 'Required',
    support_enter_desc: 'Please describe your issue.',
    support_ticket_ok_title: 'Ticket Submitted ✓',
    support_ticket_ok_msg: 'Your ticket has been created. Our team will respond within 30 minutes.',
    support_view_tickets: 'View Tickets',
    support_cat_deposit: 'Deposit Issue',
    support_cat_withdraw: 'Withdrawal Issue',
    support_cat_prediction: 'Prediction Issue',
    support_cat_account: 'Account Issue',
    support_cat_technical: 'Technical Problem',
    support_cat_other: 'Other',
    support_status_open: 'Open',
    support_status_in_progress: 'In Progress',
    support_status_resolved: 'Resolved',
    support_status_closed: 'Closed',
    support_faq_q1: 'How to Deposit?',
    support_faq_a1: 'Go to Wallet → Deposit. Enter the amount, select UPI/Bank, copy the UPI ID, send payment, and enter your UTR number to confirm. Deposits are credited within 30 minutes after admin approval.',
    support_faq_q2: 'How to Withdraw?',
    support_faq_a2: 'Go to Wallet → Withdraw. Enter the amount and your UPI ID. Withdrawals are processed within 30 minutes after admin approval. Minimum withdrawal is ₹100.',
    support_faq_q3: 'How do Predictions Work?',
    support_faq_a3: 'Open any live or upcoming match, choose a market (e.g. Match Winner), pick your option, and confirm. If correct, winnings are credited to your wallet instantly after the match result.',
    support_faq_q4: 'Wallet Rules',
    support_faq_a4: 'Your wallet balance can be used to place predictions. Deposits require admin approval. Withdrawals are processed to your registered UPI ID only. Bonus credits cannot be withdrawn directly.',
    support_faq_q6: 'Refund Policy',
    support_faq_a6: 'If a match is cancelled or abandoned, all bets are refunded automatically. For disputed transactions, raise a support ticket with your UTR number. Refunds take 3–5 business days.',
    support_hours: 'Mon–Sat, 9 AM – 9 PM IST',
    support_agent: 'Support Agent',

    // Profile
    profile_balance: 'Balance',
    profile_role: 'Role',
    profile_status: 'Status',
    profile_my_predictions: 'My Predictions',
    profile_wallet: 'Wallet',
    profile_support: 'Support',
    profile_about: 'About Jazment',
    profile_logout: 'Logout',
    profile_logout_title: 'Logout',
    profile_logout_msg: 'Are you sure you want to logout?',
    profile_cancel: 'Cancel',
    profile_about_msg: 'Cricket Prediction Platform v1.0',
    profile_change_language: 'Change Language',
    profile_kyc_pending: 'Pending',
    profile_kyc_verified: 'Verified',
    profile_kyc_rejected: 'Rejected',
    profile_role_admin: 'Admin',
    profile_role_user: 'User',
    profile_status_active: 'Active',
    profile_status_suspended: 'Suspended',
  },

} as const;

export type Lang = 'en';
type TranslationKeys = keyof typeof translations.en;

// ─── Context ──────────────────────────────────────────────────────────────────

interface LanguageContextValue {
  lang: Lang;
  t: (key: TranslationKeys, ...args: (string | number)[]) => string;
  isReady: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const t = useCallback(
    (key: TranslationKeys, ...args: (string | number)[]): string => {
      const raw = (translations.en as any)[key] ?? key;
      if (!args.length) return raw as string;
      // Replace %s tokens left-to-right
      return (raw as string).replace(/%s/g, () => String(args.shift() ?? ''));
    },
    []
  );

  return (
    <LanguageContext.Provider value={{ lang: 'en', t, isReady: true }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be inside LanguageProvider');
  return ctx;
}
