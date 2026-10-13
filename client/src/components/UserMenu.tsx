import { ChevronDown, LogOut, Shield, User as UserIcon } from 'lucide-react'
import type { User } from '@/api/files'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Props {
  user: User
  onProfile: () => void
  onAdmin: () => void
  onSignOut: () => void
}

const initial = (u: User) => u.name[0]?.toUpperCase() ?? '?'

export function UserMenu({ user, onProfile, onAdmin, onSignOut }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Account menu for ${user.name}`}
          className="group flex h-11 items-center gap-2.5 rounded-full border border-line-strong bg-white py-1 pl-1.5 pr-3.5 font-sans text-[15px] font-medium text-ink transition-colors hover:bg-fill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-fill"
        >
          <span className="grid size-8 place-items-center rounded-full bg-blue-tint text-sm font-semibold text-blue-ink" aria-hidden="true">
            {initial(user)}
          </span>
          <span className="hidden max-w-[200px] truncate sm:inline">{user.name}</span>
          <ChevronDown className="size-4 text-mute transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="flex items-center gap-3.5 px-3 pb-3 pt-2.5">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-blue-tint text-base font-semibold text-blue-ink" aria-hidden="true">
            {initial(user)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium" title={user.name}>{user.name}</p>
            {user.isAdmin && (
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-white">
                <Shield className="size-3" aria-hidden="true" />
                Admin
              </span>
            )}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onProfile}>
          <UserIcon aria-hidden="true" />
          Profile
        </DropdownMenuItem>
        {user.isAdmin && (
          <DropdownMenuItem onSelect={onAdmin}>
            <Shield aria-hidden="true" />
            Admin panel
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={onSignOut}>
          <LogOut aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
