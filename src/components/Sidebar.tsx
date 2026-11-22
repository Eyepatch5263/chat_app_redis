"use client"
import { useMemo, useState } from 'react'
import { ScrollArea } from './ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Button } from './ui/button'
import { Search, SlidersHorizontal, Heart, LogOut, Plus } from 'lucide-react'
import { LogoutLink } from '@kinde-oss/kinde-auth-nextjs/components'
import { User } from '@/types/user'
import { useSelectedUser } from '@/store/useSelectedUser'
import { useKindeBrowserClient } from "@kinde-oss/kinde-auth-nextjs"
import PreferencesTab from './PreferencesTab'

const Sidebar = ({ users }: { isCollapsed: boolean, users: User[] }) => {
  const { selectedUser, setSelectedUser } = useSelectedUser()
  const { user } = useKindeBrowserClient()
  const [search, setSearch] = useState('')
  const filteredUsers = useMemo(() => users.filter(item => item.name.toLowerCase().includes(search.toLowerCase()) || item.email.toLowerCase().includes(search.toLowerCase())), [users, search])
  const initials = (name: string) => name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()
  return <aside className="chat-sidebar">
    <header className="sidebar-head">
      <a className="brand-lockup" href="/" aria-label="Chatie home"><span className="brand-mark"><Heart size={18} strokeWidth={2.3} fill="currentColor" /></span><span>chatie<span className="brand-period">.</span></span></a>
      <div className="sidebar-actions"><PreferencesTab /><button aria-label="New conversation" className="icon-button"><Plus size={19}/></button></div>
    </header>
    <div className="sidebar-intro"><div className="eyebrow">JUST BETWEEN YOU</div><div className="inbox-title">Messages <span>{users.length.toString().padStart(2,'0')}</span></div></div>
    <div className="search-wrap"><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a conversation" aria-label="Find a conversation"/><button aria-label="Search options" className="filter-button"><SlidersHorizontal size={16}/></button></div>
    <div className="section-label"><span>ALL CONVERSATIONS</span><span className="section-line"/></div>
    <ScrollArea className="conversation-scroll"><div className="conversation-list">
      {!filteredUsers.length ? <div className="empty-list">{users.length ? 'No conversations match that name.' : 'Your conversations will appear here.'}</div> : filteredUsers.map((person) => {
        const active = selectedUser?.id === person.id
        return <button key={person.id} onClick={() => setSelectedUser(person)} className={`conversation-row ${active ? 'is-selected' : ''}`} aria-current={active ? 'true' : undefined}>
          <span className="avatar-wrap"><Avatar className="conversation-avatar"><AvatarImage src={person.image || undefined} alt=""/><AvatarFallback>{initials(person.name)}</AvatarFallback></Avatar></span>
          <span className="conversation-copy"><span className="conversation-top"><span className="conversation-name">{person.name}</span></span><span className="conversation-preview">{person.email}</span></span>
          <span className="row-arrow" aria-hidden="true">↗</span>
        </button>
      })}
    </div></ScrollArea>
    <footer className="sidebar-footer"><Avatar className="profile-avatar"><AvatarImage src={user?.picture || '/user-placeholder.png'} alt=""/><AvatarFallback>{(user?.given_name?.[0] || 'Y').toUpperCase()}</AvatarFallback></Avatar><div className="profile-copy"><span className="profile-name">{`${user?.given_name ?? ''} ${user?.family_name ?? ''}`.trim() || 'Your account'}</span><span className="profile-caption">Your private corner</span></div><LogoutLink className="logout-button" aria-label="Sign out"><LogOut size={17}/></LogoutLink></footer>
  </aside>
}
export default Sidebar
