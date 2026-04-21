'use client'

import { createClient } from '@/app/lib/supabase/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)
  const supabase = createClient()
  const router = useRouter()

  const MAX_ATTEMPTS = 5
  const locked = attempts >= MAX_ATTEMPTS

  const resetError = () => setError(null)
  const incrementAttempts = () => setAttempts(prev => prev + 1)
  const resetAttempts = () => setAttempts(0)

  const validateInputs = () => {
    if (!email.trim() || !password.trim()) {
      setError('邮箱和密码不能为空！')
      return false
    }
    return true
  }

  const handleSignUp = async () => {
    if (locked) {
      setError('尝试次数过多，请刷新页面或稍后再试。')
      return
    }
    if (!validateInputs()) return

    setLoading(true)
    resetError()
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) {
        incrementAttempts()
        // 优化注册失败体验
        if (error.message.includes('User already registered')) {
          setError('该邮箱已注册，请直接登录。如未验证，请去邮箱点击确认链接。')
        } else {
          setError(error.message)
        }
      } else {
        resetAttempts()
        alert('注册成功！请检查邮箱验证链接。')
      }
    } catch (err: unknown) {
      incrementAttempts()
      setError(err instanceof Error ? err.message : '注册失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSignIn = async () => {
    if (locked) {
      setError('尝试次数过多，请刷新页面或稍后再试。')
      return
    }
    if (!validateInputs()) return

    setLoading(true)
    resetError()
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) {
        incrementAttempts()
        setError(error.message)
      } else {
        resetAttempts()
        router.refresh()
      }
    } catch (err: unknown) {
      incrementAttempts()
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
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
      {locked && (
        <div className="bg-yellow-50 text-yellow-800 p-3 rounded mb-4">
          尝试次数过多，请刷新页面或稍后再试。
        </div>
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
            disabled={loading || locked}
            className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '处理中...' : '登录'}
          </button>
          <button
            onClick={handleSignUp}
            disabled={loading || locked}
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