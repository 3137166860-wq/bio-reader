'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/client'

export default function SignOutButton() {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.refresh() // 刷新页面以更新 UI（将重定向到登录页）
  }

  return (
    <button
      onClick={handleSignOut}
      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-800"
    >
      退出登录
    </button>
  )
}