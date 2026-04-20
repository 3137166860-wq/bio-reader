import { createClient } from '@/app/lib/supabase/server'
import UploadForm from '@/app/components/UploadForm'
import HistoryPanel from '@/app/components/HistoryPanel'
import LoginForm from '@/app/components/auth/LoginForm'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <header className="py-8 text-center">
            <h1 className="text-4xl font-bold text-gray-900">Bio‑Reader</h1>
            <p className="text-gray-600 mt-2">AI 驱动的生物医学 PDF 分析平台</p>
          </header>
          <div className="mt-12">
            <LoginForm />
          </div>
          <footer className="mt-16 text-center text-gray-500 text-sm">
            <p>使用 Supabase 认证 + DeepSeek AI + PDF 文本提取</p>
          </footer>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center py-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Bio‑Reader</h1>
            <p className="text-gray-600 mt-2">
              欢迎回来，{user.email?.split('@')[0]}！上传 PDF 即可获得 AI 分析。
            </p>
          </div>
          <form
            action="/auth/signout"
            method="post"
            className="mt-4 md:mt-0"
          >
            <button
              type="submit"
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-800"
            >
              退出登录
            </button>
          </form>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          <div className="lg:col-span-2 space-y-8">
            <section className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-4">上传与分析</h2>
              <UploadForm />
            </section>

            <section className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-4">分析结果示例</h2>
              <div className="text-gray-700 space-y-3">
                <p>
                  上传 PDF 后，AI 将自动提取：
                </p>
                <ul className="list-disc pl-5">
                  <li>
                    <strong>核心结论</strong> – 实验的主要发现
                  </li>
                  <li>
                    <strong>材料列表</strong> – 使用的试剂、设备
                  </li>
                  <li>
                    <strong>实验步骤</strong> – 详细的 protocol 流程
                  </li>
                </ul>
                <p className="text-sm text-gray-500">
                  所有分析结果会保存到您的个人历史记录中，随时可查。
                </p>
              </div>
            </section>
          </div>

          <div className="lg:col-span-1">
            <HistoryPanel />
          </div>
        </div>

        <footer className="mt-16 text-center text-gray-500 text-sm">
          <p>Powered by Next.js 16, Supabase, DeepSeek AI, and pdfjs‑dist</p>
        </footer>
      </div>
    </div>
  )
}
