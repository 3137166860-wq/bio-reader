'use server'

import { createClient } from '@/app/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { AnalysisResult, PaperCategory } from '@/app/lib/schema/analysis'

// ── Persistence: save completed analysis to Supabase ──
// Primary path: the Edge API route handles persistence via
// streamObject.onFinish + after(). This Server Action is a
// client-side fallback for retries / manual saves.

export async function saveAnalysis(
  text: string,
  pdfName: string,
  analysisResult: AnalysisResult,
  category: PaperCategory
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('未登录')
  }

  const { error } = await supabase.from('analysis_history').insert({
    user_id: user.id,
    pdf_name: pdfName,
    extracted_text: text.substring(0, 1000),
    extracted_json: analysisResult,
    category,
  })

  if (error) {
    console.error('Supabase insert error:', error)
    throw new Error('保存记录失败')
  }

  revalidatePath('/')
  return { success: true }
}

// ── Atomic patch with LWW conflict resolution ─────────
// Used by the Edge API route for race-condition-free updates.
// Can also be called from client as a fallback.

export async function patchAnalysisAtomic(
  recordId: string,
  extractedJson: AnalysisResult & { classification?: unknown },
  clientTimestamp: number
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('未登录')
  }

  // Verify ownership
  const { data: record } = await supabase
    .from('analysis_history')
    .select('id, client_timestamp')
    .eq('id', recordId)
    .eq('user_id', user.id)
    .single()

  if (!record) {
    throw new Error('记录不存在')
  }

  // LWW: skip if existing timestamp is newer
  if (
    record.client_timestamp !== null &&
    record.client_timestamp > clientTimestamp
  ) {
    console.warn(
      `LWW: stale update (existing=${record.client_timestamp}, incoming=${clientTimestamp}), skipping`
    )
    return { skipped: true }
  }

  const { error } = await supabase
    .from('analysis_history')
    .update({
      extracted_json: extractedJson as Record<string, unknown>,
      client_timestamp: clientTimestamp,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recordId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Atomic patch error:', error)
    throw new Error('更新记录失败')
  }

  revalidatePath('/')
  return { success: true }
}

// ── History retrieval ──────────────────────────────────

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

// ── History deletion ───────────────────────────────────

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

  revalidatePath('/')
}
