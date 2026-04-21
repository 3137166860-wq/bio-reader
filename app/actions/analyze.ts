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

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY 未配置')
  }

  const systemPrompt = `你是一个生物医学 AI 助手。请分析以下论文，并只返回严格的 JSON 对象，不能包含任何 markdown 代码块标记。JSON 必须严格包含三个键：core_conclusion (字符串), materials (字符串数组), protocol_steps (字符串数组)。`

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: truncatedText },
      ],
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '未知错误' }))
    throw new Error(`AI 分析失败: ${error.error || '未知错误'}`)
  }

  const data = await response.json()
  const rawContent = data.choices?.[0]?.message?.content
  if (!rawContent) {
    throw new Error('AI 返回了空的响应')
  }

  // 安全剔除可能的 ```json 标记
  const cleanedContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim()

  let analysis: AnalysisResult
  try {
    analysis = JSON.parse(cleanedContent)
  } catch {
    throw new Error('AI 返回了无效的 JSON 格式')
  }

  // 验证必需字段
  if (!analysis.core_conclusion || !Array.isArray(analysis.materials) || !Array.isArray(analysis.protocol_steps)) {
    throw new Error('AI 返回的 JSON 缺少必要字段')
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