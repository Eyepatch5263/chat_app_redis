import { MessageCircle, ArrowUpRight, LockKeyhole } from 'lucide-react'
import AuthButtons from './AuthButtons'
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
import { redirect } from 'next/navigation'

const Page = async () => {
  const { isAuthenticated } = getKindeServerSession()
  if (await isAuthenticated()) return redirect('/')
  return <main className="auth-shell">
    <section className="auth-main">
      <header className="auth-brand"><span className="brand-mark"><MessageCircle size={20}/></span><span>chatie<span className="brand-period">.</span></span></header>
      <div className="auth-content">
        <p className="eyebrow">A QUIETER KIND OF CONNECTION</p>
        <h1>Make room for<br/><em>good conversation.</em></h1>
        <p className="auth-description">A thoughtful space for the people you want to hear from. Catch up, share a moment, or just say hello.</p>
        <AuthButtons />
        <p className="auth-privacy"><LockKeyhole size={14}/> Your account keeps your conversations yours.</p>
      </div>
      <footer className="auth-footer"><span>Simple, personal messaging.</span><span>01 — 01</span></footer>
    </section>
    <aside className="auth-aside" aria-label="About Chatie">
      <div className="auth-art"><span className="art-orbit orbit-one"/><span className="art-orbit orbit-two"/><div className="art-note"><span className="art-note-icon"><MessageCircle size={18}/></span><div><strong>Better with people.</strong><span>Right where you left off.</span></div><ArrowUpRight size={16}/></div></div>
      <div className="aside-caption"><span>LESS NOISE. MORE MEANING.</span><span>CHT—001</span></div>
    </aside>
  </main>
}
export default Page
