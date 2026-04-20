'use client'

import { createClient } from '@/app/lib/supabase/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  const handleSignUp = async () => {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setError(error.message)
    } else {
      alert('注册成功！请检查邮箱验证链接。')
    }
    setLoading(false)
  }

  const handleSignIn = async () => {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) {
      setError(error.message)
    } else {
      router.refresh()
    }
    setLoading(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.refresh()
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Bio‑Reader 身份验证</h2>
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded mb-4">{error}</div>
      )}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">邮箱</label>
          <input
            type="email"
            className="w-full p-2 border rounded"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">密码</label>
          <input
            type="password"
            className="w-full p-2 border rounded"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '处理中...' : '登录'}
          </button>
          <button
            onClick={handleSignUp}
            disabled={loading}
            className="flex-1 bg-gray-200 text-gray-800 py-2 rounded hover:bg-gray-300 disabled:opacity-50"
          >
            注册
          </button>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full mt-4 text-sm text-gray-500 hover:text-gray-700"
        >
          退出登录
        </button>
      </div>
    </div>
  )
}