import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import Image from 'next/image'

export default function OrganizationAvatar({ src, name, className }: { src: string | null | undefined, name: string, className?: string }) {
  return (
    <Avatar className={cn("rounded-md", className)}>
      {src ? (
        <Image
          src={src}
          alt={name}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover object-center"
          quality={90}
          priority={false}
        />
      ) : null}
      <AvatarFallback className="rounded-md text-primary uppercase font-bold">
        {name.substring(0, 2)}
      </AvatarFallback>
    </Avatar>
  );
}
