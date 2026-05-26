import { cn } from '@/lib/utils';
import { ESTADO_LABEL } from '@/lib/utils';

export function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span className={cn('badge', `badge-${estado}`)}>
      {ESTADO_LABEL[estado] || estado}
    </span>
  );
}
