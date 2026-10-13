import { Toaster as Sonner } from 'sonner'

const Toaster = (props: React.ComponentProps<typeof Sonner>) => (
  <Sonner
    theme="dark"
    position="bottom-center"
    toastOptions={{
      unstyled: true,
      classNames: {
        toast:
          'flex w-full max-w-[420px] items-start gap-2.5 rounded-2xl bg-ink px-4 py-2.5 text-[13.5px] font-medium text-white shadow-[0_12px_32px_-8px_oklch(0.2_0.01_260/0.4)]',
        error: '!bg-[oklch(0.42_0.16_25)]',
        title: 'font-medium',
        description: 'mt-0.5 whitespace-pre-line text-[12.5px] font-normal opacity-80',
        icon: 'mt-0.5',
      },
    }}
    {...props}
  />
)

export { Toaster }
