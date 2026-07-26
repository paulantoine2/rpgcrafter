import { Slider as SliderPrimitive } from '@base-ui/react/slider';
import { cn } from '@/lib/utils';

function Slider({ className, 'aria-label': ariaLabel, ...props }: SliderPrimitive.Root.Props<number>) {
  return <SliderPrimitive.Root
    data-slot="slider"
    className={cn('relative flex w-full touch-none select-none items-center data-disabled:cursor-not-allowed data-disabled:opacity-50', className)}
    aria-label={ariaLabel}
    {...props}
  >
    <SliderPrimitive.Control className="relative flex h-5 w-full items-center">
      <SliderPrimitive.Track data-slot="slider-track" className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20">
        <SliderPrimitive.Indicator data-slot="slider-indicator" className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        data-slot="slider-thumb"
        index={0}
        getAriaLabel={() => ariaLabel || 'Slider'}
        className="block size-4 shrink-0 rounded-full border border-primary bg-background shadow-sm outline-none transition-[color,box-shadow] hover:ring-4 hover:ring-primary/15 focus-visible:ring-4 focus-visible:ring-ring/25 disabled:pointer-events-none"
      />
    </SliderPrimitive.Control>
  </SliderPrimitive.Root>;
}

export { Slider };
