"use client"
import { useSelectedUser } from '@/store/useSelectedUser'
import Sidebar from '../Sidebar'
import MessageContainer from './MessageContainer'
import { User } from '@/types/user'
import { MessageCircle, ArrowUpRight } from 'lucide-react'

const ChatLayout = ({ users }: { defaultLayout: number[] | undefined, users: User[] }) => {
  const { selectedUser } = useSelectedUser()
  return <div className={`chat-app ${selectedUser ? 'thread-open' : ''}`}>
    <div className="inbox-pane"><Sidebar users={users} isCollapsed={false}/></div>
    <section className="thread-pane" aria-label="Conversation">
      {selectedUser ? <MessageContainer /> : <div className="welcome-panel"><div className="welcome-mark"><MessageCircle size={26}/></div><p className="eyebrow">A LITTLE MORE HUMAN</p><h1>Good conversations<br/><em>start here.</em></h1><p className="welcome-copy">Choose a conversation to pick up where you left off.</p><div className="welcome-note"><span className="signal-dot"/> Your messages are ready when you are <ArrowUpRight size={15}/></div></div>}
    </section>
  </div>
}
export default ChatLayout
