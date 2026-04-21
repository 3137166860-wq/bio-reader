'use server'

import { createClient } from '@/app/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type AnalysisResult = {
  core_conclusion: string
  materials: string[]
  protocol_steps: string[]
}

export async function analyzePDF(text: string, pdfName: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('未登录')
  }

  if (!text || typeof text !== 'string') {
    throw new Error('无效的文本输入')
  }

  // 可选：限制文本长度
  const truncatedText = text.length > 10000 ? text.substring(0, 10000) : text

  // Call internal DeepSeek API route
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/deepseek`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: truncatedText }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`AI 分析失败: ${error.error || '未知错误'}`)
  }

  let analysis: AnalysisResult
  try {
    analysis = await response.json()
  } catch {
    throw new Error('AI 返回了无效的 JSON 格式')
  }

  // Save to Supabase
  const { error } = await supabase.from('analysis_history').insert({
    user_id: user.id,
    pdf_name: pdfName,
    extracted_text: truncatedText.substring(0, 1000), // store first 1000 chars for reference
    extracted_json: analysis,
  })

  if (error) {
    console.error('Supabase insert error:', error)
    throw new Error('保存记录失败')
  }

  revalidatePath('/history')
  return analysis
}

export async function getHistory() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const { data, error } = await supabase
    .from('analysis_history')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Supabase fetch error:', error)
    return []
  }

  return data
}

export async function deleteHistory(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('未登录')
  }

  const { error } = await supabase
    .from('analysis_history')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Supabase delete error:', error)
    throw new Error('删除失败')
  }

  revalidatePath('/history')
}