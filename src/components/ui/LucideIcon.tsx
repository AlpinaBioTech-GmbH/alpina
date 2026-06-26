import * as LucideIcons from 'lucide-react'
import type { LucideProps } from 'lucide-react'

interface Props extends LucideProps {
  name: string
}

export function LucideIcon({ name, ...props }: Props) {
  const Icon = LucideIcons[name as keyof typeof LucideIcons] as React.FC<LucideProps> | undefined
  if (!Icon) return null
  return <Icon {...props} />
}
