/**
 * Configuração de tema personalizada para o Clerk com a identidade visual Hexxa.
 * Cores: Deep Forest Green (#1E3328), Lime (#DFFFAE), Warm Beige (#F4EFE4), Cream (#FEFDF3), Ink (#231F20).
 */
export const hexxaClerkAppearance = {
  layout: {
    socialButtonsVariant: 'blockButton' as const,
    logoPlacement: 'none' as const,
  },
  variables: {
    colorPrimary: '#1E3328',
    colorText: '#231F20',
    colorTextSecondary: '#6E6A61',
    colorBackground: '#F4EFE4',
    colorInputBackground: '#FEFDF3',
    colorInputText: '#231F20',
    colorDanger: '#DC2626',
    colorSuccess: '#2F4A3C',
    borderRadius: '1.25rem',
    fontFamily: 'var(--font-sans), system-ui, -apple-system, sans-serif',
  },
  elements: {
    rootBox: 'w-full max-w-md mx-auto',
    cardBox: 'w-full shadow-none',
    card: 'shadow-xl border border-black/10 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] rounded-3xl p-6 sm:p-7 w-full',
    headerTitle: 'hidden',
    headerSubtitle: 'hidden',
    formButtonPrimary:
      'w-full rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] text-[#DFFFAE] font-bold text-sm py-3.5 px-6 shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]',
    formFieldInput:
      'w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] text-[#231F20] dark:text-[#FEFDF3] px-4 py-3 text-sm focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE] outline-none transition-all',
    formFieldLabel: 'text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C] mb-1.5 block',
    dividerLine: 'bg-black/10 dark:bg-white/10',
    dividerText: 'text-xs uppercase font-bold text-[#6E6A61] dark:text-[#A8A49C]',
    socialButtonsBlockButton:
      'w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] hover:bg-black/5 dark:hover:bg-white/5 text-[#231F20] dark:text-[#FEFDF3] text-sm font-bold py-3 transition-colors',
    footerActionLink: 'text-[#1E3328] dark:text-[#DFFFAE] font-bold hover:underline',
    footer: 'text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-4',
  },
};

