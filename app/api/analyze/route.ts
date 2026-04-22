import { NextRequest } from 'next/server'
import { generateText, streamText } from 'ai'
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
  compatibility: 'compatible', // 核心补丁：强制使用基础 OpenAI 协议，避免 json_schema 升级
})

const model = deepseek.chat('deepseek-chat')

// ── System prompts ─────────────────────────────────────
// 注意：两个 prompt 都包含 "JSON" 关键字，确保 DeepSeek 正确识别输出格式要求

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

IMPORTANT: You must respond with valid JSON only. No markdown, no code fences, no extra text.`

const STAGE2_SYSTEM_PROMPT = `You are a biomedical NER (Named Entity Recognition) specialist. Extract structured bio-med entities from the paper text.

For each entity, extract:
1. "target": The biological target, molecule, gene, or protein (e.g. "PD-L1", "EGFR", "CD8+ T cells")
2. "animal_model": The model system used (e.g. "C57BL/6 mice", "Sprague-Dawley rats", "MCF-7 cells")
3. "dose": Dosage or concentration information (e.g. "10 mg/kg", "5 μM", "2×10^6 cells/mouse")
4. "efficacy": The efficacy result or outcome measurement (e.g. "Tumor reduction 45%", "IC50 = 0.3 nM")
5. "source_text": The VERBATIM sentence from the text that supports this extraction. Must be an exact substring from the input text.

Extract ALL entities you can find. Be comprehensive. If a field is not explicitly mentioned, leave it as an empty string.

Also extract the "paper_title" field if you can identify it from the text.

IMPORTANT: Respond ONLY with a valid JSON object. No markdown, no code fences, no extra text.`

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

    // ── Stage 1: Classification via generateText ────────
    // 使用 generateText + responseFormat.json_object 而非 generateObject，
    // 因为 DeepSeek 不支持 json_schema（Structured Outputs 升级协议）。
    const stage1Text = text.substring(0, 1500)

    // 使用 (generateText as any) 绕过 TS 类型，因为 AI SDK v6 的 generateText 类型中不包含 responseFormat。
    // 但底层 @ai-sdk/openai provider 支持 responseFormat，会将其转为 HTTP 请求中的 response_format。
    const classificationResponse = await (generateText as any)({
      model,
      system: STAGE1_SYSTEM_PROMPT,
      prompt: `Classify:\n\n${stage1Text}`,
      temperature: 0.1,
      responseFormat: { type: 'json_object' },
    })

    // 手动解析 JSON 字符串回 ClassificationSchema
    let classification: { category: PaperCategory; confidence: number; rationale: string }
    try {
      const parsed = JSON.parse(classificationResponse.text)
      classification = ClassificationSchema.parse(parsed)
    } catch (parseError) {
      console.error('Classification JSON parse failed:', parseError, 'Raw:', classificationResponse.text)
      throw new Error('Failed to parse classification result')
    }

    // ── 立即生成 recordId，数据库写入延迟到流结束后 ──
    const tempRecordId = crypto.randomUUID()

    // ── Stage 2: Streaming NER extraction ───────────────
    // 彻底废弃 streamObject，改用 streamText 强制降级为 json_object 协议，避免 DeepSeek 400 崩溃。
    const result = (streamText as any)({
      model,
      system: `${STAGE2_SYSTEM_PROMPT}\n\nCategory: ${classification.category}`,
      prompt: `Extract from:\n\n${text}`,
      temperature: 0.1,
      // 使用实验性标志强制 DeepSeek 返回旧版 json_object，避免 400 崩溃
      experimental_providerMetadata: {
        openai: { responseFormat: { type: 'json_object' } }
      } as any,
      onFinish: async ({ text: rawText }: { text: string }) => {
        // 原来的持久化逻辑保持不变，但需尝试 JSON.parse(rawText) 获取分析结果
        try {
          const analysisResult = JSON.parse(rawText)
          after(async () => {
            const s = await createClient()
            const { error: updateError } = await s.rpc(
              'update_analysis_atomic',
              {
                p_id: tempRecordId,
                p_extracted_json: {
                  ...analysisResult,
                  classification,
                },
                p_client_timestamp: clientTimestamp,
                p_meta: {
                  pdf_name: pdfName,
                  user_id: user.id,
                },
              }
            )

            if (updateError) {
              console.error('Atomic update failed:', updateError)
            }
          })
        } catch(e) {
          console.error("Final JSON parse failed", e)
        }
      },
    })

    // 返回流式响应，客户端将接收到纯文本块
    return result.toTextStreamResponse({
      headers: {
        'X-Analysis-Id': tempRecordId,
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
