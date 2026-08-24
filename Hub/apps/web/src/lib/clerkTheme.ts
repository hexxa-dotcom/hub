/**
 * Configuração de tema personalizada para o Clerk integrada ao design Dark Obsidian da Landing Page Hexxa.
 * Cores: Deep Forest Obsidian (#18150D / #121008), Lime Accent (#DFFFAE), Cream (#FEFDF3), White/10 borders.
 */
export const hexxaClerkAppearance = {
  layout: {
    socialButtonsVariant: 'blockButton' as const,
    logoPlacement: 'none' as const,
  },
  variables: {
    colorPrimary: '#DFFFAE',
    colorText: '#FEFDF3',
    colorTextSecondary: '#A8A49C',
    colorBackground: '#18150D',
    colorInputBackground: 'rgba(255, 255, 255, 0.05)',
    colorInputText: '#FEFDF3',
    colorDanger: '#FF5F56',
    colorSuccess: '#DFFFAE',
    borderRadius: '1.25rem',
    fontFamily: 'var(--font-sans), Inter, system-ui, -apple-system, sans-serif',
  },
  elements: {
    rootBox: 'w-full max-w-[420px] mx-auto',
    cardBox: 'w-full shadow-none',
    card: 'shadow-2xl border border-white/10 bg-[#18150D]/95 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 w-full text-[#FEFDF3]',
    headerTitle: 'hidden',
    headerSubtitle: 'hidden',
    formButtonPrimary:
      'w-full rounded-full bg-[#DFFFAE] hover:bg-white text-[#1E3328] font-bold text-sm py-3.5 px-6 shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]',
    formFieldInput:
      'w-full rounded-2xl border border-white/12 bg-white/5 hover:bg-white/8 text-[#FEFDF3] placeholder:text-white/30 px-4 py-3 text-sm focus:border-[#DFFFAE] focus:ring-2 focus:ring-[#DFFFAE]/30 outline-none transition-all',
    formFieldLabel: 'text-xs font-bold uppercase tracking-wider text-white/70 mb-1.5 block',
    dividerLine: 'bg-white/10',
    dividerText: 'text-xs uppercase font-bold text-white/40',
    socialButtonsBlockButton:
      'w-full rounded-2xl border border-white/12 bg-white/5 hover:bg-white/10 text-[#FEFDF3] text-sm font-bold py-3 transition-colors',
    socialButtonsBlockButtonText: 'text-[#FEFDF3] font-semibold text-sm',
    socialButtonsBlockButtonProviderIcon: 'mr-2',
    footerActionLink: 'text-[#DFFFAE] font-bold hover:underline',
    footerActionText: 'text-white/60 text-xs',
    footer: 'text-xs text-white/40 mt-4',
    identityPreviewText: 'text-[#FEFDF3] font-semibold',
    identityPreviewEditButton: 'text-[#DFFFAE] hover:underline font-bold',
    formFieldSuccessText: 'text-[#DFFFAE] text-xs',
    formFieldErrorText: 'text-[#FF5F56] text-xs mt-1',
    alert: 'bg-[#2A1715] border border-[#FF5F56]/30 text-[#FEFDF3] rounded-2xl p-4 text-xs',
    alertText: 'text-[#FEFDF3]',
  },
};


