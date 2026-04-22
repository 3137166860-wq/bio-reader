import { NextRequest } from 'next/server'
import { generateText, streamObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createClient } from '@/app/lib/supabase/server'
import { after } from 'next/server'
import {
  ClassificationSchema,
  AnalysisResultSchema,
  type PaperCategory,
} from '@/app/lib/schema/analysis'

export const runtime = 'edge'
export const maxDuration = 60

// ── DeepSeek provider (OpenAI-compatible) ──────────────
const deepseek = (createOpenAI as any)({
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: process.env.DEEPSEEK_API_KEY ?? '',
  compatibility: 'compatible', // 核心补丁：强制使用基础 OpenAI 协议
})

const model = deepseek.chat('deepseek-chat')

// ── System prompts ─────────────────────────────────────

const STAGE1_SYSTEM_PROMPT = `You are a biomedical paper classifier. Analyze the paper text and classify it into ONE of the following categories:

- in_vivo: Animal model studies (mice, rats, zebrafish, etc.) with in vivo experiments
- in_vitro: Cell culture / in vitro experiments (cell lines, primary cells, etc.)
- clinical_trial: Human clinical trials of any phase
- omics: Omics studies (genomics, transcriptomics, proteomics, metabolomics, etc.)
- methodology: New method/technique development papers
- review: Review articles, meta-analyses, systematic reviews
- other: Papers that don't fit the above categories

Respond with a JSON object containing:
- "category": one of the above strings
- "confidence": a number between 0 and 1
- "rationale": a brief 1-sentence explanation

IMPORTANT: You must respond in valid JSON format.`

const STAGE2_SYSTEM_PROMPT = `You are a biomedical NER (Named Entity Recognition) specialist. Extract structured bio-med entities from the paper text.

For each entity, extract:
1. "target": The biological target, molecule, gene, or protein (e.g. "PD-L1", "EGFR", "CD8+ T cells")
2. "animal_model": The model system used (e.g. "C57BL/6 mice", "Sprague-Dawley rats", "MCF-7 cells")
3. "dose": Dosage or concentration information (e.g. "10 mg/kg", "5 μM", "2×10^6 cells/mouse")
4. "efficacy": The efficacy result or outcome measurement (e.g. "Tumor reduction 45%", "IC50 = 0.3 nM")
5. "source_text": The VERBATIM sentence from the text that supports this extraction. Must be an exact substring from the input text.

Extract ALL entities you can find. Be comprehensive. If a field is not explicitly mentioned, leave it as an empty string.

Also extract the "paper_title" field if you can identify it from the text.

IMPORTANT: Respond ONLY with a valid JSON object.`

// ── POST handler ───────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, pdfName, clientTimestamp = Date.now() } = body as {
      text: string
      pdfName: string
      clientTimestamp?: number
    }

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid text' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ── Auth check ─────────────────────────────────────
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // ── Stage 1: Classify (改用 generateText 手动解析，确保 100% 成功) ──
    // 理由：generateText 的 responseFormat 选项更底层，不容易被 SDK 篡改
    const classificationResponse = await (generateText as any)({
      model,
      system: STAGE1_SYSTEM_PROMPT + "\n\nAlways respond in JSON format.",
      prompt: `Classify the following paper:\n\n${text.substring(0, 4000)}`,
      temperature: 0.1,
      // 显式指定 OpenAI 兼容的 json_object 模式
      responseFormat: { type: 'json_object' },
    })

    // 手动解析并校验（因为我们绕过了 generateObject）
    let classification: any
    try {
      classification = ClassificationSchema.parse(JSON.parse(classificationResponse.text))
    } catch (e) {
      console.error("Classification parse error:", e)
      throw new Error("Failed to parse AI classification")
    }

    // ── Create initial record (atomic insert) ──────────
    const { data: record, error: insertError } = await supabase
      .from('analysis_history')
      .insert({
        user_id: user.id,
        pdf_name: pdfName,
        extracted_text: text.substring(0, 1000),
        extracted_json: {
          paper_title: '',
          entities: [],
          dimensions: {
            category: classification.category,
            dimensions: {},
          },
        },
        category: classification.category,
        client_timestamp: clientTimestamp,
      })
      .select('id')
      .single()

    if (insertError || !record) {
      console.error('Failed to create initial record:', insertError)
      throw new Error('Failed to create analysis record')
    }

    const recordId = record.id

    // ── Stage 2: Stream entities (改用 streamObject + 协议降级) ──
    const result = await (streamObject as any)({
      model,
      schema: AnalysisResultSchema,
      // 强制声明 mode: 'json' 告知 SDK 不要尝试生成 json_schema
      mode: 'json',
      system: `${STAGE2_SYSTEM_PROMPT}\n\nPaper category: ${classification.category}\n\nIMPORTANT: Respond ONLY with a valid JSON object.`,
      prompt: `Extract all biomedical entities from this paper:\n\n${text}`,
      temperature: 0.1,
      maxOutputTokens: 4096,
      onFinish: async ({ object: analysisResult }: { object?: any }) => {
        if (!analysisResult) return

        // ── Atomic persistence via after() ──────────
        // Keeps the runtime alive to complete the DB write
        // even after the HTTP response has been flushed.
        after(async () => {
          const s = await createClient()
          const { error: updateError } = await s.rpc(
            'update_analysis_atomic',
            {
              p_id: recordId,
              p_extracted_json: {
                ...analysisResult,
                classification,
              },
              p_client_timestamp: clientTimestamp,
            }
          )

          if (updateError) {
            console.error('Atomic update failed:', updateError)
          }
        })
      },
    })

    // Return SSE stream with record ID in response header
    return result.toTextStreamResponse({
      headers: {
        'X-Analysis-Id': recordId,
        'X-Category': classification.category,
      },
    })
  } catch (error) {
    console.error('Analysis API error:', error)
    return new Response(
      JSON.stringify({
        error: 'Analysis failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
