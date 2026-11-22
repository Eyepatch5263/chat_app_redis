"use client"
import { useSelectedUser } from '@/store/useSelectedUser'
import Sidebar from '../Sidebar'
import MessageContainer from './MessageContainer'
import { User } from '@/types/user'
import { Heart, ArrowUpRight } from 'lucide-react'

const ChatLayout = ({ users }: { defaultLayout: number[] | undefined, users: User[] }) => {
  console.log("users",users)
  const { selectedUser } = useSelectedUser()
  return <div className={`chat-app ${selectedUser ? 'thread-open' : ''}`}>
    <div className="inbox-pane"><Sidebar users={users} isCollapsed={false}/></div>
    <section className="thread-pane" aria-label="Conversation">
      {selectedUser ? <MessageContainer /> : <div className="welcome-panel"><div className="welcome-mark"><Heart size={25} fill="currentColor"/></div><p className="eyebrow">FOR YOUR FAVORITE PERSON</p><h1>A little closer,<br/><em>every day.</em></h1><p className="welcome-copy">Choose your person and pick up where the two of you left off.</p><div className="welcome-note"><span className="signal-dot"/> A little space for the moments you share <ArrowUpRight size={15}/></div></div>}
    </section>
  </div>
}
export default ChatLayout
