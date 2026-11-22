"use client"
import React, { useState } from 'react'
import { RegisterLink, LoginLink } from "@kinde-oss/kinde-auth-nextjs/components"
import { ArrowUpRight } from 'lucide-react'

const AuthButtons = () => {
  const [isLoading, setIsLoading] = useState(false)
  return <div className="auth-actions">
    <RegisterLink className={`auth-primary ${isLoading ? 'is-loading' : ''}`} onClick={() => setIsLoading(true)} aria-disabled={isLoading}>Create an account <ArrowUpRight size={17}/></RegisterLink>
    <LoginLink className="auth-secondary" onClick={() => setIsLoading(true)}>I already have an account</LoginLink>
  </div>
}
export default AuthButtons
