'use client'

import dynamic from 'next/dynamic'

// 在这个客户端组件中动态引入真正的 UploadForm，并关闭 SSR
const UploadForm = dynamic(() => import('./UploadForm'), { 
  ssr: false,
  loading: () => <div className="p-4 text-center text-gray-500">加载上传组件中...</div>
})

export default function ClientUploadForm() {
  return <UploadForm />
}