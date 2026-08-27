import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as Button } from './Button.vue'

export const buttonVariants = cva(
  'group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[0.35rem] border text-sm font-semibold tracking-[-0.01em] outline-none transition-[background-color,border-color,color,transform] duration-150 focus-visible:ring-2 focus-visible:ring-release-focus focus-visible:ring-offset-2 focus-visible:ring-offset-release-ink active:not-aria-[haspopup]:translate-y-px aria-invalid:border-release-destructive aria-invalid:ring-2 aria-invalid:ring-release-destructive/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 [&_svg:not([class*=size-])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-release-paper bg-release-paper text-release-ink hover:border-white hover:bg-white active:bg-release-paper-muted',
        outline: 'border-release-seam bg-release-rail text-release-paper hover:border-release-paper-muted hover:bg-[#1a1c16] aria-expanded:border-release-paper-muted aria-expanded:bg-[#1a1c16]',
        secondary: 'border-release-seam bg-[#1a1c16] text-release-paper hover:border-release-paper-muted hover:bg-[#22251d] aria-expanded:bg-[#22251d]',
        ghost: 'border-transparent bg-transparent text-release-paper-muted hover:border-release-seam hover:bg-[#171914] hover:text-release-paper aria-expanded:bg-[#171914]',
        destructive: 'border-release-destructive bg-release-destructive text-white hover:border-[#f16659] hover:bg-[#f16659] focus-visible:ring-release-destructive',
        link: 'border-transparent bg-transparent text-release-blaze underline-offset-4 hover:text-[#ff7958] hover:underline',
      },
      size: {
        'default': 'h-10 gap-2 px-4 in-data-[slot=button-group]:rounded-[0.35rem] has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3',
        'xs': 'h-6 gap-1 rounded-[min(var(--radius-md),8px)] px-2 text-xs in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*=size-])]:size-3',
        'sm': 'h-8 gap-1.5 px-3 in-data-[slot=button-group]:rounded-[0.35rem] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        // h-11 (44px), not shadcn's h-10: `lg` is what every primary CTA uses,
        // and 44px is the minimum comfortable touch target on mobile.
        'lg': 'h-11 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4',
        'icon': 'size-9',
        'icon-xs': 'size-6 rounded-[min(var(--radius-md),8px)] in-data-[slot=button-group]:rounded-md [&_svg:not([class*=size-])]:size-3',
        'icon-sm': 'size-8 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-md',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)
export type ButtonVariants = VariantProps<typeof buttonVariants>
