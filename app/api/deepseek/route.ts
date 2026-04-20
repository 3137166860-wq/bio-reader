import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

/**
 * Cleans JSON string from common LLM response artifacts:
 * - Removes Markdown code blocks (```json ... ```)
 * - Removes leading/trailing whitespace
 * - Extracts first JSON object if multiple present
 */
function cleanJsonResponse(raw: string): string {
  // Remove Markdown code block markers
  let cleaned = raw.replace(/```(?:json)?\n?/g, '')
  // Trim whitespace
  cleaned = cleaned.trim()
  // Find first { ... } or [ ... ] block
  const firstBrace = cleaned.indexOf('{')
  const firstBracket = cleaned.indexOf('[')
  const start = firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket)
    ? firstBrace
    : firstBracket >= 0 ? firstBracket : 0
  const end = cleaned.lastIndexOf(start === firstBrace ? '}' : ']') + 1
  if (end > start && start >= 0) {
    cleaned = cleaned.substring(start, end)
  }
  return cleaned
}

const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com'
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY

// Define expected JSON structure
export type DeepSeekAnalysis = {
  core_conclusion: string
  materials: string[]
  protocol_steps: string[]
}

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid text' },
        { status: 400 }
      )
    }

    if (!DEEPSEEK_API_KEY) {
      console.error('DEEPSEEK_API_KEY is not configured')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const prompt = `
你是一位专业的生物医学研究员。请分析以下实验文档（PDF 提取文本），并输出一个严格的 JSON 对象，包含以下三个字段：

1. "core_conclusion": 字符串，总结实验的核心结论（1-3句话）。
2. "materials": 字符串数组，列出实验中用到的主要材料、试剂或设备。
3. "protocol_steps": 字符串数组，按顺序描述实验步骤（每一步简洁明了）。

请确保输出 **只有 JSON**，不要有任何额外的解释、Markdown 代码块或文本。

文档内容：
${text.substring(0, 8000)} // 限制输入长度
`

    const response = await fetch(`${DEEPSEEK_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你输出严格的 JSON，不包含任何额外文本。',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('DeepSeek API error:', response.status, errorText)
      return NextResponse.json(
        { error: 'AI analysis failed', details: errorText },
        { status: 502 }
      )
    }

    const result = await response.json()
    const content = result.choices[0]?.message?.content

    if (!content) {
      throw new Error('No content in response')
    }

    // Clean and parse JSON from response
    const cleanedContent = cleanJsonResponse(content)
    let parsed: DeepSeekAnalysis
    try {
      parsed = JSON.parse(cleanedContent)
    } catch {
      // Fallback: try to parse the original content if cleaning broke something
      try {
        parsed = JSON.parse(content)
      } catch (e) {
        throw new Error('Failed to parse AI response as JSON')
      }
    }

    // Validate structure
    if (
      !parsed.core_conclusion ||
      !Array.isArray(parsed.materials) ||
      !Array.isArray(parsed.protocol_steps)
    ) {
      throw new Error('Invalid response structure')
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('DeepSeek route error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}